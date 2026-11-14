"""Offline parsing, resumable browser collection and PostgreSQL import for eLIBRARY.

See backend/docs/elibrary.md. Browser profile and downloaded HTML are private local data.
"""
from __future__ import annotations

import argparse
import csv
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import sqlite3
import statistics
import subprocess
import sys
import time
import unicodedata
from urllib.parse import parse_qs, urlparse

from bs4 import BeautifulSoup

BACKEND = Path(__file__).resolve().parents[3]
DEFAULT_WORK = BACKEND / '.elibrary'
SQL = Path(__file__).resolve().parent / 'sql'
BASE = 'https://www.elibrary.ru'


class PageError(ValueError):
    """Login, blocking, unexpected layout or wrong page; never mark as completed."""


def clean(value):
    return re.sub(r'\s+', ' ', str(value).replace('\xa0', ' ')).strip()


def text(node):
    return clean(node.get_text(' ', strip=True)) if node else ''


def digest(value):
    return hashlib.sha256(value.encode('utf-8')).hexdigest()


def soup_for(html):
    # Saved browser pages are UTF-8; live pages may specify windows-1251.
    soup = BeautifulSoup(html, 'html.parser')
    for tag in soup(['script', 'style']):
        tag.decompose()
    visible = text(soup).casefold()
    if any(x in visible for x in (
        'доступ к сайту временно заблокирован', 'подтвердите, что вы не робот',
        'доступ с вашего ip', 'слишком много запросов', 'доступ ограничен',
        'тест тьюринга', 'необычно много запросов',
    )) or soup.select_one('input[name="captcha"], img[src*="captcha"], form[action*="check_captcha"]'):
        raise PageError('Блокировка/CAPTCHA: требуется вмешательство в браузере.')
    return soup


@dataclass
class Listing:
    ids: list[int]
    page: int
    total: int
    last_page: int


def parse_listing(html):
    soup = soup_for(html)
    table = soup.select_one('#restab')
    if not table:
        raise PageError('Нет таблицы #restab: проверьте вход и доступ к подборке.')
    ids = []
    for row in table.select('tr[id]'):
        match = re.fullmatch(r'a(\d+)', row.get('id', ''))
        if match:
            item_id = int(match[1])
            if not row.select_one(f'a[href*="item.asp?id={item_id}"]'):
                raise PageError(f'Не найдена ссылка в строке {item_id}.')
            ids.append(item_id)
    visible = text(soup)
    total = re.search(r'Всего найдено публикаций:\s*([\d\s]+?)\s+из', visible)
    current = soup.select_one('input[name="pagenum"]')
    pages = [int(m) for a in soup.select('a[href]')
             for m in re.findall(r'goto_page\((\d+)\)', a['href'])]
    if not total or not current or not ids or len(set(ids)) != len(ids):
        raise PageError('Не удалось проверить счётчик, номер страницы или ID публикаций.')
    return Listing(ids, int(current['value']), int(re.sub(r'\s', '', total[1])), max(pages, default=1))


def field_value(soup, label):
    # Leaf table cells prevent matching the whole navigation/outer document.
    pattern = re.compile(re.escape(label) + r'\s*:\s*', re.I)
    for cell in soup.select('td'):
        if cell.find('table'):
            continue
        value = text(cell)
        found = pattern.search(value)
        if found:
            tail = value[found.end():]
            return re.split(r'\s+(?:Язык|Год издания|Место издания|Число страниц|Тип|Номер свидетельства|Патентное ведомство|Год публикации)\s*:', tail)[0].strip()
    return None


def parse_article(html, expected_id=None):
    soup = soup_for(html)
    canonical = soup.select_one('link[rel="canonical"]')
    source = canonical.get('href', '') if canonical else ''
    item_id = parse_qs(urlparse(source).query).get('id', [None])[0]
    heading = soup.select_one('p.bigtext')
    if not item_id or not str(item_id).isdigit() or not heading:
        raise PageError('Нет ID/заголовка карточки: проверьте авторизацию и разметку.')
    item_id = int(item_id)
    if expected_id is not None and item_id != expected_id:
        raise PageError(f'Ожидалась карточка {expected_id}, получена {item_id}.')
    # Organization-only tables can precede authors. Never take editors/reviewers as authors.
    title_table = heading.find_parent('table')
    author_table = None
    for candidate in title_table.find_all_next('table', limit=6):
        caption = text(candidate)
        if re.match(r'^(?:Редакторы|Рецензенты|Составители|Члены редакционной|Тип\s*:)', caption, re.I):
            break
        if candidate.select_one('div[style*="inline-block"] b'):
            author_table = candidate
            break
    authors = []
    affiliations = {}
    if author_table:
        for marker in author_table.select('font > sup'):
            if marker.find_parent('div', style=re.compile('inline-block')):
                continue
            fragments = []
            for sibling in marker.parent.next_siblings:
                if getattr(sibling, 'name', None) == 'br':
                    break
                fragments.append(sibling.get_text(' ', strip=True) if hasattr(sibling, 'get_text') else str(sibling))
            value = clean(' '.join(fragments))
            if value:
                affiliations[text(marker)] = value
        for block in author_table.select('div[style*="inline-block"]'):
            name = block.find('b')
            if not name:
                continue
            marker = block.find('sup')
            indices = re.findall(r'\d+', text(marker))
            link = block.select_one('a[href*="authorid="]')
            tooltip = block.select_one('span.help[title]')
            tooltip_soup = BeautifulSoup(tooltip['title'], 'html.parser') if tooltip else None
            full_name = text(tooltip_soup.find('b')) if tooltip_soup else None
            if not link and tooltip_soup:
                link = tooltip_soup.select_one('a[href*="authorid="]')
            author_id = None
            if link:
                found = re.search(r'authorid=(\d+)', link['href'])
                author_id = int(found[1]) if found else None
            authors.append({'name': text(name), 'full_name': full_name or None, 'elibrary_author_id': author_id,
                            'affiliations': [affiliations[i] for i in indices if i in affiliations]})
    if not authors:
        raise PageError('Авторский блок не распознан; карточка не будет отмечена обработанной.')
    abstract = text(soup.select_one('#abstract1')) or None
    keywords = []
    for link in soup.select('a[href*="keyword_items.asp"]'):
        word = text(link)
        if word and word not in keywords:
            keywords.append(word)
    # Some layouts use a text value without keyword links.
    if not keywords:
        value = field_value(soup, 'Ключевые слова')
        if value:
            keywords = [clean(x) for x in re.split(r'[,;]', value) if clean(x)]
    year_text = field_value(soup, 'Год издания') or field_value(soup, 'Год публикации') or field_value(soup, 'Год') or ''
    year = re.search(r'\b(1[5-9]\d{2}|20\d{2}|21\d{2})\b', year_text)
    # Never manufacture January 1 from a year or use a patent application date.
    date_text = field_value(soup, 'Дата публикации') or ''
    date_match = re.search(r'\b(\d{2}\.\d{2}\.\d{4})\b', date_text)
    pubdate = datetime.strptime(date_match[1], '%d.%m.%Y').date().isoformat() if date_match else None
    doi = field_value(soup, 'DOI')
    edn = field_value(soup, 'EDN')
    topics = {key: text(soup.select_one('#' + key)) for key in
              ('rubric_grnti', 'rubric_vak', 'rubric_oecd') if soup.select_one('#' + key)}
    result = {'elibrary_id': item_id, 'source_url': f'{BASE}/item.asp?id={item_id}',
            'title': text(heading), 'abstract': abstract, 'keywords': keywords,
              'publication_type': field_value(soup, 'Тип'),
              'publication_year': int(year[1]) if year else None,
              'publication_date': pubdate, 'doi': doi, 'edn': edn, 'topics': topics,
              'authors': authors}
    result['content_hash'] = digest(json.dumps(result, ensure_ascii=False, sort_keys=True))
    result['fetched_at'] = datetime.now(timezone.utc).isoformat()
    return result


def normalize_name(name):
    name = unicodedata.normalize('NFKC', name).casefold().replace('ё', 'е')
    return re.findall(r'[а-яa-z]+(?:[-’\'][а-яa-z]+)*', name)


class TeacherIndex:
    def __init__(self, teachers):
        self.full = {}
        self.initials = {}
        for teacher_id, name in teachers:
            parts = normalize_name(name)
            if len(parts) < 2:
                continue
            self.full.setdefault(tuple(parts), []).append(teacher_id)
            key = (parts[0], tuple(x[0] for x in parts[1:]))
            self.initials.setdefault(key, []).append(teacher_id)

    def match(self, name):
        parts = normalize_name(name)
        if len(parts) < 2:
            return []
        full = self.full.get(tuple(parts), [])
        if full and all(len(x) > 1 for x in parts[1:]):
            return [(tid, 'full_name', 'confirmed' if len(full) == 1 else 'candidate') for tid in full]
        # A fully spelled out different name must not fall back to initials.
        if any(len(x) > 1 for x in parts[1:]):
            return []
        return [(tid, 'initials', 'candidate') for tid in
                self.initials.get((parts[0], tuple(parts[1:])), [])]


class Store:
    def __init__(self, work):
        self.work = Path(work)
        self.work.mkdir(parents=True, exist_ok=True)
        self.db = sqlite3.connect(self.work / 'progress.sqlite3')
        self.db.executescript('''
            CREATE TABLE IF NOT EXISTS items (
                id INTEGER PRIMARY KEY, payload TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS discovered (
                collection_id INTEGER NOT NULL, id INTEGER NOT NULL,
                PRIMARY KEY(collection_id,id));
            CREATE TABLE IF NOT EXISTS scans (
                collection_id INTEGER PRIMARY KEY, next_page INTEGER NOT NULL,
                total INTEGER NOT NULL, complete INTEGER NOT NULL DEFAULT 0);
        ''')

    def save(self, article):
        with self.db:
            self.db.execute('INSERT INTO items VALUES (?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload',
                            (article['elibrary_id'], json.dumps(article, ensure_ascii=False)))

    def export(self, path):
        with Path(path).open('w', encoding='utf-8') as output:
            for (payload,) in self.db.execute('SELECT payload FROM items ORDER BY id'):
                output.write(payload + '\n')


def atomic_write(path, content):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + '.tmp')
    temporary.write_text(content, encoding='utf-8')
    temporary.replace(path)


def browser_options(args):
    if args.executable:
        path = args.executable.resolve()
        if not path.is_file():
            raise ValueError(f'Браузер не найден: {path}')
        return {'executable_path': str(path)}
    if args.browser == 'brave':
        candidates = [Path(os.environ.get(root, '')) / 'BraveSoftware/Brave-Browser/Application/brave.exe'
                      for root in ('PROGRAMFILES', 'PROGRAMFILES(X86)', 'LOCALAPPDATA')]
        path = next((path for path in candidates if path.is_file()), None)
        if not path:
            raise ValueError('Brave не найден. Укажите --executable полный_путь_к_brave.exe')
        return {'executable_path': str(path)}
    return {'channel': args.channel or args.browser}


def page_html(page):
    from playwright.sync_api import Error as BrowserError
    for attempt in range(4):
        try:
            page.wait_for_load_state('domcontentloaded', timeout=60000)
            return page.content()
        except BrowserError as error:
            if 'navigating and changing' not in str(error) or attempt == 3:
                raise PageError(f'Не удалось прочитать загруженную страницу: {error}') from error
            page.wait_for_timeout(500)


def listing_form(html, number, collection):
    soup = soup_for(html)
    form = soup.select_one('form[name="results"]')
    if not form or not form.select_one('input[name="pagenum"]'):
        raise PageError('Не найдена форма переключения страниц.')
    values = {}
    for element in form.select('input[name],select[name],textarea[name]'):
        name = element['name']
        if element.has_attr('disabled'):
            continue
        if element.name == 'input':
            kind = element.get('type', 'text').lower()
            if kind in ('submit', 'button', 'image', 'file'):
                continue
            if kind in ('checkbox', 'radio') and not element.has_attr('checked'):
                continue
            values[name] = element.get('value', 'on' if kind in ('checkbox', 'radio') else '')
        elif element.name == 'select':
            selected = element.select_one('option[selected]') or element.select_one('option')
            if selected:
                values[name] = selected.get('value', text(selected))
        else:
            values[name] = element.get_text()
    values.update(id=str(collection), pagenum=str(number))
    return values


def probe_http(args):
    """Two listing requests and a bounded sequential sample of cards."""
    from playwright.sync_api import Error as BrowserError, sync_playwright
    work = Path(args.work)
    results = []
    url = f'{BASE}/itembox_items.asp?id={args.collection}'
    with sync_playwright() as playwright:
        context = playwright.chromium.launch_persistent_context(
            str(work.resolve() / f'browser-profile-{args.browser}'),
            headless=False, args=['--disable-gpu'], **browser_options(args))
        try:
            blank = context.new_page()
            user_agent = blank.evaluate('navigator.userAgent')

            def request(label, method, target, **kwargs):
                started = time.perf_counter()
                try:
                    response = context.request.fetch(target, method=method, timeout=45000,
                        headers={'User-Agent': user_agent, 'Referer': url}, **kwargs)
                except BrowserError as error:
                    raise PageError(f'{label}: прямой запрос не удался: {error}') from error
                elapsed = round(time.perf_counter() - started, 3)
                body = response.body()
                report = {'request': label, 'status': response.status, 'seconds': elapsed, 'bytes': len(body)}
                results.append(report)
                print(json.dumps(report, ensure_ascii=False), flush=True)
                (work / 'http-probe').mkdir(parents=True, exist_ok=True)
                (work / 'http-probe' / f'{label}.html').write_bytes(body)
                if response.status >= 400:
                    raise PageError(f'{label}: HTTP {response.status}, дальнейшие запросы отменены.')
                return body

            first_html = request('listing-get-1', 'GET', url)
            first = parse_listing(first_html)
            if first.page != 1:
                raise PageError(f'GET вернул страницу {first.page} вместо 1; POST не отправлен.')
            results[-1].update(page=first.page, items=len(first.ids), total=first.total)
            time.sleep(2)
            second_html = request('listing-post-2', 'POST', url,
                                  form=listing_form(first_html, 2, args.collection))
            second = parse_listing(second_html)
            if second.page != 2 or second.ids == first.ids:
                raise PageError('POST не подтвердил переход на страницу 2.')
            results[-1].update(page=second.page, items=len(second.ids), total=second.total)
            pool = list(dict.fromkeys(first.ids + second.ids))
            size = min(args.articles, len(pool))
            selected = [pool[round(i * (len(pool) - 1) / (size - 1))] for i in range(size)] if size > 1 else pool[:1]
            for item_id in selected:
                time.sleep(2)
                article_html = request(f'article-{item_id}', 'GET', f'{BASE}/item.asp?id={item_id}')
                soup_for(article_html)  # CAPTCHA/blocking always stops the whole test.
                try:
                    article = parse_article(article_html, item_id)
                except PageError as error:
                    if 'Авторский блок не распознан' not in str(error):
                        raise
                    results[-1].update(elibrary_id=item_id, parse_error=str(error))
                    print(f'{item_id}: авторская разметка требует проверки', flush=True)
                    continue
                atomic_write(work / 'http-probe' / f'article-{item_id}.json',
                             json.dumps(article, ensure_ascii=False, indent=2))
                results[-1].update(elibrary_id=item_id, authors=len(article['authors']),
                                   has_abstract=bool(article['abstract']), keywords=len(article['keywords']),
                                   publication_type=article['publication_type'])
            timings = [r['seconds'] for r in results if r['request'].startswith('article-')]
            print(json.dumps({'cards': len(timings), 'parsed': sum('authors' in r for r in results),
                              'median_seconds': round(statistics.median(timings), 3),
                              'mean_seconds': round(statistics.mean(timings), 3),
                              'max_seconds': max(timings)}, ensure_ascii=False), flush=True)
            print('Проверка завершена. Массовый сбор не запускался.', flush=True)
        finally:
            atomic_write(work / 'http-probe' / 'report.json', json.dumps(results, ensure_ascii=False, indent=2))
            context.close()


def collect(args):
    from playwright.sync_api import Error as BrowserError, sync_playwright
    store = Store(args.work)
    url = f'{BASE}/itembox_items.asp?id={args.collection}'
    # A new monthly scan always starts at page 1; --resume explicitly continues an interrupted scan.
    saved = store.db.execute('SELECT next_page,total,complete FROM scans WHERE collection_id=?',
                            (args.collection,)).fetchone()
    start = saved[0] if args.resume and saved and not saved[2] else 1
    with sync_playwright() as playwright:
        context = playwright.chromium.launch_persistent_context(
            str(Path(args.work).resolve() / f'browser-profile-{args.browser}'),
            headless=False, args=['--disable-gpu'] if args.disable_gpu else [], **browser_options(args))
        try:
            page = context.pages[0] if context.pages else context.new_page()
            try:
                page.goto(url, wait_until='domcontentloaded', timeout=60000)
            except BrowserError as error:
                if not args.login:
                    raise PageError(f'Не удалось открыть подборку: {error}') from error
                print('Страница не загрузилась автоматически. Откройте подборку в этом окне вручную.', flush=True)
            if args.login:
                input('Войдите в eLIBRARY в открытом браузере, затем нажмите Enter здесь: ')
                try:
                    parse_listing(page_html(page))
                except PageError:
                    page.goto(url, wait_until='domcontentloaded', timeout=60000)
            parse_listing(page_html(page))  # Validate access before following the pagination.
            detail = context.new_page()
            previous_ids = None
            scanned = 0
            number = start
            while True:
                if number != 1:
                    time.sleep(args.delay)
                    with page.expect_navigation(wait_until='domcontentloaded', timeout=60000):
                        page.evaluate('(n) => { isnew=0; goto_page(n); }', number)
                html = page_html(page)
                listing = parse_listing(html)
                if listing.page != number or listing.ids == previous_ids:
                    raise PageError('Переход страницы не подтверждён; прогресс сохранён.')
                previous_ids = listing.ids
                atomic_write(Path(args.work) / 'listings' / str(args.collection) / f'{number}.html', html)
                with store.db:
                    store.db.executemany('INSERT OR IGNORE INTO discovered VALUES (?,?)',
                                         [(args.collection, i) for i in listing.ids])
                    store.db.execute('INSERT INTO scans VALUES (?,?,?,0) ON CONFLICT(collection_id) '
                                     'DO UPDATE SET next_page=excluded.next_page,total=excluded.total,complete=0',
                                     (args.collection, number, listing.total))
                for item_id in listing.ids:
                    if not args.refresh and store.db.execute('SELECT 1 FROM items WHERE id=?', (item_id,)).fetchone():
                        continue
                    raw_path = Path(args.work) / 'articles' / f'{item_id}.html'
                    if raw_path.exists() and not args.refresh:
                        article = parse_article(raw_path.read_bytes(), item_id)
                    else:
                        time.sleep(args.delay)
                        response = detail.goto(f'{BASE}/item.asp?id={item_id}', wait_until='domcontentloaded', timeout=60000)
                        if response and response.status >= 400:
                            raise PageError(f'HTTP {response.status}, ID {item_id}; запуск остановлен.')
                        raw = page_html(detail)
                        try:
                            article = parse_article(raw, item_id)
                        except PageError:
                            atomic_write(Path(args.work) / 'errors' / f'{item_id}.html', raw)
                            raise
                        atomic_write(raw_path, raw)
                    store.save(article)
                    print(f'{number}/{listing.last_page}: {item_id} {article["title"][:80]}', flush=True)
                finished = number == listing.last_page
                with store.db:
                    store.db.execute('UPDATE scans SET next_page=?,complete=? WHERE collection_id=?',
                                     (number + 1, int(finished), args.collection))
                scanned += 1
                if finished or (args.max_pages and scanned >= args.max_pages):
                    break
                number += 1
            unique = store.db.execute('SELECT count(*) FROM discovered WHERE collection_id=?', (args.collection,)).fetchone()[0]
            print(f'Известно ID: {unique}; в текущей выдаче: {listing.total}. '
                  'Подборка должна обновляться владельцем; сборщик читает её текущее содержимое.')
        finally:
            context.close()
            store.export(Path(args.work) / 'publications.jsonl')


def resolve_dsn():
    dsn = os.environ.get("ELIBRARY_DATABASE_URL")
    if dsn:
        return dsn
    from dotenv import load_dotenv
    here = Path(__file__).resolve()
    load_dotenv(here.parents[2] / ".env")  # backend/.env (локальная разработка)
    load_dotenv(here.parents[1] / ".env")  # backend/src/.env (контейнер)
    return "dbname={} user={} password={} host={} port={}".format(
        os.environ["DB_NAME"], os.environ["DB_USER"], os.environ["DB_PASSWORD"],
        os.environ.get("DB_HOST", "localhost"), os.environ.get("DB_PORT", "5432"))


def connect():
    import psycopg
    return psycopg.connect(resolve_dsn())


def import_db(args):
    from psycopg.types.json import Jsonb
    store = Store(args.work)
    with connect() as conn:
        teachers = TeacherIndex(conn.execute('SELECT id,name FROM teacher').fetchall())
        count = 0
        for (payload,) in store.db.execute('SELECT payload FROM items ORDER BY id'):
            data = json.loads(payload)
            with conn.transaction():
                conn.execute('''INSERT INTO elibrary_publications
                    (elibrary_id,source_url,title,abstract,keywords,publication_type,publication_year,
                     publication_date,doi,edn,topics,content_hash,raw_data,fetched_at)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                    ON CONFLICT(elibrary_id) DO UPDATE SET
                    source_url=excluded.source_url,title=excluded.title,abstract=excluded.abstract,
                    keywords=excluded.keywords,publication_type=excluded.publication_type,
                    publication_year=excluded.publication_year,publication_date=excluded.publication_date,
                    doi=excluded.doi,edn=excluded.edn,topics=excluded.topics,content_hash=excluded.content_hash,
                    raw_data=excluded.raw_data,fetched_at=excluded.fetched_at''',
                    (data['elibrary_id'], data['source_url'], data['title'], data['abstract'], Jsonb(data['keywords']),
                     data['publication_type'], data['publication_year'], data['publication_date'], data['doi'],
                     data['edn'], Jsonb(data['topics']), data['content_hash'], Jsonb(data), data['fetched_at']))
                item_id = data['elibrary_id']
                for field in ('title', 'abstract', 'keywords'):
                    value = '; '.join(data[field]) if field == 'keywords' else data[field]
                    if value:
                        conn.execute('DELETE FROM elibrary_embeddings WHERE elibrary_id=%s AND field=%s AND input_hash<>%s',
                                     (item_id, field, digest(value)))
                    else:
                        conn.execute('DELETE FROM elibrary_embeddings WHERE elibrary_id=%s AND field=%s', (item_id, field))
                # Do not silently attach manual decisions to a changed author order.
                existing = conn.execute('SELECT author_order,name FROM elibrary_authors WHERE elibrary_id=%s ORDER BY author_order',
                                        (item_id,)).fetchall()
                incoming = [(n, author['name']) for n, author in enumerate(data['authors'], 1)]
                if existing and existing != incoming:
                    reviewed = conn.execute('SELECT 1 FROM elibrary_teacher_matches WHERE elibrary_id=%s '
                                            'AND (method=\'manual\' OR reviewed_at IS NOT NULL) LIMIT 1', (item_id,)).fetchone()
                    if reviewed:
                        raise ValueError(f'ID {item_id}: авторский состав изменился, есть ручные решения; требуется проверка.')
                    conn.execute('DELETE FROM elibrary_authors WHERE elibrary_id=%s', (item_id,))
                for number, author in enumerate(data['authors'], 1):
                    conn.execute('''INSERT INTO elibrary_authors VALUES (%s,%s,%s,%s,%s)
                        ON CONFLICT(elibrary_id,author_order) DO UPDATE SET name=excluded.name,
                        elibrary_author_id=excluded.elibrary_author_id,affiliations=excluded.affiliations''',
                        (item_id, number, author['name'], author['elibrary_author_id'], Jsonb(author['affiliations'])))
                    conn.execute('DELETE FROM elibrary_teacher_matches WHERE elibrary_id=%s AND author_order=%s '
                                 'AND method<>\'manual\' AND reviewed_at IS NULL AND status<>\'rejected\'', (item_id, number))
                    for tid, method, status in teachers.match(author['name']):
                        conn.execute('''INSERT INTO elibrary_teacher_matches
                            (elibrary_id,author_order,teacher_id,method,status) VALUES (%s,%s,%s,%s,%s)
                            ON CONFLICT DO NOTHING''', (item_id, number, tid, method, status))
                for (collection_id,) in store.db.execute('SELECT collection_id FROM discovered WHERE id=?', (item_id,)):
                    conn.execute('''INSERT INTO elibrary_collection_items VALUES (%s,%s,now())
                        ON CONFLICT(collection_id,elibrary_id) DO UPDATE SET last_seen_at=now()''', (collection_id, item_id))
            conn.commit()
            count += 1
        print(f'Загружено публикаций: {count}. Повторный импорт также ищет новых преподавателей.')


def embed(args):
    # Optional heavy dependency from the project's ML environment.
    from sentence_transformers import SentenceTransformer
    model = SentenceTransformer(args.model)
    with connect() as conn:
        ids = conn.execute('SELECT elibrary_id FROM elibrary_publications ORDER BY elibrary_id').fetchall()
        for (item_id,) in ids:
            row = conn.execute('SELECT title,abstract,keywords FROM elibrary_publications WHERE elibrary_id=%s', (item_id,)).fetchone()
            for field, value in zip(('title', 'abstract', 'keywords'), (row[0], row[1], '; '.join(row[2]))):
                if not value:
                    conn.execute('DELETE FROM elibrary_embeddings WHERE elibrary_id=%s AND field=%s AND model=%s',
                                 (item_id, field, args.model))
                    continue
                hashed = digest(value)
                old = conn.execute('SELECT input_hash FROM elibrary_embeddings WHERE elibrary_id=%s AND field=%s AND model=%s',
                                   (item_id, field, args.model)).fetchone()
                if old and old[0] == hashed:
                    continue
                vector = model.encode(value, normalize_embeddings=True).tolist()
                conn.execute('''INSERT INTO elibrary_embeddings
                    (elibrary_id,field,model,input_hash,dimensions,embedding) VALUES (%s,%s,%s,%s,%s,%s)
                    ON CONFLICT(elibrary_id,field,model) DO UPDATE SET input_hash=excluded.input_hash,
                    dimensions=excluded.dimensions,embedding=excluded.embedding,created_at=now()''',
                    (item_id, field, args.model, hashed, len(vector), vector))
            conn.commit()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--work', type=Path, default=DEFAULT_WORK)
    sub = parser.add_subparsers(dest='command', required=True)
    offline = sub.add_parser('parse', help='Разобрать сохранённую карточку без сети и БД')
    offline.add_argument('html', type=Path)
    listing = sub.add_parser('listing', help='Проверить сохранённую страницу выдачи')
    listing.add_argument('html', type=Path)
    crawl = sub.add_parser('collect')
    crawl.add_argument('--collection', type=int, default=1817422)
    crawl.add_argument('--login', action='store_true')
    crawl.add_argument('--resume', action='store_true')
    crawl.add_argument('--refresh', action='store_true', help='Повторно скачать уже известные карточки')
    crawl.add_argument('--max-pages', type=int)
    crawl.add_argument('--delay', type=float, default=5)
    crawl.add_argument('--browser', choices=('brave', 'chrome', 'msedge'), default='brave')
    crawl.add_argument('--disable-gpu', action='store_true', help='Отключить GPU при артефактах отрисовки')
    crawl.add_argument('--executable', type=Path, help='Необязательный путь к исполняемому файлу браузера')
    crawl.add_argument('--channel', help='Необязательный канал Playwright для Chrome/Edge')
    probe = sub.add_parser('probe-http', help='Проверка прямых запросов на ограниченной выборке')
    probe.add_argument('--articles', type=int, default=1, choices=range(1, 21), metavar='1..20')
    probe.add_argument('--collection', type=int, default=1817422)
    probe.add_argument('--browser', choices=('brave', 'chrome', 'msedge'), default='brave')
    probe.add_argument('--executable', type=Path)
    probe.add_argument('--channel')
    sub.add_parser('init-db')
    sub.add_parser('import-db')
    review = sub.add_parser('candidates', help='CSV совпадений для проверки')
    review.add_argument('output', type=Path)
    vectors = sub.add_parser('embed')
    vectors.add_argument('--model', required=True, help='Путь к локальной multilingual SentenceTransformer или ID модели')
    export = sub.add_parser('export')
    export.add_argument('output', type=Path)
    dump = sub.add_parser('dump')
    dump.add_argument('output', type=Path)
    dump.add_argument('--pg-dump', default='pg_dump')
    args = parser.parse_args()
    if args.command == 'parse':
        data = parse_article(args.html.read_bytes())
        Store(args.work).save(data)
        print(json.dumps(data, ensure_ascii=False, indent=2))
    elif args.command == 'listing':
        print(json.dumps(asdict(parse_listing(args.html.read_bytes())), ensure_ascii=False, indent=2))
    elif args.command == 'probe-http':
        probe_http(args)
    elif args.command == 'collect':
        if args.delay < 1 or (args.max_pages is not None and args.max_pages < 1):
            parser.error('--delay должен быть >= 1, --max-pages >= 1')
        collect(args)
    elif args.command == 'init-db':
        with connect() as conn:
            conn.execute((SQL / 'elibrary.sql').read_text(encoding='utf-8'))
    elif args.command == 'import-db':
        import_db(args)
    elif args.command == 'embed':
        embed(args)
    elif args.command == 'candidates':
        with connect() as conn, args.output.open('w', encoding='utf-8-sig', newline='') as output:
            writer = csv.writer(output)
            writer.writerow(('elibrary_id', 'author_order', 'author_name', 'teacher_id', 'teacher_name', 'affiliations', 'source_url'))
            with conn.cursor() as cursor:
                cursor.execute('''SELECT m.elibrary_id,m.author_order,a.name,m.teacher_id,t.name,a.affiliations,p.source_url
                    FROM elibrary_teacher_matches m JOIN elibrary_authors a USING(elibrary_id,author_order)
                    JOIN teacher t ON t.id=m.teacher_id JOIN elibrary_publications p USING(elibrary_id)
                    WHERE m.status='candidate' ORDER BY m.elibrary_id,m.author_order,m.teacher_id''')
                writer.writerows(cursor)
    elif args.command == 'export':
        Store(args.work).export(args.output)
    elif args.command == 'dump':
        # libpq reads PG* environment variables. Do not expose a DSN/password in argv.
        env = os.environ.copy()
        import psycopg
        params = psycopg.conninfo.conninfo_to_dict(resolve_dsn())
        mapping = {'host': 'PGHOST', 'port': 'PGPORT', 'user': 'PGUSER', 'password': 'PGPASSWORD',
                   'dbname': 'PGDATABASE', 'sslmode': 'PGSSLMODE', 'sslrootcert': 'PGSSLROOTCERT'}
        for key, value in params.items():
            if key in mapping:
                env[mapping[key]] = value
        subprocess.run([args.pg_dump, '--format=custom', '--no-owner', '--no-acl',
                        '--table=public.teacher*', '--table=public.elibrary_*',
                        '--file', str(args.output)], env=env, check=True)


if __name__ == '__main__':
    try:
        main()
    except (PageError, ValueError) as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
