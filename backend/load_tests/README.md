# Нагрузочное тестирование Locust

Сценарий `locustfile.py` проверяет GET endpoint’ы backend, включая `auth/me` и `user/permissions`. Для каждого запроса проверяется HTTP 200 и отсутствие `ok: false` в JSON. Перед запуском пользователи получают существующий `student_id` из списка студентов.

Locust-пользователи по кругу входят под пятью учётными записями из `seed_users`: администратор, центр, администратор учреждения, преподаватель и студент. CSRF и login выполняются один раз при запуске каждого Locust-пользователя. Пароль можно переопределить через `SEED_PASSWORD`.

Остальные POST/PATCH/DELETE, генерация DOCX и AI-запросы не нагружаются. Данные резюме запрашиваются с `with_ai=false`.

## Запуск

Установить зависимости, создать тестовых пользователей и запустить backend на `http://localhost:8000`:

```cmd
.venv\Scripts\python -m pip install -r requirements.txt
cd src
..\.venv\Scripts\python manage.py seed_users
..\.venv\Scripts\python manage.py runserver
```

Из каталога `backend` выполнить 90-секундный smoke-тест с одним пользователем:

```cmd
.venv\Scripts\python -m locust -f load_tests\locustfile.py --host http://localhost:8000 --headless -u 1 -r 1 -t 90s --csv=load_tests\results\smoke --html=load_tests\results\smoke.html
```

Средняя нагрузка — 10 пользователей, разгон по 2 пользователя в секунду, длительность 5 минут:

```cmd
.venv\Scripts\python -m locust -f load_tests\locustfile.py --host http://localhost:8000 --headless -u 10 -r 2 -t 5m --csv=load_tests\results\public-get --html=load_tests\results\public-get.html
```

Результаты сохраняются в `load_tests/results` и не добавляются в Git.

Для конкретных тестовых данных можно задать переменные окружения `STUDENT_ID`, `TEACHER_ID`, `TEST_YEAR` и `TEST_COMPETENCY`. Для удалённого тестового стенда адрес передаётся через `--host`; не запускать нагрузку против production без разрешения.
