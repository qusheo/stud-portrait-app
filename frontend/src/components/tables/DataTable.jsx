import { useEffect, useMemo, useRef, useState } from 'react';
import './DataTable.scss';
import { Search, SearchX, FilterIcon } from 'lucide-react';
import { buildTableColumns } from './buildTableFilters';
import Empty from '../ui/Empty';
const DEFAULT_PAGE_SIZE = 50;

const FilterPanel = ({ column, handleFilterChange, filters, clearFilter }) => {
    return (
        <div
            className="data-table__filter"
            onClick={event => event.stopPropagation()}
        >
            {column.filter.type === 'select' && (
                <select
                    value={filters[column.id]?.value ?? ''}
                    onChange={event =>
                        handleFilterChange(column.id, {
                            value: event.target.value
                        })
                    }
                >
                    <option value="">Все</option>

                    {column.filter.options?.map(option => (
                        <option
                            key={String(option.value)}
                            value={option.value}
                        >
                            {option.label}
                        </option>
                    ))}
                </select>
            )}

            {column.filter.type === 'input' && (
                <div className="data-table__filter-input">
                    <select
                        value={filters[column.id]?.operator ?? '='}
                        onChange={event =>
                            handleFilterChange(column.id, {
                                operator: event.target.value
                            })
                        }
                    >
                        {column.filter.operators?.map(operator => (
                            <option
                                key={operator}
                                value={operator}
                            >
                                {operator}
                            </option>
                        ))}
                    </select>

                    <input
                        type={column.filterType === 'number' ? 'number' : 'text'}
                        value={filters[column.id]?.value ?? ''}
                        onChange={event =>
                            handleFilterChange(column.id, {
                                value: event.target.value
                            })
                        }
                    />
                </div>
            )}

            {filters[column.id] && (
                <button
                    type="button"
                    onClick={() => clearFilter(column.id)}
                >
                    Сбросить
                </button>
            )}
        </div>
    );
};

const DataTable = ({
    columns = [],
    rows = [],
    rowKey = 'id',
    pageSize = DEFAULT_PAGE_SIZE,
    cellClickHandlers = {},
    selection = true,
    onSelectionChange
}) => {
    const [filters, setFilters] = useState({});
    const [sort, setSort] = useState(null);
    const [visibleCount, setVisibleCount] = useState(pageSize);
    const [selectedRowIds, setSelectedRowIds] = useState(new Set());
    const [openedSearch, setOpenedSearch] = useState({});
    const [openedFilter, setOpenedFilter] = useState(null);
    const containerRef = useRef(null);
    const sentinelRef = useRef(null);

    const tableColumns = useMemo(() => buildTableColumns(columns, rows), [columns, rows]);
    const getRowId = row => row[rowKey];

    if (!rows.length)
        return (
            <div className="data-table">
                <Empty />
            </div>
        );

    const toggleSearch = id => {
        setOpenedSearch(prev => ({
            ...prev,
            [id]: !prev[id]
        }));
    };
    const toggleFilter = columnId => {
        setOpenedFilter(current => (current === columnId ? null : columnId));

        setOpenedSearch({});
    };
    const [search, setSearch] = useState({});

    const handleSearch = (columnId, value) => {
        setSearch(prev => ({
            ...prev,
            [columnId]: value
        }));
    };

    const filteredRows = useMemo(() => {
        return rows.filter(row =>
            tableColumns.every(column => {
                const value = row[column.id];

                const searchValue = search[column.id];

                if (searchValue) {
                    const matches = String(value ?? '')
                        .toLowerCase()
                        .includes(String(searchValue).toLowerCase());

                    if (!matches) return false;
                }

                const filterValue = filters[column.id];

                if (!filterValue || filterValue.value === '' || filterValue.value == null) {
                    return true;
                }

                if (column.filter?.type === 'select') {
                    return String(value) === String(filterValue.value);
                }

                if (column.filter?.type === 'input') {
                    if (column.filterType === 'number') {
                        const rowValue = Number(value);
                        const target = Number(filterValue.value);

                        if (Number.isNaN(rowValue) || Number.isNaN(target)) {
                            return false;
                        }

                        switch (filterValue.operator ?? '=') {
                            case '>':
                                return rowValue > target;

                            case '<':
                                return rowValue < target;

                            default:
                                return rowValue === target;
                        }
                    }

                    return String(value ?? '')
                        .toLowerCase()
                        .includes(String(filterValue.value).toLowerCase());
                }

                return true;
            })
        );
    }, [rows, tableColumns, search, filters]);

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
                    numeric: true
                });
            }

            return direction === 'asc' ? result : -result;
        });
    }, [filteredRows, sort]);

    const visibleRows = useMemo(() => {
        return sortedRows.slice(0, visibleCount);
    }, [sortedRows, visibleCount]);

    const toggleRow = row => {
        const id = getRowId(row);

        setSelectedRowIds(current => {
            const next = new Set(current);

            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }

            onSelectionChange?.(rows.filter(item => next.has(getRowId(item))));

            return next;
        });
    };

    const allFilteredSelected = filteredRows.length > 0 && filteredRows.every(row => selectedRowIds.has(getRowId(row)));

    const toggleAll = () => {
        setSelectedRowIds(current => {
            const next = new Set(current);

            if (allFilteredSelected) {
                filteredRows.forEach(row => {
                    next.delete(getRowId(row));
                });
            } else {
                filteredRows.forEach(row => {
                    next.add(getRowId(row));
                });
            }

            onSelectionChange?.(rows.filter(row => next.has(getRowId(row))));

            return next;
        });
    };

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

                setVisibleCount(current => Math.min(current + pageSize, sortedRows.length));
            },
            {
                root,
                rootMargin: '200px'
            }
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
                    direction: 'asc'
                };
            }

            if (current.direction === 'asc') {
                return {
                    id: column.id,
                    direction: 'desc'
                };
            }

            return null;
        });
    };

    const handleFilter = (columnId, value) => {
        setFilters(current => ({
            ...current,
            [columnId]: value
        }));
    };
    const handleFilterChange = (columnId, patch) => {
        setFilters(prev => ({
            ...prev,
            [columnId]: {
                ...prev[columnId],
                ...patch
            }
        }));
    };
    const clearFilter = columnId => {
        setFilters(prev => {
            const next = { ...prev };

            delete next[columnId];

            return next;
        });
    };

    const getSortIcon = column => {
        if (!column.sortable) return null;
        if (sort?.id !== column.id) return '↕';
        return sort.direction === 'asc' ? '↑' : '↓';
    };

    const getResultClass = value => {
        if (value == null || value === '') return '';

        const number = Number(value);

        if (Number.isNaN(number) || number === 0) {
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
        <div
            ref={containerRef}
            className="data-table"
        >
            <table className="data-table__table">
                <thead className="data-table__head">
                    <tr>
                        {selection && (
                            <th className="data-table__select-cell">
                                <input
                                    type="checkbox"
                                    checked={allFilteredSelected}
                                    onChange={toggleAll}
                                    onClick={event => event.stopPropagation()}
                                />
                            </th>
                        )}

                        {tableColumns.map(column => (
                            <th
                                key={column.id}
                                className="data-table__header"
                                style={{
                                    width: column.width,
                                    minWidth: column.width,
                                    maxWidth: column.width
                                }}
                            >
                                <div className="data-table__header-content">
                                    <div
                                        className={`data-table__header-title ${
                                            column.sortable ? 'data-table__header-title--sortable' : ''
                                        }`}
                                        title={column.tooltip ? column.title : undefined}
                                        onClick={() => handleSort(column)}
                                    >
                                        <span>{column.title}</span>

                                        {column.sortable && <span className="data-table__sort">{getSortIcon(column)}</span>}
                                    </div>
                                    <div className="data-table__header-action-wrap">
                                        {column.filterable && column.filter && (
                                            <div
                                                className={`data-table__header-button ${
                                                    filters[column.id]?.value !== undefined && filters[column.id]?.value !== ''
                                                        ? 'data-table__header-button--active'
                                                        : ''
                                                }`}
                                                onClick={event => {
                                                    event.stopPropagation();
                                                    toggleFilter(column.id);
                                                }}
                                            >
                                                <FilterIcon size={10} />
                                            </div>
                                        )}
                                        {column.filterable && column.filter && openedFilter === column.id && (
                                            <div className="data-table__filter-popover">
                                                <FilterPanel
                                                    column={column}
                                                    handleFilterChange={handleFilterChange}
                                                    filters={filters}
                                                    clearFilter={clearFilter}
                                                />
                                            </div>
                                        )}
                                        {column.searchable && (
                                            <div
                                                className="data-table__search-button"
                                                onClick={event => {
                                                    event.stopPropagation();
                                                    toggleSearch(column.id);
                                                }}
                                            >
                                                {openedSearch[column.id] ? <SearchX size={10} /> : <Search size={10} />}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {column.searchable && openedSearch[column.id] && (
                                    <div className="data-table__search">
                                        <input
                                            autoFocus
                                            value={search[column.id] ?? ''}
                                            placeholder="Поиск..."
                                            onClick={event => event.stopPropagation()}
                                            onChange={event => handleSearch(column.id, event.target.value)}
                                        />

                                        {!!search[column.id] && (
                                            <button
                                                type="button"
                                                onClick={event => {
                                                    event.stopPropagation();
                                                    handleSearch(column.id, '');
                                                }}
                                            >
                                                ×
                                            </button>
                                        )}
                                    </div>
                                )}
                            </th>
                        ))}
                    </tr>
                </thead>

                <tbody>
                    {visibleRows.map((row, rowIndex) => {
                        const rowId = getRowId(row);
                        const selected = selectedRowIds.has(rowId);

                        return (
                            <tr
                                key={rowId ?? rowIndex}
                                className={`data-table__row ${selected ? 'data-table__row--selected' : ''}`}
                            >
                                {selection && (
                                    <td className="data-table__select-cell">
                                        <input
                                            type="checkbox"
                                            checked={selected}
                                            onChange={() => toggleRow(row)}
                                            onClick={event => event.stopPropagation()}
                                        />
                                    </td>
                                )}

                                {columns.map(column => {
                                    const value = row[column.id];

                                    return (
                                        <td
                                            key={column.id}
                                            className={[
                                                'data-table__cell',
                                                column.results ? getResultClass(value) : '',
                                                column.clickable ? 'data-table__cell--clickable' : ''
                                            ]
                                                .filter(Boolean)
                                                .join(' ')}
                                            style={{
                                                width: column.width,
                                                minWidth: column.width,
                                                maxWidth: column.width
                                            }}
                                            onClick={() => handleCellClick(column, row)}
                                        >
                                            {getCellValue(value, column)}
                                        </td>
                                    );
                                })}
                            </tr>
                        );
                    })}
                </tbody>
            </table>

            {visibleCount < sortedRows.length && (
                <div
                    ref={sentinelRef}
                    className="data-table__sentinel"
                />
            )}

            {!sortedRows.length && <div className="data-table__empty">Нет данных</div>}
        </div>
    );
};

export default DataTable;
