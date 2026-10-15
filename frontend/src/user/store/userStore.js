import { create } from 'zustand';
import UserService from '../services/UserService.js';
import { AccountType } from '../entities/accountType.ts';
import { getDefaultPermissions } from '../entities/permissions.ts';

const getAccountType = accountType => (Object.values(AccountType).includes(accountType) ? accountType : AccountType.ADMIN);

export const useUserStore = create((set, get) => ({
    accountType: AccountType.ADMIN,
    userId: null,
    isAuthenticated: false,
    permissions: getDefaultPermissions(AccountType.ADMIN),
    accessStatus: 'idle',
    loadPermissions: async () => {
        if (get().accessStatus === 'loading' || get().accessStatus === 'ready') return;

        set({ accessStatus: 'loading' });
        try {
            const response = await UserService.getPermissions();
            const accountType = getAccountType(response.account_type);
            set({
                accountType,
                userId: response.user_id ?? null,
                isAuthenticated: response.is_authenticated === true,
                permissions: {
                    ...getDefaultPermissions(accountType),
                    ...(response.permissions || {})
                },
                accessStatus: 'ready'
            });
        } catch {
            set({
                accountType: AccountType.ADMIN,
                userId: null,
                isAuthenticated: false,
                permissions: getDefaultPermissions(AccountType.ADMIN),
                accessStatus: 'ready'
            });
        }
    }
}));
