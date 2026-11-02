import itertools
import os

from locust import HttpUser, between, task


SEED_USERS = (
    ('seed_admin', 'admin'),
    ('seed_centre', 'centre'),
    ('seed_institution_admin', 'institution_admin'),
    ('seed_teacher', 'teacher'),
    ('seed_student', 'student'),
)
SEED_PASSWORD = os.getenv('SEED_PASSWORD', 'StudPortrait-Test-2026!')
seed_user_cycle = itertools.cycle(SEED_USERS)


GET_ENDPOINTS = (
    ('health', '/portrait/health/'),
    ('auth csrf', '/portrait/auth/csrf/'),
    ('current user', '/portrait/auth/me/'),
    ('user permissions', '/portrait/user/permissions/'),
    ('audit schema', '/portrait/audit/schema/'),
    ('audit table data', '/portrait/audit/table-data/?table_name=participants&limit=5'),
    ('audit stats', '/portrait/audit/stats/'),
    ('dataload expected fields', '/portrait/dataload/expected-fields/'),
    ('dataload templates', '/portrait/dataload/templates/'),
    ('student VAM', '/portrait/analyze-student-vam/?student_id={student_id}&competency={competency}'),
    ('institutions', '/portrait/get-institutions/'),
    ('directions', '/portrait/get-directions/'),
    ('all disciplines impact', '/portrait/analyze-all-disciplines-impact/'),
    ('disciplines', '/portrait/get-disciplines/'),
    ('student discipline impact', '/portrait/analyze-student-discipline-impact/?student_id={student_id}'),
    ('education profiles comparison', '/portrait/education-profiles-comparison/'),
    ('student comparison stats', '/portrait/student-comparison-stats/?student_id={student_id}&year={year}'),
    ('analyze transfers', '/portrait/analyze-transfers/'),
    ('interest options', '/portrait/student-interests-options/'),
    ('student interests', '/portrait/interests/get_student_interests/?student_id={student_id}'),
    ('duplicate accounts', '/portrait/duplicate-accounts/'),
    ('possible duplicate accounts', '/portrait/possible-duplicate-accounts/'),
    ('courses', '/portrait/courses/'),
    ('institution directions', '/portrait/get-institution-directions/'),
    ('filter options with counts', '/portrait/get-filter-options-with-counts/'),
    ('student results', '/portrait/student-results/?stud_id={student_id}'),
    ('centers by region', '/portrait/centers-by-region/?year={year}'),
    ('students list', '/portrait/students/list/?limit=20'),
    ('student portrait', '/portrait/students/portrait/?student_id={student_id}'),
    ('student by id', '/portrait/students/byId/?student_id={student_id}'),
    ('motivator statistics', '/portrait/motivator-statistics/?group_by=course'),
    ('dashboard stats', '/portrait/dashboard-stats/'),
    ('motivation counts', '/portrait/motivation-counts/'),
    ('filter options', '/portrait/Filter-options/'),
    ('overall stats', '/portrait/overall-stats/'),
    ('scores result', '/portrait/scores-result/'),
    ('competency boxplot', '/portrait/comp-boxplot/'),
    ('available years', '/portrait/get-available-years/'),
    ('competency average by years', '/portrait/competency-average-by-years/'),
    ('grades competency correlation', '/portrait/grades-competency-correlation/'),
    ('competency trend by year', '/portrait/competency-trend-by-year/'),
    ('top correlations', '/portrait/top-correlations/'),
    ('competency segmentation', '/portrait/competency-segmentation/?competency={competency}'),
    ('teachers table', '/portrait/teachers/get_teachers_table/'),
    ('teacher by id', '/portrait/teachers/byId/?teacher_id={teacher_id}'),
    ('matching teachers', '/portrait/matching/get_matching_teachers_by_student/?student_id={student_id}'),
    ('match groups', '/portrait/matching/get_match_groups/'),
    ('matching students', '/portrait/matching/get_matching_students/?student_id={student_id}&amount=1'),
    ('curriculum parse log', '/portrait/parse-curriculum/log/'),
    ('curriculum mappings', '/portrait/parse-curriculum/mappings/'),
    ('student resume data', '/portrait/gendox/student-resume-data/?student_id={student_id}&year={year}&with_ai=false'),
)


class SeedApiUser(HttpUser):
    wait_time = between(0.1, 0.3)

    def on_start(self):
        self.username, self.account_type = next(seed_user_cycle)
        self.login_seed_user()

        self.student_id = os.getenv('STUDENT_ID', '')
        self.teacher_id = os.getenv('TEACHER_ID', '1')
        self.year = os.getenv('TEST_YEAR', '2024/2025')
        self.competency = os.getenv('TEST_COMPETENCY', 'res_comp_leadership')

        if not self.student_id:
            self.find_student()

    def login_seed_user(self):
        with self.client.get(
            '/portrait/auth/csrf/',
            name='setup: csrf',
            catch_response=True,
            timeout=30,
        ) as response:
            try:
                csrf_token = response.json()['csrfToken'] if response.status_code == 200 else ''
            except (ValueError, KeyError):
                csrf_token = ''

            if csrf_token:
                response.success()
            else:
                response.failure(f'Cannot get CSRF token: HTTP {response.status_code}')
                return

        with self.client.post(
            '/portrait/auth/login/',
            json={'username': self.username, 'password': SEED_PASSWORD},
            headers={'X-CSRFToken': csrf_token},
            name='setup: login',
            catch_response=True,
            timeout=30,
        ) as response:
            try:
                payload = response.json()
            except ValueError:
                payload = {}

            if response.status_code == 200 and payload.get('ok') is True:
                response.success()
            else:
                response.failure(
                    f"Login failed for {self.username}: HTTP {response.status_code}: "
                    f"{payload.get('message', response.text[:200])}"
                )

    def find_student(self):
        with self.client.get(
            '/portrait/students/list/?limit=1',
            name='setup: find student',
            catch_response=True,
            timeout=30,
        ) as response:
            if response.status_code != 200:
                response.failure(f'Cannot get a student: HTTP {response.status_code}')
                return

            try:
                students = response.json().get('data', [])
            except ValueError:
                response.failure('Students list returned non-JSON response')
                return

            if students:
                self.student_id = str(students[0]['id'])
                response.success()
            else:
                response.failure('Students list is empty; set STUDENT_ID explicitly')

        self.student_id = self.student_id or '1'

    @task
    def call_public_get_endpoints(self):
        for name, path in GET_ENDPOINTS:
            rendered_path = path.format(
                student_id=self.student_id,
                teacher_id=self.teacher_id,
                year=self.year,
                competency=self.competency,
            )
            with self.client.get(
                rendered_path,
                name=f'GET {name}',
                catch_response=True,
                timeout=120,
            ) as response:
                if response.status_code != 200:
                    response.failure(f'HTTP {response.status_code}: {response.text[:300]}')
                    continue

                try:
                    payload = response.json()
                except ValueError:
                    response.failure('Expected JSON response')
                    continue

                if isinstance(payload, dict) and payload.get('ok') is False:
                    response.failure(payload.get('message', 'API returned ok=false'))
                else:
                    response.success()
