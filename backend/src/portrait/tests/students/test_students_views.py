import json

from django.contrib.auth import get_user_model
from django.test import Client
from django.urls import reverse

from portrait.models import (
    Academicperformances,
    Courseresults,
    Institutions,
    Participants,
    ParticipantsWithNames,
    Results,
    Studentmapping,
    User as PortraitUser,
)

from ..base import BaseTestCase


def create_account(account_type="admin", participant=None, username="tester"):
    django_user = get_user_model().objects.create_user(
        username=username, password="password"
    )
    PortraitUser.objects.create(
        django_user=django_user,
        account_type=account_type,
        participant=participant,
    )
    return django_user


class StudentsListTests(BaseTestCase):
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
        self.assertTrue(data['ok'])
        self.assertEqual(len(data['data']), 2)
        student_names = [student['name'] for student in data['data']]
        self.assertIn('Иван Иванов', student_names)
        self.assertIn('Петр Петров', student_names)

    def test_students_list_search(self):
        response = self.client.get(reverse('students_list'), {'search': 'Петр'})

        self.assertEqual(response.status_code, 200)
        data = response.json()['data']
        self.assertEqual([student['name'] for student in data], ['Петр Петров'])

    def test_students_list_wrong_method(self):
        response = self.client.post(reverse('students_list'))

        self.assertEqual(response.status_code, 405)
        self.assertFalse(response.json()['ok'])


class StudentResultsTests(BaseTestCase):
    def setUp(self):
        self.client = Client()
        self.participant = Participants.objects.create(part_rsv_id='VIEW003')
        self.admin = create_account(username='admin')

    def create_results(self):
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

    def test_requires_authentication(self):
        response = self.client.get(
            reverse('student_results'), {'stud_id': self.participant.part_id}
        )
        self.assertEqual(response.status_code, 401)

    def test_user_without_account_forbidden(self):
        django_user = get_user_model().objects.create_user(
            username='noaccount', password='password'
        )
        self.client.force_login(django_user)
        response = self.client.get(
            reverse('student_results'), {'stud_id': self.participant.part_id}
        )
        self.assertEqual(response.status_code, 403)

    def test_results_get_success(self):
        self.create_results()
        self.client.force_login(self.admin)
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
        self.create_results()
        self.client.force_login(self.admin)
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
        self.client.force_login(self.admin)
        response = self.client.get(reverse('student_results'))

        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.json()['ok'])

    def test_results_get_invalid_stud_id(self):
        self.client.force_login(self.admin)
        response = self.client.get(reverse('student_results'), {'stud_id': 'invalid'})

        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.json()['ok'])

    def test_results_get_nonexistent_student(self):
        self.client.force_login(self.admin)
        response = self.client.get(reverse('student_results'), {'stud_id': -1})

        self.assertEqual(response.status_code, 404)
        self.assertFalse(response.json()['ok'])

    def test_student_can_only_see_own_results(self):
        own = Participants.objects.create(part_rsv_id='VIEW004')
        student_user = create_account(
            account_type=PortraitUser.AccountType.STUDENT,
            participant=own,
            username='student',
        )
        self.client.force_login(student_user)

        response = self.client.get(reverse('student_results'), {'stud_id': own.part_id})
        self.assertEqual(response.status_code, 200)

        response = self.client.get(
            reverse('student_results'), {'stud_id': self.participant.part_id}
        )
        self.assertEqual(response.status_code, 403)

    def test_results_wrong_method(self):
        response = self.client.post(reverse('student_results'))

        self.assertEqual(response.status_code, 405)
        self.assertFalse(response.json()['ok'])


class StudentPortraitTests(BaseTestCase):
    def setUp(self):
        self.client = Client()
        self.participant = Participants.objects.create(
            part_rsv_id='PORTRAIT001', part_course_num=3
        )

    def test_student_id_required(self):
        response = self.client.get(reverse('student_portrait'))
        self.assertEqual(response.status_code, 400)

    def test_student_not_found(self):
        response = self.client.get(reverse('student_portrait'), {'student_id': 999999})
        self.assertEqual(response.status_code, 404)

    def test_full_portrait(self):
        institution = Institutions.objects.create(inst_name='ТюмГУ')
        Results.objects.create(
            res_participant=self.participant,
            res_year='2024/2025',
            res_course=3,
            res_institution=institution,
            res_comp_leadership=500,
            res_mot_purpose=600,
        )
        Academicperformances.objects.create(
            perf_participant=self.participant,
            perf_year='2024/2025',
            perf_discipline='Математика',
            perf_main='5',
        )
        Courseresults.objects.create(
            course_participant=self.participant, course_leadership=4.5
        )

        response = self.client.get(
            reverse('student_portrait'), {'student_id': self.participant.part_id}
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()['data']
        self.assertEqual(data['student_info']['institution'], 'ТюмГУ')
        self.assertEqual(data['student_info']['current_course'], 3)
        self.assertEqual(len(data['test_results']), 1)
        self.assertEqual(
            data['test_results'][0]['competencies']['res_comp_leadership'], 500
        )
        self.assertEqual(len(data['academic_performance']), 1)
        self.assertEqual(data['academic_performance'][0]['discipline'], 'Математика')
        self.assertEqual(len(data['courses']), 1)
        self.assertEqual(data['courses'][0]['leadership'], 4.5)

    def test_portrait_without_results(self):
        response = self.client.get(
            reverse('student_portrait'), {'student_id': self.participant.part_id}
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()['data']
        self.assertEqual(data['test_results'], [])
        self.assertEqual(data['student_info']['institution'], 'Не указано')


class StudentByIdTests(BaseTestCase):
    def setUp(self):
        self.client = Client()
        self.participant = Participants.objects.create(
            part_rsv_id='SB001', part_course_num=3
        )

    def test_invalid_param(self):
        response = self.client.get(reverse('student_by_id'), {'student_id': 'abc'})
        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.json()['ok'])

    def test_not_found(self):
        response = self.client.get(reverse('student_by_id'), {'student_id': 999999})
        self.assertEqual(response.status_code, 404)

    def test_base_fields(self):
        from unittest.mock import patch

        with patch(
            'portrait.endpoints.entities.students.fetch_student_interests',
            return_value=['science'],
        ) as fetch_interests:
            response = self.client.get(
                reverse('student_by_id'), {'student_id': self.participant.part_id}
            )

        self.assertEqual(response.status_code, 200)
        data = response.json()['data']
        self.assertEqual(data['student_id'], self.participant.part_id)
        self.assertEqual(data['transfer'], [])
        self.assertEqual(data['duplicate_account'], [])
        self.assertFalse(data['repeated_year'])
        self.assertIsNone(data['expelled'])
        self.assertEqual(data['education'], [])
        self.assertEqual(data['interests'], ['science'])
        fetch_interests.assert_called_once_with(self.participant.part_id)

    def test_transfer_detection(self):
        inst_a = Institutions.objects.create(inst_name='ВУЗ А')
        inst_b = Institutions.objects.create(inst_name='ВУЗ Б')
        Results.objects.create(
            res_participant=self.participant, res_year='2023/2024', res_course=1,
            res_institution=inst_a,
        )
        Results.objects.create(
            res_participant=self.participant, res_year='2024/2025', res_course=2,
            res_institution=inst_b,
        )

        from unittest.mock import patch

        with patch(
            'portrait.endpoints.entities.students.fetch_student_interests',
            return_value=[],
        ):
            response = self.client.get(
                reverse('student_by_id'), {'student_id': self.participant.part_id}
            )

        data = response.json()['data']
        self.assertEqual(len(data['transfer']), 1)
        event = data['transfer'][0]
        self.assertEqual(event['type'], 'institution')
        self.assertEqual(event['from_inst'], 'ВУЗ А')
        self.assertEqual(event['to_inst'], 'ВУЗ Б')
        education = data['education']
        self.assertEqual({entry['institution'] for entry in education}, {'ВУЗ А', 'ВУЗ Б'})

    def test_duplicate_accounts(self):
        Studentmapping.objects.create(
            mapping_rsv='SB001', mapping_stud_name='Иван Иванов', mapping_stud_gender='1'
        )
        Studentmapping.objects.create(
            mapping_rsv='SB002', mapping_stud_name='Иван Иванов', mapping_stud_gender='1'
        )

        from unittest.mock import patch

        with patch(
            'portrait.endpoints.entities.students.fetch_student_interests',
            return_value=[],
        ):
            response = self.client.get(
                reverse('student_by_id'), {'student_id': self.participant.part_id}
            )

        duplicates = response.json()['data']['duplicate_account']
        self.assertEqual(len(duplicates), 1)
        self.assertEqual(duplicates[0]['rsv_id'], 'SB002')


class AnalyzeTransfersTests(BaseTestCase):
    def setUp(self):
        self.client = Client()
        self.inst_a = Institutions.objects.create(inst_name='ВУЗ А')
        self.inst_b = Institutions.objects.create(inst_name='ВУЗ Б')

    def seed_transfer_student(self, rsv_id='TR001'):
        participant = Participants.objects.create(part_rsv_id=rsv_id)
        Results.objects.create(
            res_participant=participant, res_year='2023/2024', res_course=1,
            res_institution=self.inst_a, res_comp_leadership=400,
        )
        Results.objects.create(
            res_participant=participant, res_year='2024/2025', res_course=2,
            res_institution=self.inst_b, res_comp_leadership=500,
        )
        return participant

    def test_summary_with_transfer(self):
        self.seed_transfer_student()
        response = self.client.get(reverse('analyze_transfers'))

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload['ok'])
        self.assertEqual(payload['summary']['total_transfer_students'], 1)
        self.assertEqual(payload['summary']['avg_comp_before_transfer'], 400.0)
        self.assertEqual(payload['summary']['avg_comp_after_transfer'], 500.0)
        self.assertEqual(payload['summary']['delta'], 100.0)
        self.assertEqual(payload['by_type'], {'institution': 1})
        self.assertEqual(len(payload['sankey']['links']), 1)
        self.assertEqual(len(payload['dynamics']), 2)

    def test_no_transfers(self):
        participant = Participants.objects.create(part_rsv_id='TR002')
        for course in (1, 2):
            Results.objects.create(
                res_participant=participant,
                res_year=f'{2022 + course}/{2023 + course}',
                res_course=course,
                res_institution=self.inst_a,
                res_comp_leadership=450,
            )

        response = self.client.get(reverse('analyze_transfers'))
        payload = response.json()
        self.assertEqual(payload['summary']['total_transfer_students'], 0)
        self.assertEqual(payload['sankey']['links'], [])

    def test_transfer_type_filter(self):
        self.seed_transfer_student()
        response = self.client.get(
            reverse('analyze_transfers'), {'transfer_type': 'direction'}
        )
        self.assertEqual(response.json()['summary']['total_transfer_students'], 0)

    def test_transfer_students_list(self):
        self.seed_transfer_student()
        response = self.client.post(
            reverse('analyze_transfer_students'),
            data=json.dumps({'limit': 50}),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload['ok'])
        self.assertEqual(payload['total'], 1)
        student = payload['students'][0]
        self.assertEqual(student['rsv_id'], 'TR001')
        self.assertEqual(len(student['transfers']), 1)
        self.assertEqual(len(student['trajectory']), 2)
        self.assertEqual(student['trajectory'][0]['score'], 400.0)

    def test_transfer_students_limit(self):
        self.seed_transfer_student('TR010')
        self.seed_transfer_student('TR011')
        response = self.client.post(
            reverse('analyze_transfer_students'),
            data=json.dumps({'limit': 1}),
            content_type='application/json',
        )
        payload = response.json()
        self.assertEqual(payload['total'], 1)
