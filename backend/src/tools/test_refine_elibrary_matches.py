import unittest
import tempfile
from pathlib import Path
import hashlib
import json
import sqlite3
from contextlib import closing

from parse_elibrary import TeacherIndex
from parse_elibrary import Listing
from elibrary_lists import ListStore
from prepare_elibrary_sample import prepare
from test_match_elibrary_lists import TEACHERS, publication
from refine_elibrary_matches import evidence_for_author, refine


class RefinementTests(unittest.TestCase):
    def test_additional_card_author_does_not_overwrite_listing_or_source(self):
        with tempfile.TemporaryDirectory() as directory:
            store=ListStore(directory)
            entry=dict(publication(123,['Другой В.В.']),bibliography='2026',metadata_source='listing')
            store.save_page('test',1,Listing([123],1,1,1),[entry],{})
            store.db.close()
            sample=Path(directory)/'sample'
            prepare(directory,TEACHERS,'hash',sample)
            source=sample/'analysis.sqlite3'
            before=hashlib.sha256(source.read_bytes()).hexdigest()
            cards=sample/'cards'
            cards.mkdir()
            card={'elibrary_id':123,'authors':[{'name':'Сидорова А.С.','full_name':'Сидорова Анна Сергеевна',
                'elibrary_author_id':777,'affiliations':['Тюменский государственный университет']}]}
            (cards/'123.json').write_text(json.dumps(card,ensure_ascii=False),encoding='utf8')
            target=sample/'refined.sqlite3'
            report=refine(source,cards,target)
            self.assertEqual(report['additional_candidate_links'],1)
            self.assertEqual(report['supported_publications'],1)
            self.assertEqual(before,hashlib.sha256(source.read_bytes()).hexdigest())
            with closing(sqlite3.connect(target)) as conn:
                self.assertEqual(conn.execute('SELECT name FROM publication_authors').fetchone()[0],'Другой В.В.')
                self.assertEqual(conn.execute('SELECT count(*) FROM teacher_matches').fetchone()[0],0)
                self.assertEqual(conn.execute('SELECT teacher_id FROM supported_teacher_publications').fetchone()[0],3)
                self.assertEqual(conn.execute('PRAGMA foreign_key_check').fetchall(),[])

    def test_full_name_and_organization_required(self):
        index=TeacherIndex([(1,'Иванов Иван Иванович'),(2,'Иванов Илья Иванович')])
        author={'name':'Иванов И.И.','full_name':'Иванов Иван Иванович',
                'affiliations':['Тюменский государственный университет']}
        self.assertEqual(evidence_for_author(author,index),[(1,'full_name_affiliation_supported')])
        author['affiliations']=['Тюменский государственный медицинский университет']
        self.assertEqual(evidence_for_author(author,index),[(1,'full_name_supported')])
        author['full_name']='Иванов И.И.'
        self.assertTrue(all(verdict=='initials_only' for _,verdict in evidence_for_author(author,index)))
        author['full_name']='Иванов Игорь Иванович'
        self.assertEqual(evidence_for_author(author,index),[])

    def test_duplicate_full_names_remain_ambiguous(self):
        index=TeacherIndex([(1,'Иванов Иван Иванович'),(2,'Иванов Иван Иванович')])
        author={'name':'Иванов И.И.','full_name':'Иванов Иван Иванович',
                'affiliations':['Тюменский государственный университет']}
        self.assertEqual(evidence_for_author(author,index),
                         [(1,'ambiguous_directory_name'),(2,'ambiguous_directory_name')])


if __name__=='__main__':
    unittest.main()
