import { useEffect, useMemo, useRef, useState, useLayoutEffect } from 'react';
import './DataTable.scss';
import { Search, SearchX, FilterIcon } from 'lucide-react';
import { buildTableColumns } from './buildTableFilters';
import Empty from '../ui/Empty';
import { createPortal } from 'react-dom';
import { Select } from 'antd';
const DEFAULT_PAGE_SIZE = 50;

const FilterPanel = ({ column, handleFilterChange, filters, clearFilter }) => {
    return (
        <div
            className="data-table__filter"
            onClick={event => event.stopPropagation()}
        >
            {column.filter.type === 'combined' && (
                <div className="data-table__filter-combined">
                    <select
                        value={filters[column.id]?.mode ?? 'number'}
                        onChange={event =>
                            handleFilterChange(column.id, {
                                mode: event.target.value,
                                value: event.target.value === 'text' ? [] : '',
                                operator: '=',
                            })
                        }
                    >
                        <option value="number">Количество</option>
                        <option value="text">Название</option>
                    </select>

                    {(filters[column.id]?.mode ?? 'number') === 'number' ? (
                        <div className="data-table__filter-input">
                            <select
                                value={filters[column.id]?.operator ?? '='}
                                onChange={event =>
                                    handleFilterChange(column.id, {
                                        operator: event.target.value,
                                    })
                                }
                            >
                                {column.filter.operators?.map(operator => (
                                    <option key={operator} value={operator}>
                                        {operator}
                                    </option>
                                ))}
                            </select>

                            <input
                                type="number"
                                value={filters[column.id]?.value ?? ''}
                                placeholder="Количество"
                                onChange={event =>
                                    handleFilterChange(column.id, {
                                        value: event.target.value,
                                    })
                                }
                            />
                        </div>
                    ) : (
                        <Select
                            mode="multiple"
                            showSearch
                            allowClear
                            maxTagCount="responsive"
                            placeholder="Выберите дисциплины"
                            options={column.filter.options}
                            value={filters[column.id]?.value ?? []}
                            optionFilterProp="label"
                            onChange={value =>
                                handleFilterChange(column.id, {
                                    value,
                                })
                            }
                            getPopupContainer={() => document.body}
                            notFoundContent="Нет данных"
                        />
                    )}
                </div>
            )}
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
    onSelectionChange,
    _selectedRows = []
}) => {
    const [filters, setFilters] = useState({});
    const [sort, setSort] = useState(null);
    const [visibleCount, setVisibleCount] = useState(pageSize);
    const [selectedRowIds, setSelectedRowIds] = useState(new Set());
    const [openedSearch, setOpenedSearch] = useState({});
    const [openedFilter, setOpenedFilter] = useState(null);
    const [filterPosition, setFilterPosition] = useState({ x: 0, y: 0 });
    const containerRef = useRef(null);
    const sentinelRef = useRef(null);
    const filterPopoverRef = useRef(null);
    const filterButtonRectRef = useRef(null);

    const tableColumns = useMemo(() => buildTableColumns(columns, rows), [columns, rows]);
    const getRowId = row => row[rowKey];

    useLayoutEffect(() => {
        if (!openedFilter || !filterPopoverRef.current || !filterButtonRectRef.current) return;

        const { height, width } = filterPopoverRef.current.getBoundingClientRect();
        const button = filterButtonRectRef.current;
        const padding = 8;

        const x = Math.max(padding, Math.min(button.left, window.innerWidth - width - padding));

        const y = button.bottom + 6 + height > window.innerHeight - padding ? button.top - height - 6 : button.bottom + 6;

        setFilterPosition({
            x,
            y: Math.max(padding, y)
        });
    }, [openedFilter]);

    const toggleSearch = id => {
        setOpenedSearch(prev => ({
            ...prev,
            [id]: !prev[id]
        }));
    };
    const toggleFilter = (columnId, event) => {
        setOpenedFilter(current => (current === columnId ? null : columnId));

        const rect = event.currentTarget.getBoundingClientRect();
        const width = 240;
        const padding = 8;
        const gap = 6;
        const x = Math.max(padding, Math.min(rect.left, window.innerWidth - width - padding));
        const y = rect.bottom + gap;

        setFilterPosition({ x, y });

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

                if (
                    !filterValue ||
                    filterValue.value == null ||
                    filterValue.value === '' ||
                    (Array.isArray(filterValue.value) && filterValue.value.length === 0)
                ) {
                    return true;
                }

                if (column.filter?.type === 'combined') {
                    if (!Array.isArray(value)) return false;

                    if ((filterValue.mode ?? 'number') === 'text') {
                        const selectedValues = Array.isArray(filterValue.value)
                            ? filterValue.value
                            : filterValue.value != null && filterValue.value !== ''
                                ? [filterValue.value]
                                : [];

                        return selectedValues.some(selected =>
                            value.some(item => String(item) === String(selected))
                        );
                    }

                    const rowValue = value.length;
                    const target = Number(filterValue.value);

                    if (!Number.isFinite(target)) return false;

                    switch (filterValue.operator ?? '=') {
                        case '>':
                            return rowValue > target;

                        case '<':
                            return rowValue < target;

                        default:
                            return rowValue === target;
                    }
                }

                if (column.filter?.type === 'select') {
                    return String(value) === String(filterValue.value);
                }

                if (column.filter?.type === 'input') {
                    if (column.filterType === 'number') {
                        if (value == null || value === '') return false;

                        const rowValue = Number(value);
                        const target = Number(filterValue.value);

                        if (!Number.isFinite(rowValue) || !Number.isFinite(target)) {
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
            const aValue = Array.isArray(a[id]) ? a[id].length : a[id];
            const bValue = Array.isArray(b[id]) ? b[id].length : b[id];

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
    
    const externalSelectedIds = JSON.stringify(_selectedRows.map(row => row[rowKey]));
    useEffect(() => {
        setSelectedRowIds(new Set(JSON.parse(externalSelectedIds)));
    }, [externalSelectedIds]);

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
    useEffect(() => {
        if (!openedFilter) return;

        const handleClickOutside = event => {
            if (!event.target.closest('.data-table__filter-popover') && !event.target.closest('.ant-select-dropdown')) {
                setOpenedFilter(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [openedFilter]);

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
        if (column.filterType === 'combined' && Array.isArray(value)) {
            return value.length;
        }

        if (column.results && (value == null || Number(value) === 0)) {
            return '-';
        }

        return value ?? '';
    };

    const handleCellClick = (column, row, event) => {
        if (!column.clickable) return;

        if (typeof cellClickHandlers === 'function') {
            cellClickHandlers(row, column, event);
        } else {
            cellClickHandlers[column.id]?.(row, event);
        }
    };

    if (!rows.length)
        return (
            <div className="data-table">
                <Empty />
            </div>
        );

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
                                                    toggleFilter(column.id, event);
                                                }}
                                            >
                                                <FilterIcon
                                                    className="header-icon"
                                                    size={10}
                                                />
                                            </div>
                                        )}
                                        {column.filterable &&
                                            column.filter &&
                                            openedFilter === column.id &&
                                            createPortal(
                                                <div
                                                    className="data-table__filter-popover"
                                                    ref={filterPopoverRef}
                                                    style={{
                                                        left: filterPosition.x,
                                                        top: filterPosition.y
                                                    }}
                                                >
                                                    <FilterPanel
                                                        column={column}
                                                        handleFilterChange={handleFilterChange}
                                                        filters={filters}
                                                        clearFilter={clearFilter}
                                                    />
                                                </div>,
                                                document.body
                                            )}
                                        {column.searchable && (
                                            <div
                                                className="data-table__search-button"
                                                onClick={event => {
                                                    event.stopPropagation();
                                                    toggleSearch(column.id);
                                                }}
                                            >
                                                {openedSearch[column.id] ? (
                                                    <SearchX
                                                        className="header-icon"
                                                        size={10}
                                                    />
                                                ) : (
                                                    <Search
                                                        className="header-icon"
                                                        size={10}
                                                    />
                                                )}
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
                                                maxWidth: column.width,
                                                ...(column?.contentType === 'number' && { fontsize: 12, fontFamily: 'Ebrima' }),
                                            }}
                                            onClick={event => handleCellClick(column, row, event)}
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
