import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import ExcelJS from 'exceljs';

import { AdminService } from '@services';
import { defaultQueryOptions } from '@utils/queryConfig';
import { COMPETENCIES_NAMES, FIELD_NAMES, MOTIVATORS_NAMES, VALUES_NAMES, downloadExcelWorkbook } from '@utils/utilities.js';
import { useAdminStore } from '@utils/store.jsx';

import FlexColumn from '@components/FlexColumn.jsx';
import FlexRow, { WRAP } from '@components/FlexRow.jsx';
import LabelledBox from '@components/LabelledBox.jsx';
import { ModalBody, ModalFooter, useModalWindow } from '@components/ModalWindow.jsx';
import DataTable from '@components/tables/DataTable';
import Button from '@components/ui/Button.jsx';
import ColorBox, { BOX_COLOR } from '@components/ui/ColorBox.jsx';
import Dropdown from '@components/ui/Dropdown.jsx';
import Label from '@components/ui/Label.jsx';
import LoadingSpinner from '@components/ui/LoadingSpinner.jsx';
import MultiSelect from '@components/ui/MultiSelect.jsx';
import NumberField from '@components/ui/NumberField.jsx';
import { ADMIN_PALETTE } from '@components/ui/palette.js';
import Select, { Option, OptionGroup } from '@components/ui/Select.jsx';
import StudentModal from '@components/ui/StudentModal.jsx';

import { buildStudentColumns } from './buildStudentTable.js';
import './AdminResultsView.scss';

const BASIC_FIELDS = ['res_year', 'part_gender', 'center', 'institution', 'edu_level', 'res_course_num', 'study_form', 'specialty'];

const COLUMN_GROUPS = {
    'Основная информация': [
        'res_year',
        'participant',
        'part_gender',
        'center',
        'institution',
        'edu_level',
        'res_course_num',
        'study_form',
        'specialty'
    ],
    Компетенции: Object.keys(COMPETENCIES_NAMES),
    Мотиваторы: Object.keys(MOTIVATORS_NAMES),
    Ценности: Object.keys(VALUES_NAMES)
};

const COLUMN_ORDER = Object.values(COLUMN_GROUPS).flat();

const NUMERIC_GROUPS = {
    Компетенции: Object.keys(COMPETENCIES_NAMES),
    Мотиваторы: Object.keys(MOTIVATORS_NAMES),
    Ценности: Object.keys(VALUES_NAMES)
};

const NUMERIC_OPTIONS = Object.entries(NUMERIC_GROUPS).flatMap(([group, fields]) =>
    fields.map(field => ({
        id: field,
        name: `${group}: ${FIELD_NAMES[field]}`
    }))
);

const getFilterFields = filter => filter.fields ?? (filter.field ? [filter.field] : []);

const getNumericFilterLabel = filter => {
    const selectedFields = getFilterFields(filter);
    const group = Object.entries(NUMERIC_GROUPS).find(
        ([, fields]) => fields.length === selectedFields.length && fields.every(field => selectedFields.includes(field))
    );

    if (group) return group[0];
    return selectedFields.length === 1 ? FIELD_NAMES[selectedFields[0]] : `Показатели (${selectedFields.length})`;
};

export const expandFilters = filters =>
    filters.flatMap(filter =>
        filter.type === 'numeric'
            ? getFilterFields(filter).map(field => ({
                  id: `${filter.id}_${field}`,
                  type: 'numeric',
                  field,
                  min: filter.min,
                  max: filter.max
              }))
            : [filter]
    );

function AdminResultsView() {
    const resultsView = useAdminStore(state => state.resultsView);
    const setResultsView = useAdminStore(state => state.setResultsView);
    const filters = resultsView?.filters ?? [];
    const hiddenColumns = new Set(resultsView?.hiddenColumns ?? []);

    const [shownStudent, setShownStudent] = useState(null);
    const [selectedRows, setSelectedRows] = useState(new Set());
    const [resultLimit, setResultLimit] = useState(1000);
    const [showColumnSelector, setShowColumnSelector] = useState(false);
    const [pendingFilters, setPendingFilters] = useState(() => filters);
    const [exportLoading, setExportLoading] = useState(false);
    const [groupingColumn, setGroupingColumn] = useState('');
    const navigate = useNavigate();

    const [FiltersModalWindow, , setFiltersModalWindowVisible] = useModalWindow('Фильтры');
    const [GroupingModalWindow, , setGroupingModalVisible] = useModalWindow('Выбор группировки');

    const {
        data: resultsData,
        isPending: loading,
        refetch
    } = useQuery({
        queryKey: ['admin', 'results', filters, resultLimit],
        queryFn: () => AdminService.postDataseshExtractData(expandFilters(filters), 0, resultLimit),
        ...defaultQueryOptions
    });

    const results = resultsData?.results ?? [];
    const totalCount = resultsData?.filtered_count ?? 0;
    const availableValues = resultsData?.available_values ?? {};
    const hasMore = results.length < totalCount;

    const loadMoreData = () => {
        if (!hasMore || loading) return;
        setResultLimit(current => current + 1000);
    };

    const handleRefresh = () => {
        setSelectedRows(new Set());
        refetch();
    };

    const handleExportSelected = async () => {
        const selected = rows.filter(row => selectedRows.has(row.res_id));
        if (!selected.length) {
            alert('Выберите записи для выгрузки (флажки в первом столбце)');
            return;
        }

        setExportLoading(true);
        try {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Результаты тестирования');

            worksheet.columns = columns.map(column => ({
                header: column.title,
                key: column.id,
                width: Math.min(Math.max(column.title.length + 2, 12), 40)
            }));

            selected.forEach(row => {
                worksheet.addRow(
                    Object.fromEntries(
                        columns.map(column => {
                            const value = row[column.id];
                            const displayValue = column.results && (value == null || Number(value) === 0) ? '' : value;
                            return [column.id, displayValue ?? ''];
                        })
                    )
                );
            });

            worksheet.getRow(1).font = { bold: true };
            worksheet.views = [{ state: 'frozen', ySplit: 1 }];

            await downloadExcelWorkbook(workbook, `selected_results_${new Date().toISOString().split('T')[0]}.xlsx`);
        } catch (error) {
            console.error('Export error:', error);
            alert('Ошибка при выгрузке данных');
        } finally {
            setExportLoading(false);
        }
    };

    const openFilters = () => {
        setPendingFilters(filters);
        setFiltersModalWindowVisible(true);
    };

    const addBasicFilter = field => {
        setPendingFilters(current => [
            ...current,
            {
                id: Date.now(),
                type: 'basic',
                field,
                selectedValues: []
            }
        ]);
    };

    const addNumericFilter = groupOrField => {
        setPendingFilters(current => [
            ...current,
            {
                id: Date.now(),
                type: 'numeric',
                fields: NUMERIC_GROUPS[groupOrField] ?? [groupOrField],
                min: 400,
                max: 800
            }
        ]);
    };

    const updatePendingFilter = (filterId, patch) => {
        setPendingFilters(current => current.map(filter => (filter.id === filterId ? { ...filter, ...patch } : filter)));
    };

    const removePendingFilter = filterId => {
        setPendingFilters(current => current.filter(filter => filter.id !== filterId));
    };

    const applyFilters = async () => {
        setResultsView({ filters: pendingFilters });
        await loadData(pendingFilters);
        setFiltersModalWindowVisible(false);
    };

    const clearAllFilters = async () => {
        setPendingFilters([]);
        setResultsView({ filters: [] });
        await loadData([]);
    };

    const canApplyFilters =
        pendingFilters.length > 0 &&
        pendingFilters.every(filter =>
            filter.type === 'basic'
                ? filter.selectedValues?.length > 0
                : getFilterFields(filter).length > 0 &&
                  Number.isFinite(filter.min) &&
                  Number.isFinite(filter.max) &&
                  filter.min <= filter.max
        );

    const toggleColumn = columnKey => {
        const newHidden = new Set(hiddenColumns);
        if (newHidden.has(columnKey)) {
            newHidden.delete(columnKey);
        } else {
            newHidden.add(columnKey);
        }
        setResultsView({ hiddenColumns: [...newHidden] });
    };

    const toggleColumnGroup = groupColumns => {
        const allGroupHidden = groupColumns.every(column => hiddenColumns.has(column));
        const newHidden = new Set(hiddenColumns);

        groupColumns.forEach(column => {
            if (allGroupHidden) {
                newHidden.delete(column);
            } else {
                newHidden.add(column);
            }
        });

        setResultsView({ hiddenColumns: [...newHidden] });
    };

    const handleGrouping = () => {
        if (!selectedRows.size) {
            alert('Выберите записи для группировки (флажки в первом столбце)');
            return;
        }
        setGroupingModalVisible(true);
    };

    const handleConfirmGrouping = () => {
        if (!groupingColumn) {
            alert('Выберите столбец для группировки');
            return;
        }

        navigate('/admin/grouping', {
            state: {
                selectedIds: Array.from(selectedRows),
                groupingColumn,
                filters: expandFilters(filters)
            }
        });
    };

    const rows = useMemo(
        () =>
            results.map(row => ({
                rowId: row.res_id,
                ...row,
                ...row.participant,
                ...row.competences,
                ...row.motivators,
                ...row.values,
                participant: row.participant?.part_rsv_id ?? null
            })),
        [results]
    );

    const allColumns = useMemo(() => buildStudentColumns(), []);
    const columns = useMemo(
        () => allColumns.filter(column => !column.id || !hiddenColumns.has(column.id)),
        [allColumns, resultsView?.hiddenColumns]
    );

    return (
        <div className="AdminResultsView">
            <div className="results-container">
                <div className="results-header">
                    <h2>Результаты тестирования</h2>
                    <FlexRow wrap={WRAP.DO}>
                        <Button
                            text="Фильтры..."
                            onClick={openFilters}
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

                {showColumnSelector && (
                    <div className="column-selector">
                        <div className="column-selector-header">
                            <h3>Управление колонками</h3>
                            <div className="column-selector-controls">
                                <Button
                                    text="Показать все"
                                    onClick={() => setResultsView({ hiddenColumns: [] })}
                                    disabled={loading}
                                    palette={ADMIN_PALETTE.BLUE}
                                />
                                <Button
                                    text="Скрыть все"
                                    onClick={() => setResultsView({ hiddenColumns: COLUMN_ORDER })}
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
                            {Object.entries(COLUMN_GROUPS).map(([groupName, groupColumns]) => {
                                const visibleCount = groupColumns.filter(column => !hiddenColumns.has(column)).length;
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
                                                    ref={element => {
                                                        if (element) {
                                                            element.indeterminate = visibleCount > 0 && visibleCount < groupColumns.length;
                                                        }
                                                    }}
                                                />
                                                <span className="group-name">
                                                    {groupName} ({visibleCount}/{groupColumns.length})
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
                    {loading && !results.length ? (
                        <div className="loading">
                            <LoadingSpinner text="Загрузка данных..." />
                        </div>
                    ) : (
                        <DataTable
                            rows={rows}
                            columns={columns}
                            rowKey="rowId"
                            cellClickHandlers={setShownStudent}
                            onSelectionChange={selected => setSelectedRows(new Set(selected.map(row => row.res_id)))}
                            _selectedRows={rows.filter(row => selectedRows.has(row.res_id))}
                            pageSize={20}
                        />
                    )}
                </div>

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
                                <span>Базовый (200-399)</span>
                            </FlexRow>
                        </FlexRow>
                    </Label>

                    <Label>
                        Колонок: {columns.length - 1}/{COLUMN_ORDER.length} • Записей: {results.length}
                        {hasMore && '+'} • Выбрано: {selectedRows.size}
                    </Label>

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

            <FiltersModalWindow>
                <ModalBody>
                    <div className="filters-modal-body">
                        <FlexRow wrap={WRAP.DO}>
                            <Dropdown label="+ Добавить фильтр">
                                <OptionGroup label="Базовые поля">
                                    {BASIC_FIELDS.map(field => (
                                        <Option
                                            key={field}
                                            value={field}
                                            label={FIELD_NAMES[field]}
                                            onClick={addBasicFilter}
                                        />
                                    ))}
                                </OptionGroup>
                                {Object.entries(NUMERIC_GROUPS).map(([group, fields]) => (
                                    <OptionGroup
                                        key={group}
                                        label={group}
                                    >
                                        <Option
                                            value={group}
                                            label={`Все: ${group.toLowerCase()}`}
                                            onClick={addNumericFilter}
                                        />
                                        {fields.map(field => (
                                            <Option
                                                key={field}
                                                value={field}
                                                label={FIELD_NAMES[field]}
                                                onClick={addNumericFilter}
                                            />
                                        ))}
                                    </OptionGroup>
                                ))}
                            </Dropdown>
                            <Button
                                text={loading ? 'Загрузка...' : 'Применить'}
                                onClick={applyFilters}
                                disabled={!canApplyFilters || loading}
                                palette={ADMIN_PALETTE.GREEN}
                            />
                            {(pendingFilters.length > 0 || filters.length > 0) && (
                                <Button
                                    text="Очистить"
                                    onClick={clearAllFilters}
                                    disabled={loading}
                                    palette={ADMIN_PALETTE.RED}
                                />
                            )}
                        </FlexRow>

                        {pendingFilters.length > 0 && (
                            <>
                                <h6>Выбранные фильтры:</h6>
                                <FlexColumn className="pending-filters-column">
                                    {pendingFilters.map(filter => (
                                        <LabelledBox
                                            key={filter.id}
                                            label={filter.type === 'basic' ? FIELD_NAMES[filter.field] : getNumericFilterLabel(filter)}
                                            bordered
                                        >
                                            <FlexColumn className="pending-filter">
                                                <MultiSelect
                                                    options={filter.type === 'basic' ? availableValues[filter.field] : NUMERIC_OPTIONS}
                                                    value={filter.type === 'basic' ? filter.selectedValues : getFilterFields(filter)}
                                                    onChange={values =>
                                                        updatePendingFilter(
                                                            filter.id,
                                                            filter.type === 'basic' ? { selectedValues: values } : { fields: values }
                                                        )
                                                    }
                                                    placeholder={filter.type === 'basic' ? 'Выберите значения' : 'Выберите показатели'}
                                                    withSearch
                                                />
                                                <FlexRow>
                                                    {filter.type === 'numeric' && (
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
                                                                    onChange={min => updatePendingFilter(filter.id, { min })}
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
                                                                    onChange={max => updatePendingFilter(filter.id, { max })}
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
                                            </FlexColumn>
                                        </LabelledBox>
                                    ))}
                                </FlexColumn>
                            </>
                        )}

                        {filters.length > 0 && (
                            <>
                                <h6>Активные фильтры:</h6>
                                <FlexRow
                                    className="active-filters-row"
                                    wrap={WRAP.DO}
                                >
                                    {filters.map(filter => (
                                        <Label
                                            key={filter.id}
                                            text={
                                                filter.type === 'basic'
                                                    ? `${FIELD_NAMES[filter.field]}: ${filter.selectedValues.join(', ')}`
                                                    : `${getNumericFilterLabel(filter)}: ${filter.min}–${filter.max}`
                                            }
                                        />
                                    ))}
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

            <GroupingModalWindow>
                <ModalBody>
                    <div className="groupping-modal-body">
                        <label>Столбец для группировки:</label>
                        <Select
                            initValue={groupingColumn}
                            onChange={setGroupingColumn}
                        >
                            <OptionGroup label="Базовые поля">
                                {BASIC_FIELDS.map(field => (
                                    <Option
                                        key={field}
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
                        onClick={() => setGroupingModalVisible(false)}
                        palette={ADMIN_PALETTE.GRAY}
                    />
                    <Button
                        text="Перейти к группировке"
                        onClick={handleConfirmGrouping}
                        disabled={!groupingColumn}
                        palette={ADMIN_PALETTE.BLUE}
                    />
                </ModalFooter>
            </GroupingModalWindow>

            <StudentModal
                open={!!shownStudent}
                student={shownStudent}
                onClose={() => setShownStudent(null)}
            />
        </div>
    );
}

export default AdminResultsView;
