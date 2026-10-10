import DataTable from '@components/tables/DataTable';
import './AdminTeachersView.scss';
import { useEffect, useState } from 'react';
import { buildColumns } from './buildTeachersTable.js';
import TeacherView from './TeacherView.jsx';
import TeacherService from '@services/TeacherService.js';
import LoadingSpinner from '@components/ui/LoadingSpinner.jsx';

function AdminTeachersView() {
    const [showTeacherView, setShowTeacherView] = useState(false);
    const [openDisciplinesModal, setOpenDisciplinesModal] = useState(false);
    const [disciplinesList, setDisciplinesList] = useState([]);
    const [isTableLoading, setTableLoading] = useState(false);
    const columns = buildColumns();
    const rows = [];
    // disciplines = [], надо будет кол-во в ячейке писать / если 1, то дисциплину

    const getTeachersTable = async () => {
        try {
            setTableLoading(true);
            const data = await TeacherService.getTeachersTable();
            rows = data ?? [];
        }
        catch (e) {}
        finally{
            setTableLoading(false);
        }
    }
    const cellClickHandler = (row, column) => {
        if (column.id === 'name') {
            setShowTeacherView(true);
        }
        else if (column.id === 'disciplines') {
            showDisciplinesModal(row);
        }
    }
    function showDisciplinesModal(row) {
        setOpenDisciplinesModal(true);
        setDisciplinesList(row.disciplines);
    }

    useEffect( async () => {
        await getTeachersTable();
    }, []);

    // вверху поиск препода, снизу таблица всех
    return (
        <div className="AdminTeachersView">
            <div className="AdminTeachersView__search">
                <input type="text" placeholder="Поиск преподавателя..." />
            </div>
            { showTeacherView && (
                <div className="AdminTeachersView__teacher-view">
                    <TeacherView />
                </div>
            )}
            { isTableLoading ? <LoadingSpinner text={'Загрузка таблицы'}/>
            : <DataTable
                rows={rows}
                columns={columns}
                cellClickHandlers={cellClickHandler}
                rowKey={'rowId'}
                pageSize={20}
            />}

            { openDisciplinesModal && (
                <div className={`AdminTeachersView__disciplines-modal`}>
                    <div className="AdminTeachersView__disciplines-modal-content">
                        {disciplinesList.map((discipline, index) => (
                            <div key={index} className="AdminTeachersView__discipline-item">
                                {discipline}
                            </div>
                        ))}
                    </div>
                </div>
            ) }
        </div>
    );
}

export default AdminTeachersView;
