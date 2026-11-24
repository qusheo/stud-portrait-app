const { test, expect } = require('@playwright/test');

/**
 * E2E-тесты публичного UI без авторизации.
 * Публичная поверхность приложения — только страница /login
 * и клиентская обработка несуществующих роутов.
 */

function collectConsoleErrors(page) {
    const errors = [];
    page.on('console', message => {
        if (message.type() === 'error') {
            errors.push(message.text());
        }
    });
    page.on('pageerror', error => {
        errors.push(String(error));
    });
    return errors;
}

test.describe('public UI', () => {
    test('login page renders brand, heading and form without console errors', async ({ page }) => {
        const consoleErrors = collectConsoleErrors(page);

        await page.goto('/login');
        await expect(page).toHaveURL(/\/login/);

        await expect(page.locator('.login-brand')).toHaveText('StudPortrait');
        await expect(page.getByRole('heading', { name: 'Вход в систему' })).toBeVisible();

        const usernameInput = page.locator('input#username');
        const passwordInput = page.locator('input#password');
        await expect(usernameInput).toBeVisible();
        await expect(usernameInput).toHaveAttribute('type', 'text');
        await expect(passwordInput).toBeVisible();
        await expect(passwordInput).toHaveAttribute('type', 'password');

        const submitButton = page.getByRole('button', { name: 'Войти' });
        await expect(submitButton).toBeVisible();
        await expect(submitButton).toBeEnabled();

        expect(consoleErrors).toEqual([]);
    });

    test('login form keeps typed values and uses browser validation for empty fields', async ({ page }) => {
        await page.goto('/login');

        const usernameInput = page.locator('input#username');
        const passwordInput = page.locator('input#password');

        await usernameInput.fill('some-user');
        await passwordInput.fill('secret');
        await expect(usernameInput).toHaveValue('some-user');
        await expect(passwordInput).toHaveValue('secret');

        // Поля помечены required: браузер блокирует отправку пустой формы.
        await usernameInput.clear();
        await passwordInput.clear();
        await page.getByRole('button', { name: 'Войти' }).click();
        await expect(page).toHaveURL(/\/login/);
        await expect(page.locator('.login-error')).toHaveCount(0);
        await expect(usernameInput).toBeFocused();
    });

    test('unknown route shows client-side 404 instead of a protected page', async ({ page }) => {
        await page.goto('/no-such-page-exists');

        // В роутере нет catch-all маршрута, поэтому react-router
        // показывает стандартную страницу ошибки с кодом 404.
        await expect(page.locator('body')).toContainText(/404|not found/i);
    });

    test('unauthenticated deep link into protected area redirects to login', async ({ page }) => {
        await page.goto('/admin/stats');
        await expect(page).toHaveURL(/\/login/);
        await expect(page.getByRole('heading', { name: 'Вход в систему' })).toBeVisible();
    });

    test.describe('mobile viewport (375x812)', () => {
        test.use({ viewport: { width: 375, height: 812 } });

        test('login form stays visible and usable', async ({ page }) => {
            const consoleErrors = collectConsoleErrors(page);

            await page.goto('/login');

            const card = page.locator('.login-card');
            await expect(card).toBeVisible();

            const usernameInput = page.locator('input#username');
            const passwordInput = page.locator('input#password');
            const submitButton = page.getByRole('button', { name: 'Войти' });

            await expect(usernameInput).toBeInViewport();
            await expect(passwordInput).toBeInViewport();
            await expect(submitButton).toBeInViewport();

            // Форма не должна выходить за пределы экрана по горизонтали.
            const cardBox = await card.boundingBox();
            expect(cardBox.x).toBeGreaterThanOrEqual(0);
            expect(cardBox.x + cardBox.width).toBeLessThanOrEqual(375);

            // Форма остаётся интерактивной: значения вводятся.
            await usernameInput.fill('mobile-user');
            await expect(usernameInput).toHaveValue('mobile-user');

            expect(consoleErrors).toEqual([]);
        });
    });
});
