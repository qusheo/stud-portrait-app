# Стайлгайд и структура репозитория

Документ фиксирует, где какой код должен лежать и в каком виде. Правило простое: новый код добавляем по этой схеме

## Общая структура репозитория

```text
├── backend/          Django API (портретная аналитика, парсеры)
├── frontend/         SPA на Vite + React (пользовательский интерфейс)
├── model/            отдельные ML-модели и скрипты (вне приложения)
├── compose.profile.yaml, docker-compose.yml   оркестрация (postgres, backend, frontend, redis, grafana)
├── package.json      хук pre-commit (husky + prettier по staged-файлам)
└── README.md
```

## Фронтенд (`frontend/`)

### Слои: api → service → view/component

Запросов к серверу (`fetch`) в компонентах и views **нет**. Только два допустимых слоя:

1. **`src/api.js`** — единая точка HTTP. Класс `Api`: сырые `fetch`-вызовы, CSRF-токен, `credentials: 'include'`, JSDoc-`@typedef` на входы/выходы. Один метод = один эндпоинт.
2. **`src/services/`** — сервисы: `StudentService.ts`, `TeacherService.ts`, `AdminService.ts`, `MatchingService.ts`. Каждый наследует `BaseService` (`this.request(() => Api.method(...), 'Сообщение об ошибке')` — распарсить ответ, показать toast, кинуть исключение). Сервис экспортируется синглтоном: `export default new StudentService();`. Общий экспорт — через `services/index.js`.

Использование в UI: `StudentService.getStudentPortrait(id)`, дальше данные попадают в zustand-стор или локальное состояние страницы. Используем useQuery `@tanstack/react-query` для запросов с базовым `queryConfig.js`

### Папки

```text
src/
├── api.js                  единая точка HTTP (только fetch, без бизнес-логики)
├── services/               доменные сервисы поверх Api + BaseService + index.js
├── constants/              константы (только данные, без логики), barrel index.js:
│   ├── linkTree.js         LINK_TREE, SUPER_LINK_TREE — навигация по ролям
│   ├── rsv.js              РСВ: COMPETENCIES/MOTIVATORS/VALUES (+ *_NAMES, *_DESCRIPTIONS), COURSES_NAMES, RESULT_PROFILES
│   ├── fields.js           FIELD_NAMES, CATEGORIES_DESCRIPTIONS, Mapping (подписи полей данных)
│   └── interests.js        INTEREST_CATEGORIES, INTEREST_CATEGORY_NAMES, INTEREST_NAMES, INTEREST_CODES
├── user/                   фича «текущий пользователь» (слайс):
│   ├── entities/           TypeScript-enum и типы (AccountType, permissions)
│   ├── services/           UserService (права, профиль)
│   ├── store/              zustand-стор пользователя
│   └── components/         компоненты слайса (PermissionGuard)
├── views/                  страницы, по ролям:
│   ├── admin/              AdminPortrait/, AdminResults/, ... (View.jsx + View.scss в своей папке)
│   ├── user/
│   ├── auth/               LoginView
│   ├── super/              сервисные страницы (SQL, аудит, загрузка)
│   └── <роль>/components/  компоненты, нужные только страницам этой роли
├── components/             переиспользуемые компоненты:
│   ├── cards/              Card, TitledCard, ValueCard (+ index.js)
│   ├── charts/             графики, карта РФ
│   ├── icons/
│   ├── tables/
│   └── ui/                 Button, Select, Dropdown, Modal-примитивы и т.п.
├── utils/                  чистые функции-хелперы (utilities.js — Excel и работа с профилями РСВ, queryConfig.js) + zustand-сторы (store.jsx)
```

Правила размещения:

- **Страница** → `views/<роль>/<Название>/<Название>View.jsx` + одноимённый `.scss`. Если компонент нужен только этой странице — рядом в `views/<роль>/components/`.
- **Переиспользуемый компонент** → `components/<категория>/`. Категории: `cards`, `charts`, `icons`, `tables`, `ui`.
- Каждый компонент — три файла: `Component.jsx`, `Component.scss`, `index.js` (реэкспорт). Стили только рядом, импорт первой строкой.
- **Описание компонента обязательно** — JSDoc как сейчас:

```jsx
/**
 * @description Базовый контейнер-карточка
 * @param {Object} props Параметры компонента
 * @param {*} props.children Содержимое карточки
 */
function Card({ children }) { ... }
```

- **Состояние** — zustand-сторы в `utils/store.jsx` (`useAdminStore`, `usePageStore`) или в `user/store/` для данных пользователя. Локальное состояние страницы — `useState` в самой view.
- **Константы** — только в `src/constants/`, импорт через алиас `@constants` (`vite.config.js`). В `utils/` и в файлах компонентов константы не объявляются: словари подписей, enum-маппинги и деревья ссылок — всё туда. Не дублировать: один источник (бывший дубль РСВ-карт в `utils/fields.js` удалён).

### Тесты

Интеграционные тесты — отдельно от `src`:

```text
frontend/tests/
├── selenium/       интеграционные тесты через Selenium (BaseTest, *Views.test.js, runner.js)
├── smoke.spec.js   playwright-smoke
└── example.spec.js
```

Юнит-тесты (vitest, jsdom) лежат рядом с тестируемым кодом — `Component.test.jsx` в той же папке, что и компонент; `vi.mock('@constants', ...)` для подмены констант, `vi.mock('@utils/utilities', ...)` — для функций.

Конфиги в корне фронта: `jest.config.js` (selenium, папка `tests/selenium`), `playwright.config.js` (`testDir: ./tests`, selenium-файлы исключены), `vitest.setup.js` + секция `test` в `vite.config.js` (юнит). Скрипты: `npm test` (vitest), `npm run test:functional` и `test:visual` (selenium), `test:all` — всё вместе.

## Бэкенд (`backend/`)

```text
backend/
├── src/
│   ├── studportrait/       Django-проект: settings.py (загружает .env), urls, asgi/wsgi
│   ├── manage.py
│   └── portrait/           основное приложение:
│       ├── models.py       все модели; db_table = существующая таблица
│       ├── urls.py         привязка эндпоинтов (импортирует из endpoints/)
│       ├── endpoints/      HTTP-эндпоинты (функции-представления):
│       │   ├── auth.py, audit.py, dataload.py, ...   общие модули — плоские файлы
│       │   ├── entities/   эндпоинты конкретных сущностей: students.py, teachers.py
│       │   ├── matchingService/      отдельный сервис — своя папка (matching.py, matching_utils.py)
│       │   ├── selectionService/     подбор и рекомендации (+ utils/)
│       │   ├── statisticsService/    статистика и анализ (analysis_end.py, stat.py, statsresult.py)
│       │   ├── parsers/              парсеры внешних источников (+ tools/, test/)
│       │   └── helpers/              общие хелперы эндпоинтов (common.py — общие константы/утилиты запросов, helpers.py)
│       ├── elibrary/       модуль eLIBRARY: parse_elibrary.py, sql/elibrary.sql, tests/; .elibrary/ - локальный кеш парсера (в .gitignore)
│       ├── migrations/     миграции Django
│       ├── management/commands/  CLI: seed_data, seed_users, create_student_accounts
│       ├── test/           тесты приложения (pytest, django.test)
│       ├── mlmodel.py, constants.py, status.py, admin.py
│       └── endpoints/parsers/test/ тесты парсеров
├── docs/                   документация модулей (elibrary.md и др.)
├── create_database.sql     DDL базы (таблицы приложения; миграции Django его не заменяют)
└── requirements.txt        единый файл зависимостей (отдельные requirements-*.txt не заводим)
```

Правила размещения:

- **Эндпоинт про конкретных студентов/преподавателей** → `endpoints/entities/students.py` / `teachers.py`.
- **Общий эндпоинт** (аудит, загрузка, авторизация) → плоский модуль `endpoints/<имя>.py`.
- **Отдельный сервис с логикой** → `endpoints/<имя>Service/` (своя папка, модули внутри; в `urls.py` импортируется из папки).
- **DDL** живёт в `create_database.sql`; изменения схемы для Django — миграциями в `portrait/migrations/`. Физические таблицы, которые Django не создаёт (например, `teacher`), миграция создаёт через `RunSQL` с `IF NOT EXISTS`.
- **Парсер внешнего источника** → `endpoints/parsers/` (инструменты в `tools/`), отдельный долгоживущий модуль сбора — как `elibrary/` со своими `sql/` и `tests/`.
- **Тесты**: в `portrait/tests/<тема>/` — папка по теме (`parsers/`, `matching/`, `analytics/`, `upload/`, `stats/`, `students/`, `teachers/`, `selection/`, `audit/`, `auth/`, `gendox/`); все парсеры — в `tests/parsers/`. Имена `test_*.py`, запуск `pytest portrait/tests` (конфиг — `src/pytest.ini`, `--no-migrations --reuse-db`). Перед прогоном на чистой БД — `python -m portrait.tests.bootstrap_test_db` из `backend/src`. Тесты eLIBRARY — отдельно в `elibrary/tests/`.
- **Константы бэкенда** — в `portrait/constants.py` (классы-группы `RsvCompetencies`, `RsvMotivators`, `RsvValues`, `RsvCourses`, имена таблиц `Table*`), общие константы и утилиты запросов — `endpoints/helpers/common.py`. Внутри модулей разрозненные константы не заводятся.

### Тесты и нагрузочное тестирование

| Что | Где | Запуск |
| --- | --- | --- |
| Юнит и интеграционные тесты приложения | `backend/src/portrait/tests/<тема>/` | `pytest portrait/tests` из `backend/src` (на чистой БД сначала `python -m portrait.tests.bootstrap_test_db`) |
| Тесты модуля eLIBRARY | `backend/src/portrait/elibrary/tests/` | `pytest src/portrait/elibrary` |
| Нагрузочные тесты (Locust) | `backend/load_tests/` | `locust -f locustfile.py` / `scenarios_locustfile.py` |

`load_tests/locustfile.py` — обход GET-эндпоинтов под пятью ролями (seed-пользователи), `scenarios_locustfile.py` — сценарные цепочки запросов, `results/` — результаты прогонов. Подробности — `load_tests/README.md`.

## Форматирование (Prettier)

Prettier — единый форматтер для репозитория (JS/JSX/TS/JSON/MD/SQL-файлы и прочее поддерживаемое).

- Конфиг фронта — `frontend/.prettierrc`: табы 4, одинарные кавычки, `printWidth: 140`, без висячих запятых, `arrowParens: 'avoid'`, один атрибут JSX на строку, `endOfLine: 'auto'`.
- Корневой `package.json` + husky: pre-commit автоматически делает `prettier --write` по staged-файлам (`.husky/task-runner.json`).
- Ручная проверка: `npx prettier --check .`, правка: `npx prettier --write <файлы>`.
