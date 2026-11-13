"""Resumable, bounded batches of publication cards from the frozen candidate set."""
import argparse
from collections import Counter
from contextlib import closing
from datetime import datetime,timezone
import hashlib
import json
from pathlib import Path
import random
import shutil
import sqlite3
import time

from elibrary_lists import captcha_visible,collector_lock
from parse_elibrary import DEFAULT_WORK,PageError,atomic_write,browser_options,parse_article
from refine_elibrary_matches import refine


def login_required(raw):
    from bs4 import BeautifulSoup
    soup=BeautifulSoup(raw,'html.parser')
    visible=soup.get_text(' ',strip=True).casefold()
    return ('незарегистрированных пользователей' in visible or
            'укажите имя пользователя и пароль' in visible or
            bool(soup.select_one('input[type="password"]')) and not soup.select_one('p.bigtext'))


def plan_batch(database,work,size,new=False):
    work.mkdir(parents=True,exist_ok=True)
    plans=sorted(work.glob('batch_[0-9]*.json'))
    if plans and not new:
        plan=json.loads(plans[-1].read_text(encoding='utf8'))
        if plan['source_database_sha256']!=hashlib.sha256(database.read_bytes()).hexdigest():
            raise ValueError('РСЃС…РѕРґРЅР°СЏ РІС‹Р±РѕСЂРєР° РёР·РјРµРЅРёР»Р°СЃСЊ: РЅРµР»СЊР·СЏ РїСЂРѕРґРѕР»Р¶РёС‚СЊ СЃС‚Р°СЂСѓСЋ РїР°СЂС‚РёСЋ.')
        return plan,plans[-1]
    with closing(sqlite3.connect(database.resolve().as_uri()+'?mode=ro',uri=True)) as conn:
        ids=[r[0] for r in conn.execute('SELECT DISTINCT elibrary_id FROM teacher_matches ORDER BY elibrary_id')]
    prior=set()
    for path in plans:
        prior.update(json.loads(path.read_text(encoding='utf8'))['ids'])
    available=set(ids)-prior
    cached=sorted(int(path.stem) for path in (work/'cards').glob('*.json') if path.stem.isdigit() and int(path.stem) in available)
    remaining=sorted(available-set(cached))
    random.Random(20261020+len(plans)).shuffle(remaining)
    selected=(cached+remaining)[:size]
    if not selected:
        raise ValueError('РќРµС‚ РЅРѕРІС‹С… РєР°РЅРґРёРґР°С‚РѕРІ РґР»СЏ РїР°СЂС‚РёРё.')
    plan={'batch_id':len(plans)+1,'created_at':datetime.now(timezone.utc).isoformat(),
          'source_database_sha256':hashlib.sha256(database.read_bytes()).hexdigest(),
          'ids':selected,'size':len(selected),'scope':'listing_name_candidates'}
    path=work/f'batch_{len(plans)+1:03}.json'
    atomic_write(path,json.dumps(plan,ensure_ascii=False,indent=2))
    return plan,path


class Progress:
    def __init__(self,work):
        self.work=work
        self.conn=sqlite3.connect(work/'progress.sqlite3')
        self.conn.execute('''CREATE TABLE IF NOT EXISTS cards
            (elibrary_id INTEGER PRIMARY KEY,status TEXT NOT NULL,error TEXT,updated_at TEXT NOT NULL)''')

    def save(self,item_id,status,error=None):
        with self.conn:
            self.conn.execute('INSERT OR REPLACE INTO cards VALUES (?,?,?,?)',
                (item_id,status,str(error).split('\nCall log:')[0] if error else None,datetime.now(timezone.utc).isoformat()))

    def status(self,plan,status,item_id=None,error=None):
        statuses=dict(self.conn.execute('SELECT elibrary_id,status FROM cards').fetchall())
        counts=Counter(statuses.get(i,'pending') for i in plan['ids'])
        report={'batch_id':plan['batch_id'],'batch_size':plan['size'],'status':status,
                'counts':dict(counts),'current_id':item_id,'last_error':str(error).split('\nCall log:')[0] if error else None,
                'updated_at':datetime.now(timezone.utc).isoformat(),'network_scope':'only_this_batch'}
        atomic_write(self.work/'latest.json',json.dumps(report,ensure_ascii=False,indent=2))
        print(json.dumps(report,ensure_ascii=False),flush=True)
        return report


def wait_manual(context,url,progress,plan,item_id,status):
    from playwright.sync_api import Error as BrowserError
    progress.status(plan,status,item_id,'РџСЂРѕР№РґРёС‚Рµ РїСЂРѕРІРµСЂРєСѓ/РІС…РѕРґ РІ РѕС‚РєСЂС‹С‚РѕРј Brave; РїСЂРѕРґРѕР»Р¶РµРЅРёРµ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРѕРµ.')
    page=context.pages[0] if context.pages else context.new_page()
    try:
        page.goto('https://elibrary.ru/defaultx.asp' if status=='waiting_login' else url,
                  wait_until='domcontentloaded',timeout=60000)
    except BrowserError:
        if page.is_closed():
            raise
    while True:
        page.wait_for_timeout(3000)
        for visible in context.pages:
            try:
                raw=visible.content()
                if captcha_visible(raw):
                    continue
                if status=='waiting_login':
                    from bs4 import BeautifulSoup
                    soup=BeautifulSoup(raw,'html.parser')
                    if soup.select_one('a[href*="author_info.asp?isold=1"],a[href*="logout.asp"]'):
                        return
                parse_article(raw)
                return
            except PageError:
                pass
            except BrowserError:
                if page.is_closed():
                    raise


def run(args):
    from playwright.sync_api import Error as BrowserError,sync_playwright
    work=args.work
    cards=work/'cards'
    cards.mkdir(parents=True,exist_ok=True)
    # Preserve and reuse all previously downloaded cards, including unparsed diagnostic HTML.
    cached_source=DEFAULT_WORK/'sample/quality/cards'
    if cached_source.resolve()!=cards.resolve():
        for path in cached_source.glob('*'):
            if path.suffix in ('.json','.html') and path.stem.isdigit() and not (cards/path.name).exists():
                shutil.copyfile(path,cards/path.name)
    plan,_=plan_batch(args.database,work,args.size,args.new_batch)
    progress=Progress(work)
    try:
        for cached in cards.glob('*.html'):
            raw=cached.read_bytes()
            if login_required(raw):
                diagnostics=work/'errors'
                diagnostics.mkdir(exist_ok=True)
                cached.replace(diagnostics/(cached.stem+'.login.html'))
                if int(cached.stem) in plan['ids']:
                    progress.save(int(cached.stem),'failed','РќСѓР¶РЅР° РїРѕРІС‚РѕСЂРЅР°СЏ Р°РІС‚РѕСЂРёР·Р°С†РёСЏ; СЌС‚Рѕ РЅРµ РєР°СЂС‚РѕС‡РєР°.')
        while True:
            try:
                with sync_playwright() as p:
                    context=p.chromium.launch_persistent_context(str(DEFAULT_WORK/'browser-profile-brave'),headless=False,
                        args=['--disable-gpu','--start-minimized'],**browser_options(args))
                    try:
                        progress.status(plan,'running')
                        for item_id in plan['ids']:
                            saved=progress.conn.execute('SELECT status FROM cards WHERE elibrary_id=?',(item_id,)).fetchone()
                            if saved and saved[0] in ('parsed','needs_review'):
                                continue
                            raw_path=cards/f'{item_id}.html'
                            json_path=cards/f'{item_id}.json'
                            try:
                                if raw_path.exists():
                                    raw=raw_path.read_bytes()
                                elif json_path.exists():
                                    data=json.loads(json_path.read_text(encoding='utf8'))
                                    if data['elibrary_id']!=item_id:
                                        raise PageError('ID РєРµС€РёСЂРѕРІР°РЅРЅРѕР№ РєР°СЂС‚РѕС‡РєРё РЅРµ СЃРѕРІРїР°РґР°РµС‚.')
                                    progress.save(item_id,'parsed')
                                    progress.status(plan,'running',item_id)
                                    continue
                                else:
                                    url=f'https://elibrary.ru/item.asp?id={item_id}'
                                    attempts=0
                                    while True:
                                        time.sleep(args.delay)
                                        response=context.request.get(url,timeout=args.timeout*1000)
                                        raw=response.body()
                                        if captcha_visible(raw):
                                            wait_manual(context,response.url,progress,plan,item_id,'waiting_captcha')
                                            continue
                                        if response.status in (408,429,500,502,503,504) and attempts<3:
                                            attempts+=1
                                            progress.status(plan,'retrying',item_id,f'HTTP {response.status}')
                                            time.sleep(15*attempts)
                                            continue
                                        if response.status!=200:
                                            raise PageError(f'HTTP {response.status}; РґР°РЅРЅС‹Рµ РЅРµ РѕС‚РјРµС‡РµРЅС‹ РіРѕС‚РѕРІС‹РјРё.')
                                        if login_required(raw):
                                            wait_manual(context,url,progress,plan,item_id,'waiting_login')
                                            continue
                                        break
                                    pending=raw_path.with_suffix('.html.tmp')
                                    pending.write_bytes(raw)
                                    pending.replace(raw_path)
                                data=parse_article(raw,item_id)
                                atomic_write(json_path,json.dumps(data,ensure_ascii=False,indent=2))
                                progress.save(item_id,'parsed')
                            except PageError as error:
                                progress.save(item_id,'failed' if str(error).startswith('HTTP ') else 'needs_review',error)
                            progress.status(plan,'running',item_id)
                        break
                    finally:
                        try:
                            context.close()
                        except BrowserError:
                            pass
            except BrowserError as error:
                progress.status(plan,'retrying',error=error)
                time.sleep(30)
        report=progress.status(plan,'complete_with_review_items' if progress.conn.execute(
            'SELECT 1 FROM cards WHERE status<>\'parsed\' AND elibrary_id IN ('+','.join('?' for _ in plan['ids'])+')',
            plan['ids']).fetchone() else 'complete')
        refined=refine(args.database,cards,args.database.parent/'analysis.refined.sqlite3')
        report['refinement']=refined
        atomic_write(work/'batch_result.json',json.dumps(report,ensure_ascii=False,indent=2))
        print(json.dumps(refined,ensure_ascii=False,indent=2),flush=True)
    except BaseException as error:
        progress.status(plan,'stopped',error=error)
        raise
    finally:
        progress.conn.close()


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--database',type=Path,default=DEFAULT_WORK/'sample/analysis.sqlite3')
    parser.add_argument('--work',type=Path,default=DEFAULT_WORK/'sample/enrichment')
    parser.add_argument('--size',type=int,default=100)
    parser.add_argument('--new-batch',action='store_true')
    parser.add_argument('--continuous',action='store_true',help='Continue with successive batches until the queue is exhausted')
    parser.add_argument('--delay',type=float,default=5)
    parser.add_argument('--timeout',type=int,default=120)
    parser.add_argument('--browser',default='brave')
    parser.add_argument('--executable',type=Path)
    parser.add_argument('--channel')
    args=parser.parse_args()
    if not 1<=args.size<=100 or args.delay<1 or args.timeout<1:
        parser.error('--size 1..100; --delay >= 1; --timeout >= 1')
    with collector_lock(DEFAULT_WORK):
        run(args)
        while args.continuous:
            assigned=set()
            for path in args.work.glob('batch_[0-9]*.json'):
                assigned.update(json.loads(path.read_text(encoding='utf8'))['ids'])
            with closing(sqlite3.connect(args.database.resolve().as_uri()+'?mode=ro',uri=True)) as conn:
                remaining=sum(item_id not in assigned for item_id, in conn.execute(
                    'SELECT DISTINCT elibrary_id FROM teacher_matches'))
            if not remaining:
                print('Queue exhausted. Review failed/needs_review items separately.',flush=True)
                break
            print(f'Continuous mode: {remaining} unassigned publications; starting next batch.',flush=True)
            args.new_batch=True
            run(args)


if __name__=='__main__':
    main()

