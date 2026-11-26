from unittest import TestCase
from unittest.mock import patch
from types import SimpleNamespace
from django.test import RequestFactory
from portrait.endpoints.scienceService.science import summarize
from portrait.endpoints.science import response


class StatisticsTests(TestCase):
    def test_classifiers_are_counted_separately(self):
        result=summarize([
            {'year':2024,'teacher_ids':[1],'keywords':[], 'topics':{'rubric_oecd':'Law','rubric_grnti':'Constitutional law'}},
            {'year':2025,'teacher_ids':[1],'keywords':[], 'topics':{'rubric_oecd':'Law','rubric_grnti':'нет'}},
        ])
        self.assertEqual(result['direction_groups']['rubric_oecd']['count'],1)
        self.assertEqual(result['direction_groups']['rubric_oecd']['items'],[{'name':'Law','count':2}])
        self.assertEqual(result['direction_groups']['rubric_grnti']['count'],1)

    def test_language_groups_are_selected_before_top_limit(self):
        result=summarize([{'year':2024,'teacher_ids':[1],
            'keywords':['a'+str(i) for i in range(30)]+['конституция'], 'topics':{}}])
        self.assertEqual(result['topic_groups']['ru'],[{'name':'конституция','count':1}])
        self.assertEqual(len(result['topic_groups']['latin']),20)

    def test_unique_keywords_and_coauthors(self):
        result = summarize(
            [
                {
                    "year": 2024,
                    "teacher_ids": [1, 2],
                    "keywords": ["Машинное обучение", "машинное обучение"],
                    "topics": {"oecd": "Computer sciences"},
                },
                {
                    "year": None,
                    "teacher_ids": [2],
                    "keywords": [],
                    "topics": {"vak": "нет"},
                },
            ]
        )
        self.assertEqual(result["publications_count"], 2)
        self.assertEqual(result["teachers_count"], 2)
        self.assertEqual(
            result["popular_topics"], [{"name": "машинное обучение", "count": 1}]
        )
        self.assertEqual(result["directions_count"], 1)
        self.assertEqual(
            result["coverage"],
            {"with_keywords": 1, "with_topics": 1, "unknown_year": 1},
        )

    def test_empty_statistics(self):
        self.assertEqual(summarize([])["publications_count"], 0)

    def request(self, query=""):
        request = RequestFactory().get("/science/statistics/" + query)
        request.user = SimpleNamespace(is_authenticated=True)
        return request

    def test_requires_authentication(self):
        request = self.request()
        request.user.is_authenticated = False
        self.assertEqual(response(request).status_code, 401)

    @patch("portrait.endpoints.auth.get_account_type", return_value="student")
    def test_student_cannot_read_admin_statistics(self, _):
        self.assertEqual(response(self.request()).status_code, 403)

    @patch("portrait.endpoints.auth.get_account_type", return_value="admin")
    def test_invalid_year(self, _):
        self.assertEqual(response(self.request("?year=hello")).status_code, 400)

    @patch("portrait.endpoints.auth.get_account_type", return_value="admin")
    @patch("portrait.endpoints.science.activity", return_value=None)
    def test_missing_schema_returns_actionable_error(self, *_):
        self.assertEqual(response(self.request()).status_code, 503)
