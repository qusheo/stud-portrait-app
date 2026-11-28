from django.test import Client
from django.urls import reverse

from portrait.models import (
    Competencecenters,
    Institutions,
    Participants,
    Results,
    Studentmapping,
)

from ..base import BaseTestCase


DOCX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'


class StudentResumeDataTests(BaseTestCase):
    def setUp(self):
        self.client = Client()
        self.participant = Participants.objects.create(part_rsv_id='RES001')

    def test_student_id_required(self):
        response = self.client.get(reverse('gendox_student_resume_data'))
        self.assertEqual(response.status_code, 400)

    def test_student_not_found(self):
        response = self.client.get(
            reverse('gendox_student_resume_data'), {'student_id': 999999}
        )
        self.assertEqual(response.status_code, 404)

    def test_no_results(self):
        response = self.client.get(
            reverse('gendox_student_resume_data'),
            {'student_id': self.participant.part_id},
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()['data']
        self.assertFalse(data['has_data'])
        self.assertEqual(data['competencies'], [])
        self.assertEqual(
            data['personal_info']['rsv_id'], 'RES001'
        )

    def test_success_without_ai(self):
        Studentmapping.objects.create(
            mapping_rsv='RES001', mapping_stud_name='Иванов Иван', mapping_stud_gender='1'
        )
        Results.objects.create(
            res_participant=self.participant,
            res_year='2024/2025',
            res_course=2,
            res_comp_leadership=500,
            res_comp_communication=650,
        )

        response = self.client.get(
            reverse('gendox_student_resume_data'),
            {'student_id': self.participant.part_id, 'with_ai': 'false'},
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()['data']
        self.assertEqual(data['personal_info']['name'], 'Иванов Иван')
        self.assertEqual(data['year'], '2024/2025')
        self.assertEqual(len(data['competencies']), 2)
        competency = data['competencies'][0]
        self.assertIn('level', competency['ai'])
        self.assertIn('interpretation', competency['ai'])
        self.assertIsNone(data['general_interpretation'])

    def test_year_filter(self):
        Results.objects.create(
            res_participant=self.participant, res_year='2023/2024', res_course=1,
            res_comp_leadership=400,
        )
        Results.objects.create(
            res_participant=self.participant, res_year='2024/2025', res_course=2,
            res_comp_leadership=500,
        )

        response = self.client.get(
            reverse('gendox_student_resume_data'),
            {'student_id': self.participant.part_id, 'year': '2023/2024', 'with_ai': 'false'},
        )
        data = response.json()['data']
        self.assertEqual(data['year'], '2023/2024')
        leadership = next(
            c for c in data['competencies'] if c['field'] == 'res_comp_leadership'
        )
        self.assertEqual(leadership['score'], 400)


class GenerateDocxResumeTests(BaseTestCase):
    def setUp(self):
        self.client = Client()
        self.participant = Participants.objects.create(part_rsv_id='DOC001')

    def test_student_id_required(self):
        response = self.client.get(reverse('gendox_generate_resume_docx'))
        self.assertEqual(response.status_code, 400)

    def test_student_not_found(self):
        response = self.client.get(
            reverse('gendox_generate_resume_docx'), {'student_id': 999999}
        )
        self.assertEqual(response.status_code, 404)

    def test_returns_docx_file(self):
        Results.objects.create(
            res_participant=self.participant, res_year='2024/2025', res_course=2,
            res_comp_leadership=500,
        )
        response = self.client.get(
            reverse('gendox_generate_resume_docx'),
            {'student_id': self.participant.part_id, 'with_ai': 'false'},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response['Content-Type'], DOCX_CONTENT_TYPE)
        self.assertTrue(response.content.startswith(b'PK'))
        self.assertTrue(response['Content-Disposition'])


class GeographyReportTests(BaseTestCase):
    def setUp(self):
        self.client = Client()

    def test_returns_docx(self):
        response = self.client.get(reverse('gendox_geography_report'))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response['Content-Type'], DOCX_CONTENT_TYPE)
        self.assertTrue(response.content.startswith(b'PK'))

    def test_invalid_year_falls_back_to_default(self):
        response = self.client.get(
            reverse('gendox_geography_report'), {'year': '1999/2000'}
        )
        self.assertEqual(response.status_code, 200)

    def test_report_with_data(self):
        institution = Institutions.objects.create(inst_name='ТюмГУ')
        center = Competencecenters.objects.create(center_name='Центр 1')
        participant = Participants.objects.create(part_rsv_id='GEO001')
        Results.objects.create(
            res_participant=participant,
            res_year='2024/2025',
            res_course=2,
            res_institution=institution,
            res_center=center,
        )

        response = self.client.get(
            reverse('gendox_geography_report'), {'year': '2024/2025'}
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.content.startswith(b'PK'))
