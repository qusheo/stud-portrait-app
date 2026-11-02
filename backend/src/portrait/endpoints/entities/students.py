import json
from collections import defaultdict
import traceback

import numpy as np
from django.db.models import Avg, Count, Q
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from ..common import *
from ..student_interests import fetch_student_interests


@method('GET')
@jsonResponse
@csrf_exempt
def student_results(request):
    """Get specific participant's results."""
    stud_id = request.GET.get('stud_id')

    if not stud_id:
        raise ResponseError("stud_id parameter is required")

    try:
        stud_id = int(stud_id)
    except ValueError:
        raise ResponseError("stud_id must be an integer")

    try:
        participant = Participants.objects.get(part_id=stud_id)
    except Participants.DoesNotExist:
        raise ResponseError("Student not found", status=404)

    results_list = [
        {
            "res_id": result.res_id,
            "res_year": result.res_year,
            "res_course": result.res_course,
            "res_potential": result.res_potential,
            "res_report": result.res_report,
            "center": attrIfObj(result.res_center, 'center_name'),
            "institution": attrIfObj(result.res_institution, 'inst_name'),
            "edu_level": attrIfObj(result.res_edu_level, 'edu_level_name'),
            "study_form": attrIfObj(result.res_edu_form, 'form_name'),
            "specialty": attrIfObj(result.res_edu_specialty, 'spec_name'),
            **{c: getattr(result, c) for c in COMP.list},
            **{m: zeroIfNull(getattr(result, m)) for m in MOT.list},
            **{v: getattr(result, v) for v in VAL.list},
        }
        for result in Results.objects
        .filter(res_participant=stud_id)
        .select_related(
            'res_center', 'res_institution', 'res_edu_level', 'res_edu_form', 'res_edu_specialty'
        )
    ]

    try:
        mapping = StudentMapping.objects.get(mapping_rsv=participant.part_rsv_id)
        student_name = mapping.mapping_stud_name
    except StudentMapping.DoesNotExist:
        student_name = participant.part_rsv_id

    latest_result = Results.objects.filter(res_participant=stud_id).order_by('-res_year', '-res_course').first()

    return {
        "student": {
            "stud_id": participant.part_id,
            "stud_rsv": participant.part_rsv_id,
            "stud_name": student_name,
            "stud_gender": participant.part_gender,
            "institution": attrIfObj(latest_result.res_institution, 'inst_name') if latest_result else None,
            "specialty": attrIfObj(latest_result.res_edu_specialty, 'spec_name') if latest_result else None,
            "edu_level": attrIfObj(latest_result.res_edu_level, 'edu_level_name') if latest_result else None,
            "study_form": attrIfObj(latest_result.res_edu_form, 'form_name') if latest_result else None,
            "course_num": participant.part_course_num
        },
        "results": results_list
    }


@csrf_exempt
@method("GET")
def get_students_list(request):
    """Get a list of students for search."""
    try:
        search = request.GET.get('search', '').strip()
        limit = int(request.GET.get('limit', 50))

        queryset = ParticipantsWithNames.objects.select_related(
            'part_institution', 'part_spec'
        )

        if search:
            search_filter = (
                Q(student_name__icontains=search) |
                Q(part_rsv_id__icontains=search) |
                Q(part_institution__inst_name__icontains=search) |
                Q(part_spec__spec_name__icontains=search)
            )
            if search.isdigit():
                search_filter |= Q(part_id=int(search))
            queryset = queryset.filter(search_filter)

        students = [
            {
                'id': s.part_id,
                'rsv_id': s.part_rsv_id,
                'name': s.student_name,
                'institution': s.part_institution.inst_name if s.part_institution else 'Не указан',
                'specialty': s.part_spec.spec_name if s.part_spec else 'Не указана',
                'course': s.part_course_num,
                'gender': s.part_gender,
            }
            for s in queryset[:limit]
        ]

        return JsonResponse({
            'ok': True,
            'data': students,
            'total': queryset.count()
        })

    except Exception as e:
        return JsonResponse({'ok': False, 'message': str(e)}, status=500)


@method("GET")
@csrf_exempt
def get_student_portrait(request):
    """Get a student's full digital portrait."""
    try:
        student_id = request.GET.get('student_id')
        if not student_id:
            return JsonResponse({'ok': False, 'message': 'student_id required'}, status=400)

        try:
            student = Participants.objects.get(part_id=student_id)
        except Participants.DoesNotExist:
            return JsonResponse({'ok': False, 'message': 'Student not found'}, status=404)

        try:
            mapping = StudentMapping.objects.get(mapping_rsv=student.part_rsv_id)
            student_name = mapping.mapping_stud_name
        except StudentMapping.DoesNotExist:
            student_name = student.part_rsv_id

        latest_result = Results.objects.filter(res_participant=student).order_by('-res_year', '-res_course').first()

        student_info = {
            'id': student.part_id,
            'rsv_id': student.part_rsv_id,
            'name': student_name,
            'gender': student.part_gender or 'Не указан',
            'institution': attrIfObj(latest_result.res_institution, 'inst_name') if latest_result else 'Не указано',
            'institution_id': latest_result.res_institution.inst_id if latest_result and latest_result.res_institution else None,
            'specialty': attrIfObj(latest_result.res_edu_specialty, 'spec_name') if latest_result else 'Не указана',
            'specialty_id': latest_result.res_edu_specialty.spec_id if latest_result and latest_result.res_edu_specialty else None,
            'edu_level': attrIfObj(latest_result.res_edu_level, 'edu_level_name') if latest_result else 'Не указан',
            'study_form': attrIfObj(latest_result.res_edu_form, 'form_name') if latest_result else 'Не указана',
            'current_course': student.part_course_num
        }

        results = Results.objects.filter(res_participant=student).order_by('-res_year')

        test_results = []
        for result in results:
            competencies = {
                'res_comp_info_analysis': result.res_comp_info_analysis,
                'res_comp_planning': result.res_comp_planning,
                'res_comp_result_orientation': result.res_comp_result_orientation,
                'res_comp_stress_resistance': result.res_comp_stress_resistance,
                'res_comp_partnership': result.res_comp_partnership,
                'res_comp_rules_compliance': result.res_comp_rules_compliance,
                'res_comp_self_development': result.res_comp_self_development,
                'res_comp_leadership': result.res_comp_leadership,
                'res_comp_emotional_intel': result.res_comp_emotional_intel,
                'res_comp_client_focus': result.res_comp_client_focus,
                'res_comp_communication': result.res_comp_communication,
                'res_comp_passive_vocab': result.res_comp_passive_vocab,
            }

            motivators = {
                'res_mot_autonomy': float(result.res_mot_autonomy) if result.res_mot_autonomy else None,
                'res_mot_altruism': float(result.res_mot_altruism) if result.res_mot_altruism else None,
                'res_mot_challenge': float(result.res_mot_challenge) if result.res_mot_challenge else None,
                'res_mot_salary': float(result.res_mot_salary) if result.res_mot_salary else None,
                'res_mot_career': float(result.res_mot_career) if result.res_mot_career else None,
                'res_mot_creativity': float(result.res_mot_creativity) if result.res_mot_creativity else None,
                'res_mot_relationships': float(result.res_mot_relationships) if result.res_mot_relationships else None,
                'res_mot_recognition': float(result.res_mot_recognition) if result.res_mot_recognition else None,
                'res_mot_affiliation': float(result.res_mot_affiliation) if result.res_mot_affiliation else None,
                'res_mot_self_development': float(result.res_mot_self_development) if result.res_mot_self_development else None,
                'res_mot_purpose': float(result.res_mot_purpose) if result.res_mot_purpose else None,
                'res_mot_cooperation': float(result.res_mot_cooperation) if result.res_mot_cooperation else None,
                'res_mot_stability': float(result.res_mot_stability) if result.res_mot_stability else None,
                'res_mot_tradition': float(result.res_mot_tradition) if result.res_mot_tradition else None,
                'res_mot_management': float(result.res_mot_management) if result.res_mot_management else None,
                'res_mot_work_conditions': float(result.res_mot_work_conditions) if result.res_mot_work_conditions else None,
            }

            values = {
                'res_val_honesty_justice': result.res_val_honesty_justice,
                'res_val_humanism': result.res_val_humanism,
                'res_val_patriotism': result.res_val_patriotism,
                'res_val_family': result.res_val_family,
                'res_val_health': result.res_val_health,
                'res_val_environment': result.res_val_environment,
            }

            test_results.append({
                'year': result.res_year,
                'course': result.res_course,
                'center': result.res_center.center_name if result.res_center else None,
                'potential': result.res_potential,
                'competencies': competencies,
                'motivators': motivators,
                'values': values
            })

        academic_performance = AcademicPerformances.objects.filter(
            perf_participant=student
        ).order_by('perf_year', 'perf_discipline')

        grades = []
        for grade in academic_performance:
            grades.append({
                'year': grade.perf_year,
                'discipline': grade.perf_discipline,
                'main': grade.perf_main,
                'current': grade.perf_current,
                'digital': grade.perf_digital,
                'first_retake': grade.perf_first_retake,
                'second_retake': grade.perf_second_retake,
                'grade_retake': grade.perf_grade_retake,
                'final': grade.perf_final,
            })

        courses = Courseresults.objects.filter(course_participant=student)

        courses_data = []
        for course in courses:
            course_info = {
                'id': course.course_id,
                'an_dec': float(course.course_an_dec) if course.course_an_dec else None,
                'client_focus': float(course.course_client_focus) if course.course_client_focus else None,
                'communication': float(course.course_communication) if course.course_communication else None,
                'leadership': float(course.course_leadership) if course.course_leadership else None,
                'result_orientation': float(course.course_result_orientation) if course.course_result_orientation else None,
                'planning_org': float(course.course_planning_org) if course.course_planning_org else None,
                'rules_culture': float(course.course_rules_culture) if course.course_rules_culture else None,
                'self_dev': float(course.course_self_dev) if course.course_self_dev else None,
                'collaboration': float(course.course_collaboration) if course.course_collaboration else None,
                'stress_resistance': float(course.course_stress_resistance) if course.course_stress_resistance else None,
                'emotions_communication': float(course.course_emotions_communication) if course.course_emotions_communication else None,
                'negotiations': float(course.course_negotiations) if course.course_negotiations else None,
                'digital_comm': float(course.course_digital_comm) if course.course_digital_comm else None,
                'effective_learning': float(course.course_effective_learning) if course.course_effective_learning else None,
                'entrepreneurship': float(course.course_entrepreneurship) if course.course_entrepreneurship else None,
                'creativity_tech': float(course.course_creativity_tech) if course.course_creativity_tech else None,
                'trendwatching': float(course.course_trendwatching) if course.course_trendwatching else None,
                'conflict_management': float(course.course_conflict_management) if course.course_conflict_management else None,
                'career_management': float(course.course_career_management) if course.course_career_management else None,
                'burnout': float(course.course_burnout) if course.course_burnout else None,
                'cross_cultural_comm': float(course.course_cross_cultural_comm) if course.course_cross_cultural_comm else None,
                'mentoring': float(course.course_mentoring) if course.course_mentoring else None,
            }
            courses_data.append(course_info)

        return JsonResponse({
            'ok': True,
            'data': {
                'student_info': student_info,
                'test_results': test_results,
                'academic_performance': grades,
                'courses': courses_data
            }
        })

    except Exception as e:
        return JsonResponse({'ok': False, 'message': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["GET"])
def get_student_by_id(request):
    try:
        student_id = int(request.GET.get('student_id', ''))
    except ValueError:
        return JsonResponse({'ok': False, 'message': 'student_id must be an integer'}, status=400)

    try:
        student = Participants.objects.get(part_id=student_id)
    except Participants.DoesNotExist:
        return JsonResponse({'ok': False, 'message': 'Student not found'}, status=404)

    try:
        results_sorted = sorted(
            Results.objects.filter(res_participant=student).select_related(
                'res_institution', 'res_edu_specialty'
            ),
            key=lambda result: (_year_sort_key(result.res_year), result.res_course or 0)
        )

        mapping = StudentMapping.objects.filter(mapping_rsv=student.part_rsv_id).first()
        duplicate_mappings = StudentMapping.objects.none()
        if mapping:
            duplicate_mappings = StudentMapping.objects.filter(
                mapping_stud_name=mapping.mapping_stud_name,
                mapping_stud_gender=mapping.mapping_stud_gender,
            ).exclude(mapping_rsv=student.part_rsv_id)

        participants_by_rsv = {
            participant.part_rsv_id: participant
            for participant in Participants.objects.filter(
                part_rsv_id__in=duplicate_mappings.values_list('mapping_rsv', flat=True)
            )
        }
        duplicate_accounts = [
            {
                'participant_id': participants_by_rsv.get(duplicate.mapping_rsv).part_id
                if participants_by_rsv.get(duplicate.mapping_rsv) else None,
                'rsv_id': duplicate.mapping_rsv,
                'name': duplicate.mapping_stud_name,
            }
            for duplicate in duplicate_mappings
        ]

        repeated_year = any(
            previous.res_course is not None
            and previous.res_course == current.res_course
            and previous.res_year != current.res_year
            for previous, current in zip(results_sorted, results_sorted[1:])
        )

        education_by_institution = {}
        for result in results_sorted:
            institution = attrIfObj(result.res_institution, 'inst_name')
            key = result.res_institution_id or institution
            if key not in education_by_institution:
                education_by_institution[key] = {
                    'institution': institution,
                    'years': [],
                }
            if result.res_year not in education_by_institution[key]['years']:
                education_by_institution[key]['years'].append(result.res_year)

        return JsonResponse({
            'ok': True,
            'data': {
                'student_id': student.part_id,
                'transfer': _detect_transfers(results_sorted),
                'duplicate_account': duplicate_accounts,
                'repeated_year': repeated_year,
                'expelled': None,
                'education': list(education_by_institution.values()),
                'interests': fetch_student_interests(student.part_id),
            }
        })
    except Exception as e:
        print(traceback.format_exc())
        return JsonResponse({'ok': False, 'message': str(e)}, status=500)


def get_interest_options(request):
    try:
        response_data = {
            'ok': True,
            'data': [],
        }
        # интересы потом списком
        return JsonResponse(response_data)        
    except Exception as e:
        print(traceback.format_exc())
        return JsonResponse({"ok": False, "message": str(e)}, status=500)


def _year_sort_key(year_str):
    """'2023/2024' → 2023; для сортировки."""
    try:
        return int(str(year_str).split('/')[0])
    except Exception:
        return 0

"""
Эндпоинты для анализа студентов, сменивших направление или вуз.
Логика определения перевода:
  Студент считается "переведённым" если между двумя соседними записями Results
  изменился res_institution_id (смена вуза) или res_edu_specialty_id (смена направления).
  Сравниваем записи, отсортированные по res_year.
"""
def _detect_transfers(results_sorted):
    """
    Принимает список TestResult-объектов, отсортированных по году.
    Возвращает список событий перевода:
      { 'year': str, 'from_inst': str, 'to_inst': str,
        'from_dir': str,  'to_dir': str,
        'type': 'institution' | 'direction' | 'both' }
    """
    events = []
    for i in range(1, len(results_sorted)):
        prev, curr = results_sorted[i - 1], results_sorted[i]

        prev_inst = prev.res_institution
        curr_inst = curr.res_institution
        prev_spec = prev.res_edu_specialty
        curr_spec = curr.res_edu_specialty

        inst_changed = prev_inst and curr_inst and prev_inst != curr_inst
        spec_changed = prev_spec and curr_spec and prev_spec != curr_spec

        if inst_changed or spec_changed:
            transfer_type = (
                'both'        if inst_changed and spec_changed else
                'institution' if inst_changed else
                'direction'
            )
            events.append({
                'year':      curr.res_year,
                'from_inst': prev.res_institution.inst_name if prev.res_institution else '—',
                'to_inst':   curr.res_institution.inst_name if curr.res_institution else '—',
                'from_dir':  prev.res_edu_specialty.spec_name if prev.res_edu_specialty else '—',
                'to_dir':    curr.res_edu_specialty.spec_name if curr.res_edu_specialty else '—',
                'type':      transfer_type,
            })
    return events


def _avg_comp(result):
    """Среднее по всем компетенциям для одного TestResult."""
    vals = [getattr(result, f) for f in COMP.list if getattr(result, f)]
    return float(np.mean(vals)) if vals else None


# ──────────────────────────────────────────────────────────────
#  GET /portrait/analyze-transfers/
# ──────────────────────────────────────────────────────────────

@csrf_exempt
@require_http_methods(["GET"])
def analyze_transfers(request):
    """
    Сводный анализ переводов.

    Query params:
      institution_id — фильтр по вузу (необязательно)
      competency     — компетенция для детального анализа (default: res_comp_leadership)
      transfer_type  — 'institution' | 'direction' | 'both' | '' (все)

    Возвращает:
      summary        — общая статистика
      sankey         — данные для диаграммы Санки (потоки переводов между вузами/направлениями)
      dynamics       — средние компетенции до/после перевода по курсам
      by_type        — разбивка по типу перевода
    """
    try:
        institution_id = request.GET.get('institution_id')
        competency     = request.GET.get('competency', 'res_comp_leadership')
        transfer_type  = request.GET.get('transfer_type', '')

        if competency not in COMP.list:
            competency = COMP.LEADERSHIP

        # Берём всех участников у которых есть хотя бы 2 результата
        qs = (
            Participants.objects
            .prefetch_related('results_set')
            .annotate(result_count=Count('results')) 
            .filter(result_count__gte=2)
        )
        if institution_id:
            # Участники у которых хоть одна запись Results в этом вузе
            qs = qs.filter(results__res_institution_id=institution_id).distinct()

        # ── Находим студентов с переводами ──────────────────────
        transfer_students = []   # (participant, events, results_sorted)

        for participant in qs:
            results_sorted = sorted(
                participant.results_set.select_related('res_institution', 'res_edu_specialty').all(), 
                key=lambda r: _year_sort_key(r.res_year)
            )
            if len(results_sorted) < 2:
                continue
            events = _detect_transfers(results_sorted)
            if not events:
                continue
            if transfer_type and not any(e['type'] == transfer_type or transfer_type == 'both' for e in events):
                continue
            transfer_students.append((participant, events, results_sorted))

        total_transfers = len(transfer_students)

        # ── Санки ────────────────────────────────────────────────
        # Узлы = уникальные (вуз, направление)-пары; потоки = переводы
        node_set    = {}   # label → index
        sankey_links_raw = defaultdict(float)  # (from_idx, to_idx) → count

        for _part, events, results_sorted in transfer_students:
            for ev in events:
                from_label = f"{ev['from_inst']} / {ev['from_dir']}"
                to_label   = f"{ev['to_inst']}   / {ev['to_dir']}"

                for label in (from_label, to_label):
                    if label not in node_set:
                        node_set[label] = len(node_set)

                key = (node_set[from_label], node_set[to_label])
                sankey_links_raw[key] += 1

        sankey_nodes = [{'name': label} for label in node_set]
        sankey_links = [
            {'source': src, 'target': tgt, 'value': float(val)}
            for (src, tgt), val in sankey_links_raw.items()
            if src != tgt and val > 0
        ]
        sankey = {'nodes': sankey_nodes, 'links': sankey_links}

        # ── Динамика компетенций до/после перевода ───────────────
        # Для каждого студента: записи до первого перевода и после
        before_scores = []   # [avg_comp, ...]
        after_scores  = []

        course_dynamics = defaultdict(list)  # course_num → [score]

        for _part, events, results_sorted in transfer_students:
            first_transfer_year = events[0]['year']
            before = [r for r in results_sorted if _year_sort_key(r.res_year) < _year_sort_key(first_transfer_year)]
            after  = [r for r in results_sorted if _year_sort_key(r.res_year) >= _year_sort_key(first_transfer_year)]

            if before:
                val = _avg_comp(before[-1])
                if val: before_scores.append(val)
            if after:
                val = _avg_comp(after[0])
                if val: after_scores.append(val)

            # Баллы по конкретной компетенции в разрезе курсов
            for r in results_sorted:
                score = getattr(r, competency, None)
                if score and r.res_course:
                    course_dynamics[r.res_course].append(float(score))

        dynamics = [
            {
                'course':       course,
                'avg_score':    round(float(np.mean(scores)), 1),
                'n_students':   len(scores),
            }
            for course, scores in sorted(course_dynamics.items())
        ]

        # ── Разбивка по типу ─────────────────────────────────────
        by_type = defaultdict(int)
        for _, events, _ in transfer_students:
            for ev in events:
                by_type[ev['type']] += 1

        # ── Средние до/после ────────────────────────────────────
        avg_before = round(float(np.mean(before_scores)), 1) if before_scores else None
        avg_after  = round(float(np.mean(after_scores)),  1) if after_scores  else None

        return JsonResponse({
            'ok': True,
            'summary': {
                'total_transfer_students': total_transfers,
                'avg_comp_before_transfer': avg_before,
                'avg_comp_after_transfer':  avg_after,
                'delta': round(avg_after - avg_before, 1) if avg_before and avg_after else None,
            },
            'sankey':   sankey,
            'dynamics': dynamics,
            'by_type':  dict(by_type),
            'competency': competency,
            'competency_name': COMP.names.get(competency, competency),
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({'ok': False, 'message': str(e)}, status=500)


# ──────────────────────────────────────────────────────────────
#  POST /portrait/analyze-transfer-students/
# ──────────────────────────────────────────────────────────────

@csrf_exempt
@require_http_methods(["POST"])
def analyze_transfer_students(request):
    """
    Детальный список студентов с историей переводов и динамикой компетенций.

    Body: {
        "institution_id": 1,          // необязательно
        "competency": "res_comp_leadership",
        "transfer_type": "",          // '' | 'institution' | 'direction' | 'both'
        "limit": 50
    }

    Возвращает список студентов:
      [ { rsv_id, transfers: [...], trajectory: [{year, course, score, institution, direction}] } ]
    """
    try:
        body           = json.loads(request.body)
        institution_id = body.get('institution_id')
        competency     = body.get('competency', 'res_comp_leadership')
        transfer_type  = body.get('transfer_type', '')
        limit          = min(int(body.get('limit', 50)), 200)

        if competency not in COMP.list:
            competency = COMP.LEADERSHIP

        # ИСПРАВЛЕНО: используем правильный related_name 'results_set'
        qs = (
            Participants.objects
            .annotate(result_count=Count('results')) 
            .filter(result_count__gte=2)
        )
        if institution_id:
            qs = qs.filter(results__res_institution_id=institution_id).distinct()

        students_out = []

        for participant in qs:
            results_sorted = sorted(
                participant.results_set.select_related('res_institution', 'res_edu_specialty').all(), 
                key=lambda r: _year_sort_key(r.res_year)
            )
            if len(results_sorted) < 2:
                continue

            events = _detect_transfers(results_sorted)
            if not events:
                continue
            if transfer_type and not any(e['type'] == transfer_type for e in events):
                continue

            # Траектория: одна точка на каждый TestResult
            trajectory = []
            for r in results_sorted:
                score = getattr(r, competency, None)
                trajectory.append({
                    'year':        r.res_year,
                    'course':      r.res_course,
                    'score':       float(score) if score else None,
                    'institution': r.res_institution.inst_name if r.res_institution else '—',
                    'direction':   r.res_edu_specialty.edu_spec_name if r.res_edu_specialty else '—',
                })

            students_out.append({
                'part_id':   participant.part_id,
                'rsv_id':    participant.part_rsv_id,
                'transfers': events,
                'trajectory': trajectory,
            })

            if len(students_out) >= limit:
                break

        return JsonResponse({
            'ok': True,
            'students': students_out,
            'total':    len(students_out),
            'competency': competency,
            'competency_name': COMP.names.get(competency, competency),
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({'ok': False, 'message': str(e)}, status=500)
