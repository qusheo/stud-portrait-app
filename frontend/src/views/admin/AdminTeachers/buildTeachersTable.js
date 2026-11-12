export const BASE_COLUMNS_NAMES = {
    //source_row: 'Номер строки источника',
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

const columnOrder = [
    'name',
    'gender',
    'position',
    'disciplines',
    'institution',
    'edu_level',
    'academic_degree',
    'academic_title',
    'qualification',
    'experience',
    'experience_text',
    'education_details',
    'professional_development',
    'professional_retraining'
];

const searchableCols = ['name', 'institution', 'position', 'disciplines'];
const numberCols = ['id', 'source_row', 'experience'];
const jsonCols = ['disciplines', 'education_details', 'professional_development', 'professional_retraining'];

const getFilterType = id => {
    return id === 'disciplines' || id === 'education_details' ? 'combined' : numberCols.includes(id) || jsonCols.includes(id) ? 'number' : 'text';
};

const getColumnWidth = id => {
    switch (id) {
        case 'name':
            return 200;
        case 'institution':
            return 200;
        case 'education_details':
            return 140;
        case 'professional_development':
        case 'professional_retraining':
        case 'disciplines':
            return 90;
        case 'gender':
            return 80;
        default:
            return 120;
    }
};

export const buildColumns = () => {
    const numberCol = {
        id: 'rowId',
        title: '№',
        width: 30,
        sortable: true,
        filterable: false,
        searchable: false,
        tooltip: false,
        clickable: false,
        results: false
    };

    return [
        numberCol,
        ...columnOrder.map(id => ({
            id,
            title: BASE_COLUMNS_NAMES[id] ?? id,
            width: getColumnWidth(id),
            sortable: true,
            filterable: id !== 'name' && !jsonCols.includes(id),
            filterType: getFilterType(id),
            contentType: numberCols.includes(id) ? 'number' : 'text',
            searchable: searchableCols.includes(id),
            tooltip: true,
            clickable: id === 'name' || jsonCols.includes(id),
            results: false
        }))
    ];
};