import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import { AdminService } from '@services';
import { COMPETENCIES_NAMES, FIELD_NAMES, LINK_TREE, MOTIVATORS_NAMES, VALUES_NAMES } from '@utils/utilities.js';
import { useAdminStore } from '@utils/store.jsx';

import FlexColumn from '@components/FlexColumn.jsx';
import FlexRow, { WRAP } from '@components/FlexRow.jsx';
import LabelledBox from '@components/LabelledBox.jsx';
import { ModalBody, ModalFooter, useModalWindow } from '@components/ModalWindow.jsx';
import StudentModal from './StudentModal.jsx';

import Button from '@components/ui/Button.jsx';
import ColorBox, { BOX_COLOR } from '@components/ui/ColorBox.jsx';
import Dropdown from '@components/ui/Dropdown.jsx';
import Label from '@components/ui/Label.jsx';
import LoadingSpinner from '@components/ui/LoadingSpinner.jsx';
import MultiSelect from '@components/ui/MultiSelect.jsx';
import NumberField from '@components/ui/NumberField.jsx';
import { ADMIN_PALETTE } from '@components/ui/palette.js';
import Select, { Option, OptionGroup } from '@components/ui/Select.jsx';

import './AdminResultsView.scss';
import DataTable from '@components/tables/DataTable';
import { buildStudentColumns } from './buildStudentTable.js';

function AdminResultsView() {
    const [shownStudent, setShowStudent] = useState(null);

    const resultsView = useAdminStore(state => state.resultsView);
    const setResultsView = useAdminStore(state => state.setResultsView);
    const filters = resultsView?.filters ?? [];
    const hiddenColumns = new Set(resultsView?.hiddenColumns ?? []);
    const [results, setResults] = useState([]);
    const [totalCount, setTotalCount] = useState(0);
    const [selectedRows, setSelectedRows] = useState(new Set());
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
    const [loading, setLoading] = useState(false);
    const [showColumnSelector, setShowColumnSelector] = useState(false);
    const [availableValues, setAvailableValues] = useState({});
    const [pendingFilters, setPendingFilters] = useState(() => filters);
    const [hasMore, setHasMore] = useState(false);
    const [exportLoading, setExportLoading] = useState(false);
    const [groupingColumn, setGroupingColumn] = useState('');
    const navigate = useNavigate();

    const [FiltersModalWindow, _1, setFiltersModalWindowVisible] = useModalWindow('Фильтры');
    const [GrouppingModalWindow, _2, setGrouppingModalVisible] = useModalWindow('Выбор группировки');

    // Базовые поля для фильтрации
    const basicFields = ['res_year', 'part_gender', 'center', 'institution', 'edu_level', 'res_course_num', 'study_form', 'specialty'];

    // Числовые поля для фильтрации по диапазону
    const numericFields = [...Object.keys(COMPETENCIES_NAMES), ...Object.keys(MOTIVATORS_NAMES), ...Object.keys(VALUES_NAMES)];

    // Порядок колонок в таблице
    const columnOrder = [
        // Основная информация
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
        ...Object.keys(VALUES_NAMES)
    ];

    // Группы колонок для удобства управления
    const columnGroups = {
        'Основная информация': columnOrder.slice(0, 9),
        'Компетенции': columnOrder.slice(9, 21),
        'Мотиваторы': columnOrder.slice(21, 37),
        'Ценности': columnOrder.slice(37)
    };

    // Видимые колонки
    const visibleColumns = columnOrder.filter(col => !hiddenColumns.has(col));

    // Получение класса цвета в зависимости от значения
    const getValueColorClass = (value, fieldKey) => {
        const isNumericField = fieldKey.startsWith('res_comp_') || fieldKey.startsWith('res_mot_') || fieldKey.startsWith('res_val_');

        if (!isNumericField) return '';

        if (value === null || value === undefined || value === '') return 'no-value';
        if (value >= 600) return 'high';
        if (value >= 400) return 'medium';
        if (value >= 200) return 'low';

        return 'no-value';
    };

    // Получение класса цвета в зависимости от профиля
    const getProfileColorClass = fieldKey => {
        if (fieldKey.startsWith('res_comp_')) return 'competency';
        if (fieldKey.startsWith('res_mot_')) return 'motivator';
        if (fieldKey.startsWith('res_val_')) return 'value';

        return '';
    };

    // Первоначальная загрузка с сохраненными фильтрами.
    useEffect(() => {
        loadData(filters, 0, 1000, false);
    }, []);

    const loadData = async (
        activeFilters = filters,
        start = 0,
        end = 1000,
        append = false
    ) => {
        setLoading(true);
        try {
            const data = await AdminService.postDataseshExtractData(
                activeFilters,
                start,
                end
            );
            setResults(current => append ? [...current, ...(data.results || [])] : (data.results || []));
            setTotalCount(data.filtered_count || 0);
            setHasMore(start + (data.shown_count || 0) < (data.filtered_count || 0));
            setAvailableValues(data.available_values || {});
        } catch (error) {
            console.error('Error loading results:', error);
        } finally {
            setLoading(false);
        }
    };

    // Загрузка следующей страницы результатов.
    const loadMoreData = async () => {
        if (!hasMore || loading) return;
        const start = results.length;
        await loadData(filters, start, start + 1000, true);
    };

    // Извлечение полей из результата
    const getFieldValue = (result, fieldKey) => {
        // Обработка основных полей
        if (fieldKey === 'res_year') return result.res_year;
        if (fieldKey === 'part_gender') return result.participant?.part_gender || '';
        if (fieldKey === 'center') return result.center || '';
        if (fieldKey === 'institution') return result.institution || '';
        if (fieldKey === 'edu_level') return result.edu_level || '';
        if (fieldKey === 'res_course_num') return result.res_course_num;
        if (fieldKey === 'study_form') return result.study_form || '';
        if (fieldKey === 'specialty') return result.specialty || '';
        if (fieldKey === 'participant') return result.participant?.part_name || '';

        // Обработка компетенций
        if (result.competences && result.competences[fieldKey] !== undefined) {
            return result.competences[fieldKey];
        }

        // Обработка мотиваторов
        if (result.motivators && result.motivators[fieldKey] !== undefined) {
            return result.motivators[fieldKey];
        }

        // Обработка ценностей
        if (result.values && result.values[fieldKey] !== undefined) {
            return result.values[fieldKey];
        }

        // Прямой доступ к полям результата
        if (result[fieldKey] !== undefined) {
            return result[fieldKey];
        }

        return '';
    };

    const handleSort = key => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });

        // Временная сортировка на клиенте
        const sortedResults = [...results].sort((a, b) => {
            let aValue = getFieldValue(a, key);
            let bValue = getFieldValue(b, key);

            if (aValue < bValue) {
                return direction === 'asc' ? -1 : 1;
            }
            if (aValue > bValue) {
                return direction === 'asc' ? 1 : -1;
            }
            return 0;
        });

        setResults(sortedResults);
    };

    const handleExportSelected = async () => {
        if (selectedRows.size === 0) {
            alert('Выберите записи для выгрузки (флажки в первом столбце)');
            return;
        }

        setExportLoading(true);

        AdminService.postDataseshExportSelected(Array.from(selectedRows))
            .then(blob => {
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `selected_results_${new Date().toISOString().split('T')[0]}.xlsx`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
            })
            .catch(error => {
                console.error('Export error:', error);
                alert('Ошибка при выгрузке данных');
            })
            .finally(() => setExportLoading(false));
    };

    // Функции для работы с фильтрами
    const addBasicFilter = field => {
        const newFilter = {
            id: Date.now(),
            type: 'basic',
            field: field,
            selectedValues: []
        };
        setPendingFilters(prev => [...prev, newFilter]);
    };

    const addNumericFilter = field => {
        const newFilter = {
            id: Date.now(),
            type: 'numeric',
            field: field,
            min: 200,
            max: 800
        };
        setPendingFilters(prev => [...prev, newFilter]);
    };

    const removePendingFilter = filterId => {
        setPendingFilters(prev => prev.filter(f => f.id !== filterId));
    };

    const updatePendingBasicFilter = (filterId, selectedValues) => {
        setPendingFilters(prev => prev.map(f => (f.id === filterId ? { ...f, selectedValues } : f)));
    };

    const updatePendingNumericFilter = (filterId, min, max) => {
        setPendingFilters(prev => prev.map(f => (f.id === filterId ? { ...f, min, max } : f)));
    };

    const applyFilters = async () => {
        setResultsView({ filters: [...pendingFilters] });
        setSelectedRows(new Set());
        await loadData(pendingFilters, 0, 1000, false);
    };

    const clearAllFilters = async () => {
        setPendingFilters([]);
        setResultsView({ filters: [] });
        setSelectedRows(new Set());
        await loadData([], 0, 1000, false);
    };

    const toggleColumn = columnKey => {
        const newHidden = new Set(hiddenColumns);
        if (newHidden.has(columnKey)) {
            newHidden.delete(columnKey);
        } else {
            newHidden.add(columnKey);
        }
        updateVisibleColumns(newHidden);
    };

    const toggleColumnGroup = groupColumns => {
        const allGroupHidden = groupColumns.every(col => hiddenColumns.has(col));
        const newHidden = new Set(hiddenColumns);

        groupColumns.forEach(col => {
            if (allGroupHidden) {
                newHidden.delete(col);
            } else {
                newHidden.add(col);
            }
        });

        updateVisibleColumns(newHidden);
    };

    const showAllColumns = () => {
        updateVisibleColumns(new Set());
    };

    const hideAllColumns = () => {
        updateVisibleColumns(new Set(columnOrder));
    };

    const updateVisibleColumns = newHidden => {
        setResultsView({ hiddenColumns: [...newHidden] });
    };

    // Функция для перехода к группировке
    const handleGrouping = () => {
        if (selectedRows.size === 0) {
            alert('Выберите записи для группировки (флажки в первом столбце)');
            return;
        }
        setGrouppingModalVisible(true);
    };

    const handleConfirmGrouping = () => {
        if (!groupingColumn) {
            alert('Выберите столбец для группировки');
            return;
        }

        const groupingData = {
            selectedIds: Array.from(selectedRows),
            groupingColumn: groupingColumn,
            filters
        };

        // Переходим на страницу группировки
        navigate('/admin/grouping', { state: groupingData });
    };

    const rows = results.map(row => ({
        rowId: row.res_id,
        ...row,

        // participant разворачиваем
        ...row.participant,

        // результаты разворачиваем
        ...row.competences,
        ...row.motivators,
        ...row.values,
        participant: row.participant?.part_rsv_id ?? null
    }));

    function onCellClick(row){
        setShowStudent(row);
    }

    const columns = useMemo(
        () => buildStudentColumns().filter(column => !column.id || !hiddenColumns.has(column.id)),
        [resultsView?.hiddenColumns]
    );
    return (
        <div className="AdminResultsView">
            <div
                className="results-container"
                style={{ hidden: true }}
            >
                <div className="results-header">
                    <h2>Результаты тестирования</h2>
                    <FlexRow wrap={WRAP.DO}>
                        <Button
                            text="Фильтры..."
                            onClick={() => setFiltersModalWindowVisible(filters)}
                            palette={ADMIN_PALETTE.YELLOW}
                        />
                        <Button
                            text="Колонки"
                            onClick={() => setShowColumnSelector(!showColumnSelector)}
                            palette={ADMIN_PALETTE.PURPLE}
                        />
                        <Button
                            text="Группировка"
                            onClick={handleGrouping}
                            disabled={selectedRows.size === 0}
                            palette={ADMIN_PALETTE.PURPLE}
                        />
                        <Button
                            text={exportLoading ? 'Загрузка...' : `Выгрузить выделенные (${selectedRows.size})`}
                            onClick={handleExportSelected}
                            disabled={exportLoading || selectedRows.size === 0}
                            palette={ADMIN_PALETTE.GREEN}
                        />
                        <Button
                            text={loading ? 'Загрузка...' : 'Обновить'}
                            onClick={() => loadData()}
                            disabled={loading}
                            palette={ADMIN_PALETTE.CYAN}
                        />
                        <Label>
                            Показано: {results.length} из {totalCount} записей
                            {filters.length > 0 && ` • Активных фильтров: ${filters.length}`}
                            {hiddenColumns.size > 0 && ` • Скрыто колонок: ${hiddenColumns.size}`}
                            {selectedRows.size > 0 && ` • Выбрано: ${selectedRows.size}`}
                        </Label>
                    </FlexRow>
                </div>

                {/* Селектор колонок */}
                {showColumnSelector && (
                    <div className="column-selector">
                        <div className="column-selector-header">
                            <h3>Управление колонками</h3>
                            <div className="column-selector-controls">
                                <Button
                                    text="Показать все"
                                    onClick={showAllColumns}
                                    disabled={loading}
                                    palette={ADMIN_PALETTE.BLUE}
                                />
                                <Button
                                    text="Скрыть все"
                                    onClick={hideAllColumns}
                                    disabled={loading}
                                    palette={ADMIN_PALETTE.BLUE}
                                />
                                <Button
                                    text="✕"
                                    onClick={() => setShowColumnSelector(false)}
                                    palette={ADMIN_PALETTE.RED}
                                />
                            </div>
                        </div>
                        <div className="column-groups">
                            {Object.entries(columnGroups).map(([groupName, groupColumns]) => {
                                const visibleCount = groupColumns.filter(col => !hiddenColumns.has(col)).length;
                                const totalCount = groupColumns.length;
                                return (
                                    <div
                                        key={groupName}
                                        className="column-group"
                                    >
                                        <div className="group-header">
                                            <label className="group-checkbox">
                                                <input
                                                    type="checkbox"
                                                    checked={visibleCount > 0}
                                                    onChange={() => toggleColumnGroup(groupColumns)}
                                                    disabled={loading}
                                                    ref={el => {
                                                        if (el) {
                                                            el.indeterminate = visibleCount > 0 && visibleCount < totalCount;
                                                        }
                                                    }}
                                                />
                                                <span className="group-name">
                                                    {groupName} ({visibleCount}/{totalCount})
                                                </span>
                                            </label>
                                        </div>
                                        <div className="group-columns">
                                            {groupColumns.map(columnKey => (
                                                <label
                                                    key={columnKey}
                                                    className="column-checkbox"
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={!hiddenColumns.has(columnKey)}
                                                        onChange={() => toggleColumn(columnKey)}
                                                        disabled={loading}
                                                    />
                                                    <span className="column-name">{FIELD_NAMES[columnKey]}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                <div
                    className="table-container"
                    style={{ height: 700, paddingBottom: 8 }}
                >
                    {!results.length ? (
                        <div className="loading">
                            <LoadingSpinner text="Загрузка данных..." />
                        </div>
                    ) : (
                        <DataTable
                            rows={rows ?? []}
                            columns={columns}
                            rowKey={'rowId'}
                            cellClickHandlers={onCellClick}
                            onSelectionChange={selected => setSelectedRows(new Set(selected.map(row => row.res_id)))}
                            _selectedRows={rows.filter(row => selectedRows.has(row.res_id))}
                            pageSize={20}
                        />
                    )}
                </div>

                {/* Подсказка снизу */}
                <FlexRow>
                    <Label>
                        <FlexRow gap="20">
                            <span>↸ Категории результатов:</span>
                            <FlexRow>
                                <ColorBox color={BOX_COLOR.GREEN} />
                                <span>Высокий (600-800)</span>
                            </FlexRow>
                            <FlexRow>
                                <ColorBox color={BOX_COLOR.LIME} />
                                <span>Средний (400-599)</span>
                            </FlexRow>
                            <FlexRow>
                                <ColorBox color={BOX_COLOR.YELLOW} />
                                <span>базовый (200-399)</span>
                            </FlexRow>
                        </FlexRow>
                    </Label>

                    <Label>
                        Колонок: {visibleColumns.length}/{columnOrder.length} • Записей: {results.length}
                        {hasMore && '+'} • Выбрано: {selectedRows.size}
                    </Label>

                    {/* Кнопка загрузки дополнительных данных */}
                    {hasMore && (
                        <Button
                            text={loading ? 'Загрузка...' : 'Загрузить ещё'}
                            onClick={loadMoreData}
                            disabled={loading}
                            palette={ADMIN_PALETTE.BLUE}
                        />
                    )}
                </FlexRow>
            </div>

            {/* Модальное окно системы фильтров */}
            <FiltersModalWindow>
                <ModalBody>
                    <div className="filters-modal-body">
                        <FlexRow wrap={WRAP.DO}>
                            <Dropdown
                                label="+ Добавить фильтр"
                            >
                                <OptionGroup label="Базовые поля">
                                    {basicFields.map(field => (
                                        <Option
                                            value={field}
                                            label={FIELD_NAMES[field]}
                                            onClick={addBasicFilter}
                                        />
                                    ))}
                                </OptionGroup>
                                <OptionGroup label="Компетенции">
                                    {Object.keys(COMPETENCIES_NAMES).map(field => (
                                        <Option
                                            value={field}
                                            label={FIELD_NAMES[field]}
                                            onClick={addNumericFilter}
                                        />
                                    ))}
                                </OptionGroup>
                                <OptionGroup label="Мотиваторы">
                                    {Object.keys(MOTIVATORS_NAMES).map(field => (
                                        <Option
                                            value={field}
                                            label={FIELD_NAMES[field]}
                                            onClick={addNumericFilter}
                                        />
                                    ))}
                                </OptionGroup>
                                <OptionGroup label="Ценности">
                                    {Object.keys(VALUES_NAMES).map(field => (
                                        <Option
                                            value={field}
                                            label={FIELD_NAMES[field]}
                                            onClick={addNumericFilter}
                                        />
                                    ))}
                                </OptionGroup>
                            </Dropdown>
                            {(pendingFilters.length > 0 || filters.length > 0) && (
                                <>
                                    <Button
                                        text={loading ? 'Загрузка...' : 'Применить'}
                                        onClick={applyFilters}
                                        disabled={pendingFilters.length === 0 || loading}
                                        palette={ADMIN_PALETTE.GREEN}
                                    />
                                    <Button
                                        text="Очистить"
                                        onClick={clearAllFilters}
                                        disabled={loading}
                                        palette={ADMIN_PALETTE.RED}
                                    />
                                </>
                            )}
                        </FlexRow>

                        {/* Ожидающие применения фильтры */}
                        {pendingFilters.length > 0 && (
                            <>
                                <h6>Выбранные фильтры:</h6>
                                <FlexColumn
                                    className="pending-filters-column"
                                    wrap={WRAP.DO}
                                >
                                    {pendingFilters.map(filter => (
                                        <LabelledBox
                                            label={FIELD_NAMES[filter.field]}
                                            bordered
                                        >
                                            <FlexRow>
                                                {filter.type === 'basic' ? (
                                                    <MultiSelect
                                                        options={availableValues[filter.field]}
                                                        value={filter.selectedValues}
                                                        onChange={selected => updatePendingBasicFilter(filter.id, selected)}
                                                    />
                                                ) : (
                                                    <>
                                                        <LabelledBox
                                                            label="От:"
                                                            nopad
                                                            inrow
                                                        >
                                                            <NumberField
                                                                value={filter.min}
                                                                min="200"
                                                                max="800"
                                                                onChange={value => updatePendingNumericFilter(filter.id, value, filter.max)}
                                                            />
                                                        </LabelledBox>
                                                        <LabelledBox
                                                            label="До:"
                                                            nopad
                                                            inrow
                                                        >
                                                            <NumberField
                                                                value={filter.max}
                                                                min="200"
                                                                max="800"
                                                                onChange={value => updatePendingNumericFilter(filter.id, filter.min, value)}
                                                            />
                                                        </LabelledBox>
                                                    </>
                                                )}
                                                <Button
                                                    text="✕"
                                                    onClick={() => removePendingFilter(filter.id)}
                                                    palette={ADMIN_PALETTE.RED}
                                                />
                                            </FlexRow>
                                        </LabelledBox>
                                    ))}
                                </FlexColumn>
                            </>
                        )}

                        {/* Активные фильтры */}
                        {filters.length > 0 && (
                            <>
                                <h6>Активные фильтры:</h6>
                                <FlexRow
                                    className="active-filters-row"
                                    wrap={WRAP.DO}
                                >
                                    {filters.map(filter => {
                                        let text = `${FIELD_NAMES[filter.field]}: `;
                                        switch (filter.type) {
                                            case 'basic':
                                                text += `Выбрано значений: ${filter.selectedValues.length}`;
                                                break;
                                            case 'numeric':
                                                text += `Диапазон: ${filter.min} - ${filter.max}`;
                                                break;
                                        }
                                        return <Label text={text} />;
                                    })}
                                </FlexRow>
                            </>
                        )}
                    </div>
                </ModalBody>
                <ModalFooter>
                    <Button
                        text="Отмена"
                        onClick={() => setFiltersModalWindowVisible(false)}
                        palette={ADMIN_PALETTE.GRAY}
                    />
                </ModalFooter>
            </FiltersModalWindow>

            {/* Модальное окно выбора столбца для группировки */}
            <GrouppingModalWindow>
                <ModalBody>
                    <div className="groupping-modal-body">
                        <label>Столбец для группировки:</label>
                        <Select
                            initValue={groupingColumn}
                            onChange={setGroupingColumn}
                        >
                            <OptionGroup label="Базовые поля">
                                {basicFields.map(field => (
                                    <Option
                                        value={field}
                                        label={FIELD_NAMES[field]}
                                    />
                                ))}
                            </OptionGroup>
                        </Select>
                        <p>
                            Выбрано записей: <strong>{selectedRows.size}</strong>
                        </p>
                        <p>Будет выполнена группировка по выбранному столбцу с визуализацией данных.</p>
                    </div>
                </ModalBody>
                <ModalFooter>
                    <Button
                        text="Отмена"
                        onClick={() => setGrouppingModalVisible(false)}
                        palette={ADMIN_PALETTE.GRAY}
                    />
                    <Button
                        text="Перейти к группировке"
                        onClick={handleConfirmGrouping}
                        disabled={!groupingColumn}
                        palette={ADMIN_PALETTE.BLUE}
                    />
                </ModalFooter>
            </GrouppingModalWindow>
            <StudentModal open={!!shownStudent} student={shownStudent} onClose={() => setShowStudent(null)} />
        </div>
    );
}

export default AdminResultsView;
