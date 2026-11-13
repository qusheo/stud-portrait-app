# Модуль статистики и результатов.

from django.db.models import Count, Q

from collections import defaultdict

from ..common import *


# ====== ENDPOINTS ====== #

@method('GET')

@jsonResponse
@csrf_exempt
def courses(request):
    """ Information about course completion for '/admin/courses' page
    """
    # Получаем параметры фильтрации из запроса (если нужны)
    selected_institution_ids = request.GET.getlist('institution_ids[]')
    selected_directions = request.GET.getlist('directions[]')
    
    # Преобразуем в int, если есть значения
    try:
        selected_institution_ids = list(map(int, selected_institution_ids)) if selected_institution_ids else []
    except ValueError:
        selected_institution_ids = []
    
    try:
        selected_directions = list(map(int, selected_directions)) if selected_directions else []
    except ValueError:
        selected_directions = []

    # Базовый запрос
    courses_qs = Courseresults.objects.all().select_related('course_participant')
    
    # Применяем фильтры, если они переданы
    if selected_institution_ids:
        # Фильтруем через Participants → Results (учебная информация теперь в Results)
        # Находим participants, у которых есть Results с нужными institution_ids
        participant_ids = Results.objects.filter(
            res_institution_id__in=selected_institution_ids
        ).values_list('res_participant_id', flat=True).distinct()
        courses_qs = courses_qs.filter(course_participant_id__in=participant_ids)
    
    if selected_directions:
        participant_ids = Results.objects.filter(
            res_edu_specialty_id__in=selected_directions
        ).values_list('res_participant_id', flat=True).distinct()
        courses_qs = courses_qs.filter(course_participant_id__in=participant_ids)

    courses_data = [
        {
            "course_id": course.course_id,
            "participant": {
                "part_id":     course.course_participant.part_id,
                "part_rsv_id":    course.course_participant.part_rsv_id,
                "part_gender": course.course_participant.part_gender,
                # Учебная информация теперь в Results, не в Participants
                # Можно подтянуть из последнего Results, но для производительности оставляем None
                "institution": None,
                "specialty":   None,
                "edu_level":   None,
                "study_form":  None,
            },
            **{c: zeroIfNull(getattr(course, c)) for c in CUR.list}
        }
        for course in courses_qs
    ]

    return {"courses": courses_data}


@method('GET')

@jsonResponse
@csrf_exempt
def get_institution_directions(request):
    """
    Возвращает направления, которые есть в выбранных институтах.
    Извлекает уникальные пары (institution, direction) из таблицы Results.
    """
    institution_ids = request.GET.getlist('institution_ids') or request.GET.getlist('institution_ids[]')

    try:
        institution_ids = list(map(int, institution_ids))
    except Exception:
        institution_ids = []

    if not institution_ids:
        directions = Specialties.objects.all().values('spec_id', 'spec_name').order_by('spec_name')
        result = [{"id": d['spec_id'], "name": d['spec_name']} for d in directions]
    else:
        qs = Results.objects.filter(
            res_institution_id__in=institution_ids,
            res_edu_specialty__isnull=False,
        ).values(
            'res_edu_specialty__spec_id',
            'res_edu_specialty__spec_name',
        ).distinct().order_by('res_edu_specialty__spec_name')
        result = [
            {"id": d['res_edu_specialty__spec_id'], "name": d['res_edu_specialty__spec_name']}
            for d in qs
        ]

    return {"ok": True, "directions": result}


@method('GET')

@jsonResponse
@csrf_exempt
def get_filter_options_with_counts(request):
    """
    Возвращает опции фильтров с количеством записей для каждой.
    С учётом уже выбранных фильтров (cross-filtering).
    
    ВАЖНО: Динамически подсчитывает максимальное количество прохождений!
    """
    selected_institution_values = request.GET.getlist('institution_ids[]')
    selected_direction_values = request.GET.getlist('directions[]')
    selected_courses =         request.GET.getlist('courses[]')
    selected_test_attempts =   request.GET.getlist('test_attempts[]')

    selected_institution_ids = [int(value) for value in selected_institution_values if str(value).isdigit()]
    institution_names = [value for value in selected_institution_values if not str(value).isdigit()]
    if institution_names:
        selected_institution_ids.extend(
            Institutions.objects.filter(inst_name__in=institution_names).values_list('inst_id', flat=True)
        )

    selected_directions = [int(value) for value in selected_direction_values if str(value).isdigit()]
    direction_names = [value for value in selected_direction_values if not str(value).isdigit()]
    if direction_names:
        selected_directions.extend(
            EducationSpecialties.objects.filter(edu_spec_name__in=direction_names).values_list('edu_spec_id', flat=True)
        )

    # all filters except the current one
    base_results = Results.objects.select_related(
        'res_institution',
        'res_edu_specialty'
    )

    # institutions

    institutions_query = base_results

    if selected_directions:
        institutions_query = institutions_query.filter(
            res_edu_specialty__spec_id__in=selected_directions 
        )

    if selected_courses:
        institutions_query = institutions_query.filter(res_course__in=selected_courses)

    if selected_test_attempts:
        student_attempts = Results.objects \
            .values('res_participant')     \
            .annotate(attempt_count=Count('res_id'))

        attempts_dict = {
            item['res_participant']: item['attempt_count'] 
            for item in student_attempts
        }

        valid_students = [
            student_id 
            for student_id, count in attempts_dict.items()
            if str(count) in selected_test_attempts
        ]

        institutions_query = institutions_query.filter(res_participant__in=valid_students)

    institutions_counts = institutions_query                                                                  \
        .values('res_institution_id')                                                                         \
        .annotate(count=Count('res_id'))                                                                      \
        .order_by('-count')

    _inst_names = dict(Institutions.objects.values_list('inst_id', 'inst_name'))
    institutions_list = [
        {
            "id":    item['res_institution_id'],
            "name":  _inst_names.get(item['res_institution_id']),
            "count": item['count']
        }
        for item in institutions_counts
        if item['res_institution_id'] and _inst_names.get(item['res_institution_id'])
    ]
    # majors

    directions_query = base_results

    if selected_institution_ids:
        directions_query = directions_query.filter(
            res_institution__inst_id__in=selected_institution_ids
        )

    if selected_courses:
        directions_query = directions_query.filter(res_course__in=selected_courses) 

    if selected_test_attempts:
        student_attempts = Results.objects \
            .values('res_participant')     \
            .annotate(attempt_count=Count('res_id'))

        attempts_dict = {
            item['res_participant']: item['attempt_count'] 
            for item in student_attempts
        }

        valid_students = [
            student_id 
            for student_id, count in attempts_dict.items()
            if str(count) in selected_test_attempts
        ]

        directions_query = directions_query.filter(res_participant__in=valid_students)

    directions_counts = directions_query                 \
        .values('res_edu_specialty_id')                  \
        .annotate(count=Count('res_id'))                 \
        .order_by('-count')

    _spec_names = dict(Specialties.objects.values_list('spec_id', 'spec_name'))
    directions_list = [
        {
            "id":    item['res_edu_specialty_id'],
            "name":  _spec_names.get(item['res_edu_specialty_id']),
            "count": item['count']
        }
        for item in directions_counts
        if item['res_edu_specialty_id'] and _spec_names.get(item['res_edu_specialty_id'])
    ]
    # courses

    courses_query = base_results

    if selected_institution_ids:
        courses_query = courses_query.filter(
            res_institution__inst_id__in=selected_institution_ids
        )

    if selected_directions:
        courses_query = courses_query.filter(
            res_edu_specialty__spec_id__in=selected_directions 
        )

    if selected_test_attempts:
        student_attempts = Results.objects \
            .values('res_participant')     \
            .annotate(attempt_count=Count('res_id'))

        attempts_dict = {
            item['res_participant']: item['attempt_count'] 
            for item in student_attempts
        }

        valid_students = [
            student_id 
            for student_id, count in attempts_dict.items()
            if str(count) in selected_test_attempts
        ]

        courses_query = courses_query.filter(res_participant__in=valid_students)

    courses_counts = courses_query       \
        .values('res_course')        \
        .annotate(count=Count('res_id')) \
        .order_by('res_course')

    courses_list = [
        {
            "id":    item['res_course'],
            "name":  f"{item['res_course']} курс",
            "count": item['count']
        }
        for item in courses_counts if item['res_course']
    ]

    # test attempts

    attempts_query = base_results

    if selected_institution_ids:
        attempts_query = attempts_query.filter(
            res_institution__inst_id__in=selected_institution_ids
        )

    if selected_directions:
        attempts_query = attempts_query.filter(
            res_edu_specialty__spec_id__in=selected_directions 
        )

    if selected_courses:
        attempts_query = attempts_query.filter(res_course__in=selected_courses) 

    student_attempts = attempts_query \
        .values('res_participant')    \
        .annotate(attempt_count=Count('res_id'))

    attempts_distribution = defaultdict(int)

    for item in student_attempts:
        attempts_distribution[item['attempt_count']] += 1

    max_attempts = max(attempts_distribution.keys()) if attempts_distribution else 6

    test_attempts_list = [
        {
            "id":    attempts,
            "name":  f"{attempts} прохождение" if attempts == 1 else f"{attempts} прохождения",
            "count": students_count
        }
        for attempts, students_count in sorted(attempts_distribution.items())
    ]

    # competencies

    competencies_data = [
        {'id': comp, 'name': COMP.names[comp]}
        for comp in COMP.list
    ]

    competencies_list = [
        {
            'id':    (comp_field := comp_info['id']),
            'name':  comp_info['name'],
            'count': Results.objects
                .exclude(Q(**{f"{comp_field}__isnull": True}) | Q(**{comp_field: 0}))
                .count()
        }
        for comp_info in competencies_data
    ]

    # Студенты - теперь с именем из StudentMapping
    students_query = Participants.objects         \
        .annotate(results_count=Count('results')) \
        .filter(results_count__gt=0)              \
        .order_by('part_rsv_id')[:1000]  # limit by 1000 for performance

    students_list = []
    for student in students_query:
        try:
            mapping = StudentMapping.objects.get(mapping_rsv=student.part_rsv_id)
            student_name = mapping.mapping_stud_name
        except StudentMapping.DoesNotExist:
            student_name = student.part_rsv_id
            
        students_list.append({
            "id":     student.part_id,
            "rsv_id": f"{student_name} (ID: {student.part_id})",
            "count":  student.results_count
        })

    return {"data": {
        "institutions":  institutions_list,
        "directions":    directions_list,
        "courses":       courses_list,
        "test_attempts": test_attempts_list,
        "competencies":  competencies_list,
        "students":      students_list,
        "max_attempts":  max_attempts
    }}


@method('GET')

@jsonResponse
@csrf_exempt
def centers_by_region(request):
    AVAILABLE_YEARS = '2021/2022', '2022/2023', '2023/2024', '2024/2025', '2025/2026'

    year = request.GET.get('year', '2024/2025')
    if year not in AVAILABLE_YEARS:
        raise ResponseError(f"Invalid year. Available years: {AVAILABLE_YEARS}")

    # Получаем все результаты за выбранный год
    results = Results.objects.filter(res_year=year).select_related('res_center')

    # Считаем количество результатов по центрам
    center_counts = {}
    for result in results:
        if result.res_center:
            center_name = result.res_center.center_name
            center_counts[center_name] = center_counts.get(center_name, 0) + 1

    # Группируем по регионам
    region_stats = {}
    for center_name, count in center_counts.items():
        region = CENTERS_REGIONS.get(center_name)
        if region:  # Игнорируем центры без привязки к региону
            region_stats[region] = region_stats.get(region, 0) + count

    # Формируем данные для карты
    map_data = [
        {'name': region, 'value': count}
        for region, count in region_stats.items()
    ]

    # Находим максимальное значение для шкалы
    max_value = max(region_stats.values()) if region_stats else 0

    return {
        'year': year,
        'data': map_data,
        'max_value': max_value,
        'total_centers': len(region_stats),
        'available_years': AVAILABLE_YEARS
    }


def get_motivator_statistics(request):
    """
    Получение статистики по мотиваторам с возможностью группировки.
    GET параметры:
        - institute: ID института (опционально)
        - specialty: ID направления (опционально)
        - year: год тестирования (опционально)
        - group_by: параметр группировки ('specialty', 'course', 'specialty_course')
    """
    try:
        # Получаем параметры фильтрации
        institute_id = request.GET.get('institute')
        specialty_id = request.GET.get('specialty')
        year = request.GET.get('year')
        group_by = request.GET.get('group_by', 'specialty')  # specialty, course, specialty_course

        # Базовый запрос - учебная информация теперь в Results
        queryset = Results.objects.select_related(
            'res_participant',
            'res_edu_specialty',
            'res_institution'
        )

        # Применяем фильтры
        if institute_id:
            queryset = queryset.filter(res_institution__inst_id=institute_id)
        if specialty_id:
            queryset = queryset.filter(res_edu_specialty__spec_id=specialty_id)
        if year:
            queryset = queryset.filter(res_year=year)

        # Группировка данных
        if group_by == 'specialty':
            # Группировка по направлениям подготовки
            results = []
            specialties = EducationSpecialties.objects.all()
            
            for specialty in specialties:
                specialty_results = queryset.filter(res_edu_specialty=specialty)
                
                if not specialty_results.exists():
                    continue
                    
                motivator_stats = {}
                total_count = specialty_results.count()
                
                for field in MOT.list:
                    # Считаем мотиваторы (600-800)
                    motivator_count = specialty_results.filter(
                        **{f'{field}__gte': 600, f'{field}__lte': 800}
                    ).count()
                    
                    # Считаем демотиваторы (200-399)
                    demotivator_count = specialty_results.filter(
                        **{f'{field}__gte': 200, f'{field}__lte': 399}
                    ).count()
                    
                    motivator_stats[field] = {
                        'motivator_percent': round(motivator_count / total_count * 100, 1) if total_count > 0 else 0,
                        'demotivator_percent': round(demotivator_count / total_count * 100, 1) if total_count > 0 else 0,
                        'total_count': total_count
                    }
                
                results.append({
                    'id': specialty.edu_spec_id,
                    'name': specialty.edu_spec_name,
                    'total_students': total_count,
                    'motivators': motivator_stats
                })
            
            return JsonResponse({
                'ok': True,
                'group_by': 'specialty',
                'data': results
            })
            
        elif group_by == 'course':
            # Группировка по курсам
            results = []
            for course_num in range(1, 5):  # 1-4 курсы
                course_results = queryset.filter(res_course=course_num)
                
                if not course_results.exists():
                    continue
                    
                motivator_stats = {}
                total_count = course_results.count()
                
                for field in MOT.list:
                    motivator_count = course_results                            \
                        .filter(**{f'{field}__gte': 600, f'{field}__lte': 800}) \
                        .count()
                    demotivator_count = course_results                          \
                        .filter(**{f'{field}__gte': 200, f'{field}__lte': 399}) \
                        .count()
                    
                    motivator_stats[field] = {
                        'motivator_percent': round(motivator_count / total_count * 100, 1) if total_count > 0 else 0,
                        'demotivator_percent': round(demotivator_count / total_count * 100, 1) if total_count > 0 else 0,
                        'total_count': total_count
                    }
                
                results.append({
                    'id': course_num,
                    'name': f'{course_num} курс',
                    'total_students': total_count,
                    'motivators': motivator_stats
                })
            
            return JsonResponse({
                'ok': True,
                'group_by': 'course',
                'data': results
            })
            
        elif group_by == 'specialty_course':
            # Группировка по направлениям и курсам
            results = []
            specialties = EducationSpecialties.objects.all()
            
            for specialty in specialties:
                specialty_data = {
                    'id': specialty.edu_spec_id,
                    'name': specialty.edu_spec_name,
                    'courses': []
                }
                
                for course_num in range(1, 5):
                    course_results = queryset.filter(
                        res_edu_specialty=specialty,
                        res_course=course_num
                    )
                    
                    if not course_results.exists():
                        continue
                        
                    motivator_stats = {}
                    total_count = course_results.count()
                    
                    for field in MOT.list:
                        motivator_count = course_results.filter(
                            **{f'{field}__gte': 600, f'{field}__lte': 800}
                        ).count()
                        demotivator_count = course_results.filter(
                            **{f'{field}__gte': 200, f'{field}__lte': 399}
                        ).count()
                        
                        motivator_stats[field] = {
                            'motivator_percent': round(motivator_count / total_count * 100, 1) if total_count > 0 else 0,
                            'demotivator_percent': round(demotivator_count / total_count * 100, 1) if total_count > 0 else 0,
                            'total_count': total_count
                        }
                    
                    specialty_data['courses'].append({
                        'course': course_num,
                        'name': f'{course_num} курс',
                        'total_students': total_count,
                        'motivators': motivator_stats
                    })
                
                if specialty_data['courses']:
                    results.append(specialty_data)
            
            return JsonResponse({
                'ok': True,
                'group_by': 'specialty_course',
                'data': results
            })
            
        else:
            return JsonResponse({
                'ok': False,
                'message': 'Неверный параметр group_by'
            }, status=400)
            
    except Exception as e:
        return JsonResponse({
            'ok': False,
            'message': str(e)
        }, status=500)
