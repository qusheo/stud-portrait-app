"""Export the prepared partial dataset as PostgreSQL SQL and custom archives."""
import argparse
from contextlib import closing
import hashlib
import json
from pathlib import Path
import re
import sqlite3

from match_elibrary_lists import close_dump
from parse_elibrary import BACKEND, DEFAULT_WORK, atomic_write


def copy_text(value):
    if value is None:
        return r'\N'
    value=str(value)
    if '\x00' in value:
        raise ValueError('PostgreSQL text does not support NUL bytes.')
    return value.replace('\\','\\\\').replace('\t',r'\t').replace('\n',r'\n').replace('\r',r'\r')


def export(database,output):
    import pgdumplib
    from pgdumplib import constants
    output=Path(output)
    output.mkdir(parents=True,exist_ok=True)
    schema=(BACKEND/'sql/elibrary_sample.sql').read_text(encoding='utf8')
    statements=[s.strip() for s in re.sub(r'--[^\n]*','',schema).split(';') if s.strip()]
    table_names=[re.match(r'CREATE TABLE (\w+)',s)[1] for s in statements if s.startswith('CREATE TABLE ')]
    counts={}
    archive=pgdumplib.new('elibrary_sample')
    schema_entry=archive.add_entry(desc=constants.SCHEMA,tag='elibrary_sample',defn='CREATE SCHEMA elibrary_sample;')
    dependencies=[schema_entry.dump_id]
    try:
        with closing(sqlite3.connect(Path(database).resolve().as_uri()+'?mode=ro',uri=True)) as conn:
            if conn.execute('PRAGMA integrity_check').fetchone()[0]!='ok' or conn.execute('PRAGMA foreign_key_check').fetchall():
                raise ValueError('Исходная SQLite-база не прошла проверку целостности.')
            with (output/'elibrary_sample.sql').open('w',encoding='utf8',newline='\n') as sql:
                sql.write('-- Partial dataset; inspect dataset_metadata for coverage and candidate status.\nBEGIN;\n')
                sql.write(schema+'\n')
                for statement in statements:
                    if not statement.startswith('CREATE TABLE '):
                        continue
                    name=re.match(r'CREATE TABLE (\w+)',statement)[1]
                    qualified=re.sub(r'\b('+'|'.join(table_names)+r')\b',r'elibrary_sample.\1',statement)
                    entry=archive.add_entry(desc=constants.TABLE,namespace='elibrary_sample',tag=name,
                        defn=qualified+';',dependencies=dependencies.copy())
                    dependencies.append(entry.dump_id)
                    columns=[r[1] for r in conn.execute(f'PRAGMA table_info("{name}")')]
                    if not columns:
                        raise ValueError(f'Нет таблицы {name} в подготовленной базе.')
                    sql.write(f'COPY elibrary_sample.{name} ({", ".join(columns)}) FROM stdin;\n')
                    count=0
                    with archive.table_data_writer(entry,columns) as writer:
                        for row in conn.execute(f'SELECT * FROM "{name}"'):
                            encoded=[copy_text(value) for value in row]
                            sql.write('\t'.join(encoded)+'\n')
                            writer.append(*(None if value is None else escaped for value,escaped in zip(row,encoded)))
                            count+=1
                    sql.write('\\.\n')
                    counts[name]=count
                sql.write('COMMIT;\n')
            for statement in statements:
                if statement.startswith('CREATE INDEX '):
                    desc=constants.INDEX
                    name=re.match(r'CREATE INDEX (\w+)',statement)[1]
                elif statement.startswith('CREATE VIEW '):
                    desc=constants.VIEW
                    name=re.match(r'CREATE VIEW (\w+)',statement)[1]
                    statement=statement.replace('CREATE VIEW '+name,'CREATE VIEW elibrary_sample.'+name,1)
                else:
                    continue
                qualified=re.sub(r'\b('+'|'.join(table_names)+r')\b',r'elibrary_sample.\1',statement)
                archive.add_entry(desc=desc,namespace='elibrary_sample',tag=name,defn=qualified+';',dependencies=dependencies.copy())
            archive.save(output/'elibrary_sample.dump')
    finally:
        close_dump(archive)
    # Round-trip every field, not only counts: COPY escaping must preserve Unicode/JSON.
    loaded=pgdumplib.load(output/'elibrary_sample.dump')
    try:
        with closing(sqlite3.connect(Path(database).resolve().as_uri()+'?mode=ro',uri=True)) as conn:
            for name in table_names:
                restored=loaded.table_data('elibrary_sample',name)
                expected=conn.execute(f'SELECT * FROM "{name}"')
                sentinel=object()
                from itertools import zip_longest
                for actual,row in zip_longest(restored,expected,fillvalue=sentinel):
                    if actual is sentinel or row is sentinel or tuple(actual)!=tuple(None if v is None else str(v) for v in row):
                        raise ValueError(f'Round-trip дампа не совпал с источником: {name}.')
    finally:
        close_dump(loaded)
    result={'tables':counts,'source_database_sha256':hashlib.sha256(Path(database).read_bytes()).hexdigest(),
            'archive_roundtrip_verified':True,'postgresql_restore_tested':False,
            'note':'Архив PostgreSQL custom и SQL COPY. Реальное восстановление на сервере PostgreSQL ещё не проверено.'}
    atomic_write(output/'export_summary.json',json.dumps(result,ensure_ascii=False,indent=2))
    return result


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--database',type=Path,default=DEFAULT_WORK/'sample/analysis.ready.sqlite3')
    parser.add_argument('--output',type=Path,default=DEFAULT_WORK/'delivery')
    args=parser.parse_args()
    print(json.dumps(export(args.database,args.output),ensure_ascii=False,indent=2))


if __name__=='__main__':
    main()
