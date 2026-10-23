import StudentService from '@services/StudentService.ts';
import './AdminTargetSearchView.scss';
import SearchPanel from './SearchPanel.jsx';
import { useState } from 'react';

function AdminTargetSearchView() {
	const [ loading, setLoading ] = useState(false);
	const requirements = {
		requirements,
		specialtyIds,
		courses,
		limit,
		offset, // сколько пропустить, если постранично загружаем
	}
	const studentSearchRequest = async () => {
		try {
			setLoading(true);
			const data = await StudentService.getStudentByRequirements(StudentRequirementInput);
			rows = data ?? [];
		} catch (e) {
		} finally {
			setLoading(false);
		}
	};
    function onApply() {}
    return (
        <div>
            <div>Поиск студента</div>
            <SearchPanel onApply={onApply} loading={loading}/>
        </div>
    );
}

export default AdminTargetSearchView;
