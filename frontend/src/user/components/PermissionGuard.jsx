
import { Navigate, Outlet, useMatches } from 'react-router-dom';
import { useEffect } from 'react';

import { hasPermission } from '../entities/permissions.ts';
import { useUserStore } from '../store/userStore.js';

export default function PermissionGuard() {
    const matches = useMatches();

    const permissions = useUserStore(state => state.permissions);
    const accessStatus = useUserStore(state => state.accessStatus);
    const isAuthenticated = useUserStore(state => state.isAuthenticated);
    const loadPermissions = useUserStore(state => state.loadPermissions);

    const permission = [...matches]
        .reverse()
        .find(match => match.handle?.permission)?.handle.permission;

    useEffect(() => {
        loadPermissions();
    }, [loadPermissions]);

    // Пока проверяется авторизация, защищённые страницы не отображаются.
    if (accessStatus !== 'ready') {
        return null;
    }

    // Если пользователь не авторизован, отправляем его на страницу входа.
    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    // Если у пользователя нет необходимых прав, возвращаем на главную.
    if (permission && !hasPermission(permissions, permission)) {
        return <Navigate to="/" replace />;
    }

    return <Outlet />;
}
