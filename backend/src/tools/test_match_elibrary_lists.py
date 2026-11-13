import json
from contextlib import closing
from pathlib import Path
import tempfile
import unittest
import sqlite3

from elibrary_lists import ListStore
from match_elibrary_lists import build_report, close_dump, load_teachers, match_entries
from parse_elibrary import Listing
from prepare_elibrary_sample import prepare


TEACHERS = [
    {'id':1,'name':'Петров Иван Иванович','institution':'ТюмГУ','source_row':1},
    {'id':2,'name':'Петров Илья Иванович','institution':'ТюмГУ','source_row':2},
    {'id':3,'name':'Сидорова Анна Сергеевна','institution':'ТюмГУ','source_row':3},
]


def publication(item_id,authors,truncated=False):
    return {'elibrary_id':item_id,'authors':authors,'authors_truncated':truncated,
            'authors_missing':not bool(authors),'title':'Исследование','publication_year':2026,
            'source_url':f'https://elibrary.ru/item.asp?id={item_id}'}


class MatchingTests(unittest.TestCase):
    def test_frozen_sample_preserves_candidates_and_source_incompleteness(self):
        with tempfile.TemporaryDirectory() as directory:
            store = ListStore(directory)
            entry = dict(publication(123,['Петров И.И.']),bibliography='2026',metadata_source='listing')
            store.save_page('test',1,Listing([123],1,2,2),[entry],{})
            store.stopped('test','User chose current sample',status='paused')
            store.db.close()
            output = Path(directory)/'sample'
            manifest = prepare(directory,TEACHERS,'test-hash',output)
            self.assertFalse(manifest['coverage_complete'])
            self.assertEqual(manifest['scope'],'frozen_collected_sample')
            self.assertEqual(manifest['publications_with_visible_matches'],1)
            with closing(sqlite3.connect(output/'analysis.sqlite3')) as conn:
                self.assertEqual(conn.execute('SELECT count(*) FROM teacher_matches').fetchone()[0],2)
                self.assertEqual(conn.execute("SELECT count(*) FROM teacher_matches WHERE status='confirmed'").fetchone()[0],0)
                self.assertEqual(conn.execute('PRAGMA foreign_key_check').fetchall(),[])
            # A second generated snapshot replaces the database without duplicating rows.
            prepare(directory,TEACHERS,'test-hash',output)

    def test_collisions_and_unknown_authors_are_not_lost(self):
        entries = [publication(1,['Петров И.И.']),publication(2,[]),
            publication(3,['Сидорова А.С.'],True),publication(4,['Другой В.В.']),
            publication(5,['Другой В.В.'],True),publication(6,['Сидорова Анна Сергеевна'])]
        counts,pairs,queue,by_teacher = match_entries(TEACHERS,entries)
        self.assertEqual(counts['publications_with_visible_matches'],3)
        self.assertEqual(counts['candidate_pairs'],4)
        self.assertEqual(counts['cards_to_consider'],5)
        self.assertEqual(counts['cards_truncated_authors'],1)
        self.assertEqual(counts['cards_missing_authors'],1)
        self.assertEqual(counts['publications_with_confirmed_full_names'],1)
        self.assertTrue(all(p['status']=='candidate' for p in pairs if p['elibrary_id']==1))
        self.assertEqual(by_teacher[3],{3,6})
        self.assertEqual(len({x['elibrary_id'] for x in queue}),len(queue))

    def test_dump_column_order_and_original_ids(self):
        import pgdumplib
        from pgdumplib import constants
        with tempfile.TemporaryDirectory() as directory:
            dump = pgdumplib.new('test')
            entry = dump.add_entry(desc=constants.TABLE,namespace='public',tag='teacher_directory',
                defn='CREATE TABLE public.teacher_directory (name text, id bigint, institution text, source_row integer);')
            with dump.table_data_writer(entry,['name','id','institution','source_row']) as writer:
                writer.append('Петров Иван Иванович',123,'ТюмГУ',7)
            path = Path(directory)/'test.dump'
            dump.save(path)
            close_dump(dump)
            rows = load_teachers(path)
            self.assertEqual(rows,[{'id':123,'name':'Петров Иван Иванович','institution':'ТюмГУ','source_row':7}])

    def test_partial_report_does_not_claim_final_counts(self):
        with tempfile.TemporaryDirectory() as directory:
            store = ListStore(directory)
            entry = publication(123,['Петров И.И.'])
            store.save_page('test',1,Listing([123],1,2,2),[entry],{})
            store.db.close()
            report = build_report(directory,TEACHERS,'test-hash','test')
            self.assertFalse(report['is_final'])
            self.assertEqual(report['teacher_directory_rows'],3)
            self.assertEqual(report['publications_with_visible_matches'],1)
            self.assertEqual(report['teacher_rows_with_matches'],2)
            self.assertEqual(len((Path(directory)/'matches/test/card_candidates.jsonl').read_text(encoding='utf8').splitlines()),1)
            self.assertFalse(json.loads((Path(directory)/'matches/latest.json').read_text(encoding='utf8'))['coverage_complete'])


if __name__=='__main__':
    unittest.main()
