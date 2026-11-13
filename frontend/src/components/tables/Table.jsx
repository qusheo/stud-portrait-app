import React, { createContext, useContext } from 'react';

import './Table.scss';

const TableContext = createContext({ inHeader: false });

/**
 * @description Таблица, собранная из TableHeader, TableRow и TableItem.
 * @param {Object} props Параметры компонента.
 * @param {*} props.children Элементы таблицы.
 */
function Table({ children }) {
    const arr = React.Children.toArray(children);
    return (
        <table className="Table">
            {arr.find(child => child.type === TableHeader)}
            <tbody>
                <TableContext.Provider value={{ inHeader: false }}>{arr.filter(child => child.type === TableRow)}</TableContext.Provider>
            </tbody>
        </table>
    );
}

/**
 * @description Строка заголовков таблицы.
 * @param {Object} props Параметры компонента.
 * @param {*} props.children Элементы TableItem с названиями колонок.
 */
export function TableHeader({ children }) {
    const arr = React.Children.toArray(children);
    return (
        <thead>
            <TableContext.Provider value={{ inHeader: true }}>
                <tr>{arr.filter(child => child.type === TableItem)}</tr>
            </TableContext.Provider>
        </thead>
    );
}

/**
 * @description Строка данных таблицы.
 * @param {Object} props Параметры компонента.
 * @param {*} props.children Ячейки TableItem.
 * @param {string} props.className Дополнительный CSS-класс строки.
 */
export function TableRow({ children, className }) {
    const arr = React.Children.toArray(children);
    return <tr className={className}>{arr.filter(child => child.type === TableItem)}</tr>;
}

/**
 * @description Ячейка заголовка или данных таблицы.
 * @param {Object} props Параметры компонента.
 * @param {*} props.children Содержимое ячейки.
 * @param {string} props.className Дополнительный CSS-класс.
 * @param {string} props.title Всплывающая подсказка ячейки.
 * @param {Function} [props.onClick] Обработчик нажатия на ячейку.
 * @param {Object} [props.cssVars] CSS-переменные для оформления ячейки.
 */
export function TableItem({ children, className, title, onClick, cssVars }) {
    const { inHeader } = useContext(TableContext);
    const Cell = inHeader ? 'th' : 'td';
    const variables = cssVars && Object.fromEntries(Object.entries(cssVars).filter(([key]) => key.startsWith('--')));
    return (
        <Cell
            className={className}
            title={title}
            onClick={() => onClick?.()}
            style={variables}
        >
            {children}
        </Cell>
    );
}

export default Table;
