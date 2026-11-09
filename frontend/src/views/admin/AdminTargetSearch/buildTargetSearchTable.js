import { COMPETENCIES_NAMES, MOTIVATORS_NAMES, VALUES_NAMES } from '@utils/utilities.js';

const BASE_COLUMNS = [
    { id: 'studentName', title: 'Имя', width: 120, filterType: 'text' },
    { id: 'course', title: 'Курс', width: 40, filterType: 'number' }
];

const CHARACTERISTIC_GROUPS = [
    { key: 'competencies', names: COMPETENCIES_NAMES },
    { key: 'motivators', names: MOTIVATORS_NAMES },
    { key: 'values', names: VALUES_NAMES }
];

const selectedCharacteristics = (searchParams = {}) =>
    CHARACTERISTIC_GROUPS.flatMap(group => {
        const params = searchParams?.[group.key];

        if (!params?.enabled) return [];

        const chosen = Object.entries(params.values ?? {}).filter(([, level]) => level);

        // Группа включена без конкретных значений — показываем все характеристики группы
        const fields = chosen.length ? chosen.map(([field]) => field) : Object.keys(group.names);

        return fields
            .filter(field => field in group.names)
            .map(field => ({ id: field, title: group.names[field] }));
    });

export const buildTargetSearchColumns = (searchParams = {}) => [
    ...BASE_COLUMNS.map(column => ({
        ...column,
        sortable: true,
        filterable: true,
        searchable: column.id === 'studentName',
        tooltip: true,
        contentType: 'text',
        results: false
    })),
    ...selectedCharacteristics(searchParams).map(({ id, title }) => ({
        id,
        title,
        width: 90,
        sortable: true,
        filterable: true,
        filterType: 'number',
        searchable: false,
        tooltip: true,
        contentType: 'number',
        results: true
    }))
];
