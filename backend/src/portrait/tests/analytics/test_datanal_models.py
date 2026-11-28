import numpy as np
import pandas as pd

from portrait.endpoints.datanal import (
    DisciplineImpactAnalyzer,
    LatentGrowthModel,
    ValueAddedModel,
)

from ..base import BaseTestCase


class TestValueAddedModel(BaseTestCase):
    def setUp(self):
        self.vam = ValueAddedModel()

    def test_compute_global_baseline(self):
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
        data = pd.DataFrame({
            'year': ['2024/2025'],
            'course': [1],
            'competency_score': [500]
        })

        result = self.vam.fit_for_student(data)
        self.assertFalse(result['ok'])

    def test_fit_for_student_success(self):
        data = pd.DataFrame({
            'year': ['2023/2024', '2024/2025'],
            'course': [2, 3],
            'competency_score': [500, 580]
        })

        result = self.vam.fit_for_student(data, expected_growth=20)
        self.assertTrue(result['ok'])
        self.assertIn('average_value_added', result)
        self.assertIn('performance', result)


class TestLatentGrowthModel(BaseTestCase):
    def setUp(self):
        self.lgm = LatentGrowthModel()

    def test_fit_insufficient_data(self):
        data = pd.DataFrame({
            'student_id': [1],
            'time_point': [1],
            'competency_score': [500]
        })

        result = self.lgm.fit(data)
        self.assertFalse(result['ok'])

    def test_fit_success(self):
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


class TestDisciplineImpactAnalyzer(BaseTestCase):
    def setUp(self):
        self.analyzer = DisciplineImpactAnalyzer()

    def test_convert_grade(self):
        self.assertEqual(self.analyzer.convert_grade_to_text(5), 'отл.')
        self.assertEqual(self.analyzer.convert_grade_to_num('хор.'), 4)

    def test_analyze_discipline_impact_insufficient_data(self):
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
