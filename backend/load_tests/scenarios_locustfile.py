import itertools
import os
import random

from locust import HttpUser, between, tag, task

COURSES = [1, 2, 3, 4]
COMPETENCY = "res_comp_leadership"

SEED_USERS = itertools.cycle(
    [
        ("seed_admin", "StudPortrait-Test-2026!"),
        ("seed_centre", "StudPortrait-Test-2026!"),
        ("seed_teacher", "StudPortrait-Test-2026!"),
        ("seed_student", "StudPortrait-Test-2026!"),
    ]
)


class StudPortraitUser(HttpUser):
    wait_time = between(0.5, 2)
    host = os.getenv("LT_HOST", "http://localhost:8000")

    def on_start(self):
        self.institutions = [9]
        self.students = [1028]
        self._toggle = False
        self.username, self.password = next(SEED_USERS)
        self._login()
        try:
            r = self.client.get("/portrait/get-institutions/", name="setup/get-institutions")
            ids = [i["inst_id"] for i in r.json()["institutions"]]
            if ids:
                self.institutions = ids
        except Exception:
            pass
        try:
            r = self.client.get("/portrait/students/list/?limit=100", name="setup/students-list")
            ids = [s["id"] for s in r.json()["data"]]
            if ids:
                self.students = ids
        except Exception:
            pass

    def _login(self):
        self.csrf_token = ""
        try:
            r = self.client.get("/portrait/auth/csrf/", name="setup/csrf")
            self.csrf_token = r.json()["csrfToken"]
            r = self.client.post(
                "/portrait/auth/login/",
                json={"username": self.username, "password": self.password},
                headers={"X-CSRFToken": self.csrf_token},
                name="setup/login",
            )
            if r.status_code != 200:
                self.csrf_token = ""
                return
            r = self.client.get("/portrait/auth/csrf/", name="setup/csrf-after-login")
            self.csrf_token = r.json()["csrfToken"]
        except Exception:
            self.csrf_token = ""

    def _sid(self):
        return random.choice(self.students)

    def _iid(self):
        return random.choice(self.institutions)

    @tag("LT-01", "LT-09")
    @task(10)
    def lt01_admin_panel(self):
        self.client.get("/portrait/dashboard-stats/", name="LT-01/dashboard-stats")
        self.client.get("/portrait/overall-stats/", name="LT-01/overall-stats")
        self.client.get(
            f"/portrait/competency-average-by-years/?competency={COMPETENCY}",
            name="LT-01/comp-avg-by-years",
        )
        self.client.post(
            "/portrait/get-boxplot-data/",
            json={"competency": COMPETENCY, "group_by": "auto"},
            name="LT-01/boxplot",
        )

    @tag("LT-02", "LT-09")
    @task(10)
    def lt02_filters(self):
        self.client.get("/portrait/get-available-years/", name="LT-02/years")
        self.client.get("/portrait/Filter-options/", name="LT-02/filter-options")
        self.client.get(
            f"/portrait/get-filter-options-with-counts/?institution_ids[]={self._iid()}&courses[]={random.choice(COURSES)}",
            name="LT-02/filter-options-counts",
        )
        self.client.get(
            f"/portrait/courses/?institution_ids[]={self._iid()}",
            name="LT-02/courses",
        )

    @tag("LT-03", "LT-09")
    @task(10)
    def lt03_search(self):
        self.client.get(
            f"/portrait/students/list/?limit={random.choice([20, 50])}",
            name="LT-03/students-list",
        )
        self.client.get("/portrait/get-institutions/", name="LT-03/institutions")
        self.client.get(
            f"/portrait/get-directions/?institution_ids[]={self._iid()}",
            name="LT-03/directions",
        )

    @tag("LT-04", "LT-09")
    @task(20)
    def lt04_matching(self):
        self.client.get(
            f"/portrait/matching/get_matching_students/?student_id={self._sid()}"
            f"&amount={random.choice([5, 10])}&course={random.choice(COURSES)}",
            name="LT-04/matching-students",
        )

    @tag("LT-05", "LT-09")
    @task(20)
    def lt05_by_requirements(self):
        self.client.post(
            "/portrait/students/by-requirements/",
            json={
                "requirements": {
                    "competencies": {COMPETENCY: random.choice(["medium", "high"])}
                },
                "courses": [random.choice(COURSES)],
                "limit": 20,
            },
            name="LT-05/by-requirements",
        )

    @tag("LT-06", "LT-09")
    @task(8)
    def lt06_portrait(self):
        self.client.get(
            f"/portrait/students/portrait/?student_id={self._sid()}",
            name="LT-06/student-portrait",
        )

    @tag("LT-07", "LT-09")
    @task(8)
    def lt07_interests(self):
        self.client.get("/portrait/student-interests-options/", name="LT-07/interests-options")
        self.client.get(
            "/portrait/interests/get_student_interests/?student_id=30",
            name="LT-07/interests-read",
        )
        if not self.csrf_token:
            return
        self._toggle = not self._toggle
        with self.client.patch(
            "/portrait/interests/update_student_interests/",
            json={"student_id": 30, "changes": {"charity": self._toggle}},
            headers={"X-CSRFToken": self.csrf_token},
            name="LT-07/interests-update",
            catch_response=True,
        ) as r:
            if r.status_code in (200, 403):
                r.success()
            else:
                r.failure(f"HTTP {r.status_code}")

    @tag("LT-08", "LT-09")
    @task(10)
    def lt08_analytics(self):
        self.client.get(
            "/portrait/centers-by-region/?year=2024/2025",
            name="LT-08/centers-by-region",
        )
        self.client.post(
            "/portrait/get-discipline-heatmap-data/",
            json={"institution_ids": [self._iid()], "direction_ids": []},
            name="LT-08/discipline-heatmap",
        )
        self.client.get("/portrait/motivator-statistics/", name="LT-08/motivator-statistics")
