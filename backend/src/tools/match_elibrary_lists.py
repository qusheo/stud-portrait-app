"""Read teachers from a custom PostgreSQL dump and match collected lists offline.

No SQL from the dump is executed. No eLIBRARY requests/card downloads are made.
"""
import argparse
from collections import Counter, defaultdict
import csv
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import sqlite3
import time

from parse_elibrary import DEFAULT_WORK, TeacherIndex, atomic_write, normalize_name


def load_teachers(path):
    import pgdumplib
    dump = pgdumplib.load(path)
    try:
        return read_teachers(dump)
    finally:
        close_dump(dump)


def close_dump(dump):
    # pgdumplib 4.0.0 has no public close/context manager; release Windows handles.
    for writer in dump._writers.values():
        writer._handle.close()
    if dump._handle is not None:
        dump._handle.close()
    dump._temp_dir.cleanup()


def read_teachers(dump):
    from pgdumplib import constants
    entry = dump.lookup_entry(constants.TABLE_DATA, 'public', 'teacher_directory')
    if entry is None:
        raise ValueError('В дампе нет данных public.teacher_directory.')
    match = re.search(r'\((.*?)\)\s+FROM\s+stdin', entry.copy_stmt, re.S | re.I)
    if not match:
        raise ValueError('Не распознан список столбцов teacher_directory.')
    columns = [x.strip().strip('"') for x in match[1].split(',')]
    if not {'id', 'name', 'institution'}.issubset(columns):
        raise ValueError('В teacher_directory нет необходимых столбцов.')
    teachers = []
    seen = set()
    for row in dump.table_data('public', 'teacher_directory'):
        if len(row) != len(columns):
            raise ValueError('Число полей строки teacher_directory не совпадает со схемой.')
        data = dict(zip(columns, row))
        teacher = {key: data.get(key) for key in ('id','name','institution','source_row')}
        teacher['id'] = int(teacher['id'])
        teacher['source_row'] = int(teacher['source_row']) if teacher['source_row'] is not None else None
        if not isinstance(teacher['name'], str) or not normalize_name(teacher['name']):
            raise ValueError(f'Некорректное ФИО у teacher_id={teacher["id"]}.')
        if teacher['id'] in seen:
            raise ValueError(f'Повтор teacher_id={teacher["id"]}.')
        seen.add(teacher['id'])
        teachers.append(teacher)
    if not teachers:
        raise ValueError('Справочник преподавателей пуст.')
    return teachers


def read_snapshot(work, run_id=None):
    # A read transaction gives the report one coherent checkpoint while harvesting continues.
    conn = sqlite3.connect(Path(work) / 'progress.sqlite3', timeout=30)
    conn.row_factory = sqlite3.Row
    try:
        conn.execute('BEGIN')
        if run_id:
            scan = conn.execute('SELECT * FROM http_list_scans WHERE run_id=?', (run_id,)).fetchone()
        else:
            scan = conn.execute('SELECT * FROM http_list_scans ORDER BY updated_at DESC LIMIT 1').fetchone()
        if not scan:
            raise ValueError('Нет сохранённого прохода списка.')
        rows = conn.execute('''SELECT e.payload FROM http_list_entries e JOIN
            (SELECT id,max(page) AS page FROM http_list_entries WHERE run_id=? GROUP BY id) u
            ON e.id=u.id AND e.page=u.page WHERE e.run_id=? ORDER BY e.id''', (scan['run_id'],scan['run_id'])).fetchall()
        pages, total_rows = conn.execute('SELECT count(DISTINCT page),count(*) FROM http_list_entries WHERE run_id=?',
                                        (scan['run_id'],)).fetchone()
        metadata = dict(scan)
        metadata.pop('form', None)
        metadata.update(pages=pages, rows=total_rows)
        return metadata, [json.loads(row[0]) for row in rows]
    finally:
        conn.close()


def match_entries(teachers, entries):
    index = TeacherIndex([(t['id'],t['name']) for t in teachers])
    names = {t['id']:t['name'] for t in teachers}
    pairs = []
    queue = []
    teacher_articles = defaultdict(set)
    counts = Counter()
    for entry in entries:
        article_pairs = []
        for position, name in enumerate(entry['authors'], 1):
            for tid, method, status in index.match(name):
                article_pairs.append({'elibrary_id':entry['elibrary_id'], 'title':entry['title'],
                    'publication_year':entry['publication_year'], 'author_order':position,
                    'author_name':name, 'teacher_id':tid, 'teacher_name':names[tid],
                    'method':method, 'status':status, 'authors_truncated':entry['authors_truncated'],
                    'source_url':entry['source_url']})
                teacher_articles[tid].add(entry['elibrary_id'])
        pairs.extend(article_pairs)
        counts['publications_with_visible_matches'] += bool(article_pairs)
        counts['publications_with_confirmed_full_names'] += any(p['status']=='confirmed' for p in article_pairs)
        counts['truncated_author_lists'] += bool(entry['authors_truncated'])
        counts['missing_author_lists'] += bool(entry['authors_missing'])
        reason = ('visible_name_match' if article_pairs else 'truncated_authors' if entry['authors_truncated']
                  else 'missing_authors' if entry['authors_missing'] else None)
        if reason:
            queue.append({'elibrary_id':entry['elibrary_id'], 'reason':reason,
                          'candidate_teacher_ids':sorted(set(p['teacher_id'] for p in article_pairs)),
                          'title':entry['title'], 'source_url':entry['source_url']})
            counts['cards_' + reason] += 1
        else:
            counts['publications_without_visible_match'] += 1
    # Stable zero-valued fields make partial/empty reports comparable.
    for key in ('publications_with_visible_matches','publications_with_confirmed_full_names',
                'truncated_author_lists','missing_author_lists','cards_visible_name_match',
                'cards_truncated_authors','cards_missing_authors','publications_without_visible_match'):
        counts.setdefault(key,0)
    counts.update(candidate_pairs=len(pairs), teacher_rows_with_matches=len(teacher_articles),
                  cards_to_consider=len(queue))
    return dict(counts), pairs, queue, teacher_articles


def write_csv(path, columns, rows):
    temporary = path.with_suffix('.tmp')
    with temporary.open('w',encoding='utf-8-sig',newline='') as output:
        writer = csv.DictWriter(output,fieldnames=columns)
        writer.writeheader()
        writer.writerows(rows)
    temporary.replace(path)


def build_report(work, teachers, dump_hash, run_id=None):
    scan, entries = read_snapshot(work,run_id)
    counts, pairs, queue, teacher_articles = match_entries(teachers,entries)
    unique_names = {tuple(normalize_name(t['name'])) for t in teachers}
    full_coverage = scan['status']=='complete' and len(entries)==scan['total']
    report = {'generated_at':datetime.now(timezone.utc).isoformat(),
        'run_id':scan['run_id'], 'collection_id':scan['collection_id'],
        'list_status':scan['status'], 'pages':scan['pages'], 'expected_publications':scan['total'],
        'unique_publications':len(entries), 'duplicate_rows':scan['rows']-len(entries),
        'is_final':full_coverage, 'coverage_complete':full_coverage,
        'teacher_directory_rows':len(teachers), 'distinct_normalized_teacher_names':len(unique_names),
        'teacher_dump_sha256':dump_hash, **counts,
        'note':'Совпадения по инициалам — кандидаты. Отсутствие видимого совпадения не доказывает отсутствие авторства. Карточки не скачивались.'}
    directory = Path(work) / 'matches' / scan['run_id']
    directory.mkdir(parents=True,exist_ok=True)
    columns = ['elibrary_id','title','publication_year','author_order','author_name','teacher_id',
               'teacher_name','method','status','authors_truncated','source_url']
    write_csv(directory/'candidate_matches.csv',columns,pairs)
    write_csv(directory/'teachers.csv',['id','name','institution','source_row','candidate_publications'],
              [dict(t,candidate_publications=len(teacher_articles[t['id']])) for t in teachers])
    atomic_write(directory/'card_candidates.jsonl',''.join(json.dumps(row,ensure_ascii=False)+'\n' for row in queue))
    atomic_write(directory/'summary.json',json.dumps(report,ensure_ascii=False,indent=2))
    atomic_write(Path(work)/'matches/latest.json',json.dumps(report,ensure_ascii=False,indent=2))
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--dump',required=True,type=Path)
    parser.add_argument('--work',default=DEFAULT_WORK,type=Path)
    parser.add_argument('--run-id')
    parser.add_argument('--watch',action='store_true',help='Обновлять отчёт до конца текущего прохода')
    parser.add_argument('--interval',default=30,type=int)
    args = parser.parse_args()
    if args.interval < 5:
        parser.error('--interval >= 5')
    teachers = load_teachers(args.dump)
    dump_hash = hashlib.sha256(args.dump.read_bytes()).hexdigest()
    previous = None
    run_id = args.run_id
    while True:
        scan,_ = read_snapshot(args.work,run_id)
        run_id = scan['run_id']  # Keep watching this scan even if another is started later.
        checkpoint = (scan['updated_at'],scan['status'])
        if checkpoint != previous:
            report = build_report(args.work,teachers,dump_hash,run_id)
            print(json.dumps({key:report[key] for key in ('pages','unique_publications','teacher_directory_rows',
                'publications_with_visible_matches','teacher_rows_with_matches','cards_to_consider','is_final')},ensure_ascii=False),flush=True)
            previous = checkpoint
        if not args.watch or scan['status']=='complete':
            return
        time.sleep(args.interval)


if __name__=='__main__':
    main()
