import { useEffect, useMemo, useRef, useState } from 'react';
import './DataTable.scss';

const DEFAULT_PAGE_SIZE = 50;

const DataTable = ({
    columns = [],
    rows = [],
    rowKey = 'id',
    pageSize = DEFAULT_PAGE_SIZE,
    cellClickHandlers = {},
}) => {
    const [filters, setFilters] = useState({});
    const [sort, setSort] = useState(null);
    const [visibleCount, setVisibleCount] = useState(pageSize);

    const containerRef = useRef(null);
    const sentinelRef = useRef(null);

    const filteredRows = useMemo(() => {
        return rows.filter(row => {
            return columns.every(column => {
                if (!column.filterable) return true;

                const filterValue = filters[column.id];

                if (!filterValue) return true;

                const value = row[column.id];

                return String(value ?? '')
                    .toLowerCase()
                    .includes(filterValue.toLowerCase());
            });
        });
    }, [rows, columns, filters]);

    const sortedRows = useMemo(() => {
        if (!sort) return filteredRows;

        const { id, direction } = sort;

        return [...filteredRows].sort((a, b) => {
            const aValue = a[id];
            const bValue = b[id];

            if (aValue == null && bValue == null) return 0;
            if (aValue == null) return 1;
            if (bValue == null) return -1;

            const aNumber = Number(aValue);
            const bNumber = Number(bValue);

            let result;

            if (!Number.isNaN(aNumber) && !Number.isNaN(bNumber)) {
                result = aNumber - bNumber;
            } else {
                result = String(aValue).localeCompare(String(bValue), 'ru', {
                    numeric: true,
                });
            }

            return direction === 'asc' ? result : -result;
        });
    }, [filteredRows, sort]);

    const visibleRows = useMemo(() => {
        return sortedRows.slice(0, visibleCount);
    }, [sortedRows, visibleCount]);

    useEffect(() => {
        setVisibleCount(pageSize);
    }, [filters, sort, rows, pageSize]);

    useEffect(() => {
        const root = containerRef.current;
        const target = sentinelRef.current;

        if (!root || !target) return;

        const observer = new IntersectionObserver(
            entries => {
                if (!entries[0].isIntersecting) return;

                setVisibleCount(current =>
                    Math.min(current + pageSize, sortedRows.length),
                );
            },
            {
                root,
                rootMargin: '200px',
            },
        );

        observer.observe(target);

        return () => observer.disconnect();
    }, [pageSize, sortedRows.length, visibleCount]);

    const handleSort = column => {
        if (!column.sortable) return;

        setSort(current => {
            if (!current || current.id !== column.id) {
                return {
                    id: column.id,
                    direction: 'asc',
                };
            }

            if (current.direction === 'asc') {
                return {
                    id: column.id,
                    direction: 'desc',
                };
            }

            return null;
        });
    };

    const handleFilter = (columnId, value) => {
        setFilters(current => ({
            ...current,
            [columnId]: value,
        }));
    };

    const getSortIcon = column => {
        if (!column.sortable) return null;
        if (sort?.id !== column.id) return '↕';
        return sort.direction === 'asc' ? '↑' : '↓';
    };

    const getResultClass = value => {
        const number = Number(value);

        if (
            value == null ||
            value === '' ||
            Number.isNaN(number) ||
            number === 0
        ) {
            return '';
        }

        if (number >= 600) return 'data-table__cell--green';
        if (number >= 400) return 'data-table__cell--yellow';
        if (number >= 200) return 'data-table__cell--red';

        return '';
    };

    const getCellValue = (value, column) => {
        if (column.results && (value == null || Number(value) === 0)) {
            return '-';
        }

        return value ?? '';
    };

    const handleCellClick = (column, row) => {
        if (!column.clickable) return;

        const handler = cellClickHandlers[column.id];

        if (handler) {
            handler(row);
        }
    };

    return (
        <div ref={containerRef} className="data-table">
            <table className="data-table__table">
                <thead className="data-table__head">
                    <tr>
                        {columns.map(column => (
                            <th
                                key={column.id}
                                className={`data-table__header ${
                                    column.sortable
                                        ? 'data-table__header--sortable'
                                        : ''
                                }`}
                                style={{
                                    width: column.width,
                                    minWidth: column.width,
                                    maxWidth: column.width,
                                }}
                                onClick={() => handleSort(column)}
                            >
                                <div
                                    className="data-table__header-content"
                                    title={
                                        column.tooltip
                                            ? column.title
                                            : undefined
                                    }
                                >
                                    <span>{column.title}</span>

                                    {column.sortable && (
                                        <span className="data-table__sort">
                                            {getSortIcon(column)}
                                        </span>
                                    )}
                                </div>
                            </th>
                        ))}
                    </tr>

                    {columns.some(column => column.filterable) && (
                        <tr className="data-table__filters">
                            {columns.map(column => (
                                <th
                                    key={column.id}
                                    style={{
                                        width: column.width,
                                        minWidth: column.width,
                                        maxWidth: column.width,
                                    }}
                                >
                                    {column.filterable && (
                                        <input
                                            value={filters[column.id] ?? ''}
                                            placeholder="Фильтр"
                                            onClick={event =>
                                                event.stopPropagation()
                                            }
                                            onChange={event =>
                                                handleFilter(
                                                    column.id,
                                                    event.target.value,
                                                )
                                            }
                                        />
                                    )}
                                </th>
                            ))}
                        </tr>
                    )}
                </thead>

                <tbody>
                    {visibleRows.map((row, rowIndex) => (
                        <tr
                            key={row[rowKey] ?? rowIndex}
                            className="data-table__row"
                        >
                            {columns.map(column => {
                                const value = row[column.id];

                                return (
                                    <td
                                        key={column.id}
                                        className={[
                                            'data-table__cell',
                                            column.results ? getResultClass(value) : '',
                                            column.clickable ? 'data-table__cell--clickable' : '',
                                        ]
                                            .filter(Boolean)
                                            .join(' ')}
                                        style={{
                                            width: column.width,
                                            minWidth: column.width,
                                            maxWidth: column.width,
                                        }}
                                        onClick={() => handleCellClick(column, row)}
                                    >
                                        {getCellValue(value, column)}
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>

            {visibleCount < sortedRows.length && (
                <div
                    ref={sentinelRef}
                    className="data-table__sentinel"
                />
            )}

            {!sortedRows.length && (
                <div className="data-table__empty">
                    Нет данных
                </div>
            )}
        </div>
    );
};

export default DataTable;