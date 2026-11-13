"""HTTP-only list harvest. No publication card requests are made."""
import argparse
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
import json
import os
from pathlib import Path
import re
import sqlite3
import time
import uuid
from urllib.parse import urljoin, urlparse

from parse_elibrary import (BASE, DEFAULT_WORK, PageError, Store, atomic_write,
                            browser_options, listing_form, parse_listing, soup_for, text)


class TemporaryError(PageError):
    """Retry the same checkpoint; never skip a page."""


class PaginationError(TemporaryError):
    """Bound retries for inconsistent source data."""


def retry_delay(attempt):
    return min(300, 15 * (2 ** min(max(attempt - 1, 0), 5)))


@contextmanager
def collector_lock(work):
    Path(work).mkdir(parents=True, exist_ok=True)
    handle = (Path(work) / 'collector.lock').open('a+b')
    try:
        handle.seek(0, 2)
        if not handle.tell():
            handle.write(b'0')
            handle.flush()
        handle.seek(0)
        try:
            if os.name == 'nt':
                import msvcrt
                msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
            else:
                import fcntl
                fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError:
            raise ValueError('Сборщик уже запущен для этого каталога. Второй запуск отменён.') from None
        yield
    finally:
        handle.close()


def captcha_visible(html):
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(html, 'html.parser')
    return bool(soup.select_one('form[action*="check_captcha"],input[name="captcha"],img[src*="captcha"],a[href*="/page_captcha.asp"]')
                or 'тест тьюринга' in text(soup.title).casefold())


def wait_for_captcha(context, url, store, run_id, session=False):
    """User solves the challenge; polling reads local DOM only."""
    from playwright.sync_api import Error as BrowserError
    if store.db.execute('SELECT 1 FROM http_list_scans WHERE run_id=?', (run_id,)).fetchone():
        store.stopped(run_id, 'Восстановите вход в открытом Brave и откройте подборку; продолжение автоматическое.' if session else 'Пройдите CAPTCHA в открытом окне Brave; продолжение автоматическое.', status='waiting_login' if session else 'waiting_captcha')
        store.export(run_id)
    page = context.pages[0] if context.pages else context.new_page()
    print('Восстанавливаю сессию. Если появился вход — войдите в Brave и откройте подборку. Окно не закрывайте.' if session else 'Ожидаю ручного прохождения CAPTCHA. Окно не закрывайте; после проверки сбор продолжится сам.', flush=True)
    try:
        page.goto(url, wait_until='domcontentloaded', timeout=60000)
    except BrowserError:
        if page.is_closed():
            raise
    while True:
        page.wait_for_timeout(3000)
        for visible in context.pages:
            try:
                raw = visible.content()
            except BrowserError:
                continue
            if captcha_visible(raw):
                continue
            try:
                parse_listing(raw)
            except PageError:
                continue
            print('Проверка пройдена, продолжаю с сохранённой страницы.', flush=True)
            return


def parse_entries(html):
    listing = parse_listing(html)
    soup = soup_for(html)
    entries = []
    for item_id in listing.ids:
        row = soup.select_one(f'#restab tr[id="a{item_id}"]')
        link = row.select_one(f'a[href*="item.asp?id={item_id}"]')
        author_node = row.find('i')
        author_text = text(author_node)
        truncated = bool(re.search(r'и\s+др\.|et\s+al\.?|…|\.\.\.', author_text, re.I))
        names = re.sub(r'\s*(?:и\s+др\.|et\s+al\.?).*$', '', author_text, flags=re.I)
        # Only the publication cell, excluding ordinal/citation counts.
        cell = link.find_parent('td')
        title = text(link)
        bibliography = text(cell)
        tail = bibliography.removeprefix(title).strip()
        if author_text and tail.startswith(author_text):
            tail = tail[len(author_text):].strip()
        # Years in titles and patent application dates are not publication years.
        years = re.findall(r'(?<!\d)(?:19|20|21)\d{2}(?!\d)', tail)
        year = int(years[0]) if years else None
        if not title:
            raise PageError(f'Пустое название {item_id}.')
        entries.append({'elibrary_id': item_id, 'source_url': f'{BASE}/item.asp?id={item_id}',
                        'title': title, 'authors': [name.strip() for name in names.split(',') if name.strip()],
                        'authors_truncated': truncated, 'authors_missing': not bool(author_text),
                        'publication_year': year, 'bibliography': tail, 'metadata_source': 'listing'})
    return listing, entries


class ListStore:
    def __init__(self, work):
        self.work = Path(work)
        self.db = Store(work).db
        self.db.executescript('''
            CREATE TABLE IF NOT EXISTS http_list_scans (
                run_id TEXT PRIMARY KEY, collection_id INTEGER NOT NULL,
                next_page INTEGER NOT NULL, total INTEGER NOT NULL, last_page INTEGER NOT NULL,
                form TEXT NOT NULL, status TEXT NOT NULL, updated_at TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS http_list_entries (
                run_id TEXT NOT NULL REFERENCES http_list_scans(run_id),
                page INTEGER NOT NULL, position INTEGER NOT NULL,
                id INTEGER NOT NULL, payload TEXT NOT NULL,
                PRIMARY KEY(run_id,page,position));
            CREATE INDEX IF NOT EXISTS http_list_ids ON http_list_entries(run_id,id);
            CREATE TABLE IF NOT EXISTS http_list_failures (
                run_id TEXT PRIMARY KEY, error TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS http_list_runtime (
                run_id TEXT PRIMARY KEY, next_retry_at TEXT);
        ''')

    def latest(self, collection):
        self.db.row_factory = sqlite3.Row
        return self.db.execute('SELECT * FROM http_list_scans WHERE collection_id=? ORDER BY updated_at DESC LIMIT 1',
                               (collection,)).fetchone()

    def save_page(self, run_id, collection, listing, entries, form):
        now = datetime.now(timezone.utc).isoformat()
        with self.db:
            previous = self.db.execute('SELECT total FROM http_list_scans WHERE run_id=?', (run_id,)).fetchone()
            if previous and previous[0] != listing.total:
                raise PageError('Количество публикаций изменилось во время обхода. Начните новый проход для проверки полноты.')
            overlap = self.db.execute('SELECT count(*) FROM http_list_entries WHERE run_id=? AND page<>? '
                'AND id IN (' + ','.join('?' for _ in entries) + ')',
                (run_id, listing.page, *(e['elibrary_id'] for e in entries))).fetchone()[0]
            if overlap >= len(entries):
                # eLIBRARY can reorder a page between requests. Keep the page
                # checkpoint so later pages can still reveal unseen IDs; the
                # final unique count remains the completeness check.
                print(f'На странице {listing.page} все ID уже встречались; сохраняю checkpoint и продолжаю.', flush=True)
            if overlap:
                print(f'Страница {listing.page}: пересечение {overlap} ID; новые записи сохраняются, выгрузка исключает дубли.', flush=True)
            self.db.execute('''INSERT INTO http_list_scans VALUES (?,?,?,?,?,?,?,?)
                ON CONFLICT(run_id) DO UPDATE SET next_page=excluded.next_page,
                last_page=excluded.last_page,form=excluded.form,status=excluded.status,updated_at=excluded.updated_at''',
                (run_id, collection, listing.page + 1, listing.total, listing.last_page,
                 json.dumps(form, ensure_ascii=False), 'complete' if listing.page == listing.last_page else 'in_progress', now))
            self.db.execute('DELETE FROM http_list_entries WHERE run_id=? AND page=?', (run_id, listing.page))
            self.db.executemany('INSERT INTO http_list_entries VALUES (?,?,?,?,?)',
                [(run_id, listing.page, n, entry['elibrary_id'], json.dumps(entry, ensure_ascii=False))
                 for n, entry in enumerate(entries, 1)])
            self.db.execute('DELETE FROM http_list_failures WHERE run_id=?', (run_id,))
            self.db.execute('DELETE FROM http_list_runtime WHERE run_id=?', (run_id,))

    def summary(self, run_id):
        rows, unique, pages = self.db.execute(
            'SELECT count(*),count(DISTINCT id),count(DISTINCT page) FROM http_list_entries WHERE run_id=?', (run_id,)).fetchone()
        scan = self.db.execute('SELECT total,status FROM http_list_scans WHERE run_id=?', (run_id,)).fetchone()
        error = self.db.execute('SELECT error FROM http_list_failures WHERE run_id=?', (run_id,)).fetchone()
        runtime = self.db.execute('SELECT next_retry_at FROM http_list_runtime WHERE run_id=?', (run_id,)).fetchone()
        return {'run_id': run_id, 'pages': pages, 'rows': rows, 'unique_publications': unique,
                'duplicates': rows - unique, 'expected': scan[0], 'status': scan[1],
                'coverage_complete': scan[1] == 'complete' and unique == scan[0],
                'last_error': error[0] if error else None,
                'next_retry_at': runtime[0] if runtime else None,
                'updated_at': self.db.execute('SELECT updated_at FROM http_list_scans WHERE run_id=?', (run_id,)).fetchone()[0]}

    def stopped(self, run_id, error, status='stopped', retry_seconds=None):
        # Playwright call logs can contain session cookies; keep only the error summary.
        message = str(error).split('\nCall log:')[0]
        with self.db:
            self.db.execute('UPDATE http_list_scans SET status=?,updated_at=? WHERE run_id=?',
                            (status, datetime.now(timezone.utc).isoformat(), run_id))
            self.db.execute('INSERT OR REPLACE INTO http_list_failures VALUES (?,?)', (run_id, message))
            retry_at = (datetime.now(timezone.utc) + timedelta(seconds=retry_seconds)).isoformat() if retry_seconds else None
            self.db.execute('INSERT OR REPLACE INTO http_list_runtime VALUES (?,?)', (run_id, retry_at))

    def export(self, run_id):
        target = self.work / 'lists' / f'{run_id}.jsonl'
        target.parent.mkdir(parents=True, exist_ok=True)
        temporary = target.with_suffix('.tmp')
        with temporary.open('w', encoding='utf8') as output:
            for (payload,) in self.db.execute('''SELECT e.payload FROM http_list_entries e
                JOIN (SELECT id,max(page) AS page FROM http_list_entries WHERE run_id=? GROUP BY id) u
                ON e.id=u.id AND e.page=u.page WHERE e.run_id=? ORDER BY e.id''', (run_id, run_id)):
                output.write(payload + '\n')
        temporary.replace(target)
        report = self.summary(run_id)
        atomic_write(self.work / 'lists/latest.json', json.dumps(report, ensure_ascii=False, indent=2))
        return report


def run(args):
    from playwright.sync_api import Error as BrowserError, sync_playwright
    store = ListStore(args.work)
    saved = store.latest(args.collection) if args.resume else None
    if saved and saved['status'] == 'complete':
        print(json.dumps(store.summary(saved['run_id']), ensure_ascii=False), flush=True)
        store.db.close()
        return
    run_id = saved['run_id'] if saved else uuid.uuid4().hex
    number = saved['next_page'] if saved else 1
    form = json.loads(saved['form']) if saved else None
    if form and (form.get('sortorder'), form.get('order')) != ('4', '0'):
        raise PageError('Старый проход использует нестабильную сортировку; запустите новый без --resume.')
    print(f'Проход {run_id}, начинаю со страницы {number}. Только списки, без карточек.', flush=True)
    # www redirects POST with HTTP 302, which converts it to GET and loses pagination.
    url = f'https://elibrary.ru/itembox_items.asp?id={args.collection}'
    with sync_playwright() as playwright:
        try:
            context = playwright.chromium.launch_persistent_context(
                str(Path(args.work).resolve() / f'browser-profile-{args.browser}'),
                headless=False, args=['--disable-gpu', '--start-minimized'], **browser_options(args))
        except BrowserError:
            store.db.close()
            raise
        try:
            ua = context.new_page().evaluate('navigator.userAgent')
            if form is None:
                bootstrap = context.request.get(url, timeout=60000, headers={'User-Agent': ua})
                if bootstrap.status != 200:
                    raise PageError(f'HTTP {bootstrap.status} при получении формы.')
                html = bootstrap.body()
                if captcha_visible(html):
                    wait_for_captcha(context, url, store, run_id)
                    raise TemporaryError('Проверка пройдена: обновление формы запроса.')
                parse_listing(html)
                form = listing_form(html, 1, args.collection)
                # Collection position is unique; publication year has many ties.
                form.update(sortorder='4', order='0')
            count = 0
            session_reset_retries = 0
            while True:
                started = time.perf_counter()
                for attempt in range(args.retries + 1):
                    try:
                        kwargs = {'method': 'POST', 'form': dict(form, pagenum=str(number))}
                        response = context.request.fetch(url, timeout=args.timeout * 1000, max_redirects=0,
                            headers={'User-Agent': ua, 'Referer': url}, **kwargs)
                        body = response.body()
                        break
                    except BrowserError as error:
                        message = str(error).split('\nCall log:')[0]
                        if 'Timeout' in message and attempt < args.retries:
                            pause = 15 * (attempt + 1)
                            print(f'Страница {number}: таймаут; повтор через {pause} секунд ({attempt+1}/{args.retries}).', flush=True)
                            time.sleep(pause)
                            continue
                        raise TemporaryError(f'Страница {number}: ошибка HTTP-клиента. {message}') from None
                path = Path(args.work) / 'lists' / run_id / f'{number}.html'
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(body)
                if captcha_visible(body):
                    wait_for_captcha(context, url, store, run_id)
                    session_reset_retries = 0
                    time.sleep(args.delay)
                    continue
                if response.status in (301, 302, 307, 308):
                    redirected = urljoin(url, response.headers.get('location', ''))
                    parsed = urlparse(redirected)
                    if (parsed.scheme == 'https' and parsed.hostname in ('elibrary.ru', 'www.elibrary.ru')
                            and parsed.path == '/start_session.asp'):
                        wait_for_captcha(context, redirected, store, run_id, session=True)
                        session_reset_retries = 0
                        continue
                    if (parsed.scheme == 'https' and parsed.hostname in ('elibrary.ru', 'www.elibrary.ru')
                            and parsed.path == '/itembox_items.asp' and redirected != url
                            and session_reset_retries < 2):
                        url = redirected
                        session_reset_retries += 1
                        print(f'Обновлён адрес выдачи; повторяю POST страницы {number}.', flush=True)
                        continue
                if response.status in (408, 429, 500, 502, 503, 504):
                    raise TemporaryError(f'HTTP {response.status}, страница {number}; временная ошибка сервера.')
                if response.status != 200:
                    raise PageError(f'HTTP {response.status}, страница {number}; сбор остановлен.')
                listing, entries = parse_entries(body)
                if listing.page != number:
                    if listing.page == 1 and number > 1 and session_reset_retries < 2:
                        refreshed = listing_form(body, number, args.collection)
                        refreshed.update(sortorder='4', order='0')
                        form = refreshed
                        session_reset_retries += 1
                        print(f'Сайт сбросил выдачу на страницу 1; форма обновлена, повторяю страницу {number}.', flush=True)
                        time.sleep(args.delay)
                        continue
                    raise PaginationError(f'Запрошена страница {number}, получена {listing.page}. Прогресс не сдвинут.')
                if listing.page < listing.last_page and len(entries) != 100:
                    raise PageError('Изменился размер страницы: ожидается 100 публикаций. Прогресс не сдвинут.')
                form = listing_form(body, number + 1, args.collection)
                if (form.get('sortorder'), form.get('order')) != ('4', '0'):
                    raise PageError('Сайт изменил выбранную сортировку; прогресс не сдвинут.')
                store.save_page(run_id, args.collection, listing, entries, form)
                summary = store.export(run_id)
                print(json.dumps(dict(summary, page=number, seconds=round(time.perf_counter()-started, 3)), ensure_ascii=False), flush=True)
                count += 1
                if number == listing.last_page or (args.max_pages and count >= args.max_pages):
                    break
                number += 1
                time.sleep(args.delay)
        except BaseException as error:
            store.stopped(run_id, error, status='retrying' if isinstance(error, (TemporaryError, BrowserError)) else 'needs_review')
            raise
        finally:
            try:
                context.close()
            except BrowserError:
                pass
            if store.db.execute('SELECT 1 FROM http_list_scans WHERE run_id=?', (run_id,)).fetchone():
                store.export(run_id)
            store.db.close()


def supervise(args, runner=None, wait=None):
    from playwright.sync_api import Error as BrowserError
    runner = runner or run
    wait = wait or time.sleep
    attempt = 0
    previous_checkpoint = None
    while True:
        try:
            runner(args)
            return
        except (TemporaryError, BrowserError) as error:
            store = ListStore(args.work)
            try:
                scan = store.latest(args.collection)
                checkpoint = (scan['run_id'], scan['next_page']) if scan else None
                if checkpoint != previous_checkpoint:
                    attempt = 0
                previous_checkpoint = checkpoint
                attempt += 1
                if isinstance(error, PaginationError) and attempt > 5:
                    if scan:
                        store.stopped(scan['run_id'], error, status='needs_review')
                        store.export(scan['run_id'])
                    raise PageError('Пагинация не восстановилась после пяти повторов; данные сохранены, требуется проверка кода/источника.') from None
                pause = retry_delay(attempt)
                message = str(error).split('\nCall log:')[0]
                if scan:
                    store.stopped(scan['run_id'], message, status='retrying', retry_seconds=pause)
                    store.export(scan['run_id'])
                print(f'Автовосстановление через {pause} секунд: {message}', flush=True)
            finally:
                store.db.close()
            args.resume = True
            wait(pause)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--work', type=Path, default=DEFAULT_WORK)
    parser.add_argument('--collection', type=int, default=1817422)
    parser.add_argument('--resume', action='store_true')
    parser.add_argument('--max-pages', type=int)
    parser.add_argument('--delay', type=float, default=10)
    parser.add_argument('--timeout', type=int, default=180, help='Ожидание ответа в секундах')
    parser.add_argument('--retries', type=int, default=2, choices=range(0, 4))
    parser.add_argument('--browser', choices=('brave', 'chrome', 'msedge'), default='brave')
    parser.add_argument('--executable', type=Path)
    parser.add_argument('--channel')
    args = parser.parse_args()
    if args.delay < 1 or args.timeout < 1 or (args.max_pages is not None and args.max_pages < 1):
        parser.error('--delay >= 1; --timeout >= 1; --max-pages >= 1')
    try:
        with collector_lock(args.work):
            supervise(args)
    except (PageError, ValueError) as error:
        parser.exit(1, str(error) + '\n')


if __name__ == '__main__':
    main()
