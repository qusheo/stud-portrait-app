from django.test import Client
from django.urls import reverse

from portrait.models import Participants, ParticipantsWithNames, Results

from .test_backend import BaseTestCase


class TestStudentsView(BaseTestCase):
    def setUp(self):
        self.client = Client()
        ParticipantsWithNames.objects.create(
            part_id=1001,
            part_rsv_id='VIEW001',
            student_name='Иван Иванов',
        )
        ParticipantsWithNames.objects.create(
            part_id=1002,
            part_rsv_id='VIEW002',
            student_name='Петр Петров',
        )

    def test_students_list_get(self):
        response = self.client.get(reverse('students_list'))

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['status'], 'success')
        self.assertEqual(len(data['data']), 2)
        student_names = [student['name'] for student in data['data']]
        self.assertIn('Иван Иванов', student_names)
        self.assertIn('Петр Петров', student_names)

    def test_students_list_wrong_method(self):
        response = self.client.post(reverse('students_list'))

        self.assertEqual(response.status_code, 405)
        self.assertFalse(response.json()['ok'])


class TestResultsView(BaseTestCase):
    def setUp(self):
        self.client = Client()
        self.participant = Participants.objects.create(part_rsv_id='VIEW003')
        Results.objects.create(
            res_participant=self.participant,
            res_year='2022/2023',
            res_course=1,
            res_comp_communication=380,
            res_comp_info_analysis=385,
        )
        Results.objects.create(
            res_participant=self.participant,
            res_year='2023/2024',
            res_course=2,
            res_comp_communication=490,
            res_comp_info_analysis=488,
        )

    def test_results_get_success(self):
        response = self.client.get(
            reverse('student_results'),
            {'stud_id': self.participant.part_id},
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data['ok'])
        self.assertEqual(data['student']['stud_id'], self.participant.part_id)
        self.assertEqual(data['student']['stud_name'], self.participant.part_rsv_id)
        self.assertEqual(len(data['results']), 2)
        result_years = [result['res_year'] for result in data['results']]
        self.assertIn('2022/2023', result_years)
        self.assertIn('2023/2024', result_years)

    def test_results_data_structure(self):
        response = self.client.get(
            reverse('student_results'),
            {'stud_id': self.participant.part_id},
        )

        result = response.json()['results'][0]
        self.assertIn('res_id', result)
        self.assertIn('res_year', result)
        self.assertIn('res_comp_communication', result)
        self.assertIn('res_mot_purpose', result)
        self.assertIn('res_comp_info_analysis', result)
        self.assertIn('res_val_honesty_justice', result)

    def test_results_get_missing_stud_id(self):
        response = self.client.get(reverse('student_results'))

        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.json()['ok'])

    def test_results_get_invalid_stud_id(self):
        response = self.client.get(reverse('student_results'), {'stud_id': 'invalid'})

        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.json()['ok'])

    def test_results_get_nonexistent_student(self):
        response = self.client.get(reverse('student_results'), {'stud_id': -1})

        self.assertEqual(response.status_code, 404)
        self.assertFalse(response.json()['ok'])

    def test_results_wrong_method(self):
        response = self.client.post(reverse('student_results'))

        self.assertEqual(response.status_code, 405)
        self.assertFalse(response.json()['ok'])
