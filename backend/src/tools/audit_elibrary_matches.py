"""Assess candidate ambiguity and verify a small, explicitly bounded card sample.

Does not modify analysis.sqlite3 or confirm teacher associations automatically.
"""
import argparse
from collections import Counter, defaultdict
from contextlib import closing
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import random
import re
import sqlite3
import time

from elibrary_lists import captcha_visible
from match_elibrary_lists import write_csv
from parse_elibrary import (DEFAULT_WORK, PageError, TeacherIndex, atomic_write,
                            browser_options, normalize_name, parse_article)


def tyumgu_affiliation(value):
    value = ' '.join(normalize_name(value))
    return bool(re.search(r'\bтюмгу\b|тюменск\w* государственн\w* университет|university of tyumen|tyumen state university', value))


def prepare(database, output, size=30):
    with closing(sqlite3.connect(f'{database.resolve().as_uri()}?mode=ro',uri=True)) as conn:
        conn.row_factory=sqlite3.Row
        publications={r['elibrary_id']:dict(r) for r in conn.execute('SELECT * FROM publications')}
        teachers={r['id']:dict(r) for r in conn.execute('SELECT * FROM teacher_directory')}
        matches=[dict(r) for r in conn.execute('''SELECT m.*,a.name AS author_name FROM teacher_matches m
            JOIN publication_authors a USING(elibrary_id,author_order) ORDER BY elibrary_id,author_order,teacher_id''')]
    per_author=defaultdict(list)
    for row in matches:
        per_author[(row['elibrary_id'],row['author_order'])].append(row)
    groups=defaultdict(set)
    position_categories=Counter()
    rows=[]
    for (item_id,position), candidates in per_author.items():
        names={tuple(normalize_name(teachers[c['teacher_id']]['name'])) for c in candidates}
        category=('single_directory_candidate' if len(candidates)==1 else
                  'duplicate_directory_name' if len(names)==1 else 'ambiguous_initials')
        position_categories[category]+=1
        groups[category].add(item_id)
        for candidate in candidates:
            rows.append(dict(candidate,teacher_name=teachers[candidate['teacher_id']]['name'],
                             category=category,candidate_count=len(candidates),title=publications[item_id]['title']))
    for item_id,pub in publications.items():
        if pub['authors_missing']:
            groups['missing_authors'].add(item_id)
        if pub['authors_truncated']:
            groups['truncated_authors'].add(item_id)
    # Groups can overlap. Sample is stratified for diagnostics, not a random accuracy estimate.
    plan=[('ambiguous_initials',10),('single_directory_candidate',10),('truncated_authors',5),('missing_authors',5)]
    selected=[]
    seen=set()
    rng=random.Random(20261018)
    for category,quota in plan:
        pool=sorted(groups[category]-seen)
        rng.shuffle(pool)
        for item_id in pool[:min(quota,max(0,size-len(selected)))]:
            selected.append({'elibrary_id':item_id,'sample_group':category,**publications[item_id]})
            seen.add(item_id)
    if len(selected)<size:
        pool=sorted(set(publications)-seen)
        rng.shuffle(pool)
        selected.extend({'sample_group':'additional',**publications[i]} for i in pool[:size-len(selected)])
    output.mkdir(parents=True,exist_ok=True)
    write_csv(output/'candidate_quality.csv',
        ['elibrary_id','author_order','teacher_id','method','status','author_name','teacher_name','category','candidate_count','title'],rows)
    atomic_write(output/'sample.json',json.dumps(selected,ensure_ascii=False,indent=2))
    report={'generated_at':datetime.now(timezone.utc).isoformat(),'source_database_sha256':hashlib.sha256(database.read_bytes()).hexdigest(),
            'publications':len(publications),'candidate_pairs':len(matches),'matched_author_positions':len(per_author),
            'publications_by_category':{k:len(v) for k,v in groups.items()},
            'author_positions_by_category':dict(position_categories),
            'sample_size':len(selected),'sample_groups':dict(Counter(r['sample_group'] for r in selected)),
            'note':'Категории публикаций пересекаются. Единственный кандидат по инициалам не считается подтверждённым автором.'}
    atomic_write(output/'quality_summary.json',json.dumps(report,ensure_ascii=False,indent=2))
    return report


def verify(args):
    from playwright.sync_api import Error as BrowserError, sync_playwright
    output=args.output
    sample=json.loads((output/'sample.json').read_text(encoding='utf8'))
    if len(sample)>30:
        raise ValueError('Проверка ограничена 30 карточками.')
    with closing(sqlite3.connect(f'{args.database.resolve().as_uri()}?mode=ro',uri=True)) as conn:
        teachers=conn.execute('SELECT id,name FROM teacher_directory').fetchall()
        index=TeacherIndex(teachers)
        existing=defaultdict(set)
        for item_id,teacher_id in conn.execute('SELECT elibrary_id,teacher_id FROM teacher_matches'):
            existing[item_id].add(teacher_id)
    results=[]
    started=time.perf_counter()
    with sync_playwright() as p:
        context=p.chromium.launch_persistent_context(str(DEFAULT_WORK/'browser-profile-brave'),headless=False,
            args=['--disable-gpu','--start-minimized'],**browser_options(args))
        try:
            for entry in sample:
                item_id=entry['elibrary_id']
                path=output/'cards'/f'{item_id}.html'
                row={'elibrary_id':item_id,'sample_group':entry['sample_group'],'title':entry['title']}
                try:
                    if path.exists():
                        body=path.read_bytes()
                        row['cached']=True
                    else:
                        time.sleep(args.delay)
                        t=time.perf_counter()
                        response=context.request.get(f'https://elibrary.ru/item.asp?id={item_id}',timeout=60000)
                        body=response.body()
                        row.update(http_status=response.status,seconds=round(time.perf_counter()-t,3),cached=False)
                        if captcha_visible(body):
                            row['status']='waiting_captcha'
                            results.append(row)
                            raise PageError('CAPTCHA: проверка остановлена, исходная выборка не изменена.')
                        if response.status!=200:
                            row['status']='http_error'
                            results.append(row)
                            raise PageError(f'HTTP {response.status}; проверка остановлена.')
                        path.parent.mkdir(parents=True,exist_ok=True)
                        path.write_bytes(body)
                    card=parse_article(body,item_id)
                    matched=set()
                    affiliation_ids=set()
                    evidence=[]
                    for author in card['authors']:
                        candidates=index.match(author.get('full_name') or author['name'])
                        matched.update(tid for tid,_,_ in candidates)
                        at_tyumgu=any(tyumgu_affiliation(x) for x in author['affiliations'])
                        if at_tyumgu:
                            affiliation_ids.update(tid for tid,_,_ in candidates)
                        if candidates:
                            evidence.append({'author_name':author['name'],'full_name':author.get('full_name'),
                                             'elibrary_author_id':author['elibrary_author_id'],
                                             'match_basis':'full_name' if author.get('full_name') else 'initials',
                                             'teacher_ids':[c[0] for c in candidates],
                                             'affiliations':author['affiliations'],'tyumgu_affiliation':at_tyumgu})
                    row.update(status='parsed',card_authors=len(card['authors']),
                        visible_candidate_ids=sorted(existing[item_id]),card_candidate_ids=sorted(matched),
                        visible_candidates_present=sorted(existing[item_id]&matched),
                        visible_candidates_not_found=sorted(existing[item_id]-matched),
                        additional_candidate_ids=sorted(matched-existing[item_id]),
                        candidates_with_tyumgu_affiliation=sorted(affiliation_ids),
                        abstract_present=bool(card['abstract']),keywords=len(card['keywords']),evidence=evidence)
                    atomic_write(output/'cards'/f'{item_id}.json',json.dumps(card,ensure_ascii=False,indent=2))
                except PageError as error:
                    if row.get('status') in ('waiting_captcha','http_error'):
                        raise
                    row.update(status='parse_needs_review',error=str(error).split('\nCall log:')[0])
                results.append(row)
                atomic_write(output/'verification.json',json.dumps(results,ensure_ascii=False,indent=2))
                print(f'{len(results)}/{len(sample)}: {item_id} {row["status"]}',flush=True)
        except BrowserError as error:
            raise PageError(str(error).split('\nCall log:')[0]) from None
        finally:
            context.close()
            atomic_write(output/'verification.json',json.dumps(results,ensure_ascii=False,indent=2))
            parsed=[r for r in results if r['status']=='parsed']
            write_csv(output/'verification.csv',
                ['elibrary_id','sample_group','title','status','card_authors','full_names',
                 'visible_candidates_not_found','additional_candidate_ids','candidates_with_tyumgu_affiliation','error'],
                [{'elibrary_id':r['elibrary_id'],'sample_group':r['sample_group'],'title':r['title'],
                  'status':r['status'],'card_authors':r.get('card_authors'),
                  'full_names':'; '.join(e.get('full_name') or e['author_name'] for e in r.get('evidence',[])),
                  'visible_candidates_not_found':json.dumps(r.get('visible_candidates_not_found',[])),
                  'additional_candidate_ids':json.dumps(r.get('additional_candidate_ids',[])),
                  'candidates_with_tyumgu_affiliation':json.dumps(r.get('candidates_with_tyumgu_affiliation',[])),
                  'error':r.get('error','')} for r in results])
            summary={'requested':len(sample),'checked':len(results),'statuses':dict(Counter(r['status'] for r in results)),
                     'seconds':round(time.perf_counter()-started,1),'source_database_unchanged':True,
                     'network_requests':sum(not r.get('cached',False) for r in results),
                     'cached_cards':sum(r.get('cached',False) for r in results),
                     'cards_with_visible_candidates_not_found':sum(bool(r['visible_candidates_not_found']) for r in parsed),
                     'cards_with_additional_candidates':sum(bool(r['additional_candidate_ids']) for r in parsed),
                     'cards_with_tyumgu_affiliation_evidence':sum(bool(r['candidates_with_tyumgu_affiliation']) for r in parsed),
                     'cards_with_abstract':sum(r['abstract_present'] for r in parsed),
                     'cards_with_keywords':sum(bool(r['keywords']) for r in parsed),
                     'note':'Аффилиация ТюмГУ — дополнительный признак, не доказательство личности. Связи автоматически не подтверждены.'}
            atomic_write(output/'verification_summary.json',json.dumps(summary,ensure_ascii=False,indent=2))
            print(json.dumps(summary,ensure_ascii=False),flush=True)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command',choices=('prepare','verify'))
    parser.add_argument('--database',type=Path,default=DEFAULT_WORK/'sample/analysis.sqlite3')
    parser.add_argument('--output',type=Path,default=DEFAULT_WORK/'sample/quality')
    parser.add_argument('--size',type=int,default=30,choices=range(1,31))
    parser.add_argument('--delay',type=float,default=5)
    parser.add_argument('--browser',default='brave')
    parser.add_argument('--executable',type=Path)
    parser.add_argument('--channel')
    args=parser.parse_args()
    if args.delay<1:
        parser.error('--delay >= 1')
    if args.command=='prepare':
        print(json.dumps(prepare(args.database,args.output,args.size),ensure_ascii=False,indent=2))
    else:
        try:
            verify(args)
        except PageError as error:
            parser.exit(1,str(error)+'\n')


if __name__=='__main__':
    main()
