import { Navigate, Outlet, useMatches } from 'react-router-dom';
import { useEffect } from 'react';
import { hasPermission } from '../entities/permissions.ts';
import { useUserStore } from '../store/userStore.js';

export default function PermissionGuard() {
    const matches = useMatches();
    const permissions = useUserStore(state => state.permissions);
    const accessStatus = useUserStore(state => state.accessStatus);
    const loadPermissions = useUserStore(state => state.loadPermissions);
    const permission = [...matches].reverse().find(match => match.handle?.permission)?.handle.permission;

    useEffect(() => {
        loadPermissions();
    }, [loadPermissions]);

    if (permission && accessStatus === 'ready' && !hasPermission(permissions, permission)) {
        return (
            <Navigate
                to="/"
                replace
            />
        );
    }

    return <Outlet />;
}
