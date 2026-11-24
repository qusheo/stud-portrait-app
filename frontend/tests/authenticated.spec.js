const { test, expect } = require('@playwright/test');

// Реальные тестовые учётные записи (заведены сидером в БД).
const USERS = {
    student: { username: 'student_3', password: 'aag81_4ZKVhyEVc8x0CvAIbz' },
    admin: { username: 'seed_admin', password: 'StudPortrait-Test-2026!' }
};

const LOGIN_BUTTON = 'button.login-button[type="submit"]';

// Вход через реальную форму /login: логин сессионный с CSRF,
// форма сама получает CSRF-токен и выставляет сессионную куку.
async function loginAs(page, { username, password }) {
    await page.goto('/login');
    await page.locator('#username').fill(username);
    await page.locator('#password').fill(password);
    await page.locator(LOGIN_BUTTON).click();
    await expect(page).not.toHaveURL(/\/login/);
}

test.describe('student authentication', () => {
    test('student logs in and lands on own profile page', async ({ page }) => {
        await loginAs(page, USERS.student);

        // LoginView редиректит студента на /user/<participantId>.
        await expect(page).toHaveURL(/\/user\/\d+/);

        // Интерфейс студента: карточка профиля и боковая панель.
        await expect(page.locator('.UserView')).toBeVisible();
        await expect(page.locator('.profile-card')).toBeVisible();
        await expect(page.locator('.profile-card')).toContainText('ID студента:');

        // В шапке — метка типа аккаунта, в сайдбаре — студенческие разделы.
        await expect(page.locator('.Header .user-name')).toHaveText('Студент');
        await expect(page.locator('.Sidebar a', { hasText: 'Личные данные' })).toBeVisible();
    });

    test('student sidebar does not expose admin sections', async ({ page }) => {
        await loginAs(page, USERS.student);
        await expect(page).toHaveURL(/\/user\/\d+/);

        const sidebar = page.locator('.Sidebar');
        await expect(sidebar).toBeVisible();
        await expect(sidebar.locator('a[href="/admin/stats"]')).toHaveCount(0);
        await expect(sidebar.locator('a[href="/admin/results"]')).toHaveCount(0);
    });

    test('student is redirected away from /admin/stats by PermissionGuard', async ({ page }) => {
        await loginAs(page, USERS.student);
        await expect(page).toHaveURL(/\/user\/\d+/);

        await page.goto('/admin/stats');

        // PermissionGuard при отсутствии права возвращает на главную '/'.
        await expect(page).toHaveURL(/\/$/);
        await expect(page.locator('.AdminStatsView')).toHaveCount(0);
        await expect(page.getByRole('heading', { name: 'Статистика тестирования' })).toHaveCount(0);
    });

    test('student can log out and protected routes require login again', async ({ page }) => {
        await loginAs(page, USERS.student);
        await expect(page).toHaveURL(/\/user\/\d+/);

        // Кнопка выхода в шапке — иконка LogOut с подсказкой «Выйти».
        await page.locator('.Header .right-side svg.lucide-log-out').click();
        await expect(page).toHaveURL(/\/login/);
        await expect(page.locator(LOGIN_BUTTON)).toBeVisible();

        // После выхода защищённые роуты снова закрыты.
        await page.goto('/admin/stats');
        await expect(page).toHaveURL(/\/login/);

        await page.goto('/');
        await expect(page).toHaveURL(/\/login/);
    });
});

test.describe('admin authentication', () => {
    test('admin logs in and opens the stats page', async ({ page }) => {
        await loginAs(page, USERS.admin);

        // Для не-студентов LoginView ведёт на '/' (нет location.state.from).
        await expect(page).toHaveURL(/\/$/);
        await expect(page.locator('.Header .user-name')).toHaveText('Администратор');
        await expect(page.locator('.Sidebar a[href="/admin/stats"]')).toBeVisible();

        await page.goto('/admin/stats');
        await expect(page).toHaveURL(/\/admin\/stats/);
        await expect(page.getByRole('heading', { name: 'Статистика тестирования' })).toBeVisible();
    });

    test('admin can log out and protected routes require login again', async ({ page }) => {
        await loginAs(page, USERS.admin);
        await expect(page).toHaveURL(/\/$/);

        await page.locator('.Header .right-side svg.lucide-log-out').click();
        await expect(page).toHaveURL(/\/login/);

        await page.goto('/admin/stats');
        await expect(page).toHaveURL(/\/login/);
    });
});
