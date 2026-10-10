const BASE_COLUMNS_NAMES = {
    name: 'ФИО',
    gender: 'Пол',
    position: 'Должность',
    disciplines: 'Дисциплины', // список []
    institution: 'Образовательная организация',
    edu_level: 'Уровень образования',
    academic_degree: 'Учёная степень',
    academic_title: 'Учёное звание',
    qualification: 'Квалификация',
    experience: 'Стаж работы',
};
const searchableCols = ['name', 'institution', 'position', 'disciplines'];
const numberCols =['experience'];

export const buildColumns = () => {
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
    ];

    const names = {
        ...BASE_COLUMNS_NAMES,
    };

    const numberCol = {
        id: '',
        title: '№',
        width: 50,
        sortable: true,
        filterable: true,
        searchable: false,
        tooltip: false,
        clickable: false,
        results: false
    };

    return [
        numberCol,
        ...columnOrder.map(id => ({
            id,
            title: names[id] ?? id,
            width: getColumnWidth(id),
            sortable: true,
            filterable: id !== 'name',
            filterType: numberCols.has(id) ? 'number' : 'text',
            searchable: !!searchableCols.find(id_ => id === id_),
            tooltip: true,
            clickable: id === 'name' || id === 'disciplines',
            results: false,
        }))
    ];
};

const getColumnWidth = id => {
    switch (id) {
        case 'name':
            return 200;

        case 'institution':
        case 'specialty':
            return 220;

        case 'center':
            return 200;

        case 'edu_level':
        case 'disciplines':
            return 120;

        case 'gender':
            return 80;

        default:
            return 120;
    }
};
