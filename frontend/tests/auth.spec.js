const { test, expect } = require('@playwright/test');

test.describe('login page', () => {
    test('renders login form with fields and submit button', async ({ page }) => {
        await page.goto('/login');

        await expect(page.locator('.login-title')).toHaveText('Вход в систему');
        await expect(page.locator('label[for="username"]')).toHaveText('Логин');
        await expect(page.locator('#username')).toBeVisible();
        await expect(page.locator('#username')).toHaveAttribute('placeholder', 'Введите логин');
        await expect(page.locator('label[for="password"]')).toHaveText('Пароль');
        await expect(page.locator('#password')).toBeVisible();
        await expect(page.locator('#password')).toHaveAttribute('type', 'password');

        const submitButton = page.locator('button.login-button[type="submit"]');
        await expect(submitButton).toBeVisible();
        await expect(submitButton).toBeEnabled();
        await expect(submitButton).toHaveText('Войти');
    });

    test('empty form is not submitted and fields are marked invalid', async ({ page }) => {
        await page.goto('/login');
        await page.locator('button.login-button[type="submit"]').click();

        // Нативная HTML5-валидация: оба поля required, форма не отправляется.
        await expect(page.locator('#username')).toHaveJSProperty('validity.valid', false);
        await expect(page.locator('#password')).toHaveJSProperty('validity.valid', false);
        await expect(page).toHaveURL(/\/login/);
        await expect(page.locator('.login-error')).toHaveCount(0);
    });

    test('form with only username is not submitted (password required)', async ({ page }) => {
        await page.goto('/login');
        await page.locator('#username').fill('some_user');
        await page.locator('button.login-button[type="submit"]').click();

        await expect(page.locator('#password')).toHaveJSProperty('validity.valid', false);
        await expect(page).toHaveURL(/\/login/);
        await expect(page.locator('.login-error')).toHaveCount(0);
    });

    test('login with invalid credentials shows error to user', async ({ page }) => {
        await page.goto('/login');
        await page.locator('#username').fill('nonexistent_e2e_user');
        await page.locator('#password').fill('definitely-wrong-password-123');
        await page.locator('button.login-button[type="submit"]').click();

        const error = page.locator('.login-error[role="alert"]');
        await expect(error).toBeVisible();
        await expect(error).not.toBeEmpty();

        // Пользователь остаётся на странице логина, кнопка снова активна.
        await expect(page).toHaveURL(/\/login/);
        await expect(page.locator('button.login-button[type="submit"]')).toBeEnabled();
    });
});

test.describe('unauthenticated access to protected routes', () => {
    const protectedRoutes = ['/', '/admin/stats', '/admin/geography'];

    for (const route of protectedRoutes) {
        test(`redirects to /login from ${route}`, async ({ page }) => {
            await page.goto(route);
            await expect(page).toHaveURL(/\/login/);
            await expect(page.locator('button.login-button[type="submit"]')).toBeVisible();
        });
    }
});
