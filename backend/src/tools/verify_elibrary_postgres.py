"""Restore the shipped dump into a disposable database and verify its data.

Connection settings use PGHOST/PGPORT/PGUSER/PGPASSWORD. Never uses an existing
target database: creates a unique database and removes only that database.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import shutil
import subprocess
import uuid

import psycopg
from psycopg import sql


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--pg-bin',type=Path,help='Directory containing pg_restore')
    parser.add_argument('--maintenance-db',default='postgres')
    args=parser.parse_args()
    dataset=Path(__file__).resolve().parents[2]/'data/elibrary'
    manifest=json.loads((dataset/'manifest.json').read_text(encoding='utf8'))
    dump=dataset/manifest['file']
    if hashlib.sha256(dump.read_bytes()).hexdigest()!=manifest['sha256']:
        raise ValueError('Dump SHA-256 mismatch')
    executable=str(args.pg_bin/'pg_restore.exe') if args.pg_bin else shutil.which('pg_restore')
    if not executable or not Path(executable).is_file():
        parser.error('pg_restore not found. Install PostgreSQL 18 or specify --pg-bin.')
    name='elibrary_verify_'+uuid.uuid4().hex
    with psycopg.connect(dbname=args.maintenance_db,autocommit=True) as admin:
        admin.execute(sql.SQL('CREATE DATABASE {}').format(sql.Identifier(name)))
        try:
            subprocess.run([executable,'--exit-on-error','--no-owner','--no-acl','--dbname',name,str(dump)],check=True)
            with psycopg.connect(dbname=name) as conn:
                for table,expected in manifest['tables'].items():
                    actual=conn.execute(sql.SQL('SELECT count(*) FROM elibrary_sample.{}').format(sql.Identifier(table))).fetchone()[0]
                    if actual!=expected:
                        raise ValueError(f'{table}: expected {expected}, received {actual}')
                invalid=conn.execute("SELECT count(*) FROM pg_constraint WHERE connamespace='elibrary_sample'::regnamespace AND NOT convalidated").fetchone()[0]
                if invalid:
                    raise ValueError('Unvalidated constraints')
                for table in ('publication_title_vectors','publication_detail_vectors'):
                    for dimensions,indices,weights in conn.execute(sql.SQL('SELECT dimensions,indices,weights FROM elibrary_sample.{}').format(sql.Identifier(table))):
                        if (len(indices)!=len(weights) or len(set(indices))!=len(indices)
                            or any(type(i)!=int or not 0<=i<dimensions for i in indices)
                            or any(not math.isfinite(w) for w in weights)
                            or weights and abs(sum(w*w for w in weights)-1)>1e-8):
                            raise ValueError(f'Invalid vector in {table}')
                for view in ('candidate_teacher_publications','supported_teacher_publications'):
                    conn.execute(sql.SQL('SELECT * FROM elibrary_sample.{} LIMIT 1').format(sql.Identifier(view))).fetchall()
            print('PASS: PostgreSQL restore, table counts, constraints, views and vector dimensions/norms')
        finally:
            admin.execute(sql.SQL('DROP DATABASE {} WITH (FORCE)').format(sql.Identifier(name)))


if __name__=='__main__':
    main()
