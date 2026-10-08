type FilterOperator = '<' | '>' | '=';

type ColumnFilterType = 'number' | 'text';

interface IColumnFilterValue {
    value?: string | number | null;
    operator?: FilterOperator | null;
}

interface IColumnFilterConfig {
    type: 'select' | 'input';
    options?: {
        value: string | number;
        label: string;
    }[];
    operators?: FilterOperator[];
}

interface ITableColumn {
    id: string;
    header: string;

    filterable?: boolean;
    filterType?: ColumnFilterType;
}

export function buildColumnFilter(column: ITableColumn, rows: Record<string, any>[]): IColumnFilterConfig | null {
    if (!column.filterable) return null;

    const field = column.id;

    if (column.filterType) {
        return {
            type: 'input',
            operators: ['=', '>', '<']
        };
    }

    const values = Array.from(
        new Set(rows.map(row => row?.[field]).filter(value => value !== null && value !== undefined && value !== ''))
    );

    return {
        type: 'select',
        options: values.map(value => ({
            value,
            label: String(value)
        }))
    };
}

export function buildTableColumns(columns: ITableColumn[], rows: Record<string, any>[]) {
    return columns.map(column => ({
        ...column,
        filter: buildColumnFilter(column, rows)
    }));
}
