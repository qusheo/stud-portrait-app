import StudentService from '@services/StudentService.ts';
import './AdminTargetSearchView.scss';
import SearchPanel from './SearchPanel.jsx';
import { useState, useEffect } from 'react';
import { defaultQueryOptions } from '@utils/queryConfig';
import { useQuery } from '@tanstack/react-query';
import { DataTable } from '../../../components/index.js';

function AdminTargetSearchView() {
	const [startSearch, setStartSearch ] = useState(false);
	const [showSearch, setShowSearch ] = useState(true);
	const StudentRequirementInput = {
		requirements: undefined,
		specialtyIds: undefined,
		courses: undefined,
		limit: undefined,
		offset: undefined, // сколько пропустить, если постранично загружаем
	}
	/*
	"students": [
            {
                "studentId": 326,
                "resultId": 125,
                "specialtyId": null,
                "course": 4,
                "year": "2022/2023",
                "matchScore": null
            },
	*/
	const tableColumns = [{
		id: 'studentId',
		name: 'Студент'
	}];
	const { data: rows, isLoading: loading = false } = useQuery({
		queryKey: ['admin', 'student-search', StudentRequirementInput],
		queryFn: async () => (await StudentService.getStudentByRequirements(StudentRequirementInput))?.data?.students,
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
			<div className='hide-show-container' onClick={() => setShowSearch(!showSearch)}>
				<div className='hide-show-btn'>{ showSearch ? 'Скрыть' : 'Показать'}</div>
			</div>
			{showSearch && (<SearchPanel onApply={onApply} loading={loading}/>)}
			<div className='AdminTargetView__content'>
				{rows ?  rows.length ? <div className='AdminTargetView__content_table'>
						{<DataTable
							rows={rows}
							columns={tableColumns}
							pageSize={10}
						/>}
					</div>
					: <div className='studentSearch__emptyResult'> Ничего не найдено </div>
					: <></>
				}
			</div>

        </div>
    );
}

export default AdminTargetSearchView;
