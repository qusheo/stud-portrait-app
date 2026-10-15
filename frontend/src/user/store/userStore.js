import { create } from 'zustand';
import UserService from '../services/UserService.js';
import { AccountType } from '../entities/accountType.ts';
import { getDefaultPermissions } from '../entities/permissions.ts';

const getAccountType = accountType => (Object.values(AccountType).includes(accountType) ? accountType : AccountType.ADMIN);

export const useUserStore = create((set, get) => ({
    accountType: AccountType.ADMIN,
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
                permissions: {
                    ...getDefaultPermissions(accountType),
                    ...(response.permissions || {})
                },
                accessStatus: 'ready'
            });
        } catch {
            set({
                accountType: AccountType.ADMIN,
                permissions: getDefaultPermissions(AccountType.ADMIN),
                accessStatus: 'ready'
            });
        }
    }
}));
