import './AdminTeachersView.scss';

import ExcelJS from 'exceljs';
import { defaultQueryOptions } from '@utils/queryConfig';
import { downloadExcelWorkbook } from '@utils/utilities';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState, useLayoutEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

import { buildColumns } from './buildTeachersTable.js';
import TeacherService from '@services/TeacherService.ts';

import TeacherView from './TeacherView.jsx';
import ScientificActivity from '@components/science/ScientificActivity';
import DataTable from '@components/tables/DataTable';
import Loading from '@components/ui/Loading.jsx';
import { AutocompleteInput, Button } from '../../../components/index.js';
import { toast } from 'react-toastify';

const EDUCATION_DETAILS_LABELS = {
    education_type: 'Тип образования',
    direction: 'Направление',
    qualification: 'Квалификация'
};

const formatEducationDetails = details => {
    if (!Array.isArray(details) || details.length === 0) return '—';
    return details.length >= 2 ? details[1] : details[0];
};

const educationDetailsItems = teacher => {
    const educations =
        Array.isArray(teacher.education) && teacher.education.length
            ? teacher.education
            : Array.isArray(teacher.educationDetails)
              ? teacher.educationDetails
              : [];
    return educations.map(item => {
        if (typeof item === 'string') return item;
        const parts = Object.entries(EDUCATION_DETAILS_LABELS)
            .map(([key, label]) => [label, (item[key] ?? '').toString().trim()])
            .filter(([, value]) => value.length > 0)
            .map(([label, value]) => `${label}: ${value}`);
        return parts.length > 0 ? parts.join('; ') : '—';
    });
};

function AdminTeachersView() {
    const [shownTeacher, setShownTeacher] = useState(null);
    const [showTeacherView, setShowTeacherView] = useState(false);
    const [selectedRows, setSelectedRows] = useState([]);
    const [exportLoading, setExportLoading] = useState(false);

    const [openListModal, setOpenListModal] = useState(false);
    const [listItems, setListItems] = useState([]);
    const [modalPosition, setModalPosition] = useState({ x: 0, y: 0 });
    const modalRef = useRef(null);

    const navigate = useNavigate();

    const { data: teachersResponse, isPending: isTableLoading } = useQuery({
        queryKey: ['admin', 'teachers-table'],
        queryFn: () => TeacherService.getTeachersTable(),
        enabled: true,
        ...defaultQueryOptions
    });
    const dataRows = teachersResponse?.data ?? [];
    const columns = useMemo(() => buildColumns(), []);
    const tableRows = useMemo(
        () =>
            dataRows.map((r, index) => {
                const educationDetails = Array.isArray(r.education_details) ? r.education_details : [];
                const professionalDevelopment = Array.isArray(r.professional_development) ? r.professional_development : [];
                const professionalRetraining = Array.isArray(r.professional_retraining) ? r.professional_retraining : [];
                return {
                    ...r,
                    rowId: index + 1,
                    educationDetails,
                    professionalDevelopment,
                    professionalRetraining,
                    education_details: formatEducationDetails(educationDetails),
                    professional_development: professionalDevelopment.length,
                    professional_retraining: professionalRetraining.length
                };
            }),
        [dataRows]
    );
    const searchOptions = useMemo(
        () =>
            tableRows.map(r => ({
                label: `${r.name}, ${r.position} | ${r.institution}`,
                value: r.rowId
            })),
        [tableRows]
    );

    function cellClickHandler(row, column, event) {
        const teacher = tableRows.find(r => r.rowId === row.rowId);
        if (!teacher) return;

        if (column.id === 'name') {
            setShownTeacher(teacher);
            setShowTeacherView(true);
        } else if (column.id === 'disciplines') {
            showListModal(teacher.disciplines, event);
        } else if (column.id === 'education_details') {
            showListModal(educationDetailsItems(teacher), event);
        } else if (column.id === 'professional_development') {
            showListModal(teacher.professionalDevelopment, event);
        } else if (column.id === 'professional_retraining') {
            showListModal(teacher.professionalRetraining, event);
        }
    }
    function showListModal(items, event) {
        if (!items?.length) return;
        setListItems(items);
        setModalPosition({ x: event.clientX, y: event.clientY });
        setOpenListModal(true);
    }
    function onInputChange(val) {
        const teacher = tableRows.find(r => r.rowId === val);
        if (!teacher) return;
        setShownTeacher(teacher);
        setShowTeacherView(true);
    }
    function handleCloseTeacher() {
        setShowTeacherView(!showTeacherView);
        setShownTeacher(null);
    }
    function redirectToPortrait() {
        if (shownTeacher) {
            navigate('/admin/portrait', { state: { teacherId: shownTeacher.id } });
        }
    }

    const getExportValue = (teacher, columnId) => {
        switch (columnId) {
            case 'disciplines':
                return Array.isArray(teacher.disciplines) ? teacher.disciplines.join('; ') : (teacher.disciplines ?? '');
            case 'education_details':
                return educationDetailsItems(teacher).join('; ');
            case 'professional_development':
                return teacher.professionalDevelopment.join('; ');
            case 'professional_retraining':
                return teacher.professionalRetraining.join('; ');
            default:
                return teacher[columnId] ?? '';
        }
    };

    async function handleExportSelected() {
        if (!selectedRows.length) return;

        setExportLoading(true);
        try {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Преподаватели');
            const exportColumns = columns.filter(column => column.id !== 'rowId');

            worksheet.columns = exportColumns.map(column => ({
                header: column.title,
                key: column.id,
                width: Math.min(Math.max(column.title.length + 2, 12), 60)
            }));

            selectedRows.forEach(teacher => {
                worksheet.addRow(Object.fromEntries(exportColumns.map(column => [column.id, getExportValue(teacher, column.id)])));
            });

            worksheet.getRow(1).font = { bold: true };
            worksheet.views = [{ state: 'frozen', ySplit: 1 }];

            await downloadExcelWorkbook(workbook, `teachers_${new Date().toISOString().split('T')[0]}.xlsx`);
        } catch (error) {
            console.error('Export error:', error);
            toast.error('Ошибка при выгрузке данных');
        } finally {
            setExportLoading(false);
        }
    }

    useEffect(() => {
        if (!openListModal) return;

        const handleClickOutside = event => {
            if (!event.target.closest('.AdminTeachersView__list-modal')) {
                setOpenListModal(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [openListModal]);

    useLayoutEffect(() => {
        if (!openListModal || !modalRef.current) return;

        const modal = modalRef.current;
        const rect = modal.getBoundingClientRect();
        const padding = 8;

        const x = Math.max(padding, Math.min(modalPosition.x, window.innerWidth - rect.width - padding));
        const y = Math.max(padding, Math.min(modalPosition.y, window.innerHeight - rect.height - padding));

        modal.style.left = `${x}px`;
        modal.style.top = `${y}px`;
    }, [openListModal, modalPosition]);

    return (
        <div className="AdminTeachersView">
            <ScienceTab />
            <div className="AdminTeachersView__search">
                <AutocompleteInput
                    type="text"
                    placeholder="Поиск преподавателя..."
                    onChange={onInputChange}
                    value={shownTeacher?.name}
                    options={searchOptions}
                />
                {showTeacherView && (
                    <div className="AdminTeachersView__search_actions">
                        <Button
                            text={'Перейти к профилю'}
                            onClick={() => redirectToPortrait()}
                        />
                        <Button
                            text={'X Закрыть'}
                            type="cancel"
                            className="AdminTeachersView__search-close"
                            onClick={() => handleCloseTeacher()}
                        />
                    </div>
                )}
            </div>
            {showTeacherView && (
                <div className="AdminTeachersView__teacher-view">
                    <TeacherView teacher={shownTeacher} />
                </div>
            )}
            {selectedRows.length > 0 && (
                <div className="AdminTeachersView__btn-container">
                    <Button
                        type="accept"
                        text={exportLoading ? 'Загрузка...' : `Выгрузить выбранные (${selectedRows.length})`}
                        loading={exportLoading}
                        onClick={handleExportSelected}
                    />
                </div>
            )}
            <div className="AdminTeachersView__table">
                {isTableLoading ? (
                    <Loading
                        type="table"
                        title="Загрузка таблицы"
                    />
                ) : (
                    <DataTable
                        rows={tableRows}
                        columns={columns}
                        cellClickHandlers={cellClickHandler}
                        rowKey={'rowId'}
                        pageSize={10}
                        _selectedRows={shownTeacher ? [shownTeacher] : []}
                        onSelectionChange={setSelectedRows}
                    />
                )}
            </div>

            {openListModal && (
                <div
                    ref={modalRef}
                    className={`AdminTeachersView__list-modal`}
                    style={{
                        left: modalPosition.x,
                        top: modalPosition.y
                    }}
                >
                    <div className="AdminTeachersView__list-modal-content">
                        {listItems.map((item, index) => (
                            <div
                                key={index}
                                className="AdminTeachersView__list-item"
                            >
                                {item}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export default AdminTeachersView;

/** @description Toggle the scientific activity dashboard from the teachers page. */
function ScienceTab() {
    const [open, setOpen] = useState(false);
    return (
        <div className="AdminTeachersView__science">
            <Button text={open ? 'Скрыть научную деятельность' : 'Научная деятельность'} onClick={() => setOpen(!open)} />
            {open && <ScientificActivity />}
        </div>
    );
}
