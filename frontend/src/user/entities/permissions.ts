import { AccountType } from './accountType';

export interface UserPermissions {
    canViewStats: boolean;
    canViewGeography: boolean;
    canViewSearch: boolean;
    canViewGrouping: boolean;
    canViewResults: boolean;
    canViewCourses: boolean;
    canViewMotivators: boolean;
    canViewCompetences: boolean;
    canViewStudentPortrait: boolean;
    canViewTeachers: boolean;
    canViewAnalysisDisciplines: boolean;
    canViewAP: boolean;
    canViewAnalysisAdvanced: boolean;
    canViewAiAnalytics: boolean;
    canViewEduProfiles: boolean;
    canViewTransferAnalysis: boolean;
    canViewAnomalousStudents: boolean;
    canViewDuplicateAccounts: boolean;
    canViewHelp: boolean;
    canViewAudit: boolean;
    canViewUpload: boolean;
    canViewSql: boolean;
    canViewOwnPortrait: boolean;
    canViewOwnReport: boolean;
}

export type PermissionsByAccountType = Record<AccountType, UserPermissions>;

export const Permission = {
    STATS: 'canViewStats',
    GEOGRAPHY: 'canViewGeography',
    SEARCH: 'canViewSearch',
    GROUPING: 'canViewGrouping',
    RESULTS: 'canViewResults',
    COURSES: 'canViewCourses',
    MOTIVATORS: 'canViewMotivators',
    COMPETENCES: 'canViewCompetences',
    PORTRAIT: 'canViewPortrait',
    PORTRAIT_DETAILED: 'canViewDetailedPortrait',
    TEACHERS: 'canViewTeachers',
    ANALYSIS_DISCIPLINES: 'canViewAnalysisDisciplines',
    AP: 'canViewAP',
    ANALYSIS_ADVANCED: 'canViewAnalysisAdvanced',
    AI_ANALYTICS: 'canViewAiAnalytics',
    EDU_PROFILES: 'canViewEduProfiles',
    TRANSFER_ANALYSIS: 'canViewTransferAnalysis',
    ANOMALOUS_STUDENTS: 'canViewAnomalousStudents',
    DUPLICATE_ACCOUNTS: 'canViewDuplicateAccounts',
    HELP: 'canViewHelp',
    AUDIT: 'canViewAudit',
    UPLOAD: 'canViewUpload',
    SQL: 'canViewSql',
    OWN_PORTRAIT: 'canViewOwnPortrait',
    OWN_REPORT: 'canViewOwnReport'
} as const;

export type PermissionKey = (typeof Permission)[keyof typeof Permission];

export function hasPermission(permissions: Partial<UserPermissions> | null, permission?: PermissionKey) {
    return !permission || permissions?.[permission] === true;
}

export function filterLinkTree<T extends { links: Array<{ permission?: PermissionKey }> }>(
    linkTree: T[],
    permissions: Partial<UserPermissions> | null
): T[] {
    return linkTree
        .map(category => ({
            ...category,
            links: category.links.filter(link => hasPermission(permissions, link.permission))
        }))
        .filter(category => category.links.length > 0);
}

//@ts-ignore
const ALL_PERMISSIONS = Object.fromEntries(Object.values(Permission).map(permission => [permission, true])) as UserPermissions;

export const DEFAULT_PERMISSIONS_BY_ACCOUNT_TYPE: PermissionsByAccountType = Object.fromEntries(
    Object.values(AccountType).map(accountType => [accountType, { ...ALL_PERMISSIONS }])
) as PermissionsByAccountType;

export function getDefaultPermissions(accountType: AccountType): UserPermissions {
    return { ...DEFAULT_PERMISSIONS_BY_ACCOUNT_TYPE[accountType] };
}
