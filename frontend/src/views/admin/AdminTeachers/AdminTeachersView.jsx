import './AdminTeachersView.scss';

import { defaultQueryOptions } from '@utils/queryConfig';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState, useLayoutEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

import { buildColumns } from './buildTeachersTable.js';
import TeacherService from '@services/TeacherService.ts';

import TeacherView from './TeacherView.jsx';
import DataTable from '@components/tables/DataTable';
import Loading from '@components/ui/Loading.jsx';
import { AutocompleteInput, Button } from '../../../components/index.js';

// education_details: [тип образования, направление, ..., степень]
const EDUCATION_DETAILS_LABELS = ['Тип образования', 'Направление', 'Степень'];

const formatEducationDetails = details => {
    if (!Array.isArray(details) || details.length === 0) return '—';
    return details.length >= 2 ? details[1] : details[0];
};

const educationDetailsItems = details => {
    const lastIndex = details.length - 1;
    return details.map((item, index) => {
        const label =
            index === 0
                ? EDUCATION_DETAILS_LABELS[0]
                : index === lastIndex && lastIndex > 1
                    ? EDUCATION_DETAILS_LABELS[2]
                    : EDUCATION_DETAILS_LABELS[1];
        return `${label}: ${item}`;
    });
};

function AdminTeachersView() {
    const [shownTeacher, setShownTeacher] = useState(null);
    const [showTeacherView, setShowTeacherView] = useState(false);

    const [openListModal, setOpenListModal] = useState(false);
    const [listItems, setListItems] = useState([]);
    const [modalPosition, setModalPosition] = useState({ x: 0, y: 0 });
    const modalRef = useRef(null);

	const navigate = useNavigate();

    const { data: dataRows = [], isPending: isTableLoading } = useQuery({
        queryKey: ['admin', 'teachers-table'],
        queryFn: () => TeacherService.getTeachersTable(),
        enabled: true,
        ...defaultQueryOptions
    });
    const columns = buildColumns();
    let tableRows = dataRows.length ? dataRows.map((r, index) => {
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
    }) : [];
    const searchOptions = tableRows.map(r => ({
        label: `${r.name}, ${r.position} | ${r.institution}`,
        value: r.rowId
    }));

    function cellClickHandler(row, column) {
        const teacher = tableRows.find(r => r.rowId === row.rowId);
        if (!teacher) return;

        if (column.id === 'name') {
            setShownTeacher(teacher);
            setShowTeacherView(true);
        } else if (column.id === 'disciplines') {
            showListModal(teacher.disciplines);
        } else if (column.id === 'education_details') {
            showListModal(educationDetailsItems(teacher.educationDetails));
        } else if (column.id === 'professional_development') {
            showListModal(teacher.professionalDevelopment);
        } else if (column.id === 'professional_retraining') {
            showListModal(teacher.professionalRetraining);
        }
    }
    function showListModal(items) {
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
            navigate('/admin/portrait', { state: { studentId: null } }); //shownTeacher.rowId
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
						<Button text={'Перейти к профилю'} onClick={() => redirectToPortrait()}/>
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
            {isTableLoading ? (
                <Loading type="table" title="Загрузка таблицы" />
            ) : (
                <DataTable
                    rows={tableRows}
                    columns={columns}
                    cellClickHandlers={cellClickHandler}
                    rowKey={'rowId'}
                    pageSize={20}
                    _selectedRows={shownTeacher ? [shownTeacher] : []}
                />
            )}

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
