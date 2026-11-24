// Общий хелпер для тестов профиля студента.
// Креды и логин держим в одном месте, чтобы не дублировать в spec-файлах.

const { expect } = require('@playwright/test');

const STUDENT = {
    username: 'student_3',
    password: 'aag81_4ZKVhyEVc8x0CvAIbz',
    participantId: 3
};

const LOGIN_BUTTON = 'button.login-button[type="submit"]';

// Вход через реальную форму /login: логин сессионный с CSRF,
// форма сама получает CSRF-токен и выставляет сессионную куку.
async function loginAsStudent(page) {
    await page.goto('/login');
    await page.locator('#username').fill(STUDENT.username);
    await page.locator('#password').fill(STUDENT.password);
    await page.locator(LOGIN_BUTTON).click();
    // LoginView редиректит студента на /user/<participantId>.
    await expect(page).toHaveURL(new RegExp(`/user/${STUDENT.participantId}$`));
}

// Открытие профиля студента и ожидание окончания загрузки карточки.
async function openOwnProfile(page) {
    await page.goto(`/user/${STUDENT.participantId}`);
    await expect(page.locator('.profile-card')).toBeVisible();
}

module.exports = { STUDENT, loginAsStudent, openOwnProfile };
