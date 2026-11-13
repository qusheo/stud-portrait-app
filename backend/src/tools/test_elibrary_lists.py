import json
from argparse import Namespace
from pathlib import Path
import tempfile
import unittest
from unittest.mock import Mock

from elibrary_lists import (ListStore, PaginationError, TemporaryError, captcha_visible,
                            collector_lock, parse_entries, retry_delay, supervise, wait_for_captcha)
from parse_elibrary import Listing, PageError


class ListTests(unittest.TestCase):
    def test_collector_lock_releases_after_exit(self):
        with tempfile.TemporaryDirectory() as directory:
            with collector_lock(directory):
                with self.assertRaises(ValueError):
                    with collector_lock(directory):
                        self.fail('Second collector acquired the same lock')
            with collector_lock(directory):
                pass

    def test_supervisor_restarts_same_checkpoint_and_records_delay(self):
        with tempfile.TemporaryDirectory() as directory:
            store = ListStore(directory)
            store.save_page('test', 1, Listing([123], 1, 2, 2), [{'elibrary_id':123}], {})
            store.db.close()
            args = Namespace(work=Path(directory), collection=1, resume=True)
            runner = Mock(side_effect=[TemporaryError('Timeout'), TemporaryError('Connection reset'), None])
            wait = Mock()
            supervise(args, runner, wait)
            self.assertEqual(runner.call_count, 3)
            self.assertEqual([call.args[0] for call in wait.call_args_list], [15,30])
            store = ListStore(directory)
            self.assertEqual(store.latest(1)['next_page'], 2)
            self.assertIsNotNone(store.summary('test')['next_retry_at'])
            store.db.close()
        self.assertEqual(retry_delay(100), 300)

    def test_persistent_pagination_error_never_skips_page(self):
        with tempfile.TemporaryDirectory() as directory:
            store = ListStore(directory)
            store.save_page('test', 1, Listing([123], 1, 2, 2), [{'elibrary_id':123}], {})
            store.db.close()
            runner = Mock(side_effect=PaginationError('No new IDs'))
            with self.assertRaises(PageError):
                supervise(Namespace(work=Path(directory),collection=1,resume=True),runner,Mock())
            self.assertEqual(runner.call_count, 6)
            store = ListStore(directory)
            self.assertEqual(store.latest(1)['next_page'], 2)
            self.assertEqual(store.summary('test')['status'], 'needs_review')
            store.db.close()

    def test_captcha_wait_keeps_browser_and_only_reads_dom(self):
        challenge = '<title>Тест Тьюринга</title><form action="/check_captcha.asp"></form>'
        ready = '''Всего найдено публикаций: 1 из 1
        <input name="pagenum" value="1"><table id="restab"><tr id="a123">
        <td><a href="item.asp?id=123">Работа</a></td></tr></table>'''
        self.assertTrue(captcha_visible(challenge))
        self.assertTrue(captcha_visible('<title>Object moved</title><a href="/page_captcha.asp?rpage=test">here</a>'))
        self.assertFalse(captcha_visible(ready))
        with tempfile.TemporaryDirectory() as directory:
            store = ListStore(directory)
            store.save_page('test',1,Listing([123],1,2,2),[{'elibrary_id':123}],{})
            context = Mock()
            page = Mock()
            context.pages = [page]
            page.content.side_effect = [challenge, ready]
            wait_for_captcha(context,'https://elibrary.ru/',store,'test')
            context.close.assert_not_called()
            context.request.fetch.assert_not_called()
            page.goto.assert_called_once()
            self.assertEqual(page.wait_for_timeout.call_count,2)
            self.assertEqual(store.summary('test')['status'],'waiting_captcha')
            store.db.close()

    def test_saved_listing_metadata(self):
        sample = Path(__file__).resolve().parents[2] / '.elibrary/samples/listing.html'
        if not sample.exists():
            self.skipTest('Private samples not committed')
        listing, entries = parse_entries(sample.read_bytes())
        self.assertEqual(len(entries), 100)
        self.assertEqual(entries[0]['elibrary_id'], 89203996)
        self.assertEqual(entries[0]['publication_year'], 2026)
        self.assertTrue(entries[0]['authors_truncated'])
        self.assertEqual(entries[0]['authors'][0], 'Абрамова С.В.')
        self.assertFalse(any('и др.' in x for x in entries[0]['authors']))
        self.assertFalse(entries[1]['authors_truncated'])

    def test_resume_idempotence_and_coverage(self):
        with tempfile.TemporaryDirectory() as directory:
            store = ListStore(directory)
            first = {'elibrary_id': 123, 'title': 'Первая'}
            second = {'elibrary_id': 456, 'title': 'Вторая'}
            store.save_page('test', 1, Listing([123], 1, 2, 2), [first], {'pagenum': '2'})
            store.db.close()
            store = ListStore(directory)
            saved = store.latest(1)
            self.assertEqual(saved['next_page'], 2)
            store.stopped('test', 'Timeout\nCall log:\n cookie: private')
            self.assertEqual(store.summary('test')['last_error'], 'Timeout')
            self.assertEqual(store.summary('test')['status'], 'stopped')
            self.assertEqual(json.loads(saved['form']), {'pagenum': '2'})
            store.save_page('test', 1, Listing([123], 1, 2, 2), [first], {'pagenum': '2'})
            self.assertEqual(store.summary('test')['rows'], 1)
            with self.assertRaises(PageError):
                store.save_page('test', 1, Listing([456], 2, 3, 2), [second], {})
            self.assertEqual(store.latest(1)['next_page'], 2)
            store.save_page('test', 1, Listing([456], 2, 2, 2), [second], {})
            self.assertTrue(store.export('test')['coverage_complete'])
            self.assertEqual(len((Path(directory) / 'lists/test.jsonl').read_text(encoding='utf8').splitlines()), 2)
            store.db.close()

    def test_duplicate_page_advances_without_claiming_coverage(self):
        with tempfile.TemporaryDirectory() as directory:
            store = ListStore(directory)
            entry = {'elibrary_id': 123}
            store.save_page('test', 1, Listing([123], 1, 2, 2), [entry], {})
            store.save_page('test', 1, Listing([123], 2, 2, 2), [entry], {})
            report = store.export('test')
            self.assertEqual(report['duplicates'], 1)
            self.assertEqual(store.latest(1)['next_page'], 3)
            self.assertFalse(report['coverage_complete'])
            store.db.close()

    def test_partial_overlap_saves_new_ids_but_does_not_claim_coverage(self):
        with tempfile.TemporaryDirectory() as directory:
            store = ListStore(directory)
            first = {'elibrary_id': 123}
            second = {'elibrary_id': 456}
            store.save_page('test', 1, Listing([123], 1, 3, 2), [first], {})
            store.save_page('test', 1, Listing([123,456], 2, 3, 2), [first,second], {})
            report = store.export('test')
            self.assertEqual(report['duplicates'], 1)
            self.assertEqual(report['unique_publications'], 2)
            self.assertFalse(report['coverage_complete'])
            self.assertEqual(len((Path(directory) / 'lists/test.jsonl').read_text(encoding='utf8').splitlines()), 2)
            store.db.close()


if __name__ == '__main__':
    unittest.main()
