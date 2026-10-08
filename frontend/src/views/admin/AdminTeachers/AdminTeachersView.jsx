import DataTable from '@components/tables/DataTable';
import './AdminTeachersView.scss';
import { buildColumns } from './buildTeachersTable.js';

function AdminTeachersView() {
    // вверху поиск препода, снизу таблица всех
    return (
        <div className="AdminTeachersView">
            <DataTable />
        </div>
    );
}

export default AdminTeachersView;
