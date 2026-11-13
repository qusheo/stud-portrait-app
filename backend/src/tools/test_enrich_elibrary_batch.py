from pathlib import Path
import sqlite3
import tempfile
import unittest
import csv
import json

from enrich_elibrary_batch import plan_batch,Progress,login_required
from export_elibrary_card_details import export_details


class BatchTests(unittest.TestCase):
    def test_readable_card_csv_preserves_multiline_abstract(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory)
            cards=root/'cards'
            cards.mkdir()
            value={'elibrary_id':1,'title':'Название, с запятой','authors':[{'name':'Иванов И.И.',
                'full_name':'Иванов Иван Иванович','affiliations':['ТюмГУ']}],
                'abstract':'Первая строка\nВторая строка','keywords':['наука','данные']}
            (cards/'1.json').write_text(json.dumps(value,ensure_ascii=False),encoding='utf8')
            target=root/'details.csv'
            self.assertEqual(export_details(cards,target),1)
            with target.open(encoding='utf-8-sig',newline='') as source:
                rows=list(csv.DictReader(source))
            self.assertEqual(rows[0]['abstract'],value['abstract'])
            self.assertEqual(rows[0]['authors'],'Иванов Иван Иванович')
            self.assertEqual(rows[0]['keywords'],'наука; данные')

    def test_logged_out_access_response_is_not_a_card(self):
        self.assertTrue(login_required('<p>Доступ для незарегистрированных пользователей ограничен.</p>'))
        self.assertTrue(login_required('<p>Укажите имя пользователя и пароль.</p>'))
        self.assertFalse(login_required('<p class="bigtext">Статья</p>'))

    def test_plan_resumes_exact_ids_and_new_batch_excludes_prior(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory)
            db=root/'sample.sqlite3'
            conn=sqlite3.connect(db)
            conn.execute('CREATE TABLE teacher_matches (elibrary_id INTEGER)')
            conn.executemany('INSERT INTO teacher_matches VALUES (?)',[(i,) for i in range(1,11)])
            conn.commit()
            conn.close()
            work=root/'work'
            first,_=plan_batch(db,work,4)
            resumed,_=plan_batch(db,work,8)
            self.assertEqual(first['ids'],resumed['ids'])
            self.assertEqual(resumed['size'],4)
            second,_=plan_batch(db,work,4,new=True)
            self.assertFalse(set(first['ids'])&set(second['ids']))
            progress=Progress(work)
            progress.save(first['ids'][0],'parsed')
            progress.save(first['ids'][1],'failed','Timeout\nCall log:\n cookie: secret')
            report=progress.status(first,'stopped')
            self.assertEqual(report['counts'],{'parsed':1,'failed':1,'pending':2})
            error=progress.conn.execute('SELECT error FROM cards WHERE status=\'failed\'').fetchone()[0]
            self.assertEqual(error,'Timeout')
            progress.conn.close()


if __name__=='__main__':
    unittest.main()
