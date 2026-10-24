import StudentService from '@services/StudentService.ts';
import './AdminTargetSearchView.scss';
import SearchPanel from './SearchPanel.jsx';
import { useState } from 'react';
import { defaultQueryOptions } from '@utils/queryConfig';
import { useQuery } from '@tanstack/react-query';

function AdminTargetSearchView() {
	const [startSearch, setStartSearch ] = useState(false);
	const StudentRequirementInput = {
		requirements,
		specialtyIds,
		courses,
		limit,
		offset, // сколько пропустить, если постранично загружаем
	}

	const { data: rows = [], isPending: loading } = useQuery({
		queryKey: ['admin', 'student-search', StudentRequirementInput],
		queryFn: () => StudentService.getStudentByRequirements(StudentRequirementInput),
		enabled: startSearch,
		...defaultQueryOptions
	});
    function onApply() {
		setStartSearch(true);
	}
	useEffect(() => {
		if (loading) setStartSearch(false);
	}, [loading])

    return (
        <div>
            <div>Поиск студента</div>
            <SearchPanel onApply={onApply} loading={loading}/>
        </div>
    );
}

export default AdminTargetSearchView;
