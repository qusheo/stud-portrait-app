const { test, expect } = require('@playwright/test');

const API = '/portrait';

// Получает CSRF-cookie и токен, необходимые для POST-запросов.
async function fetchCsrfToken(request) {
    const res = await request.get(`${API}/auth/csrf/`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.csrfToken).toBeTruthy();
    return body.csrfToken;
}

test.describe('api: health', () => {
    test('GET /portrait/health/ returns 200 with ok status', async ({ request }) => {
        const res = await request.get(`${API}/health/`);
        expect(res.status()).toBe(200);
        expect(await res.json()).toEqual({ status: 'ok' });
    });
});

test.describe('api: authentication required', () => {
    // Реально защищённые эндпоинты (проверяют request.user.is_authenticated).
    const protectedEndpoints = [
        { method: 'get', url: `${API}/auth/me/` },
        { method: 'get', url: `${API}/user/permissions/` },
        { method: 'get', url: `${API}/student-results/` },
        { method: 'get', url: `${API}/interests/get_student_interests/?student_id=1` }
    ];

    for (const { method, url } of protectedEndpoints) {
        test(`${method.toUpperCase()} ${url} without auth returns 401/403`, async ({ request }) => {
            const res = await request[method](url);
            expect([401, 403]).toContain(res.status());
        });
    }
});

test.describe('api: routing and method handling', () => {
    test('unknown endpoint returns 404', async ({ request }) => {
        const res = await request.get(`${API}/this-endpoint-does-not-exist/`);
        expect(res.status()).toBe(404);
    });

    test('GET on POST-only login endpoint returns 405', async ({ request }) => {
        const res = await request.get(`${API}/auth/login/`);
        expect(res.status()).toBe(405);
    });
});

test.describe('api: login', () => {
    test('login with wrong credentials returns 401, not 500', async ({ request }) => {
        const csrfToken = await fetchCsrfToken(request);
        const res = await request.post(`${API}/auth/login/`, {
            headers: { 'X-CSRFToken': csrfToken },
            data: { username: 'no_such_user_e2e', password: 'definitely-wrong-password' }
        });
        expect(res.status()).toBe(401);
        const body = await res.json();
        expect(body.ok).toBe(false);
    });

    test('login with missing fields returns 400, not 500', async ({ request }) => {
        const csrfToken = await fetchCsrfToken(request);
        const res = await request.post(`${API}/auth/login/`, {
            headers: { 'X-CSRFToken': csrfToken },
            data: {}
        });
        expect(res.status()).toBe(400);
        const body = await res.json();
        expect(body.ok).toBe(false);
    });

    test('login with malformed JSON returns 400, not 500', async ({ request }) => {
        const csrfToken = await fetchCsrfToken(request);
        const res = await request.post(`${API}/auth/login/`, {
            headers: {
                'X-CSRFToken': csrfToken,
                'Content-Type': 'application/json'
            },
            // Buffer отправляется как есть, без сериализации
            data: Buffer.from('not-a-json-body')
        });
        expect(res.status()).toBe(400);
        const body = await res.json();
        expect(body.ok).toBe(false);
    });

    // Известный дефект API: тело, являющееся валидным JSON, но не объектом
    // (строка, массив), вызывает 500 в login_view (data.get по не-словарю).
    // Тест фиксирует текущее поведение; ожидаемое после исправления — 400.
    test('login with non-object JSON body currently returns 500 (known defect)', async ({ request }) => {
        const csrfToken = await fetchCsrfToken(request);
        const res = await request.post(`${API}/auth/login/`, {
            headers: {
                'X-CSRFToken': csrfToken,
                'Content-Type': 'application/json'
            },
            data: [1, 2]
        });
        expect(res.status()).toBe(500);
    });

    test('login POST without CSRF token is rejected with 403, not 500', async ({ request }) => {
        const res = await request.post(`${API}/auth/login/`, {
            data: { username: 'x', password: 'y' }
        });
        expect(res.status()).toBe(403);
    });
});
