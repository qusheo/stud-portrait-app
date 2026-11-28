import json

from django.test import Client
from django.urls import reverse

from portrait.models import Participants

from ..base import BaseTestCase


class AuditSchemaTests(BaseTestCase):
    def setUp(self):
        self.client = Client()

    def test_schema_returns_tables(self):
        response = self.client.get(reverse('audit_schema'))
        payload = response.json()
        self.assertTrue(payload['ok'])
        schema = payload['schema']
        self.assertGreater(schema['total_tables'], 0)
        table_names = {table['name'] for table in schema['tables']}
        self.assertIn('participants', table_names)

    def test_schema_filtered_by_table(self):
        response = self.client.get(reverse('audit_schema'), {'table_name': 'participants'})
        payload = response.json()
        self.assertEqual(payload['schema']['total_tables'], 1)
        table = payload['schema']['tables'][0]
        self.assertEqual(table['name'], 'participants')
        self.assertEqual(table['row_count'], 0)
        column_names = {column['name'] for column in table['columns']}
        self.assertIn('part_rsv_id', column_names)

    def test_schema_counts_rows(self):
        Participants.objects.create(part_rsv_id='AUD001')
        response = self.client.get(reverse('audit_schema'), {'table_name': 'participants'})
        table = response.json()['schema']['tables'][0]
        self.assertEqual(table['row_count'], 1)


class TableSampleDataTests(BaseTestCase):
    def setUp(self):
        self.client = Client()

    def test_table_name_required(self):
        response = self.client.get(reverse('audit_table_data'))
        self.assertEqual(response.status_code, 400)

    def test_unknown_table(self):
        response = self.client.get(
            reverse('audit_table_data'), {'table_name': 'no_such_table'}
        )
        self.assertEqual(response.status_code, 404)

    def test_sample_rows_and_limit(self):
        for index in range(3):
            Participants.objects.create(part_rsv_id=f'AUD{index:03d}')

        response = self.client.get(reverse('audit_table_data'), {
            'table_name': 'participants',
            'limit': 2,
        })
        self.assertEqual(response.status_code, 200)
        sample = response.json()['sample']
        self.assertEqual(sample['total_rows'], 3)
        self.assertEqual(len(sample['rows']), 2)
        self.assertIn('part_rsv_id', sample['columns'])


class ExecuteRawSqlTests(BaseTestCase):
    def setUp(self):
        self.client = Client()

    def post_query(self, query):
        return self.client.post(
            reverse('audit_sql'),
            data=json.dumps({'query': query}),
            content_type='application/json',
        )

    def test_query_required(self):
        response = self.post_query('')
        self.assertEqual(response.status_code, 400)

    def test_forbidden_statements(self):
        for query in (
            "DROP TABLE participants",
            "DELETE FROM participants",
            "UPDATE participants SET part_gender = 1",
            "SELECT * FROM participants; DROP TABLE participants",
        ):
            with self.subTest(query=query):
                response = self.post_query(query)
                self.assertEqual(response.status_code, 400)

    def test_select_query(self):
        Participants.objects.create(part_rsv_id='AUD001')
        response = self.post_query(
            "SELECT part_rsv_id FROM participants WHERE part_rsv_id = 'AUD001'"
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()['data']
        self.assertEqual(data['row_count'], 1)
        self.assertEqual(data['columns'], ['part_rsv_id'])
        self.assertEqual(data['rows'][0]['part_rsv_id'], 'AUD001')

    def test_wrong_method(self):
        response = self.client.get(reverse('audit_sql'))
        self.assertEqual(response.status_code, 405)


class DatabaseStatsTests(BaseTestCase):
    def test_stats(self):
        response = Client().get(reverse('audit_stats'))
        payload = response.json()
        self.assertTrue(payload['ok'])
        info = payload['info']
        self.assertGreater(info['total_tables'], 0)
        self.assertGreater(info['db_size_mb'], 0)
        self.assertEqual(info['db_engine'], 'postgresql')
