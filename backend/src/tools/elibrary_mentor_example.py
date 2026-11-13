"""Offline readable handoff and complete teacher source rows, without account data."""
from contextlib import closing
from html import escape
import hashlib
import json
from pathlib import Path
import re
import sqlite3

from match_elibrary_lists import close_dump, write_csv
from parse_elibrary import atomic_write


def build_example(database, dump_path, output):
    import pgdumplib
    from pgdumplib import constants
    output=Path(output)
    with closing(sqlite3.connect(database)) as conn:
        expected=json.loads(conn.execute("SELECT value FROM dataset_metadata WHERE key='teacher_dump_sha256'").fetchone()[0])
        if hashlib.sha256(Path(dump_path).read_bytes()).hexdigest()!=expected:
            raise ValueError('Teacher dump differs from source manifest')
        dump=pgdumplib.load(dump_path)
        try:
            entry=dump.lookup_entry(constants.TABLE_DATA,'public','teacher_directory')
            columns=[v.strip().strip('"') for v in re.search(r'\((.*?)\)\s+FROM\s+stdin',entry.copy_stmt,re.S|re.I)[1].split(',')]
            teachers=[dict(zip(columns,row)) for row in dump.table_data('public','teacher_directory')]
        finally:
            close_dump(dump)
        ids={r[0] for r in conn.execute('SELECT id FROM teacher_directory')}
        if ids!={int(r['id']) for r in teachers}:
            raise ValueError('Original teacher IDs do not match working database')
        conn.executescript('''DROP TABLE IF EXISTS teacher_source_rows;
            CREATE TABLE teacher_source_rows (teacher_id INTEGER PRIMARY KEY REFERENCES teacher_directory,payload TEXT NOT NULL);''')
        with conn:
            conn.executemany('INSERT INTO teacher_source_rows VALUES (?,?)',
                [(int(r['id']),json.dumps(r,ensure_ascii=False)) for r in teachers])
        write_csv(output/'ibrahim_teachers_full.csv',columns,teachers)
        models={}
        for model_id,config in conn.execute('SELECT model_id,config FROM title_vector_models UNION ALL SELECT model_id,config FROM detail_vector_models'):
            models[model_id]=json.loads(config)
        rows=[]
        for tid,name,pid,title,year,payload,verdict in conn.execute('''
            SELECT DISTINCT t.id,t.name,p.elibrary_id,p.title,p.publication_year,c.payload,e.verdict
            FROM match_evidence e JOIN teacher_directory t ON t.id=e.teacher_id
            JOIN publications p USING(elibrary_id) JOIN card_metadata c USING(elibrary_id)
            ORDER BY t.id,p.elibrary_id,e.verdict'''):
            card=json.loads(payload)
            vector_rows=list(conn.execute('SELECT model_id,indices,weights FROM publication_title_vectors WHERE elibrary_id=?',(pid,)))
            vector_rows+=list(conn.execute('SELECT model_id,indices,weights FROM publication_detail_vectors WHERE elibrary_id=?',(pid,)))
            tops={}
            for mid,indices,weights in vector_rows:
                model=models[mid]
                field=model.get('field','title')
                tops[field]='; '.join(f'{model["vocabulary"][i]} ({w:.3f})' for i,w in
                    sorted(zip(json.loads(indices),json.loads(weights)),key=lambda x:-x[1])[:8])
            rows.append({'teacher_id':tid,'teacher_name':name,'elibrary_id':pid,'title':card.get('title') or title,
                'publication_year':card.get('publication_year') or year,'publication_date':card.get('publication_date') or '',
                'source_topics':json.dumps(card.get('topics') or {},ensure_ascii=False),'verdict':verdict,
                'authors':'; '.join(a.get('full_name') or a['name'] for a in card['authors']),
                'abstract':card.get('abstract') or '', 'keywords':'; '.join(card.get('keywords') or []),
                'title_vector_terms':tops.get('title',''),'abstract_vector_terms':tops.get('abstract',''),
                'keywords_vector_terms':tops.get('keywords',''),'source_url':f'https://elibrary.ru/item.asp?id={pid}'})
        fields=['teacher_id','teacher_name','elibrary_id','title','publication_year','publication_date','source_topics','verdict',
                'authors','abstract','keywords','title_vector_terms','abstract_vector_terms','keywords_vector_terms','source_url']
        write_csv(output/'teacher_articles_with_vectors.csv',fields,rows)
        selected=list(rows)
        linked={r['elibrary_id'] for r in rows}
        for pid,payload in conn.execute('SELECT elibrary_id,payload FROM card_metadata ORDER BY elibrary_id'):
            if pid in linked:
                continue
            card=json.loads(payload)
            row=dict.fromkeys(fields,'')
            row.update(elibrary_id=pid,title=card.get('title') or '',verdict='no_teacher_match',
                publication_year=card.get('publication_year') or '',publication_date=card.get('publication_date') or '',
                source_topics=json.dumps(card.get('topics') or {},ensure_ascii=False),
                authors='; '.join(a.get('full_name') or a['name'] for a in card['authors']),
                abstract=card.get('abstract') or '',keywords='; '.join(card.get('keywords') or []),
                source_url=f'https://elibrary.ru/item.asp?id={pid}')
            for mid,ii,ww in list(conn.execute('SELECT model_id,indices,weights FROM publication_title_vectors WHERE elibrary_id=?',(pid,)))+list(conn.execute('SELECT model_id,indices,weights FROM publication_detail_vectors WHERE elibrary_id=?',(pid,))):
                model=models[mid]
                row[model.get('field','title')+'_vector_terms']='; '.join(f'{model["vocabulary"][i]} ({w:.3f})' for i,w in sorted(zip(json.loads(ii),json.loads(ww)),key=lambda x:-x[1])[:8])
            selected.append(row)
        cards=[]
        for row in selected:
            cards.append('<article><h2>'+escape(str(row['teacher_name'] or 'Преподаватель не найден'))+' → '+escape(str(row['title']))+'</h2>'+''.join(f'<p><b>{escape(k)}</b>: {escape(str(row[k]))}</p>' for k in fields)+'</article><hr>')
        atomic_write(output/'START_HERE.html','<!doctype html><html lang="ru"><meta charset="utf-8"><title>Публикации</title><body><h1>Преподаватели и публикации</h1><p>Все загруженные карточки. У одной статьи может быть несколько преподавателей.</p>'+''.join(cards)+'</body></html>')
        counts={table:conn.execute('SELECT count(*) FROM '+table).fetchone()[0] for table in
            ['teacher_directory','publications','card_metadata','match_evidence','publication_title_vectors','publication_detail_vectors']}
        report=f'''# Выполнение задания на имеющихся данных

Это законченный демонстрационный набор, а не полное выполнение сбора всех публикаций eLIBRARY.

| Требование | Реализация |
|---|---|
| Преподаватели из database.dump Ибрагима | {len(teachers)} строк, {len(columns)} исходных полей; ibrahim_teachers_full.csv и teacher_source_rows.payload; ID сохранены |
| Отдельная таблица публикаций | publications: {counts['publications']}; подробные поля и рубрики: card_metadata.payload |
| Связь с преподавателями | teacher_matches — кандидаты по спискам; match_evidence — {counts['match_evidence']} связей из подробных карточек |
| Подробности публикаций | {counts['card_metadata']} карточек; publication_details.csv; аннотация/ключевые слова могут отсутствовать на сайте |
| Название, тема, дата | Название, исходные рубрики topics, год и точная дата при наличии в карточке; тему не придумываем, год не превращаем в 1 января |
| Три вида векторов | TF-IDF отдельно для названия, аннотации, ключевых слов; модели и хеш входа сохранены |
| SQL в проекте | backend/sql/elibrary_sample.sql — схема поставляемого набора; backend/sql/elibrary.sql — добавочные таблицы приложения |
| Дамп с данными | elibrary_sample.dump и elibrary_sample.sql: отдельная схема elibrary_sample, исходные таблицы приложения не заменяются |

## Как связаны данные

teacher_directory.id = teacher_source_rows.teacher_id = teacher_matches.teacher_id = match_evidence.teacher_id.
publications.elibrary_id связывает статью со списком авторов, подробной карточкой и векторами.
Одна публикация может иметь несколько преподавателей; поэтому teacher_id находится в таблице связей.
Позиции авторов списка и карточки различаются: используются author_order и card_author_order соответственно.
teacher_articles_with_vectors.csv объединяет связи из карточек, статью и расшифрованные векторы в одном файле.

## Ограничения качества

577 страниц обойдены, но уникальных ID 41922 при счётчике 57692. Повторение ID в ответах не доказывает,
что сам каталог состоит из дублей: пагинация могла пропустить публикации. coverage_complete=false.
Инициалы дают только кандидата. Полное ФИО и организация — более сильное основание, не доказанная личность.
Этот набор не позволяет оценить общую точность на всём университете; первоначальные 30 карточек были диагностическими.
TF-IDF с лемматизацией, униграммами и биграммами; без нейросетевой семантики. Разные модели полей имеют разные словари.
Реальное восстановление PostgreSQL не проверено: проверено чтение custom-дампа обратно с полным сравнением полей.
Оригинальный database.dump не изменяется и не включается в пакет целиком: посторонние таблицы и аккаунты не передаются.
В поставке SQLite analysis.sqlite3 — готовая база; в sample/analysis.sqlite3 — исходная база только списков.

## Проверка примера

Откройте START_HERE.html в браузере, затем teacher_articles_with_vectors.csv в Excel.
Для точных числовых векторов используйте publication_title_vectors и publication_detail_vectors в analysis.sqlite3;
detail_vectors.csv содержит векторы аннотаций и ключевых слов; *_vector_model.json — словари, не сами векторы статей.
Инструкции PostgreSQL находятся в README.md. Не запускайте backend/create_database.sql поверх дампа Ибрагима.
'''
        atomic_write(output/'REQUIREMENTS.md',report)
        atomic_write(output/'example_queries.sql','''-- PostgreSQL: read-only examples after restoring elibrary_sample.dump
SET search_path TO elibrary_sample, pg_catalog;
-- Original Ibrahim fields, matched by original teacher ID.
SELECT t.id,t.name,s.payload FROM teacher_directory t
JOIN teacher_source_rows s ON s.teacher_id=t.id LIMIT 10;
-- Strong automatic evidence; this is not a manual identity confirmation.
SELECT * FROM supported_teacher_publications LIMIT 20;
-- Card text, year/date and original subject classifications.
SELECT elibrary_id,payload->>'title' AS title,payload->>'publication_year' AS year,
payload->>'publication_date' AS exact_date,payload->>'abstract' AS abstract,
payload->'keywords' AS keywords,payload->'topics' AS topics FROM card_metadata LIMIT 10;
-- Three separate kinds of vectors and the corresponding dictionaries.
SELECT v.elibrary_id,'title' AS field,v.model_id,v.indices,v.weights,m.config->'vocabulary' AS vocabulary
FROM publication_title_vectors v JOIN title_vector_models m USING(model_id) LIMIT 1;
SELECT v.elibrary_id,v.field,v.model_id,v.indices,v.weights,m.config->'vocabulary' AS vocabulary
FROM publication_detail_vectors v JOIN detail_vector_models m USING(model_id) LIMIT 2;
''')
    return counts
