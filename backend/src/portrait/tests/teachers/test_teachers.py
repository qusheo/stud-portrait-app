from django.test import Client
from django.urls import reverse

from portrait.models import (
    Institutions,
    Teacher,
    TeacherDiscipline,
    TeacherEducation,
)

from ..base import BaseTestCase


class TeachersTableTests(BaseTestCase):
    def setUp(self):
        self.client = Client()

    def test_empty_table(self):
        response = self.client.get(reverse('teachers_table'))
        payload = response.json()
        self.assertTrue(payload['ok'])
        self.assertEqual(payload['data'], [])

    def test_table_with_teacher(self):
        institution = Institutions.objects.create(inst_name='ТюмГУ')
        teacher = Teacher.objects.create(
            source_row=1,
            name='Иванова Анна Петровна',
            gender='Ж',
            position='Доцент',
            institution=institution,
        )
        TeacherDiscipline.objects.create(teacher=teacher, name='Алгебра')

        response = self.client.get(reverse('teachers_table'))
        data = response.json()['data']
        self.assertEqual(len(data), 1)
        row = data[0]
        self.assertEqual(row['name'], 'Иванова Анна Петровна')
        self.assertEqual(row['institution'], 'ТюмГУ')
        self.assertEqual(row['disciplines'], ['Алгебра'])


class TeacherByIdTests(BaseTestCase):
    def setUp(self):
        self.client = Client()
        institution = Institutions.objects.create(inst_name='Тестовый университет')
        self.teacher = Teacher.objects.create(
            source_row=1,
            name='Иванова Анна Петровна',
            gender='Ж',
            position='Доцент',
            institution=institution,
            academic_degree='Кандидат физико-математических наук',
            academic_title='Доцент',
            experience=10,
        )
        TeacherEducation.objects.create(
            teacher=self.teacher,
            education_type='Высшее образование',
            direction='Математика',
            qualification='Математик',
        )
        TeacherDiscipline.objects.create(teacher=self.teacher, name='Алгебра')

    def test_teacher_by_id(self):
        response = self.client.get(reverse('teacher_by_id'), {'teacher_id': self.teacher.id})

        self.assertEqual(response.status_code, 200)
        data = response.json()['data']
        self.assertEqual(data['teacher_id'], self.teacher.id)
        self.assertEqual(data['name'], 'Иванова Анна Петровна')
        self.assertEqual(data['institution'], 'Тестовый университет')
        self.assertEqual(data['disciplines'], ['Алгебра'])
        self.assertEqual(data['education'], [{
            'education_type': 'Высшее образование',
            'direction': 'Математика',
            'qualification': 'Математик',
        }])
        self.assertEqual(data['education_details'], ['Высшее образование', 'Математика', 'Математик'])
        self.assertEqual(data['interests'], [])

    def test_teacher_by_id_not_found(self):
        response = self.client.get(reverse('teacher_by_id'), {'teacher_id': 999999})

        self.assertEqual(response.status_code, 404)
        self.assertFalse(response.json()['ok'])

    def test_teacher_by_id_invalid_param(self):
        response = self.client.get(reverse('teacher_by_id'), {'teacher_id': 'abc'})

        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.json()['ok'])
