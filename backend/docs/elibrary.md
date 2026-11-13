# eLIBRARY

Модуль сопоставляет публикации eLIBRARY с существующим справочником преподавателей и формирует набор для PostgreSQL. Исходные ID преподавателей сохраняются.

## Структура

```text
src/tools/                 сбор, сопоставление, векторизация, экспорт и тесты
sql/elibrary.sql           добавочная схема для базы приложения
sql/elibrary_sample.sql    схема самостоятельного набора данных
sql/elibrary_example_queries.sql  примеры запросов к набору
data/elibrary/             версионируемый PostgreSQL dump и метаданные
.elibrary/                 локальный кеш и профиль браузера; исключены из Git
```

Две SQL-схемы имеют разные назначения. `elibrary.sql` содержит таблицы `elibrary_*` для приложения. Готовый дамп использует отдельную схему `elibrary_sample` и не импортирует данные в таблицы приложения автоматически.

## Установка и проверка

Команды выполняются из `backend`, Python 3.14:

```text
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements-elibrary.txt
.venv/Scripts/python -m unittest discover -s src/tools -p "test_*.py"
```

Для восстановления готового набора достаточно PostgreSQL; Python-зависимости сборщика не нужны.

## Восстановление PostgreSQL

Требуются PostgreSQL 18, `createdb` и `pg_restore` в PATH.

```text
createdb studportrait_elibrary_sample
pg_restore --exit-on-error --no-owner --no-acl --dbname=studportrait_elibrary_sample data/elibrary/elibrary_sample.dump
psql --dbname=studportrait_elibrary_sample --file=sql/elibrary_example_queries.sql
```

Параметры подключения задаются через стандартные переменные окружения PostgreSQL. Пароли не сохраняются в репозитории.
Восстановление выполняется в отдельную пустую базу. `create_database.sql` пересоздаёт таблицы приложения и не используется для установки этого набора.

## Данные

`teacher_directory.id` — исходный ID преподавателя; `teacher_source_rows.payload` сохраняет все 18 полей исходного справочника.
`publications.elibrary_id` — ID публикации eLIBRARY. `publication_authors` содержит авторов списка, `card_authors` — авторов подробной карточки.
`teacher_matches` связывает преподавателей с авторами списка; `match_evidence` содержит основания сопоставления по карточкам.
`card_metadata.payload` хранит аннотации, ключевые слова, рубрики, год и точную дату при наличии.

`initials_only` означает совпадение инициалов; `full_name_supported` — полное ФИО; `full_name_affiliation_supported` — полное ФИО и организация. Эти признаки не заменяют ручную проверку личности.

## Векторы

Три отдельные TF-IDF-модели: название, аннотация, ключевые слова. Русский текст лемматизируется через pymorphy3; удаляются стоп-слова и служебные части речи, добавляются соседние биграммы. Многословные ключевые термины дополнительно сохраняются целиком. Английская морфология не нормализуется.

Таблицы `publication_title_vectors` и `publication_detail_vectors` содержат разреженные массивы `indices` и `weights`; `*_vector_models` — словари и параметры. В PostgreSQL массивы сохранены как JSONB, расширение pgvector не требуется. Разные модели имеют разные словари; их координаты напрямую не сравниваются. Исходные тексты не изменяются.

## Повторная обработка локального кеша

```text
python src/tools/refine_elibrary_matches.py --cards .elibrary/sample/enrichment/cards
python src/tools/package_elibrary_sample.py --teacher-dump "PATH_TO_DATABASE.dump"
```

Команды требуют локального кеша и исходного справочника; сетевой сбор не запускают. Генерируемый комплект находится в `.elibrary/delivery/` и не является версионируемым дампом из `data/elibrary/`.

## Сетевой сбор

Требуется Brave и интерактивная авторизация в отдельном профиле.

```text
python src/tools/elibrary_lists.py --resume
python src/tools/enrich_elibrary_batch.py --continuous --delay 5
```

Не запускаются при установке или восстановлении базы. CAPTCHA и повторный вход выполняются вручную; прогресс сохраняется локально. Профиль браузера, cookies, HTML и диагностические логи в Git не включаются.

## Ограничения и проверки

Интеграционная проверка дампа на PostgreSQL 18:

```text
python src/tools/verify_elibrary_postgres.py
```

Требуются зависимости из requirements-elibrary.txt, pg_restore в PATH и доступ к серверу через PGHOST/PGPORT/PGUSER/PGPASSWORD. Для Windows можно указать `--pg-bin "C:/Program Files/PostgreSQL/18/bin"`.
Пользователь PostgreSQL должен иметь право создавать базы. Проверка создаёт уникальную временную базу, восстанавливает дамп, сверяет числа строк с manifest.json, ограничения, представления и числовые векторы, затем удаляет только созданную тестовую базу. Существующая база приложения не изменяется.

Текущий набор содержит 41922 публикации и 2478 подробных карточек. Полнота каталога не доказана: ответы пагинации содержали повторяющиеся ID. Отсутствующие даты, аннотации и ключевые слова не генерируются.
Проверены целостность SQLite, внешние ключи, нормализация векторов, SHA-256 и обратное чтение custom dump с полным сравнением данных. Восстановление финального дампа проверено на PostgreSQL 18.7: все количества строк, ограничения, представления и векторы прошли проверку. Отчёт: data/elibrary/postgresql_verification.json.
