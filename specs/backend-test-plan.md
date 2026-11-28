# План тестов бэкенда

## Цель

Убрать gpt-тесты, дубли и неактуальные тесты; покрыть тестами рабочие эндпоинты бэкенда, пропуская недоработанные.

## Структура

Тесты лежат в `backend/src/portrait/tests/<тема>/`. Нагрузочные (`backend/load_tests/`, locust) и elibrary (`backend/src/portrait/elibrary/tests/`) не перемещаются и не меняются.

```
backend/src/portrait/tests/
├── base.py                     # BaseTestCase + create_test_tables (перенесено из test_backend.py)
├── parsers/                    # ВСЕ парсеры в одной папке
│   ├── test_teacher_directory_parser.py
│   ├── test_disciplines_parser.py
│   ├── test_amount_students.py
│   └── test_curriculum_endpoints.py
├── matching/
│   └── test_matching_students.py
├── analytics/
│   ├── test_datanal_models.py
│   └── test_analysis_endpoints.py
├── upload/
│   ├── test_dataload.py
│   └── test_datasesh.py
├── stats/
│   ├── test_dashboard_stats.py
│   ├── test_stat_endpoints.py
│   └── test_statsresult.py
├── students/
│   ├── test_students_views.py
│   └── test_student_interests.py
├── teachers/
│   └── test_teachers.py
├── selection/
│   └── test_student_selection.py
├── audit/
│   └── test_audit.py
├── auth/
│   └── test_auth.py
└── gendox/
    └── test_gendox.py
```

## Покрытие по эндпоинтам

### parsers/
- `teacher_directory_parser` — перенос существующих тестов (parse_teacher, gender, education type, дубли).
- `disciplines_parser` — разбор карты дисциплина→компетенции, ошибочные входы.
- `parser_amount_students` + `load_students_amount` — парсинг количества студентов, загрузка в БД.
- `curriculum_end` — `parse_curriculum_view`, `get_parse_log`, `get_saved_mappings` (POST с файлом, чтение лога/маппингов).

### matching/
- `get_matching_students` — успешный подбор, несуществующий студент (404), невалидные параметры (400), фильтры sameGroup/course/motivators/competences/values.
- Заглушки `get_match_groups`, `get_matching_teachers_by_student` НЕ покрываются (недоработаны, возвращают `{}`).

### analytics/
- `test_datanal_models.py` (перенос из test_backend.py): ValueAddedModel (baseline, fit недостаток данных/успех), LatentGrowthModel (fit), DisciplineImpactAnalyzer (конвертация оценок, анализ impact).
- `test_analysis_endpoints.py`:
  - справочники: `get_institutions`, `get_directions`, `get_disciplines`;
  - `analyze-student-vam`, `analyze-cohort-lgm`, `get-vam-trend-data`, `get-lgm-growers`;
  - `analyze-all-disciplines-impact`, `analyze-discipline-impact-advanced`, `get-discipline-heatmap-data`, `analyze-student-discipline-impact`;
  - `get-competency-level-flow`, `get-competency-level-flow-yearly`;
  - `education-profiles-comparison`, `get-boxplot-data`, `student-comparison-stats`;
  - `duplicate-accounts`, `possible-duplicate-accounts`.
  - `ai_analytics_summary` НЕ покрывается (недоработан).

### upload/
- `dataload`: `get_expected_fields`, `get_templates`, `save_template`, `delete_template`, `import_excel` (валидный файл / нет файла / битый файл).
- `datasesh`: `create_data_session`, `extract_data`, `update_session_filters/columns/window`, `export_selected_results`, `group_data`, `stats_with_filters`.

### stats/
- `test_dashboard_stats.py` — перенос существующих мок-юнитов (`get_dashboard_stats`, `get_year_metrics`, производительность, ошибка БД, пустые оценки).
- `test_stat_endpoints.py`: `filter_options`, `overall_stats`, `get_scores_result`, `get_available_years`, `get_competency_average_by_years`, `get_grades_competency_correlation`, `get_competency_trend_by_year`, `get_top_correlations`, `get_competency_segmentation`, `get_motivation_counts`.
- `test_statsresult.py`: `courses`, `get_institution_directions`, `get_filter_options_with_counts`, `centers_by_region`, `get_motivator_statistics`.

### students/
- `test_students_views.py` — перенос test_views.py (students_list + student_results) и тестов student_portrait/student_by_id из test_backend.py; `analyze_transfers`, `analyze_transfer_students`.
- `test_student_interests.py`: `get_interest_options`, `get_student_interests`, `update_student_interests` (включая внешний fetch, замоканный).

### teachers/
- `get_teachers_table`, `get_teacher_by_id` (перенос из test_backend.py: успех, 404, 400).

### selection/
- `get_students_by_requirememnts` (students/by-requirements).

### audit/
- `get_database_schema`, `get_table_sample_data`, `get_database_stats`, `execute_raw_sql` (допустимый запрос / запрещённый не-SELECT).

### auth/
- `csrf_token`, `login_view` (успех/неверный пароль/метод), `current_user`, `logout_view`, `get_user_permissions` (гость/админ/другой тип).

### gendox/
- `get_student_resume_data`, `generate_docx_resume` (200 + content-type docx), `generate_geography_report`.

## Что удаляется

- `backend/src/portrait/test/test_backend.py` — ценное (модели VAM/LGM/analyzer, тесты templates/audit/student/teacher) переносится по темам; тривиальные smoke-дубли (`status_code == 200` поверх test_views/test_dashboard_stats) удаляются.
- `backend/src/portrait/test/test_models.py` — тавтологические проверки ORM, удаляется (FK-связь Results→Participants переносится в students).
- Баннерные комментарии вида `# === TEST: ...` во всех переносимых файлах не сохраняются.

## Пропускаем (недоработанные)

- `matching/get_match_groups/`, `matching/get_matching_teachers_by_student/` — заглушки.
- `ainterp.py` — пустой модуль.
- `ai_analytics_summary` — недоработан (по решению владельца).
- `analyze_student_lgm` — определён, но не подключён в urls.py.
- `get_duplicate_accounts` — заглушка с захардкоженным ответом (покрыт только `possible-duplicate-accounts`).
- `student-interests-options` (`get_interest_options`) — заглушка, возвращает пустой список.
- `access.py` — модуль не подключён в urls.py (используется `auth.get_user_permissions`).
- `parser_amount_students.py` — скрипт с сетевым скрейпингом на уровне импорта; покрыты чистые функции `load_students_amount`.
- `get_education_profiles_comparison` — покрыт только пустой кейс: эндпоинт итерирует `Educationspecialties`, а `Results.res_edu_specialty` — FK на `Specialties`; с данными в таблице он падает с 500 (баг в коде).

## Исправленные баги (найдены при покрытии)

- `helpers/common.py`: декораторы `method`/`jsonResponse`/`httpResponse` не пробрасывали `*args/**kwargs` — `dataload/template-delete/<id>/` падал с TypeError.
- `urls.py`: роут `get-competency-level-flow-yearly/` дублировал имя `get_competency_level_flow` — `reverse()` резолвился в yearly-эндпоинт.
- `analysis_end.py::get_boxplot_data`: в ответ попадал объект модели `Institutions` как `group_id` — grouped-режим падал с TypeError при сериализации.

## Конвенции

- Django `Client` + `reverse()` для API-тестов; чистые unit-тесты с моками где логика отделена от ORM (по образцу test_dashboard_stats).
- Общий `tests/base.py` с `BaseTestCase` (создание unmanaged-таблиц через `create_test_tables`), pytest.ini (`--reuse-db --no-migrations`) не меняется.
- Без баннерных комментариев; docstring у класса, короткие импорты в начале файла.
- CI: `.github/workflows/ci.yml` меняет `pytest portrait/test -v` → `pytest portrait/tests -v` (job pytest + integration).
