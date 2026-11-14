import { Permission } from '../user/entities/permissions.ts';

/** Link tree for admin navigation. */
export const LINK_TREE = [
    {
        category: null,
        links: [
            { title: 'Статистика тестирования', to: '/admin/stats', permission: Permission.STATS },
            { title: 'География тестирования', to: '/admin/geography', permission: Permission.GEOGRAPHY }
        ]
    },
    {
        category: 'Подбор',
        links: [
            { title: 'Поиск под задачи', to: '/admin/search', permission: Permission.SEARCH },
            { title: 'Подбор групп', to: '/admin/grouping', permission: Permission.GROUPING }
        ]
    },
    {
        category: 'Результаты',
        links: [
            { title: 'Тестирование профилей', to: '/admin/results', permission: Permission.RESULTS },
            { title: 'Образовательные курсы', to: '/admin/courses', permission: Permission.COURSES },
            { title: 'Мотиваторы', to: '/admin/motivators', permission: Permission.MOTIVATORS },
            { title: 'Компетенции', to: '/admin/competences', permission: Permission.COMPETENCES },
            { title: 'Цифровой профиль', to: '/admin/portrait', permission: Permission.PORTRAIT },
            { title: 'Преподаватели', to: '/admin/teachers', permission: Permission.TEACHERS }
        ]
    },
    {
        category: 'Анализ данных',
        links: [
            { title: 'Анализ дисциплин', to: '/admin/analysis/disciplines', permission: Permission.ANALYSIS_DISCIPLINES },
            { title: 'Дисциплины и компетенции', to: '/admin/AP', permission: Permission.AP },
            { title: 'Визуализации', to: '/admin/analysis/advanced', permission: Permission.ANALYSIS_ADVANCED },
            //{ title: 'ИИ-аналитика', to: '/admin/analysis/ai-analytics', permission: Permission.AI_ANALYTICS },
            //{ title: 'Области образования', to: '/admin/analysis/edu-profiles', permission: Permission.EDU_PROFILES },
            //{ title: 'Переведённые студенты', to: '/admin/analysis/transfered-students', permission: Permission.TRANSFER_ANALYSIS },
            //{ title: 'Аномальные студенты', to: '/admin/analysis/anomalous-students', permission: Permission.ANOMALOUS_STUDENTS },
            //{ title: 'Дублирующиеся аккаунты', to: '/admin/analysis/dublicate-accounts', permission: Permission.DUPLICATE_ACCOUNTS }
        ]
    }
];

/** Link tree for superadmin navigation. */
export const SUPER_LINK_TREE = [
    {
        category: 'Управление данными',
        links: [
            { title: 'Аудит данных', to: '/super/audit', permission: Permission.AUDIT },
            { title: 'Загрузка данных', to: '/super/upload', permission: Permission.UPLOAD },
            { title: 'SQL-запросник', to: '/super/sql', permission: Permission.SQL }
        ]
    }
];
