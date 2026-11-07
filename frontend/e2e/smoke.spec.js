const { test, expect } = require('@playwright/test');

const API = process.env.E2E_API_URL ?? '';

test.describe('smoke', () => {
    test('backend health endpoint returns ok', async ({ request }) => {
        const res = await request.get(`${API}/portrait/health/`);
        expect(res.ok()).toBeTruthy();
        expect(await res.json()).toEqual({ status: 'ok' });
    });

    test('login page renders', async ({ page }) => {
        await page.goto('/login');
        await expect(page).toHaveURL(/\/login/);
        await expect(
            page.locator('input[type="password"], form button[type="submit"]').first()
        ).toBeVisible();
    });

    test('unauthenticated user is redirected to login', async ({ page }) => {
        await page.goto('/');
        await expect(page).toHaveURL(/\/login/);
    });
});
