import json

from django.contrib.auth import get_user_model
from django.db import connection
from django.test import Client
from django.urls import reverse

from portrait.models import Participants, User as PortraitUser

from ..base import BaseTestCase


def create_interests_tables():
    with connection.cursor() as cursor:
        cursor.execute(
            "CREATE TABLE IF NOT EXISTS interests (code text PRIMARY KEY)"
        )
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS participant_interests (
                participant_id integer NOT NULL,
                interest_code text NOT NULL,
                UNIQUE (participant_id, interest_code)
            )
            """
        )
        for code in ("science", "sport", "art"):
            cursor.execute(
                "INSERT INTO interests (code) VALUES (%s) ON CONFLICT DO NOTHING",
                [code],
            )


class StudentInterestsTests(BaseTestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        create_interests_tables()

    def setUp(self):
        self.client = Client()
        self.participant = Participants.objects.create(part_rsv_id='INT001')
        django_user = get_user_model().objects.create_user(
            username='int_tester', password='password'
        )
        PortraitUser.objects.create(
            django_user=django_user,
            account_type=PortraitUser.AccountType.STUDENT,
            participant=self.participant,
        )
        self.user = django_user

    def login(self):
        self.client.force_login(self.user)

    def update(self, changes):
        return self.client.patch(
            reverse('update_student_interests'),
            data=json.dumps({
                'student_id': self.participant.part_id,
                'changes': changes,
            }),
            content_type='application/json',
        )

    def test_get_requires_authentication(self):
        response = self.client.get(
            reverse('get_student_interests'),
            {'student_id': self.participant.part_id},
        )
        self.assertEqual(response.status_code, 401)

    def test_get_invalid_student_id(self):
        response = self.client.get(reverse('get_student_interests'))
        self.assertEqual(response.status_code, 400)

        response = self.client.get(
            reverse('get_student_interests'), {'student_id': 'abc'}
        )
        self.assertEqual(response.status_code, 400)

    def test_get_student_not_found(self):
        self.login()
        response = self.client.get(
            reverse('get_student_interests'), {'student_id': 999999}
        )
        self.assertEqual(response.status_code, 404)

    def test_get_empty_interests(self):
        self.login()
        response = self.client.get(
            reverse('get_student_interests'),
            {'student_id': self.participant.part_id},
        )
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload['ok'])
        self.assertEqual(payload['data']['interests'], [])

    def test_update_adds_and_removes_interests(self):
        self.login()

        response = self.update({'science': True, 'sport': True})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json()['data']['interests'], ['science', 'sport']
        )

        response = self.update({'science': False})
        self.assertEqual(response.json()['data']['interests'], ['sport'])

    def test_update_rejects_unknown_codes(self):
        self.login()
        response = self.update({'unknown_code': True})
        self.assertEqual(response.status_code, 400)

    def test_update_validates_payload(self):
        self.login()
        response = self.client.patch(
            reverse('update_student_interests'),
            data=json.dumps({'student_id': 'str', 'changes': {}}),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 400)

        response = self.client.patch(
            reverse('update_student_interests'),
            data=json.dumps({
                'student_id': self.participant.part_id,
                'changes': {'science': 'yes'},
            }),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 400)

    def test_update_forbidden_for_other_student(self):
        other = Participants.objects.create(part_rsv_id='INT002')
        self.login()
        response = self.client.patch(
            reverse('update_student_interests'),
            data=json.dumps({'student_id': other.part_id, 'changes': {'science': True}}),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 403)

    def test_update_unauthenticated(self):
        response = self.update({'science': True})
        self.assertEqual(response.status_code, 403)
