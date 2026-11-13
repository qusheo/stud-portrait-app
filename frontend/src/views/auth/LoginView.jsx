
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Api from '../../api.js';
import { useUserStore } from '../../user/store/userStore.js';
import { AccountType } from '../../user/entities/accountType.ts';
import './LoginView.scss';

export default function LoginView() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const navigate = useNavigate();
    const location = useLocation();

    const loadPermissions = useUserStore(state => state.loadPermissions);

    const handleSubmit = async event => {
        event.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const response = await Api.postLogin(username.trim(), password);
            const data = await response.json().catch(() => null);

            if (!response.ok) {
                throw new Error(
                    data?.message ||
                    data?.detail ||
                    'Неверный логин или пароль'
                );
            }

            // Получаем роль и ID профиля из backend.
            await loadPermissions(true);

            const userState = useUserStore.getState();

            if (!userState.isAuthenticated) {
                throw new Error(
                    'Не удалось подтвердить авторизацию. Проверьте сессию.'
                );
            }

            let destination;

            if (userState.accountType === AccountType.STUDENT) {
                // Студент всегда открывает только собственный профиль.
                if (!userState.participantId) {
                    throw new Error(
                        'Для этой учётной записи не найден связанный профиль студента.'
                    );
                }

                destination = `/user/${userState.participantId}`;
            } else {
                // Для остальных ролей сохраняем прежнее поведение.
                destination = location.state?.from?.pathname || '/';
            }

            navigate(destination, { replace: true });

        } catch (err) {
            setError(err.message || 'Не удалось выполнить вход');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <main className="login-page">
            <section className="login-card">
                <div className="login-brand">StudPortrait</div>

                <h1 className="login-title">Вход в систему</h1>

                <p className="login-description">
                    Войдите, чтобы продолжить работу с цифровыми профилями.
                </p>

                <form className="login-form" onSubmit={handleSubmit}>
                    <label htmlFor="username">Логин</label>
                    <input
                        id="username"
                        type="text"
                        autoComplete="username"
                        value={username}
                        onChange={event => setUsername(event.target.value)}
                        placeholder="Введите логин"
                        required
                    />

                    <label htmlFor="password">Пароль</label>
                    <input
                        id="password"
                        type="password"
                        autoComplete="current-password"
                        value={password}
                        onChange={event => setPassword(event.target.value)}
                        placeholder="Введите пароль"
                        required
                    />

                    {error && (
                        <p className="login-error" role="alert">
                            {error}
                        </p>
                    )}

                    <button
                        className="login-button"
                        type="submit"
                        disabled={isLoading}
                    >
                        {isLoading ? 'Выполняется вход…' : 'Войти'}
                    </button>
                </form>
            </section>
        </main>
    );
}
