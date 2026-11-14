"""Run with: python -m unittest discover -s src/tools -p test_parse_elibrary.py"""
import json
from argparse import Namespace
from pathlib import Path
import tempfile
import unittest
from unittest.mock import Mock

from parse_elibrary import PageError, Store, TeacherIndex, browser_options, listing_form, page_html, parse_article, parse_listing


ARTICLE = '''<html><head><meta charset="utf-8">
<link rel="canonical" href="https://elibrary.ru/item.asp?id=123"></head><body>
<table><tr><td><p class="bigtext">Название работы</p></td></tr></table>
<table><tr><td>
<div style="display: inline-block"><b>СЕМЁНОВ&nbsp;А.Б.</b><font><sup>1</sup></font></div>
<div style="display: inline-block"><b>Петров В.Г.</b><font><sup>1,2</sup></font></div>
<font><sup>1</sup></font> <span class="help1">Тюменский государственный университет</span>, Тюмень<br>
<font><sup>2</sup></font> Другой университет<br>
</td></tr></table>
<table><tr><td>Редакторы: <div style="display: inline-block"><b>Не автор</b></div></td></tr></table>
<table><tr><td>Тип: <font>статья в журнале</font> Язык: Русский</td></tr>
<tr><td>Год издания: <font>2026</font> Место издания: Тюмень</td></tr>
<tr><td>DOI: <a>10.123/test</a></td></tr></table>
<div id="abstract1">Текст аннотации.</div>
<a href="keyword_items.asp?id=1">Обучение</a><a href="keyword_items.asp?id=2">Наука</a>
<a href="keywords.asp">КЛЮЧЕВЫЕ СЛОВА</a>
<span id="rubric_grnti">Педагогика</span>
</body></html>'''


class ParsingTests(unittest.TestCase):
    def test_institution_before_author_block(self):
        html=ARTICLE.replace('<table><tr><td>\n<div style="display: inline-block">',
            '<table><tr><td>Издающая организация</td></tr></table><table><tr><td>\n<div style="display: inline-block">',1)
        self.assertEqual(len(parse_article(html)['authors']),2)

    def test_author_full_name_and_id_from_tooltip(self):
        html = ARTICLE.replace('<b>СЕМЁНОВ&nbsp;А.Б.</b>',
            '''<span class="help" title="&lt;b&gt;Семёнов Алексей Борисович&lt;/b&gt;&lt;br&gt;&lt;a href='/author_profile.asp?authorid=1234'&gt;Профиль&lt;/a&gt;"><b>СЕМЁНОВ&nbsp;А.Б.</b></span>''')
        author = parse_article(html)['authors'][0]
        self.assertEqual(author['name'],'СЕМЁНОВ А.Б.')
        self.assertEqual(author['full_name'],'Семёнов Алексей Борисович')
        self.assertEqual(author['elibrary_author_id'],1234)

    def test_software_certificate_metadata(self):
        html = ARTICLE.replace('статья в журнале</font> Язык: Русский',
            'свидетельство</font> Номер свидетельства: RU 123 Патентное ведомство: Россия Год публикации: 2025')
        html = html.replace('Год издания: <font>2026</font>', 'Страниц: <font>2</font>')
        data = parse_article(html)
        self.assertEqual(data['publication_type'], 'свидетельство')
        self.assertEqual(data['publication_year'], 2025)

    def test_pagination_post_preserves_filters_without_selecting_records(self):
        html = '''<form name="results"><input name="id" value="12">
        <input name="pagenum" value="1"><input type="hidden" name="token" value="keep">
        <input type="checkbox" name="tid123"><input type="checkbox" name="filter" checked>
        <select name="sortorder"><option value="0">A</option><option value="1" selected>B</option></select>
        <input type="submit" name="delete" value="Delete"></form>'''
        values = listing_form(html, 2, 1817422)
        self.assertEqual(values, {'id': '1817422', 'pagenum': '2', 'token': 'keep', 'filter': 'on', 'sortorder': '1'})

    def test_navigation_race_is_retried_but_other_errors_stop(self):
        from playwright.sync_api import Error
        page = Mock()
        page.content.side_effect = [Error('Unable to retrieve content because the page is navigating and changing the content.'), ARTICLE]
        self.assertEqual(page_html(page), ARTICLE)
        self.assertEqual(page.wait_for_load_state.call_count, 2)
        page.content.side_effect = Error('Target closed')
        with self.assertRaises(PageError):
            page_html(page)

    def test_browser_executable_and_channel(self):
        with tempfile.TemporaryDirectory() as directory:
            executable = Path(directory) / 'brave.exe'
            executable.touch()
            args = Namespace(executable=executable, browser='brave', channel=None)
            self.assertEqual(browser_options(args), {'executable_path': str(executable.resolve())})
            args.executable = Path(directory) / 'missing.exe'
            with self.assertRaises(ValueError):
                browser_options(args)
        self.assertEqual(browser_options(Namespace(executable=None, browser='chrome', channel=None)), {'channel': 'chrome'})

    def test_article_fields_and_editors(self):
        value = parse_article(ARTICLE.encode('utf8'), 123)
        self.assertEqual(value['title'], 'Название работы')
        self.assertEqual(value['publication_year'], 2026)
        self.assertIsNone(value['publication_date'])
        self.assertEqual(value['publication_type'], 'статья в журнале')
        self.assertEqual(value['doi'], '10.123/test')
        self.assertEqual(value['keywords'], ['Обучение', 'Наука'])
        self.assertEqual(len(value['authors']), 2)
        self.assertEqual(len(value['authors'][1]['affiliations']), 2)
        self.assertIn('Тюменский', value['authors'][0]['affiliations'][0])

    def test_cp1251(self):
        html = ARTICLE.replace('utf-8', 'windows-1251').encode('cp1251')
        self.assertEqual(parse_article(html)['title'], 'Название работы')

    def test_wrong_id_and_login(self):
        with self.assertRaises(PageError):
            parse_article(ARTICLE, 999)
        with self.assertRaises(PageError):
            parse_article('<html>Войдите в систему</html>')
        with self.assertRaises(PageError):
            parse_listing('<html>Войдите в систему</html>')

    def test_captcha(self):
        with self.assertRaises(PageError):
            parse_article(ARTICLE + '<input name="captcha">')
        with self.assertRaises(PageError):
            parse_listing('<title>Тест Тьюринга</title><form action="/check_captcha.asp"></form>')

    def test_stable_hash(self):
        self.assertEqual(parse_article(ARTICLE)['content_hash'], parse_article(ARTICLE)['content_hash'])
        self.assertNotEqual(parse_article(ARTICLE)['content_hash'],
                            parse_article(ARTICLE.replace('Название работы', 'Новая работа'))['content_hash'])

    def test_upsert_and_jsonl(self):
        with tempfile.TemporaryDirectory() as directory:
            store = Store(directory)
            store.save(parse_article(ARTICLE))
            store.save(parse_article(ARTICLE.replace('Название работы', 'Новая работа')))
            out = Path(directory) / 'export.jsonl'
            store.export(out)
            lines = out.read_text(encoding='utf8').splitlines()
            self.assertEqual(len(lines), 1)
            self.assertEqual(json.loads(lines[0])['title'], 'Новая работа')
            store.db.close()

    def test_initials_are_candidates_including_collisions(self):
        index = TeacherIndex([(1, 'Семенов Алексей Борисович'), (2, 'Семёнов Антон Борисович')])
        self.assertEqual(index.match('СЕМЁНОВ А.Б.'), [(1, 'initials', 'candidate'), (2, 'initials', 'candidate')])
        self.assertEqual(index.match('Семенов Алексей Борисович'), [(1, 'full_name', 'confirmed')])
        self.assertEqual(index.match('Семенов Андрей Борисович'), [])
        self.assertEqual(index.match('Семенов'), [])

    def test_duplicate_directory_names_not_confirmed(self):
        index = TeacherIndex([(1, 'Петров Иван Иванович'), (2, 'Петров Иван Иванович')])
        self.assertTrue(all(status == 'candidate' for _, _, status in index.match('Петров Иван Иванович')))

    def test_real_saved_samples_when_available(self):
        samples = Path(__file__).resolve().parents[2] / '.elibrary/samples'
        if not (samples / 'listing.html').exists():
            self.skipTest('Private user samples are intentionally not committed')
        listing = parse_listing((samples / 'listing.html').read_bytes())
        self.assertEqual((listing.page, listing.total, listing.last_page), (1, 57695, 577))
        self.assertEqual(len(listing.ids), 100)
        self.assertEqual(listing.ids[0], 89203996)
        article = parse_article((samples / 'article.html').read_bytes(), listing.ids[0])
        self.assertEqual(article['publication_type'], 'монография')
        self.assertEqual(article['publication_year'], 2026)
        self.assertEqual(article['edn'], 'FXIZXY')
        self.assertEqual(len(article['authors']), 43)
        self.assertTrue(article['abstract'])
        self.assertTrue(any('Тюменский' in org for author in article['authors'] for org in author['affiliations']))


if __name__ == '__main__':
    unittest.main()
