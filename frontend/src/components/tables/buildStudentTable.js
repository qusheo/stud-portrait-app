import { COMPETENCIES_NAMES, MOTIVATORS_NAMES, VALUES_NAMES } from '@utils/utilities.js';

const BASE_COLUMNS_NAMES = {
    res_year: 'Учебный год',
    participant: 'Участник',
    part_gender: 'Пол',
    center: 'Центр',
    institution: 'Образовательная организация',
    edu_level: 'Уровень образования',
    res_course_num: 'Курс',
    study_form: 'Форма обучения',
    specialty: 'Специальность',
};

export const buildStudentColumns = () => {
    const columnOrder = [
        'res_year',
        'participant',
        'part_gender',
        'center',
        'institution',
        'edu_level',
        'res_course_num',
        'study_form',
        'specialty',
        ...Object.keys(COMPETENCIES_NAMES),
        ...Object.keys(MOTIVATORS_NAMES),
        ...Object.keys(VALUES_NAMES),
    ];

    const resultsColumns = new Set([
        ...Object.keys(COMPETENCIES_NAMES),
        ...Object.keys(MOTIVATORS_NAMES),
        ...Object.keys(VALUES_NAMES),
    ]);

    const names = {
        ...BASE_COLUMNS_NAMES,
        ...COMPETENCIES_NAMES,
        ...MOTIVATORS_NAMES,
        ...VALUES_NAMES,
    };

    return columnOrder.map(id => ({
        id,
        title: names[id] ?? id,
        width: getColumnWidth(id),
        sortable: true,
        filterable: true,
        tooltip: true,
        clickable: id === 'participant',
        results: resultsColumns.has(id),
    }));
};

const getColumnWidth = id => {
    switch (id) {
        case 'participant':
            return 240;

        case 'institution':
        case 'specialty':
            return 280;

        case 'center':
            return 220;

        case 'edu_level':
        case 'study_form':
            return 180;

        case 'res_year':
        case 'part_gender':
        case 'res_course_num':
            return 120;

        default:
            return 160;
    }
};