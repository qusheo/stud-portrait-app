import { COMPETENCIES_DESCRIPTIONS, COMPETENCIES_NAMES, COURSES_NAMES, MOTIVATORS_DESCRIPTIONS, MOTIVATORS_NAMES, VALUES_DESCRIPTIONS, VALUES_NAMES } from './rsv.js';

/** Подписи полей справочника преподавателей. */
export const TEACHER_FIELDS = {
    id: 'ID',
    source_row: 'Номер',
    name: 'ФИО',
    gender: 'Пол',
    position: 'Должность',
    disciplines: 'Дисциплины',
    institution: 'Образовательная организация',
    edu_level: 'Уровень образования',
    academic_degree: 'Учёная степень',
    academic_title: 'Учёное звание',
    qualification: 'Квалификация',
    experience: 'Стаж работы',
    experience_text: 'Стаж работы (текст)',
    education_details: 'Сведения об образовании',
    professional_development: 'Повышение квалификации',
    professional_retraining: 'Профессиональная переподготовка'
};

/** Подписи полей результатов (основные поля + РСВ). */
export const FIELD_NAMES = {
    // Основные поля
    res_year: 'Учебный год',
    participant: 'Имя участника',
    part_gender: 'Пол',
    center: 'Название ЦК',
    institution: 'Учебное заведение',
    edu_level: 'Уровень образования',
    res_course_num: 'Номер курса',
    study_form: 'Форма обучения',
    specialty: 'Специальность',

    ...COMPETENCIES_NAMES,
    ...MOTIVATORS_NAMES,
    ...VALUES_NAMES
};

export const CATEGORIES_DESCRIPTIONS = {
    ...COMPETENCIES_DESCRIPTIONS,
    ...MOTIVATORS_DESCRIPTIONS,
    ...VALUES_DESCRIPTIONS
};

export const Mapping = {
    ...Object.keys(COMPETENCIES_NAMES).map(o => ({ value: o, label: COMPETENCIES_NAMES[o] })),
    ...Object.keys(MOTIVATORS_NAMES).map(o => ({ value: o, label: MOTIVATORS_NAMES[o] })),
    ...Object.keys(VALUES_NAMES).map(o => ({ value: o, label: VALUES_NAMES[o] })),
    ...Object.keys(COURSES_NAMES).map(o => ({ value: o, label: COURSES_NAMES[o] }))
};
