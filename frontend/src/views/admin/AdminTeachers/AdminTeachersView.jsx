import { useEffect, useMemo, useState } from 'react';
import DataTable from '@components/tables/DataTable';
import LoadingSpinner from '@components/ui/LoadingSpinner.jsx';
import TeacherService from '@services/TeacherService.js';
import { buildColumns } from './buildTeachersTable.js';
import TeacherView from './TeacherView.jsx';
import './AdminTeachersView.scss';

function AdminTeachersView() {
    const [rows, setRows] = useState([]);
    const [search, setSearch] = useState('');
    const [selectedTeacher, setSelectedTeacher] = useState(null);
    const [isLoading, setLoading] = useState(true);
    const columns = useMemo(() => buildColumns(), []);

    useEffect(() => {
        let active = true;
        TeacherService.getTeachersTable()
            .then(result => {
                if (active) {
                    setRows((result.data ?? []).map(row => ({
                        ...row,
                        disciplineList: row.disciplines ?? [],
                        disciplines: row.disciplines?.length || '',
                    })));
                }
            })
            .catch(() => {})
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, []);

    const visibleRows = useMemo(
        () => rows.filter(row => row.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())),
        [rows, search]
    );

    const openTeacher = async row => {
        const result = await TeacherService.getTeacherById(row.rowId);
        setSelectedTeacher(result.data);
    };

    return (
        <div className="AdminTeachersView">
            <div className="AdminTeachersView__search">
                <input
                    type="search"
                    value={search}
                    onChange={event => setSearch(event.target.value)}
                    placeholder="Поиск преподавателя"
                    aria-label="Поиск преподавателя"
                />
                <span>{visibleRows.length}</span>
            </div>
            {isLoading ? <LoadingSpinner text="Загрузка преподавателей" /> : (
                <DataTable
                    rows={visibleRows}
                    columns={columns}
                    cellClickHandlers={{ name: openTeacher, disciplines: openTeacher }}
                    rowKey="rowId"
                    pageSize={20}
                    selection={false}
                />
            )}
            {selectedTeacher && (
                <TeacherView teacher={selectedTeacher} onClose={() => setSelectedTeacher(null)} />
            )}
        </div>
    );
}

export default AdminTeachersView;
