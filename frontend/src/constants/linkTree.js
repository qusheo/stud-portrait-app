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

/** Link tree for student navigation. */
export const STUDENT_LINK_TREE = [
    {
        category: 'Мой профиль',
        links: [
            { title: 'Личные данные', to: '/user/profile' },
            { title: 'Компетенции', to: '/user/competences' },
            { title: 'Мотиваторы', to: '/user/motivators' },
            { title: 'Ценности', to: '/user/values' },
            { title: 'Образование', to: '/user/education' }
        ]
    },
    {
        category: 'Подбор',
        links: [
            { title: 'Подбор студентов', to: '/user/matching/students' },
            { title: 'Подбор преподавателя', to: '/user/matching/teachers' }
        ]
    },
    {
        category: 'Проекты',
        links: [
            { title: 'Каталог проектов', to: '/user/projects' },
            { title: 'Мои проекты', to: '/user/projects/my' },
            { title: 'Создать проект', to: '/user/projects/create' }
        ]
    },
    {
        category: 'Другие профили',
        links: [
            { title: 'Студенты', to: '/user/students' },
            { title: 'Преподаватели', to: '/user/teachers' }
        ]
    }
];

/** Link tree for teacher navigation. */
export const TEACHER_LINK_TREE = [
    {
        category: 'Мой профиль',
        links: [
            { title: 'Личные данные', to: '/teacher/profile' },
            { title: 'Компетенции', to: '/teacher/competences' },
            { title: 'Мотиваторы', to: '/teacher/motivators' },
            { title: 'Образование', to: '/teacher/education' }
        ]
    },
    {
        category: 'Проекты',
        links: [
            { title: 'Мои проекты', to: '/teacher/projects' },
            { title: 'Создать проект', to: '/teacher/projects/create' }
        ]
    },
    {
        category: 'Подбор',
        links: [
            { title: 'Подбор студентов', to: '/teacher/matching/students' }
        ]
    }
];