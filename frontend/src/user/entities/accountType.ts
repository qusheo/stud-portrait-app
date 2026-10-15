export enum AccountType {
    ADMIN = 'admin',
    CENTRE = 'centre',
    INSTITUTION_ADMIN = 'institution_admin',
    TEACHER = 'teacher',
    STUDENT = 'student'
}

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
    [AccountType.ADMIN]: 'Администратор',
    [AccountType.CENTRE]: 'Центр',
    [AccountType.INSTITUTION_ADMIN]: 'Администратор учреждения',
    [AccountType.TEACHER]: 'Преподаватель',
    [AccountType.STUDENT]: 'Студент'
};
