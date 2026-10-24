import StudentService from '@services/StudentService.ts';
import './AdminTargetSearchView.scss';
import SearchPanel from './SearchPanel.jsx';
import { useState, useEffect } from 'react';
import { defaultQueryOptions } from '@utils/queryConfig';
import { useQuery } from '@tanstack/react-query';

function AdminTargetSearchView() {
	const [startSearch, setStartSearch ] = useState(false);
	const StudentRequirementInput = {
		requirements: undefined,
		specialtyIds: undefined,
		courses: undefined,
		limit: undefined,
		offset: undefined, // сколько пропустить, если постранично загружаем
	}

	const { data: rows = [], isLoading: loading = false } = useQuery({
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
        <div className='AdminTargetView'>
            <div className='studentSearch__title'>
				<div className='studentSearch__title_main'>Панель поиска</div>
				<div className='studentSearch__title_hint'>Выберите критерии студентов и нажмите поиск</div>
			</div>
			<div className='border'/>
            <SearchPanel onApply={onApply} loading={loading}/>
        </div>
    );
}

export default AdminTargetSearchView;
