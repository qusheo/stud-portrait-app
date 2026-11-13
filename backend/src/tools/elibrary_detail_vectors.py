"""Build separate lexical vectors for cached abstracts and keywords, offline."""
from contextlib import closing
import json
from pathlib import Path
import sqlite3

from elibrary_title_vectors import fit, encode
from match_elibrary_lists import write_csv
from parse_elibrary import atomic_write, digest


def build_details(database):
    database = Path(database)
    reports = {}
    exported = []
    with closing(sqlite3.connect(database)) as conn:
        conn.execute('PRAGMA foreign_keys=ON')
        cards = [(item_id, json.loads(payload)) for item_id, payload in
                 conn.execute('SELECT elibrary_id,payload FROM card_metadata ORDER BY elibrary_id')]
        conn.executescript('''
            DROP TABLE IF EXISTS publication_detail_vectors;
            DROP TABLE IF EXISTS detail_vector_models;
            CREATE TABLE detail_vector_models (model_id TEXT PRIMARY KEY,field TEXT NOT NULL UNIQUE,config TEXT NOT NULL);
            CREATE TABLE publication_detail_vectors (
                elibrary_id INTEGER NOT NULL REFERENCES card_metadata,
                field TEXT NOT NULL,model_id TEXT NOT NULL REFERENCES detail_vector_models,
                input_hash TEXT NOT NULL,dimensions INTEGER NOT NULL,indices TEXT NOT NULL,weights TEXT NOT NULL,
                PRIMARY KEY(elibrary_id,field));
        ''')
        with conn:
            for field in ('abstract', 'keywords'):
                rows = []
                for item_id, card in cards:
                    value = card.get(field) or ''
                    text = '; '.join(value) if isinstance(value, list) else value.strip()
                    if text:
                        rows.append((item_id, text))
                if not rows:
                    reports[field] = {'documents': 0, 'empty_vectors': 0}
                    continue
                model = fit([text for _, text in rows], min_df=1,field=field)
                model['field'] = field
                model.pop('model_id')
                model['model_id'] = 'tfidf-' + field + '-' + digest(json.dumps(model, ensure_ascii=False, sort_keys=True))[:20]
                lookup = {term: i for i, term in enumerate(model['vocabulary'])}
                conn.execute('INSERT INTO detail_vector_models VALUES (?,?,?)',
                             (model['model_id'], field, json.dumps(model, ensure_ascii=False)))
                empty = 0
                for item_id, text in rows:
                    indices, weights = encode(text, model, lookup)
                    empty += not bool(indices)
                    conn.execute('INSERT INTO publication_detail_vectors VALUES (?,?,?,?,?,?,?)',
                                 (item_id, field, model['model_id'], digest(text), len(lookup),
                                  json.dumps(indices), json.dumps(weights)))
                    exported.append({'elibrary_id': item_id, 'field': field, 'model_id': model['model_id'],
                                     'dimensions': len(lookup), 'indices': json.dumps(indices), 'weights': json.dumps(weights)})
                reports[field] = {'documents': len(rows), 'dimensions': len(lookup), 'empty_vectors': empty,
                                  'model_id': model['model_id']}
                atomic_write(database.parent / (field + '_vector_model.json'), json.dumps(model, ensure_ascii=False))
            conn.execute('INSERT OR REPLACE INTO dataset_metadata VALUES (?,?)',
                         ('detail_vectorization', json.dumps(reports, ensure_ascii=False)))
        if conn.execute('PRAGMA integrity_check').fetchone()[0] != 'ok' or conn.execute('PRAGMA foreign_key_check').fetchall():
            raise ValueError('Detail vector integrity check failed')
    write_csv(database.parent / 'detail_vectors.csv',
              ['elibrary_id', 'field', 'model_id', 'dimensions', 'indices', 'weights'], exported)
    atomic_write(database.parent / 'detail_vector_summary.json', json.dumps(reports, ensure_ascii=False, indent=2))
    return reports
