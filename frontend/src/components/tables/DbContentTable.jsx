import Table, { TableHeader, TableItem, TableRow } from './Table';

/**
 * @description Таблица предпросмотра строк базы данных.
 * @param {Object} props Параметры компонента.
 * @param {Object} props.data Данные с массивом строк rows.
 */
function DbContentTable({ data }) {
    const columns = Object.keys(data.rows[0]);
    return (
        <Table>
            <TableHeader>
                {columns.map(col => (
                    <TableItem key={col}>{col}</TableItem>
                ))}
            </TableHeader>
            {data.rows.map((row, idx) => (
                <TableRow key={idx}>
                    {columns.map(col => (
                        <TableItem key={col}>{row[col] !== null && row[col] !== undefined ? String(row[col]) : '—'}</TableItem>
                    ))}
                </TableRow>
            ))}
        </Table>
    );
}

export default DbContentTable;
