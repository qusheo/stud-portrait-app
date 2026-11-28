import json

from django.contrib.auth import get_user_model
from django.test import Client
from django.urls import reverse

from portrait.models import User as PortraitUser

from ..base import BaseTestCase


def make_user(username='tester', password='password', account_type='admin', participant=None):
    django_user = get_user_model().objects.create_user(
        username=username, password=password
    )
    if account_type is not None:
        PortraitUser.objects.create(
            django_user=django_user,
            account_type=account_type,
            participant=participant,
        )
    return django_user


def post_login(client, body):
    return client.post(
        reverse('auth_login'),
        data=json.dumps(body),
        content_type='application/json',
    )


class CsrfTokenTests(BaseTestCase):
    def test_csrf_token(self):
        response = Client().get(reverse('auth_csrf'))
        payload = response.json()
        self.assertTrue(payload['ok'])
        self.assertTrue(payload['csrfToken'])

    def test_wrong_method(self):
        response = Client().post(reverse('auth_csrf'))
        self.assertEqual(response.status_code, 405)


class LoginTests(BaseTestCase):
    def setUp(self):
        self.client = Client()
        self.user = make_user()

    def test_success(self):
        response = post_login(self.client, {'username': 'tester', 'password': 'password'})
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload['ok'])
        self.assertTrue(payload['is_authenticated'])
        self.assertEqual(payload['account_type'], 'admin')
        self.assertEqual(payload['username'], 'tester')

    def test_wrong_password(self):
        response = post_login(self.client, {'username': 'tester', 'password': 'wrong'})
        self.assertEqual(response.status_code, 401)
        self.assertFalse(response.json()['ok'])

    def test_unknown_user(self):
        response = post_login(self.client, {'username': 'ghost', 'password': 'password'})
        self.assertEqual(response.status_code, 401)

    def test_missing_credentials(self):
        response = post_login(self.client, {'username': 'tester'})
        self.assertEqual(response.status_code, 400)

        response = post_login(self.client, {'username': '  ', 'password': 'password'})
        self.assertEqual(response.status_code, 400)

    def test_invalid_json(self):
        response = self.client.post(
            reverse('auth_login'),
            data='not json',
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 400)

    def test_user_without_portrait_account(self):
        get_user_model().objects.create_user(username='plain', password='password')
        response = post_login(self.client, {'username': 'plain', 'password': 'password'})
        self.assertEqual(response.status_code, 403)

    def test_wrong_method(self):
        response = self.client.get(reverse('auth_login'))
        self.assertEqual(response.status_code, 405)


class CurrentUserTests(BaseTestCase):
    def setUp(self):
        self.client = Client()

    def test_anonymous(self):
        response = self.client.get(reverse('auth_current_user'))
        self.assertEqual(response.status_code, 401)
        self.assertFalse(response.json()['is_authenticated'])

    def test_authenticated(self):
        user = make_user()
        self.client.force_login(user)
        response = self.client.get(reverse('auth_current_user'))
        payload = response.json()
        self.assertTrue(payload['ok'])
        self.assertEqual(payload['account_type'], 'admin')
        self.assertEqual(payload['username'], 'tester')

    def test_authenticated_without_role(self):
        get_user_model().objects.create_user(username='plain', password='password')
        self.client.force_login(get_user_model().objects.get(username='plain'))
        response = self.client.get(reverse('auth_current_user'))
        self.assertEqual(response.status_code, 403)


class LogoutTests(BaseTestCase):
    def test_logout(self):
        client = Client()
        user = make_user()
        client.force_login(user)

        response = client.post(reverse('auth_logout'))
        payload = response.json()
        self.assertTrue(payload['ok'])
        self.assertFalse(payload['is_authenticated'])

        response = client.get(reverse('auth_current_user'))
        self.assertEqual(response.status_code, 401)


class UserPermissionsTests(BaseTestCase):
    def setUp(self):
        self.client = Client()

    def test_anonymous(self):
        response = self.client.get(reverse('user_permissions'))
        self.assertEqual(response.status_code, 401)

    def test_admin_has_all_permissions(self):
        user = make_user()
        self.client.force_login(user)
        permissions = self.client.get(reverse('user_permissions')).json()['permissions']
        self.assertTrue(all(permissions.values()))

    def test_institution_admin_lacks_service_sections(self):
        user = make_user(
            username='inst_admin',
            account_type=PortraitUser.AccountType.INSTITUTION_ADMIN,
        )
        self.client.force_login(user)
        permissions = self.client.get(reverse('user_permissions')).json()['permissions']
        self.assertTrue(permissions['canViewStats'])
        self.assertFalse(permissions['canViewAudit'])
        self.assertFalse(permissions['canViewUpload'])
        self.assertFalse(permissions['canViewSql'])
        self.assertTrue(permissions['canViewOwnPortrait'])
        self.assertTrue(permissions['canViewOwnReport'])

    def test_student_has_only_own_sections(self):
        user = make_user(
            username='student',
            account_type=PortraitUser.AccountType.STUDENT,
        )
        self.client.force_login(user)
        permissions = self.client.get(reverse('user_permissions')).json()['permissions']
        self.assertTrue(permissions['canViewOwnPortrait'])
        self.assertTrue(permissions['canViewOwnReport'])
        self.assertFalse(permissions['canViewStats'])
        self.assertFalse(permissions['canViewTeachers'])

    def test_user_without_account(self):
        get_user_model().objects.create_user(username='plain', password='password')
        self.client.force_login(get_user_model().objects.get(username='plain'))
        response = self.client.get(reverse('user_permissions'))
        self.assertEqual(response.status_code, 403)
