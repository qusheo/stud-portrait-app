from contextlib import closing
import json
import math
from pathlib import Path
import sqlite3
import tempfile
import unittest

from elibrary_lists import ListStore
from elibrary_title_vectors import build,encode,fit,search
from elibrary_title_vectors import tokens
from elibrary_detail_vectors import build_details
from export_elibrary_sample import copy_text,export
from parse_elibrary import Listing
from prepare_elibrary_sample import prepare
from refine_elibrary_matches import refine
from test_match_elibrary_lists import TEACHERS,publication


class DeliveryTests(unittest.TestCase):
    def test_normalization_and_keyword_phrases(self):
        features=tokens('Другие нейронными сетями; обработка естественного языка',field='keywords')
        self.assertIn('нейронный сеть',features)
        self.assertIn('обработка естественный язык',features)
        self.assertNotIn('другой',features)
        self.assertNotIn('сеть обработка',features)

    def test_sparse_vectors_are_normalized_and_deterministic(self):
        titles=['Кошки в доме','Собаки в лесу','Кошки и собаки']
        model=fit(titles,min_df=1)
        self.assertEqual(model['model_id'],fit(list(reversed(titles)),min_df=1)['model_id'])
        indices,weights=encode('КОШКИ кошки дом',model)
        self.assertEqual(indices,sorted(indices))
        self.assertAlmostEqual(sum(x*x for x in weights),1)
        self.assertEqual(encode('несуществующийтермин',model),([],[]))

    def test_copy_escaping_preserves_null_and_literal_null_marker(self):
        self.assertEqual(copy_text(None),r'\N')
        self.assertEqual(copy_text(r'\N'),r'\\N')
        self.assertEqual(copy_text('а\tб\nв\r\\.'),r'а\tб\nв\r\\.')
        with self.assertRaises(ValueError):
            copy_text('\x00')

    def test_export_roundtrip_and_search(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory)
            store=ListStore(root)
            entries=[dict(publication(1,['Сидорова А.С.']),title="Кошки\t'\\.\nисследование",bibliography='2026',metadata_source='listing'),
                     dict(publication(2,['Другой В.В.']),title='Собаки исследование',bibliography='2026',metadata_source='listing')]
            store.save_page('test',1,Listing([1,2],1,2,1),entries,{})
            store.db.close()
            sample=root/'sample'
            prepare(root,TEACHERS,'hash',sample)
            cards=sample/'cards'
            cards.mkdir()
            card={'elibrary_id':1,'abstract':'Исследование кошек', 'keywords':['кошки','биология'],'authors':[{'name':'Сидорова А.С.','full_name':'Сидорова Анна Сергеевна',
                'elibrary_author_id':123,'affiliations':['Тюменский государственный университет']}]}
            (cards/'1.json').write_text(json.dumps(card,ensure_ascii=False),encoding='utf8')
            refine(sample/'analysis.sqlite3',cards,sample/'refined.sqlite3')
            summary=build(sample/'refined.sqlite3',sample/'ready.sqlite3',min_df=1)
            self.assertEqual(summary['publications'],2)
            self.assertEqual(search(sample/'ready.sqlite3','кошки')[0]['elibrary_id'],1)
            detail=build_details(sample/'ready.sqlite3')
            self.assertEqual(detail['abstract']['documents'],1)
            self.assertEqual(detail['keywords']['documents'],1)
            with closing(sqlite3.connect(sample/'ready.sqlite3')) as conn:
                conn.execute('CREATE TABLE teacher_source_rows (teacher_id INTEGER PRIMARY KEY REFERENCES teacher_directory,payload TEXT NOT NULL)')
                conn.execute("INSERT INTO teacher_source_rows SELECT id,'{}' FROM teacher_directory")
                conn.commit()
                self.assertEqual(conn.execute('SELECT count(*) FROM publication_detail_vectors WHERE elibrary_id=2').fetchone()[0],0)
                for weights, in conn.execute('SELECT weights FROM publication_detail_vectors'):
                    self.assertAlmostEqual(sum(w*w for w in json.loads(weights)),1)
            result=export(sample/'ready.sqlite3',root/'delivery')
            self.assertTrue(result['archive_roundtrip_verified'])
            self.assertEqual(result['tables']['publications'],2)
            self.assertEqual(result['tables']['publication_title_vectors'],2)
            self.assertFalse(result['postgresql_restore_tested'])


if __name__=='__main__':
    unittest.main()
