# eLIBRARY

Модуль собирает публикации eLIBRARY и сопоставляет авторов с таблицей `teacher` приложения. Данные сразу загружаются в PostgreSQL; дампы и промежуточные SQLite-выборки не используются.

Код: `src/portrait/elibrary/parse_elibrary.py`, схема: `src/portrait/elibrary/sql/elibrary.sql`, тесты: `src/portrait/elibrary/tests/`.

## Установка

Зависимости — общий `backend/requirements.txt` (включая playwright и psycopg). Команды выполняются из `backend`:

```text
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt
.venv/Scripts/python -m pytest src/portrait/elibrary
```

Браузерный профиль, cookies и скачанный HTML сохраняются локально в `backend/.elibrary/` (в Git не включаются).

## Подключение к базе

Адрес базы берётся из `ELIBRARY_DATABASE_URL`, а если она не задана — из стандартных `DB_NAME`/`DB_USER`/`DB_PASSWORD`/`DB_HOST`/`DB_PORT` (загружаются из `backend/.env` или `backend/src/.env`, как в `studportrait/settings.py`). В базе должна быть таблица `teacher` (справочник преподавателей приложения).

## Поток

```text
# 1. Создать таблицы elibrary_* (однократно)
python src/portrait/elibrary/parse_elibrary.py init-db

# 2. Собрать карточки в локальный кеш (Brave, интерактивный вход)
python src/portrait/elibrary/parse_elibrary.py collect --collection 1817422 --login
python src/portrait/elibrary/parse_elibrary.py collect --collection 1817422 --resume

# 3. Загрузить кеш в PostgreSQL и сопоставить авторов с teacher
python src/portrait/elibrary/parse_elibrary.py import-db

# 4. CSV кандидатов для ручной проверки
python src/portrait/elibrary/parse_elibrary.py candidates matches.csv

# 5. Опционально: эмбеддинги (локальная SentenceTransformer)
python src/portrait/elibrary/parse_elibrary.py embed --model <путь или ID модели>
```

Повторный `import-db` обновляет изменённые карточки и заново матчит авторов: ручные решения (`method='manual'` или `reviewed_at IS NOT NULL`) не трогаются, но если изменился авторский состав у карточки с ручными решениями — импорт остановится с ошибкой, требуется проверка.

Полное совпадение ФИО даёт `status='confirmed'`, совпадение по инициалам — `status='candidate'`. Кандидаты по инициалам не доказывают авторство; подтверждение личности выполняется вручную через `elibrary_teacher_matches`.

Проверка без сети и базы: `parse <card.html>` и `listing <page.html>` разбирают сохранённые страницы.

## Структура данных

`elibrary_publications` — карточки публикаций (`raw_data` хранит исходный разбор), `elibrary_authors` — авторы с порядком и аффилиациями, `elibrary_collection_items` — принадлежность подборкам, `elibrary_teacher_matches` — связи автор→преподаватель с методом и статусом, `elibrary_embeddings` — вектора по полям title/abstract/keywords (`model` + `input_hash` делают пересчёт явным).

## Ограничения

Полнота каталога не гарантируется: пагинация eLIBRARY может возвращать повторяющиеся страницы. Отсутствующие даты, аннотации и ключевые слова не генерируются, а сохраняются как есть.
