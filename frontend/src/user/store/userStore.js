
import { create } from 'zustand';
import UserService from '../services/UserService.js';
import { AccountType } from '../entities/accountType.ts';
import { getDefaultPermissions } from '../entities/permissions.ts';

// Неизвестная роль не должна превращаться в администратора.
const getAccountType = accountType =>
    Object.values(AccountType).includes(accountType)
        ? accountType
        : AccountType.STUDENT;

// Безопасное состояние: все разрешения выключены.
const getDeniedPermissions = () =>
    Object.fromEntries(
        Object.keys(getDefaultPermissions(AccountType.STUDENT)).map(
            permission => [permission, false]
        )
    );

export const useUserStore = create((set, get) => ({
    accountType: AccountType.STUDENT,
    userId: null,
    participantId: null,
    isAuthenticated: false,
    permissions: getDeniedPermissions(),
    accessStatus: 'idle',

    resetAuth: () => {
        set({
            accountType: AccountType.STUDENT,
            userId: null,
            participantId: null,
            isAuthenticated: false,
            permissions: getDeniedPermissions(),
            accessStatus: 'idle'
        });
    },

    loadPermissions: async (force = false) => {
        const currentStatus = get().accessStatus;

        if (
            !force &&
            (currentStatus === 'loading' || currentStatus === 'ready')
        ) {
            return;
        }

        set({ accessStatus: 'loading' });

        try {
            const response = await UserService.getPermissions();
            const isAuthenticated = response.is_authenticated === true;

            // Если backend не подтвердил авторизацию,
            // не выдаём пользователю никаких разрешений.
            if (!isAuthenticated) {
                set({
                    accountType: AccountType.STUDENT,
                    userId: null,
                    participantId: null,
                    isAuthenticated: false,
                    permissions: getDeniedPermissions(),
                    accessStatus: 'ready'
                });
                return;
            }

            const accountType = getAccountType(response.account_type);

            set({
                accountType,
                userId: response.user_id ?? null,
                participantId: response.participant_id ?? null,
                isAuthenticated: true,
                permissions: {
                    ...getDeniedPermissions(),
                    ...(response.permissions || {})
                },
                accessStatus: 'ready'
            });
        } catch {
            set({
                accountType: AccountType.STUDENT,
                userId: null,
                participantId: null,
                isAuthenticated: false,
                permissions: getDeniedPermissions(),
                accessStatus: 'ready'
            });
        }
    }
}));
