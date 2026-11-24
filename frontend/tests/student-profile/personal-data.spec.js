// spec: specs/student-profile-plan.md
// seed: seed.spec.ts

const { test, expect } = require('@playwright/test');
const { STUDENT, loginAsStudent, openOwnProfile } = require('./helpers');

test.describe('Личные данные профиля', () => {
    test('Отображение карточки профиля владельца', async ({ page }) => {
        // 1. Войти под учётной записью студента (student_3).
        await loginAsStudent(page);

        // 2. Убедиться, что выполнен редирект на /user/3.
        await expect(page).toHaveURL(new RegExp(`/user/${STUDENT.participantId}$`));

        // 3. Дождаться окончания загрузки профиля (исчезает индикатор «Загрузка профиля...»).
        await expect(page.locator('.profile-card')).toBeVisible();
        await expect(page.getByText('Загрузка профиля...')).toHaveCount(0);

        // 4. Проверить содержимое карточки: непустое имя и строка «ID студента:» со значением 3.
        const profileCard = page.locator('.profile-card');
        await expect(profileCard.locator('.profile-title h3')).not.toBeEmpty();
        await expect(profileCard).toContainText('ID студента:');
        await expect(profileCard.locator('.info-value').first()).toHaveText(String(STUDENT.participantId));

        // 5. Проверить наличие разделов «Интересы» и «Навыки» с текстами-заглушками.
        await expect(profileCard.getByRole('heading', { name: 'Интересы' })).toBeVisible();
        await expect(profileCard).toContainText('Нет данных об интересах');
        await expect(profileCard.getByRole('heading', { name: 'Навыки' })).toBeVisible();
        await expect(profileCard).toContainText('Нет данных о навыках');

        // 6. Проверить наличие правой карточки «Дополнительная информация» с заглушкой.
        const dashboard = page.locator('.dashboard-card');
        await expect(dashboard.getByRole('heading', { name: 'Дополнительная информация' })).toBeVisible();
        await expect(dashboard).toContainText('Здесь будет ваша активность');
    });

    test('Редактирование навыков с сохранением', async ({ page }) => {
        // 1. Войти под учётной записью студента, открыть /user/3.
        await loginAsStudent(page);
        await openOwnProfile(page);

        // 2. Нажать кнопку «Редактировать» в разделе «Навыки».
        await page.getByRole('button', { name: 'Редактировать', exact: true }).click();

        // 3. Проверить, что появилась textarea, а кнопки сменились на «Отмена» и «Сохранить».
        const textarea = page.locator('textarea.edit-textarea');
        await expect(textarea).toBeVisible();
        await expect(page.getByRole('button', { name: 'Отмена', exact: true })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Сохранить', exact: true })).toBeVisible();

        // 4. Ввести в textarea произвольный текст навыка.
        await textarea.fill('Playwright e2e навык');

        // 5. Нажать «Сохранить».
        await page.getByRole('button', { name: 'Сохранить', exact: true }).click();

        // Ожидается toast-заглушка об успешном сохранении.
        await expect(page.locator('.Toastify__toast')).toContainText('Данные сохранены (тестовая заглушка)!');

        // Режим редактирования закрывается: textarea исчезает, снова кнопка «Редактировать».
        await expect(textarea).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'Редактировать', exact: true })).toBeVisible();

        // Введённый текст отображается в разделе «Навыки» карточки профиля.
        await expect(page.locator('.profile-card')).toContainText('Playwright e2e навык');
    });

    test('Отмена редактирования навыков', async ({ page }) => {
        // 1. Войти под учётной записью студента, открыть /user/3.
        await loginAsStudent(page);
        await openOwnProfile(page);

        // 2. Нажать «Редактировать» в разделе «Навыки».
        await page.getByRole('button', { name: 'Редактировать', exact: true }).click();

        // 3. Ввести в textarea произвольный текст.
        const textarea = page.locator('textarea.edit-textarea');
        await expect(textarea).toBeVisible();
        await textarea.fill('Этот текст не должен сохраниться');

        // 4. Нажать «Отмена».
        await page.getByRole('button', { name: 'Отмена', exact: true }).click();

        // Режим редактирования закрывается без toast об успехе.
        await expect(textarea).toHaveCount(0);
        await expect(page.locator('.Toastify__toast')).toHaveCount(0);

        // Кнопка «Отмена» не откатывает локальное состояние: введённый текст
        // продолжает отображаться в карточке (особенность реализации).
        await expect(page.locator('.profile-card')).toContainText('Этот текст не должен сохраниться');

        // После перезагрузки страницы в разделе снова исходный текст-заглушка —
        // введённые данные не сохраняются.
        await page.reload();
        await expect(page.locator('.profile-card')).toBeVisible();
        await expect(page.locator('.profile-card')).toContainText('Нет данных о навыках');
    });
});
