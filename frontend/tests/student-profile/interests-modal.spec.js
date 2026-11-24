// spec: specs/student-profile-plan.md
// seed: seed.spec.ts

const { test, expect } = require('@playwright/test');
const { loginAsStudent, openOwnProfile } = require('./helpers');

const MODAL = '.ant-modal';
const INTEREST_OPTION = '.student-interests__options .ant-checkbox-wrapper';

async function openInterestsModal(page) {
    await page.getByRole('button', { name: 'Изменить интересы' }).click();
    await expect(page.locator(MODAL)).toBeVisible();
    // Дожидаемся загрузки сохранённых интересов (спиннер скрывается).
    await expect(page.locator(`${MODAL} .ant-spin-spinning`)).toHaveCount(0);
}

test.describe('Интересы студента (модальное окно)', () => {
    test.beforeEach(async ({ page }) => {
        await loginAsStudent(page);
        await openOwnProfile(page);
    });

    test('Открытие модального окна и его структура', async ({ page }) => {
        // 1–2. Открыть /user/3 и нажать кнопку «Изменить интересы».
        await openInterestsModal(page);
        const modal = page.locator(MODAL);

        // 3. Проверить заголовок модального окна и описание.
        await expect(modal).toContainText('Мои интересы');
        await expect(modal).toContainText('Выберите интересующие вас направления для подбора проектов.');

        // 4. Проверить поле поиска и счётчик «Выбрано: 0».
        await expect(modal.getByPlaceholder('Поиск интересов')).toBeVisible();
        await expect(modal.locator('.student-interests__counter')).toHaveText('Выбрано: 0');

        // 5. Проверить, что отображаются категории интересов и чекбоксы.
        await expect(modal.getByRole('heading', { name: 'IT и технологии' })).toBeVisible();
        await expect(modal.getByRole('heading', { name: 'Здоровье и спорт' })).toBeVisible();
        await expect(modal.locator(INTEREST_OPTION).first()).toBeVisible();

        // 6. Проверить наличие кнопок «Сохранить» и «Отмена».
        await expect(modal.getByRole('button', { name: 'Сохранить' })).toBeVisible();
        await expect(modal.getByRole('button', { name: 'Отмена' })).toBeVisible();
    });

    test('Поиск фильтрует список интересов', async ({ page }) => {
        // 1. Открыть модальное окно «Изменить интересы».
        await openInterestsModal(page);
        const modal = page.locator(MODAL);

        // 2. В поле «Поиск интересов» ввести «программирование».
        await modal.getByPlaceholder('Поиск интересов').fill('программирование');

        // 3. Проверить, что в списке осталась категория «IT и технологии» и интерес «Программирование и разработка».
        await expect(modal.getByRole('heading', { name: 'IT и технологии' })).toBeVisible();
        await expect(modal.locator(INTEREST_OPTION, { hasText: 'Программирование и разработка' })).toBeVisible();

        // 4. Проверить, что нерелевантная категория «Здоровье и спорт» скрыта.
        await expect(modal.getByRole('heading', { name: 'Здоровье и спорт' })).toHaveCount(0);

        // 5. Очистить поле поиска и проверить, что все категории снова видны.
        await modal.getByPlaceholder('Поиск интересов').fill('');
        await expect(modal.getByRole('heading', { name: 'Здоровье и спорт' })).toBeVisible();
        await expect(modal.getByRole('heading', { name: 'IT и технологии' })).toBeVisible();
    });

    test('Выбор интереса и закрытие без сохранения', async ({ page }) => {
        // 1. Открыть модальное окно «Изменить интересы».
        await openInterestsModal(page);
        const modal = page.locator(MODAL);

        // 2. Отметить первый чекбокс в списке.
        await modal.locator(INTEREST_OPTION).first().click();

        // 3. Проверить, что счётчик изменился на «Выбрано: 1».
        await expect(modal.locator('.student-interests__counter')).toHaveText('Выбрано: 1');

        // 4. Нажать «Отмена» и убедиться, что модальное окно закрылось.
        await modal.getByRole('button', { name: 'Отмена' }).click();
        await expect(modal).toBeHidden();

        // 5. Снова открыть модальное окно.
        await openInterestsModal(page);

        // Счётчик вновь показывает «Выбрано: 0» — выбор без сохранения не применяется.
        await expect(modal.locator('.student-interests__counter')).toHaveText('Выбрано: 0');
        await modal.getByRole('button', { name: 'Отмена' }).click();

        // Текст раздела «Интересы» в карточке профиля не изменился.
        await expect(page.locator('.profile-card')).toContainText('Нет данных об интересах');
    });

    test('Сохранение выбранного интереса', async ({ page }) => {
        const interest = page.locator(MODAL).locator(INTEREST_OPTION, { hasText: 'Программирование и разработка' });
        const modal = page.locator(MODAL);

        // 1. Открыть модальное окно «Изменить интересы».
        await openInterestsModal(page);

        // 2. Отметить чекбокс «Программирование и разработка».
        await interest.click();
        await expect(modal.locator('.student-interests__counter')).toHaveText('Выбрано: 1');

        // 3. Нажать «Сохранить».
        await modal.getByRole('button', { name: 'Сохранить' }).click();

        // 4. Убедиться, что модальное окно закрылось.
        await expect(modal).toBeHidden();

        // 5. Снова открыть модальное окно: счётчик «Выбрано: 1», чекбокс отмечен.
        await openInterestsModal(page);
        await expect(modal.locator('.student-interests__counter')).toHaveText('Выбрано: 1');
        await expect(interest.locator('input[type="checkbox"]')).toBeChecked();

        // 6. Снять отметку и сохранить — возврат исходного состояния аккаунта.
        await interest.click();
        await modal.getByRole('button', { name: 'Сохранить' }).click();
        await expect(modal).toBeHidden();

        // Проверяем, что состояние вернулось к «Выбрано: 0».
        await openInterestsModal(page);
        await expect(modal.locator('.student-interests__counter')).toHaveText('Выбрано: 0');
        await modal.getByRole('button', { name: 'Отмена' }).click();
    });
});
