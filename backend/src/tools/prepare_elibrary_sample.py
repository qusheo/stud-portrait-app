"""Freeze the current partial harvest as a standalone SQLite analysis dataset."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import sqlite3

from match_elibrary_lists import load_teachers, match_entries, read_snapshot, write_csv
from parse_elibrary import DEFAULT_WORK, atomic_write


def prepare(work, teachers, dump_hash, output):
    scan, entries = read_snapshot(work)
    if scan['status'] not in ('paused', 'complete', 'needs_review', 'stopped'):
        raise ValueError('Перед фиксацией выборки остановите сбор, чтобы её границы были явными.')
    counts, pairs, queue, by_teacher = match_entries(teachers,entries)
    output = Path(output)
    output.mkdir(parents=True,exist_ok=True)
    ids = {pair['elibrary_id'] for pair in pairs}
    matched = [entry for entry in entries if entry['elibrary_id'] in ids]
    teacher_ids = {}
    for pair in pairs:
        teacher_ids.setdefault(pair['elibrary_id'],set()).add(pair['teacher_id'])
    write_csv(output/'matched_publications.csv',
        ['elibrary_id','title','publication_year','authors','candidate_teacher_ids','authors_truncated','source_url'],
        [{'elibrary_id':e['elibrary_id'],'title':e['title'],'publication_year':e['publication_year'],
          'authors':'; '.join(e['authors']),'candidate_teacher_ids':'; '.join(map(str,sorted(teacher_ids[e['elibrary_id']]))),
          'authors_truncated':e['authors_truncated'],'source_url':e['source_url']} for e in matched])
    write_csv(output/'teacher_candidates.csv', ['teacher_id','teacher_name','institution','candidate_publications'],
        [{'teacher_id':t['id'],'teacher_name':t['name'],'institution':t['institution'],
          'candidate_publications':len(by_teacher[t['id']])} for t in teachers])
    manifest = {'created_at':datetime.now(timezone.utc).isoformat(),'source_run_id':scan['run_id'],
        'collection_id':scan['collection_id'],'source_status':scan['status'],'pages':scan['pages'],
        'unique_publications':len(entries),'expected_publications':scan['total'],
        'duplicate_rows_removed':scan['rows']-len(entries),
        'coverage_complete':scan['status']=='complete' and len(entries)==scan['total'],
        'teacher_directory_rows':len(teachers),'teacher_dump_sha256':dump_hash,
        'scope':'frozen_collected_sample','metadata_source':'listing',**counts,
        'limitations':['Неполная выборка публикаций; не репрезентативная случайная выборка.',
            'Совпадения по инициалам являются кандидатами, не подтверждённым авторством.',
            'Нет аннотаций, ключевых слов и векторов; подробные карточки не загружались.',
            'Год извлечён из строки выдачи; исходное описание сохранено.',
            'Сокращённые/отсутствующие авторы и транслитерация требуют дополнительной проверки.']}
    target = output/'analysis.sqlite3'
    temporary = output/'analysis.building.sqlite3'
    # A previous interrupted build can be safely reused: all generated tables are recreated.
    conn = sqlite3.connect(temporary)
    try:
        conn.execute('PRAGMA foreign_keys=ON')
        conn.executescript('''
            DROP VIEW IF EXISTS candidate_teacher_publications;
            DROP TABLE IF EXISTS teacher_matches;
            DROP TABLE IF EXISTS publication_authors;
            DROP TABLE IF EXISTS publications;
            DROP TABLE IF EXISTS teacher_directory;
            DROP TABLE IF EXISTS dataset_metadata;
            CREATE TABLE dataset_metadata (key TEXT PRIMARY KEY,value TEXT NOT NULL);
            CREATE TABLE teacher_directory (id INTEGER PRIMARY KEY,name TEXT NOT NULL,institution TEXT,source_row INTEGER);
            CREATE TABLE publications (elibrary_id INTEGER PRIMARY KEY,title TEXT NOT NULL,publication_year INTEGER,
                source_url TEXT NOT NULL,authors_truncated INTEGER NOT NULL,authors_missing INTEGER NOT NULL,
                bibliography TEXT NOT NULL,metadata_source TEXT NOT NULL);
            CREATE TABLE publication_authors (elibrary_id INTEGER NOT NULL REFERENCES publications,
                author_order INTEGER NOT NULL,name TEXT NOT NULL,PRIMARY KEY(elibrary_id,author_order));
            CREATE TABLE teacher_matches (elibrary_id INTEGER NOT NULL,author_order INTEGER NOT NULL,
                teacher_id INTEGER NOT NULL REFERENCES teacher_directory,method TEXT NOT NULL,status TEXT NOT NULL,
                PRIMARY KEY(elibrary_id,author_order,teacher_id),
                FOREIGN KEY(elibrary_id,author_order) REFERENCES publication_authors(elibrary_id,author_order));
            CREATE INDEX sample_matches_teacher ON teacher_matches(teacher_id);
            CREATE INDEX sample_publications_year ON publications(publication_year);
            CREATE VIEW candidate_teacher_publications AS
                SELECT DISTINCT t.id AS teacher_id,t.name AS teacher_name,p.elibrary_id,p.title,p.publication_year,m.status
                FROM teacher_matches m JOIN teacher_directory t ON t.id=m.teacher_id
                JOIN publications p USING(elibrary_id);
        ''')
        with conn:
            conn.executemany('INSERT INTO teacher_directory VALUES (?,?,?,?)',
                [(t['id'],t['name'],t['institution'],t['source_row']) for t in teachers])
            conn.executemany('INSERT INTO publications VALUES (?,?,?,?,?,?,?,?)',
                [(e['elibrary_id'],e['title'],e['publication_year'],e['source_url'],int(e['authors_truncated']),
                  int(e['authors_missing']),e['bibliography'],e['metadata_source']) for e in entries])
            conn.executemany('INSERT INTO publication_authors VALUES (?,?,?)',
                [(e['elibrary_id'],n,name) for e in entries for n,name in enumerate(e['authors'],1)])
            conn.executemany('INSERT INTO teacher_matches VALUES (?,?,?,?,?)',
                [(p['elibrary_id'],p['author_order'],p['teacher_id'],p['method'],p['status']) for p in pairs])
            conn.executemany('INSERT INTO dataset_metadata VALUES (?,?)',
                [(key,json.dumps(value,ensure_ascii=False)) for key,value in manifest.items()])
        if conn.execute('PRAGMA integrity_check').fetchone()[0]!='ok' or conn.execute('PRAGMA foreign_key_check').fetchall():
            raise ValueError('Проверка целостности подготовленной базы не пройдена.')
    finally:
        conn.close()
    temporary.replace(target)
    manifest['database_sha256'] = hashlib.sha256(target.read_bytes()).hexdigest()
    atomic_write(output/'manifest.json',json.dumps(manifest,ensure_ascii=False,indent=2))
    return manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--work',type=Path,default=DEFAULT_WORK)
    parser.add_argument('--dump',type=Path,required=True)
    parser.add_argument('--output',type=Path,default=DEFAULT_WORK/'sample')
    args = parser.parse_args()
    teachers = load_teachers(args.dump)
    report = prepare(args.work,teachers,hashlib.sha256(args.dump.read_bytes()).hexdigest(),args.output)
    print(json.dumps(report,ensure_ascii=False,indent=2))


if __name__=='__main__':
    main()
