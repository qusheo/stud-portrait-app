"""Add full-name/affiliation evidence from cached cards to a derived SQLite copy."""
import argparse
from collections import Counter
from contextlib import closing
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import sqlite3

from audit_elibrary_matches import tyumgu_affiliation
from match_elibrary_lists import write_csv
from parse_elibrary import DEFAULT_WORK, TeacherIndex, atomic_write


def evidence_for_author(author,index):
    fullname=author.get('full_name')
    matches=index.match(fullname or author['name'])
    at_tyumgu=any(tyumgu_affiliation(org) for org in author.get('affiliations',[]))
    full_match=bool(matches) and all(method=='full_name' for _,method,_ in matches)
    verdict=('initials_only' if not full_match else 'ambiguous_directory_name' if len(matches)>1
             else 'full_name_affiliation_supported' if at_tyumgu else 'full_name_supported')
    return [(tid,verdict) for tid,_,_ in matches]


def refine(source,cards_dir,target):
    source=Path(source)
    target=Path(target)
    if source.resolve()==target.resolve():
        raise ValueError('Исходная база и результат должны быть разными файлами.')
    target.parent.mkdir(parents=True,exist_ok=True)
    original_hash=hashlib.sha256(source.read_bytes()).hexdigest()
    temporary=target.with_suffix('.building.sqlite3')
    with closing(sqlite3.connect(source.resolve().as_uri()+'?mode=ro',uri=True)) as src:
        with closing(sqlite3.connect(temporary)) as dest:
            src.backup(dest)
    rows=[]
    skipped=[]
    cards=0
    with closing(sqlite3.connect(temporary)) as conn:
        conn.execute('PRAGMA foreign_keys=ON')
        teachers=dict(conn.execute('SELECT id,name FROM teacher_directory').fetchall())
        index=TeacherIndex(list(teachers.items()))
        conn.executescript('''
            CREATE TABLE card_metadata (elibrary_id INTEGER PRIMARY KEY REFERENCES publications,
                payload TEXT NOT NULL,source_file TEXT NOT NULL);
            CREATE TABLE card_authors (elibrary_id INTEGER NOT NULL REFERENCES card_metadata,
                author_order INTEGER NOT NULL,name TEXT NOT NULL,full_name TEXT,elibrary_author_id INTEGER,
                affiliations TEXT NOT NULL,PRIMARY KEY(elibrary_id,author_order));
            CREATE TABLE match_evidence (elibrary_id INTEGER NOT NULL,card_author_order INTEGER NOT NULL,
                teacher_id INTEGER NOT NULL REFERENCES teacher_directory,verdict TEXT NOT NULL,
                was_listing_candidate INTEGER NOT NULL,
                PRIMARY KEY(elibrary_id,card_author_order,teacher_id),
                FOREIGN KEY(elibrary_id,card_author_order) REFERENCES card_authors(elibrary_id,author_order));
            CREATE VIEW supported_teacher_publications AS
                SELECT DISTINCT e.teacher_id,t.name AS teacher_name,e.elibrary_id,p.title,p.publication_year
                FROM match_evidence e JOIN teacher_directory t ON t.id=e.teacher_id
                JOIN publications p USING(elibrary_id)
                WHERE e.verdict='full_name_affiliation_supported';
        ''')
        with conn:
            for path in sorted(Path(cards_dir).glob('*.json')):
                card=json.loads(path.read_text(encoding='utf8'))
                item_id=card['elibrary_id']
                if not conn.execute('SELECT 1 FROM publications WHERE elibrary_id=?',(item_id,)).fetchone():
                    skipped.append(item_id)
                    continue
                cards+=1
                conn.execute('INSERT INTO card_metadata VALUES (?,?,?)',
                             (item_id,json.dumps(card,ensure_ascii=False),str(path)))
                for position,author in enumerate(card['authors'],1):
                    conn.execute('INSERT INTO card_authors VALUES (?,?,?,?,?,?)',
                        (item_id,position,author['name'],author.get('full_name'),author.get('elibrary_author_id'),
                         json.dumps(author.get('affiliations',[]),ensure_ascii=False)))
                    for teacher_id,verdict in evidence_for_author(author,index):
                        prior=bool(conn.execute('SELECT 1 FROM teacher_matches WHERE elibrary_id=? AND teacher_id=?',
                                                (item_id,teacher_id)).fetchone())
                        conn.execute('INSERT INTO match_evidence VALUES (?,?,?,?,?)',
                                     (item_id,position,teacher_id,verdict,int(prior)))
                        rows.append({'elibrary_id':item_id,'card_author_order':position,'teacher_id':teacher_id,
                            'teacher_name':teachers[teacher_id],'card_author_name':author['name'],
                            'full_name':author.get('full_name'),'elibrary_author_id':author.get('elibrary_author_id'),
                            'affiliations':'; '.join(author.get('affiliations',[])),
                            'verdict':verdict,'was_listing_candidate':prior})
            metadata={'source_database_sha256':original_hash,'created_at':datetime.now(timezone.utc).isoformat(),
                'cards':cards,'evidence_rows':len(rows),'verdicts':dict(Counter(r['verdict'] for r in rows)),
                'supported_publications':len({r['elibrary_id'] for r in rows if r['verdict']=='full_name_affiliation_supported'}),
                'additional_candidate_links':sum(not r['was_listing_candidate'] for r in rows),
                'skipped_cards_not_in_sample':skipped,
                'note':'Supported — совпадение полного ФИО и аффилиации ТюмГУ, не ручное подтверждение личности. Исходные кандидаты не удалены.'}
            conn.execute('INSERT OR REPLACE INTO dataset_metadata VALUES (?,?)',
                         ('refinement',json.dumps(metadata,ensure_ascii=False)))
        if conn.execute('PRAGMA integrity_check').fetchone()[0]!='ok' or conn.execute('PRAGMA foreign_key_check').fetchall():
            raise ValueError('Не пройдена проверка целостности результата.')
    temporary.replace(target)
    if hashlib.sha256(source.read_bytes()).hexdigest()!=original_hash:
        raise ValueError('Исходная база изменилась во время обработки.')
    write_csv(target.parent/'refined_matches.csv',
        ['elibrary_id','card_author_order','teacher_id','teacher_name','card_author_name','full_name',
         'elibrary_author_id','affiliations','verdict','was_listing_candidate'],rows)
    atomic_write(target.parent/'refinement_summary.json',json.dumps(metadata,ensure_ascii=False,indent=2))
    return metadata


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source',type=Path,default=DEFAULT_WORK/'sample/analysis.sqlite3')
    parser.add_argument('--cards',type=Path,default=DEFAULT_WORK/'sample/quality/cards')
    parser.add_argument('--output',type=Path,default=DEFAULT_WORK/'sample/analysis.refined.sqlite3')
    args=parser.parse_args()
    print(json.dumps(refine(args.source,args.cards,args.output),ensure_ascii=False,indent=2))


if __name__=='__main__':
    main()
