"""Build a handoff bundle from explicitly selected dataset artifacts, offline."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import shutil
import sqlite3
from contextlib import closing
import zipfile

from elibrary_title_vectors import build,search
from elibrary_detail_vectors import build_details
from elibrary_mentor_example import build_example
from export_elibrary_sample import export
from export_elibrary_card_details import export_details
from parse_elibrary import DEFAULT_WORK, atomic_write
from match_elibrary_lists import write_csv


def package(sample,output,teacher_dump=None):
    sample,output=Path(sample),Path(output)
    output.mkdir(parents=True,exist_ok=True)
    vectors=build(sample/'analysis.refined.sqlite3',sample/'analysis.ready.sqlite3')
    details=build_details(sample/'analysis.ready.sqlite3')
    if teacher_dump is None:
        teacher_dump=Path.home()/'Downloads/AyuGram Desktop/database.dump'
    build_example(sample/'analysis.ready.sqlite3',teacher_dump,sample)
    exported=export(sample/'analysis.ready.sqlite3',output)
    cards=sample/'enrichment/cards' if (sample/'enrichment/cards').exists() else sample/'quality/cards'
    export_details(cards,sample/'publication_details.csv')
    with closing(sqlite3.connect(sample/'analysis.ready.sqlite3')) as conn:
        examples=[]
        for teacher_id,name,item_id,title,payload in conn.execute('''
            SELECT DISTINCT t.id,t.name,p.elibrary_id,p.title,c.payload
            FROM match_evidence e JOIN teacher_directory t ON t.id=e.teacher_id
            JOIN publications p USING(elibrary_id) JOIN card_metadata c USING(elibrary_id)
            WHERE e.verdict='full_name_affiliation_supported' ORDER BY t.id,p.elibrary_id LIMIT 10'''):
            card=json.loads(payload)
            examples.append({'teacher_id':teacher_id,'teacher_name':name,'elibrary_id':item_id,
                'title':title,'abstract':card.get('abstract') or '',
                'keywords':'; '.join(card.get('keywords') or []),
                'evidence':'Совпадают полное ФИО и аффилиация ТюмГУ; не ручное подтверждение личности',
                'vector_fields':'; '.join(row[0] for row in conn.execute(
                    'SELECT field FROM publication_detail_vectors WHERE elibrary_id=? ORDER BY field',(item_id,))),
                'source_url':f'https://elibrary.ru/item.asp?id={item_id}'})
    write_csv(sample/'teacher_publication_examples.csv',
        ['teacher_id','teacher_name','elibrary_id','title','abstract','keywords','evidence','vector_fields','source_url'],examples)
    sources={
        'START_HERE.html':sample/'START_HERE.html',
        'REQUIREMENTS.md':sample/'REQUIREMENTS.md',
        'example_queries.sql':sample/'example_queries.sql',
        'ibrahim_teachers_full.csv':sample/'ibrahim_teachers_full.csv',
        'teacher_articles_with_vectors.csv':sample/'teacher_articles_with_vectors.csv',
        'analysis.sqlite3':sample/'analysis.ready.sqlite3',
        'matched_publications.csv':sample/'matched_publications.csv',
        'teacher_candidates.csv':sample/'teacher_candidates.csv',
        'refined_matches.csv':sample/'refined_matches.csv',
        'publication_details.csv':sample/'publication_details.csv',
        'teacher_publication_examples.csv':sample/'teacher_publication_examples.csv',
        'source_manifest.json':sample/'manifest.json',
        'refinement_summary.json':sample/'refinement_summary.json',
        'title_vector_model.json':sample/'title_vector_model.json',
        'title_vector_summary.json':sample/'title_vector_summary.json',
        'abstract_vector_model.json':sample/'abstract_vector_model.json',
        'keywords_vector_model.json':sample/'keywords_vector_model.json',
        'detail_vectors.csv':sample/'detail_vectors.csv',
        'detail_vector_summary.json':sample/'detail_vector_summary.json',
        'quality_summary.json':sample/'quality/quality_summary.json',
        'verification.csv':sample/'quality/verification.csv',
        'verification_summary.json':sample/'quality/verification_summary.json',
    }
    for name,source in sources.items():
        shutil.copyfile(source,output/name)
    examples=search(sample/'analysis.ready.sqlite3','машинное обучение анализ данных',5)
    atomic_write(output/'search_example.json',json.dumps(examples,ensure_ascii=False,indent=2))
    source=json.loads((sample/'manifest.json').read_text(encoding='utf8'))
    refined=json.loads((sample/'refinement_summary.json').read_text(encoding='utf8'))
    readme=f'''# Публикации ТюмГУ: текущая неполная выборка

Собрано {source['unique_publications']} уникальных публикаций из {source['expected_publications']} по счётчику сайта.
Это не полный и не случайный набор: делать выводы о всей научной деятельности университета по нему нельзя.
Справочник преподавателей: {source['teacher_directory_rows']} исходных записей, ID сохранены.
Кандидаты по именам: {source['publications_with_visible_matches']} публикаций, {source['candidate_pairs']} связей.
Совпадение по инициалам не является подтверждённым авторством.

## Файлы и использование

- analysis.sqlite3 — готовая локальная база SQLite, открывается без PostgreSQL.
- elibrary_sample.dump — архив PostgreSQL custom; elibrary_sample.sql — эквивалентная SQL/COPY-выгрузка.
- matched_publications.csv — публикации с кандидатами на совпадение по спискам.
- teacher_candidates.csv — число таких публикаций для каждого преподавателя.
- refined_matches.csv — дополнительные признаки из {refined['cards']} разобранных карточек.
- publication_details.csv — полные ФИО, организации, аннотации и ключевые слова доступных карточек.
- title_vector_model.json — словарь и веса TF-IDF; векторы находятся в таблице publication_title_vectors.
- search_example.json — пример лексического поиска по названиям.
- manifest.json — контрольные суммы файлов; source_manifest.json — происхождение неполной выборки.

## Восстановление PostgreSQL

Нужны PostgreSQL 18 и pg_restore/psql. Создайте отдельную пустую базу:

```text
createdb studportrait_elibrary_sample
pg_restore --exit-on-error --no-owner --no-acl --dbname=studportrait_elibrary_sample elibrary_sample.dump
```

Либо вместо pg_restore:

```text
psql --set=ON_ERROR_STOP=1 --dbname=studportrait_elibrary_sample --file=elibrary_sample.sql
```

Оба файла создают схему elibrary_sample. Не применяйте их одновременно и не используйте повторно
в уже заполненной схеме. Таблицы приложения в public не изменяются.
Архив проверен чтением обратно с полным сравнением строк. Реальное восстановление на PostgreSQL
в этой среде не запускалось. SQLite проверена через integrity_check и foreign_key_check.

## Признаки и ограничения

- Метаданные карточек есть только у {refined['cards']} публикаций: аннотации/ключевые слова не заполнены для остальных.
- Для {refined['supported_publications']} публикаций есть связи с уникальным полным ФИО и аффилиацией ТюмГУ;
  это дополнительное основание, а не ручная проверка личности.
- teacher_matches сохраняет исходных кандидатов. match_evidence хранит дополнительные признаки отдельно.
- Векторы — лексический TF-IDF по названиям, словарь {vectors['dimensions']} слов, с лемматизацией, униграммами и биграммами; без нейросетевой семантики.
  Пустых векторов: {vectors['empty_vectors']}. Они не участвуют в поиске.
- Формат векторов разреженный: indices и weights с общей размерностью dimensions.
- Год извлечён из библиографической строки выдачи и нуждается в проверке по карточкам.

## Примеры SQL

В PostgreSQL используйте SET search_path TO elibrary_sample, pg_catalog;

```sql
SELECT teacher_id, teacher_name, count(DISTINCT elibrary_id) AS candidate_publications
FROM candidate_teacher_publications GROUP BY teacher_id, teacher_name
ORDER BY candidate_publications DESC;

SELECT * FROM supported_teacher_publications;
```

Сбор можно продолжить позже из исходного проекта через elibrary_lists.py --resume.
Архив для передачи не содержит браузерный профиль, cookies и исходные HTML-страницы.
'''
    atomic_write(output/'README.md','Начните с START_HERE.html — все подробные карточки одним списком в браузере. REQUIREMENTS.md — требования, связи и ограничения.\n\n'+readme)
    with (output/'README.md').open('a',encoding='utf8') as handle:
        handle.write('\n## Векторы подробных карточек\n\n'
            'Аннотации и ключевые слова векторизованы отдельно методом TF-IDF. Это лексические признаки, не нейросетевые эмбеддинги. '
            'Отсутствующий текст не заменяется выдуманным вектором. Модели полей имеют разные словари: напрямую сравнивать их координаты нельзя.\n\n'
            f"Аннотации: {details['abstract']['documents']}; ключевые слова: {details['keywords']['documents']}. "
            'Векторы: detail_vectors.csv и таблица publication_detail_vectors; словари: abstract_vector_model.json и keywords_vector_model.json.\n')
    names=sorted(list(sources)+['elibrary_sample.dump','elibrary_sample.sql','export_summary.json','search_example.json','README.md'])
    paths={}
    for name in names:
        folder=('database' if name in ('analysis.sqlite3','elibrary_sample.dump','elibrary_sample.sql') else
                'sql' if name=='example_queries.sql' else 'models' if name.endswith('_vector_model.json') else
                'csv' if name.endswith('.csv') and name!='verification.csv' else
                'docs' if name=='REQUIREMENTS.md' else
                'reports' if name.endswith('.json') or name=='verification.csv' else '')
        paths[name]=str(Path(folder)/name).replace('\\','/')
    for name,relative in paths.items():
        if relative!=name:
            destination=output/relative
            destination.parent.mkdir(parents=True,exist_ok=True)
            (output/name).replace(destination)
    for document in ('START_HERE.html','docs/REQUIREMENTS.md'):
        path=output/document
        content=path.read_text(encoding='utf8')
        for name,relative in paths.items():
            if relative!=name:
                content=content.replace(name,relative if document=='START_HERE.html' else '../'+relative)
        atomic_write(path,content)
    atomic_write(output/'README.md', '''# Публикации eLIBRARY и преподаватели ТюмГУ

START_HERE.html — все подробные карточки для просмотра в браузере.
database/ — PostgreSQL dump, SQL-выгрузка и альтернативная SQLite-база.
csv/ — преподаватели, публикации, связи и векторы в таблицах.
models/ — словари и параметры трёх TF-IDF-моделей.
sql/example_queries.sql — примеры запросов.
docs/REQUIREMENTS.md — выполненные требования и ограничения.
reports/ — отчёты, происхождение и проверки данных.

## PostgreSQL

Для PostgreSQL 18 создайте отдельную пустую базу:
```text
createdb studportrait_elibrary_sample
pg_restore --exit-on-error --no-owner --no-acl --dbname=studportrait_elibrary_sample database/elibrary_sample.dump
```

Альтернатива дампу: psql --set=ON_ERROR_STOP=1 --dbname=studportrait_elibrary_sample --file=database/elibrary_sample.sql
Используйте один вариант. Восстановление на сервере пока не проверено; проверено чтение архива обратно.
Данные находятся в схеме elibrary_sample. Исходная база приложения не изменяется.

## Связи данных

teacher_id — исходный ID преподавателя из дампа Ибрагима; elibrary_id — ID публикации.
teacher_matches содержит кандидатов, match_evidence — основания совпадения по карточкам.
Векторы названий: publication_title_vectors; аннотаций и ключевых слов: publication_detail_vectors.
TF-IDF с лемматизацией русского текста, стоп-словами и словосочетаниями. Полнота каталога не достигнута.
''')
    names=sorted(paths.values())
    manifest={'created_at':datetime.now(timezone.utc).isoformat(),'scope':'partial_collected_sample',
        'coverage_complete':False,'tables':exported['tables'],'postgresql_restore_tested':False,
        'files':{name:{'sha256':hashlib.sha256((output/name).read_bytes()).hexdigest(),'bytes':(output/name).stat().st_size} for name in names}}
    atomic_write(output/'manifest.json',json.dumps(manifest,ensure_ascii=False,indent=2))
    archive_path=output/'elibrary_sample_bundle.zip'
    with zipfile.ZipFile(archive_path,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as archive:
        for name in names+['manifest.json']:
            archive.write(output/name,arcname=name)
    with zipfile.ZipFile(archive_path) as archive:
        if archive.testzip() is not None:
            raise ValueError('Ошибка проверки ZIP.')
        for name in names:
            if hashlib.sha256(archive.read(name)).hexdigest()!=manifest['files'][name]['sha256']:
                raise ValueError(f'Не совпала контрольная сумма {name}.')
    atomic_write(output/'elibrary_sample_bundle.sha256',hashlib.sha256(archive_path.read_bytes()).hexdigest()+'  '+archive_path.name+'\n')
    return {'archive':str(archive_path),'bytes':archive_path.stat().st_size,'tables':exported['tables'],
            'archive_roundtrip_verified':True,'zip_checksums_verified':True,'postgresql_restore_tested':False}


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--sample',type=Path,default=DEFAULT_WORK/'sample')
    parser.add_argument('--output',type=Path,default=DEFAULT_WORK/'delivery')
    parser.add_argument('--teacher-dump',type=Path)
    args=parser.parse_args()
    print(json.dumps(package(args.sample,args.output,args.teacher_dump),ensure_ascii=False,indent=2))


if __name__=='__main__':
    main()
