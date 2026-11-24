// spec: specs/student-profile-plan.md
// seed: seed.spec.ts

const { test, expect } = require('@playwright/test');
const { STUDENT, loginAsStudent, openOwnProfile } = require('./helpers');

test.describe('Отчёты по результатам тестирования', () => {
    test.beforeEach(async ({ page }) => {
        await loginAsStudent(page);
    });

    test('Навигация на отчёт по компетенциям из сайдбара', async ({ page }) => {
        // 1. Открыть /user/3 (после входа студент уже на своём профиле).
        await openOwnProfile(page);

        // 2. В сайдбаре нажать ссылку «Компетенции».
        const competencesLink = page.locator('.Sidebar a', { hasText: 'Компетенции' });
        await competencesLink.click();

        // 3. Проверить, что URL изменился на /user/3/report/competences.
        await expect(page).toHaveURL(new RegExp(`/user/${STUDENT.participantId}/report/competences$`));

        // 4. Проверить, что ссылка «Компетенции» получила класс активного пункта.
        await expect(competencesLink).toHaveClass(/Sidebar-item-active/);

        // 5. Проверить наличие заголовка страницы «Компетенции».
        await expect(page.locator('.UserReportView').getByRole('heading', { name: 'Компетенции' })).toBeVisible();
    });

    test('Пустое состояние отчётов для студента без результатов', async ({ page }) => {
        const reports = [
            { type: 'competences', title: 'Компетенции' },
            { type: 'motivators', title: 'Мотиваторы' },
            { type: 'values', title: 'Ценности' }
        ];

        for (const { type, title } of reports) {
            // 2–4. Открыть отчёт соответствующего типа и проверить заголовок и пустое состояние.
            await page.goto(`/user/${STUDENT.participantId}/report/${type}`);

            const reportView = page.locator('.UserReportView');
            await expect(reportView.getByRole('heading', { name: title })).toBeVisible();
            await expect(reportView).toContainText('Нет данных для отображения');
            // Таблицы результатов отсутствуют.
            await expect(reportView.locator('table')).toHaveCount(0);
        }
    });

    test('Открытие отчёта с неизвестным типом', async ({ page }) => {
        // 1–2. Открыть отчёт с неизвестным типом.
        await page.goto(`/user/${STUDENT.participantId}/report/unknown-type`);

        // Приложение не падает: отображается заголовок по умолчанию «Результаты» и пустое состояние.
        const reportView = page.locator('.UserReportView');
        await expect(reportView.getByRole('heading', { name: 'Результаты' })).toBeVisible();
        await expect(reportView).toContainText('Нет данных для отображения');
    });
});
