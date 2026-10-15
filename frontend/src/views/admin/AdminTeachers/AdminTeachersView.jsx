import DataTable from '@components/tables/DataTable';
import './AdminTeachersView.scss';
import { useEffect, useState, useLayoutEffect, useRef } from 'react';
import { buildColumns } from './buildTeachersTable.js';
import TeacherView from './TeacherView.jsx';
import TeacherService from '@services/TeacherService.js';
import LoadingSpinner from '@components/ui/LoadingSpinner.jsx';
import { AutocompleteInput } from '../../../components/index.js';
// тестовое
const teachers = [
    {
        name: 'Иванов Иван Петрович',
        gender: 'Мужской',
        position: 'Профессор',
        disciplines: ['Математический анализ', 'Линейная алгебра'],
        institution: 'МГУ имени М. В. Ломоносова',
        edu_level: 'Высшее',
        academic_degree: 'Доктор физико-математических наук',
        academic_title: 'Профессор',
        qualification: 'Математик',
        experience: 18
    },
    {
        name: 'Петрова Анна Сергеевна',
        gender: 'Женский',
        position: 'Доцент',
        disciplines: ['Программирование', 'Базы данных'],
        institution: 'НИУ ВШЭ',
        edu_level: 'Высшее',
        academic_degree: 'Кандидат технических наук',
        academic_title: 'Доцент',
        qualification: 'Инженер-программист',
        experience: 12
    },
    {
        name: 'Сидоров Алексей Викторович',
        gender: 'Мужской',
        position: 'Старший преподаватель',
        disciplines: ['Физика', 'Электротехника'],
        institution: 'МГТУ имени Н. Э. Баумана',
        edu_level: 'Высшее',
        academic_degree: 'Кандидат физико-математических наук',
        academic_title: 'Отсутствует',
        qualification: 'Инженер-физик',
        experience: 9
    },
    {
        name: 'Кузнецова Мария Андреевна',
        gender: 'Женский',
        position: 'Доцент',
        disciplines: ['Экономика', 'Финансовый менеджмент'],
        institution: 'РЭУ имени Г. В. Плеханова',
        edu_level: 'Высшее',
        academic_degree: 'Кандидат экономических наук',
        academic_title: 'Доцент',
        qualification: 'Экономист',
        experience: 12
    },
    {
        name: 'Смирнов Дмитрий Олегович',
        gender: 'Мужской',
        position: 'Ассистент',
        disciplines: ['Алгоритмы и структуры данных', 'Веб-разработка'],
        institution: 'Университет ИТМО',
        edu_level: 'Магистратура',
        academic_degree: 'Отсутствует',
        academic_title: 'Отсутствует',
        qualification: 'Разработчик программного обеспечения',
        experience: 3
    },
    {
        name: 'Васильева Елена Николаевна',
        gender: 'Женский',
        position: 'Профессор',
        disciplines: ['Педагогика', 'Психология образования'],
        institution: 'РГПУ имени А. И. Герцена',
        edu_level: 'Высшее',
        academic_degree: 'Доктор педагогических наук',
        academic_title: 'Профессор',
        qualification: 'Педагог-психолог',
        experience: 20
    },
    {
        name: 'Морозов Павел Игоревич',
        gender: 'Мужской',
        position: 'Доцент',
        disciplines: ['Машинное обучение', 'Искусственный интеллект', 'Анализ данных'],
        institution: 'МФТИ',
        edu_level: 'Высшее',
        academic_degree: 'Кандидат технических наук',
        academic_title: 'Доцент',
        qualification: 'Специалист по анализу данных',
        experience: 7
    }
];

function AdminTeachersView() {
    const [isTableLoading, setTableLoading] = useState(false);
    const [shownTeacher, setShownTeacher] = useState(null);
    const [showTeacherView, setShowTeacherView] = useState(false);

    const [openDisciplinesModal, setOpenDisciplinesModal] = useState(false);
    const [disciplinesList, setDisciplinesList] = useState([]);
    const [modalPosition, setModalPosition] = useState({ x: 0, y: 0 });
    const modalRef = useRef(null);

    const columns = buildColumns();
    let rows = teachers.map((r, index) => ({ ...r, rowId: index + 1 }));
    const tableRows = rows.map(r => ({ ...r, disciplines: r.disciplines.length }));
    const searchOptions = rows.map(r => ({
        label: `${r.name}, ${r.position} | ${r.institution}`,
        value: r.rowId
    }));

    const getTeachersTable = async () => {
        try {
            setTableLoading(true);
            const data = await TeacherService.getTeachersTable();
            rows = data ?? [];
        } catch (e) {
        } finally {
            setTableLoading(false);
        }
    };
    function cellClickHandler(row, column) {
        if (column.id === 'name') {
            const teacher = rows.find(r => r.rowId === row.rowId);
            console.log(teacher);
            setShownTeacher(teacher);
            setShowTeacherView(true);
        } else if (column.id === 'disciplines') {
            const disciplines = rows.find(r => r.rowId === row.rowId).disciplines;
            showDisciplinesModal(disciplines);
        }
    }
    function showDisciplinesModal(disciplines) {
        setDisciplinesList(disciplines);
        setModalPosition({ x: event.clientX, y: event.clientY });
        setOpenDisciplinesModal(true);
    }
    function onInputChange(val) {
        const teacher = rows.find(r => r.rowId === val);
        if (!teacher) return;
        setShownTeacher(teacher);
        setShowTeacherView(true);
    }
    function handleCloseTeacher() {
        setShowTeacherView(!showTeacherView);
        setShownTeacher(null);
    }
    useEffect(() => {
        getTeachersTable();
    }, []);
    useEffect(() => {
        if (!openDisciplinesModal) return;

        const handleClickOutside = event => {
            if (!event.target.closest('.AdminTeachersView__disciplines-modal')) {
                setOpenDisciplinesModal(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [openDisciplinesModal]);

    useLayoutEffect(() => {
        if (!openDisciplinesModal || !modalRef.current) return;

        const modal = modalRef.current;
        const rect = modal.getBoundingClientRect();
        const padding = 8;

        const x = Math.max(padding, Math.min(modalPosition.x, window.innerWidth - rect.width - padding));
        const y = Math.max(padding, Math.min(modalPosition.y, window.innerHeight - rect.height - padding));

        modal.style.left = `${x}px`;
        modal.style.top = `${y}px`;
    }, [openDisciplinesModal, modalPosition]);

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
                    <div
                        className="AdminTeachersView__search-close"
                        onClick={() => handleCloseTeacher()}
                    >
                        {' '}
                        X Закрыть
                    </div>
                )}
            </div>
            {showTeacherView && (
                <div className="AdminTeachersView__teacher-view">
                    <TeacherView teacher={shownTeacher} />
                </div>
            )}
            {isTableLoading ? (
                <LoadingSpinner text={'Загрузка таблицы'} />
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

            {openDisciplinesModal && (
                <div
                    ref={modalRef}
                    className={`AdminTeachersView__disciplines-modal`}
                    style={{
                        left: modalPosition.x,
                        top: modalPosition.y
                    }}
                >
                    <div className="AdminTeachersView__disciplines-modal-content">
                        {disciplinesList.map((discipline, index) => (
                            <div
                                key={index}
                                className="AdminTeachersView__discipline-item"
                            >
                                {discipline}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export default AdminTeachersView;
