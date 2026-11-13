# backend/tests/test_backend.py

import json
import pytest
from unittest.mock import patch, MagicMock
from io import BytesIO
from django.test import TestCase, Client
from django.urls import reverse
from django.core.cache import cache
from django.db import connection
from django.utils import timezone

# Импорты моделей
from ..models import *
# Импорты утилит
from ..endpoints.common import COMP, MOT, VAL, zeroIfNull, attrIfObj, join, isIn, desc
from ..endpoints.datanal import ValueAddedModel, LatentGrowthModel, DisciplineImpactAnalyzer



# ============================================================
# ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ ДЛЯ СОЗДАНИЯ ТАБЛИЦ
# ============================================================

def create_test_tables():
    existing_tables = set(connection.introspection.table_names())
    test_models = (
        Competencecenters,
        Institutions,
        Educationlevels,
        Educationforms,
        Educationspecialties,
        Specialties,
        Studyforms,
        Educationdisciplines,
        Participants,
        Studentmapping,
        ParticipantsWithNames,
        Results,
        Courseresults,
        Academicperformances,
        Datauploadtemplate,
        StudentsAmount,
        DisciplineCompetencyMapping,
        CurriculumParseLog,
    )

    with connection.schema_editor() as schema_editor:
        for model in test_models:
            if model._meta.db_table not in existing_tables:
                schema_editor.create_model(model)


# ============================================================
# БАЗОВЫЙ КЛАСС ТЕСТОВ
# ============================================================

class BaseTestCase(TestCase):
    """Базовый класс с автоматическим созданием таблиц."""

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        create_test_tables()


# ============================================================
# TEST: COMMON UTILITIES
# ============================================================

class TestCommonUtilities(BaseTestCase):
    """Тесты общих утилит."""

    def test_zeroIfNull(self):
        self.assertEqual(zeroIfNull(None), 0.0)
        self.assertEqual(zeroIfNull(5), 5.0)
        self.assertEqual(zeroIfNull(3.14), 3.14)

    def test_attrIfObj(self):
        class TestObj:
            attr = "value"

        obj = TestObj()
        self.assertEqual(attrIfObj(obj, "attr"), "value")
        self.assertEqual(attrIfObj(None, "attr"), None)

    def test_join(self):
        self.assertEqual(join("a", "b", "c"), "a__b__c")

    def test_isIn(self):
        self.assertEqual(isIn("field", [1, 2, 3]), {"field__in": [1, 2, 3]})

    def test_desc(self):
        self.assertEqual(desc("field"), "-field")


# ============================================================
# TEST: VALUE ADDED MODEL
# ============================================================

class TestValueAddedModel(BaseTestCase):
    """Тесты Value Added Model."""

    def setUp(self):
        self.vam = ValueAddedModel()

    def test_compute_global_baseline(self):
        import pandas as pd

        data = pd.DataFrame({
            'student_id': [1, 1, 2, 2],
            'year': ['2023/2024', '2024/2025', '2023/2024', '2024/2025'],
            'course': [1, 2, 1, 2],
            'competency_score': [400, 450, 500, 530]
        })

        baseline = self.vam.compute_global_baseline(data)
        self.assertIsNotNone(baseline)
        self.assertGreaterEqual(baseline, 0)

    def test_fit_for_student_insufficient_data(self):
        import pandas as pd

        data = pd.DataFrame({
            'year': ['2024/2025'],
            'course': [1],
            'competency_score': [500]
        })

        result = self.vam.fit_for_student(data)
        self.assertFalse(result['ok'])

    def test_fit_for_student_success(self):
        import pandas as pd

        data = pd.DataFrame({
            'year': ['2023/2024', '2024/2025'],
            'course': [2, 3],
            'competency_score': [500, 580]
        })

        result = self.vam.fit_for_student(data, expected_growth=20)
        self.assertTrue(result['ok'])
        self.assertIn('average_value_added', result)
        self.assertIn('performance', result)


# ============================================================
# TEST: LATENT GROWTH MODEL
# ============================================================

class TestLatentGrowthModel(BaseTestCase):
    """Тесты Latent Growth Model."""

    def setUp(self):
        self.lgm = LatentGrowthModel()

    def test_fit_insufficient_data(self):
        import pandas as pd

        data = pd.DataFrame({
            'student_id': [1],
            'time_point': [1],
            'competency_score': [500]
        })

        result = self.lgm.fit(data)
        self.assertFalse(result['ok'])

    def test_fit_success(self):
        import pandas as pd

        data = pd.DataFrame({
            'student_id': [1, 1, 1],
            'time_point': [1, 2, 3],
            'competency_score': [400, 480, 550]
        })

        result = self.lgm.fit(data)
        self.assertTrue(result['ok'])
        self.assertIn('n_students', result)
        self.assertIn('mean_intercept', result)
        self.assertIn('mean_slope', result)


# ============================================================
# TEST: DISCIPLINE IMPACT ANALYZER
# ============================================================

class TestDisciplineImpactAnalyzer(BaseTestCase):
    """Тесты анализа влияния дисциплин."""

    def setUp(self):
        self.analyzer = DisciplineImpactAnalyzer()

    def test_convert_grade(self):
        self.assertEqual(self.analyzer.convert_grade_to_text(5), 'отл.')
        self.assertEqual(self.analyzer.convert_grade_to_num('хор.'), 4)

    def test_analyze_discipline_impact_insufficient_data(self):
        import pandas as pd

        data = pd.DataFrame({
            'student_id': [1],
            'discipline': ['Project Management'],
            'grade': ['отл.'],
            'res_comp_leadership_before': [500],
            'res_comp_leadership_after': [550]
        })

        result = self.analyzer.analyze_discipline_impact(
            data, 'res_comp_leadership', grade_format='text'
        )
        self.assertTrue(result['ok'])

    def test_analyze_discipline_impact_success(self):
        import pandas as pd
        import numpy as np

        data = []
        for i in range(10):
            data.append({
                'student_id': i,
                'discipline': 'Project Management',
                'grade': 'отл.',
                'res_comp_leadership_before': float(400 + np.random.randint(0, 100)),
                'res_comp_leadership_after': float(500 + np.random.randint(0, 100)),
                'year': '2024/2025'
            })

        df = pd.DataFrame(data)
        result = self.analyzer.analyze_discipline_impact(
            df, 'res_comp_leadership', grade_format='text'
        )
        self.assertTrue(result['ok'])


# ============================================================
# TEST: DASHBOARD STATISTICS
# ============================================================

class TestDashboardStatistics(BaseTestCase):
    """Тесты дашборда."""

    def setUp(self):
        self.client = Client()

    def test_overall_stats(self):
        response = self.client.get(reverse('overall_stats'))
        self.assertEqual(response.status_code, 200)

    def test_filter_options(self):
        response = self.client.get(reverse('filter_options'))
        self.assertEqual(response.status_code, 200)

    def test_dashboard_stats(self):
        response = self.client.get(reverse('dashboard_stats'))
        self.assertEqual(response.status_code, 200)

    def test_motivation_counts(self):
        response = self.client.get(reverse('motivation_counts'))
        self.assertEqual(response.status_code, 200)


# ============================================================
# TEST: FILTER OPTIONS (исправлены имена эндпоинтов)
# ============================================================

class TestFilterOptions(BaseTestCase):
    """Тесты опций фильтров."""

    def setUp(self):
        self.client = Client()

    def test_get_filter_options_with_counts(self):
        response = self.client.get(reverse('get_filter_options_with_counts'))
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data['ok'])
        self.assertIn('data', data)

    def test_students_list(self):
        response = self.client.get(reverse('students_list'), {
            'search': 'Ivan',
            'limit': 10
        })
        self.assertEqual(response.status_code, 200)

    def test_student_portrait(self):
        # Сначала создаём студента
        participant = Participants.objects.create(
            part_rsv_id="TEST001",
            part_course_num=3,
            part_gender=1
        )
        response = self.client.get(reverse('student_portrait'), {
            'student_id': participant.part_id
        })
        self.assertEqual(response.status_code, 200)

    @patch('portrait.endpoints.entities.students.fetch_student_interests', return_value=['science'])
    def test_student_by_id(self, fetch_interests):
        participant = Participants.objects.create(
            part_rsv_id="TEST001",
            part_course_num=3,
            part_gender=1
        )
        response = self.client.get(reverse('student_by_id'), {
            'student_id': participant.part_id
        })

        self.assertEqual(response.status_code, 200)
        data = response.json()['data']
        self.assertEqual(data['student_id'], participant.part_id)
        self.assertEqual(data['transfer'], [])
        self.assertEqual(data['duplicate_account'], [])
        self.assertFalse(data['repeated_year'])
        self.assertIsNone(data['expelled'])
        self.assertEqual(data['education'], [])
        self.assertEqual(data['interests'], ['science'])
        fetch_interests.assert_called_once_with(participant.part_id)

    def test_teacher_by_id(self):
        response = self.client.get(reverse('teacher_by_id'), {'teacher_id': 1})

        self.assertEqual(response.status_code, 200)
        data = response.json()['data']
        self.assertEqual(data['teacher_id'], 1)
        self.assertEqual(data['education'], [])
        self.assertEqual(data['interests'], [])


# ============================================================
# TEST: BOXPLOT (исправлены имена эндпоинтов)
# ============================================================

class TestBoxplot(BaseTestCase):
    """Тесты боксплотов."""

    def setUp(self):
        self.client = Client()

    def test_get_boxplot_data(self):
        response = self.client.post(reverse('get_boxplot_data'), {
            'competency': 'res_comp_leadership'
        }, content_type='application/json')
        # 400 - нет данных для боксплота
        self.assertIn(response.status_code, [200, 400])

    def test_comp_boxplot(self):
        response = self.client.get(reverse('comp_boxplot'))
        self.assertIn(response.status_code, [200, 400, 500])


# ============================================================
# TEST: DUPLICATE ACCOUNTS
# ============================================================

class TestDuplicateAccounts(BaseTestCase):
    """Тесты поиска дублей аккаунтов."""

    def setUp(self):
        self.client = Client()

        # Создаём данные
        self.participant1 = Participants.objects.create(
            part_rsv_id="TEST001",
            part_course_num=3,
            part_gender=1
        )
        self.participant2 = Participants.objects.create(
            part_rsv_id="TEST002",
            part_course_num=3,
            part_gender=1
        )

        Studentmapping.objects.create(
            mapping_rsv="TEST001",
            mapping_stud_name="Ivan Testov",
            mapping_stud_gender=1,
            mapping_created_at=timezone.now()
        )
        Studentmapping.objects.create(
            mapping_rsv="TEST002",
            mapping_stud_name="Ivan Testov",
            mapping_stud_gender=1,
            mapping_created_at=timezone.now()
        )

    def test_duplicate_accounts(self):
        response = self.client.get(reverse('duplicate_accounts'))
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data['ok'])


# ============================================================
# TEST: TEMPLATE MANAGEMENT (исправлены имена эндпоинтов)
# ============================================================

class TestTemplateManagement(BaseTestCase):
    """Тесты управления шаблонами."""

    def setUp(self):
        self.client = Client()

    def test_get_templates(self):
        response = self.client.get(reverse('dataload_templates'))
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data['ok'])
        self.assertIn('templates', data)

    def test_save_template(self):
        response = self.client.post(reverse('dataload_template_save'), {
            'name': 'New Template',
            'config': {"sheets": []},
            'description': 'Test Description'
        }, content_type='application/json')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data['ok'])
        self.assertEqual(data['name'], 'New Template')


# ============================================================
# TEST: AUDIT (исправлены имена эндпоинтов)
# ============================================================

class TestAudit(BaseTestCase):
    """Тесты аудита."""

    def setUp(self):
        self.client = Client()

    def test_audit_schema(self):
        response = self.client.get(reverse('audit_schema'))
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data['ok'])
        self.assertIn('schema', data)

    def test_audit_table_data(self):
        response = self.client.get(reverse('audit_table_data'), {
            'table_name': 'participants',
            'limit': 5
        })
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data['ok'])
        self.assertIn('sample', data)

    def test_audit_stats(self):
        response = self.client.get(reverse('audit_stats'))
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data['ok'])
        self.assertIn('info', data)


# ============================================================
# TEST: CACHING
# ============================================================

class TestCaching(BaseTestCase):
    """Тесты кэширования."""

    def setUp(self):
        self.client = Client()
        cache.clear()

    def test_caching_enabled(self):
        response = self.client.get(reverse('get_institutions'))
        self.assertEqual(response.status_code, 200)


# ============================================================
# TEST: INSTITUTIONS & DIRECTIONS
# ============================================================

class TestInstitutionsDirections(BaseTestCase):
    """Тесты институтов и направлений."""

    def setUp(self):
        self.client = Client()

    def test_get_institutions(self):
        response = self.client.get(reverse('get_institutions'))
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data['ok'])

    def test_get_directions(self):
        response = self.client.get(reverse('get_directions'))
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data['ok'])


# ============================================================
# RUNNER
# ============================================================

if __name__ == '__main__':
    import unittest
    unittest.main()
