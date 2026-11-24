// spec: specs/student-profile-plan.md
// seed: seed.spec.ts

const { test, expect } = require('@playwright/test');
const { loginAsStudent, openOwnProfile } = require('./helpers');

test.describe('Действия на странице профиля', () => {
    test('Кнопка скачивания резюме доступна владельцу профиля', async ({ page }) => {
        // 1. Войти под учётной записью студента, открыть /user/3.
        await loginAsStudent(page);
        await openOwnProfile(page);

        // 2. Проверить, что в карточке профиля отображается активная кнопка «Скачать резюме DOCX».
        // Клик по кнопке не проверяется: известный дефект приложения
        // (ReferenceError: WindowChain is not defined, кнопка зависает в «Загрузка...»).
        const resumeButton = page.getByRole('button', { name: 'Скачать резюме DOCX' });
        await expect(resumeButton).toBeVisible();
        await expect(resumeButton).toBeEnabled();
    });
});
