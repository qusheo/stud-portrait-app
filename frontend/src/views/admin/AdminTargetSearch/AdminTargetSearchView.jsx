import StudentService from '@services/StudentService.ts';
import './AdminTargetSearchView.scss';
import SearchPanel from './SearchPanel.jsx';
import { useState, useEffect, useMemo } from 'react';
import { defaultQueryOptions } from '@utils/queryConfig';
import { useQuery } from '@tanstack/react-query';
import { DataTable, Empty, Loading } from '../../../components/index.js';
import { buildTargetSearchColumns } from './buildTargetSearchTable.js';

const SEARCH_GROUPS = ['competencies', 'motivators', 'values'];

function buildRequirementsInput(params) {
	const requirements = {};

	for (const key of SEARCH_GROUPS) {
		if (!params[key]?.enabled) continue;

		requirements[key] = Object.fromEntries(
			Object.entries(params[key].values ?? {}).filter(([, level]) => level)
		);
	}

	const specialtyIds = params.sphere?.values?.specialty ?? [];
	const courses = params.extra?.values?.course ?? [];

	return {
		requirements,
		specialtyIds: specialtyIds.length ? specialtyIds : undefined,
		courses: courses.length ? courses : undefined,
		limit: 100
	};
}

function AdminTargetSearchView() {
	const [startSearch, setStartSearch ] = useState(false);
	const [showSearch, setShowSearch ] = useState(true);
	const [searchInput, setSearchInput] = useState(null);
	const [appliedSearch, setAppliedSearch] = useState(null);
	const tableColumns = useMemo(() => buildTargetSearchColumns(appliedSearch), [appliedSearch]);
	const { data: rows, isLoading: loading = false } = useQuery({
		queryKey: ['admin', 'student-search', searchInput],
		queryFn: async () => (await StudentService.getStudentByRequirements(searchInput))?.data?.students,
		enabled: startSearch,
		...defaultQueryOptions
	});
    function onApply(params) {
		setAppliedSearch(params);
		setSearchInput(buildRequirementsInput(params));
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
				{loading ? (
						<Loading type="table" title="Поиск студентов..." />
					) : rows ? rows.length ? <div className='AdminTargetView__content_table'
							style={{ height: 700, paddingBottom: 20 }}
						>
							<DataTable
									rows={rows}
									columns={tableColumns}
									rowKey='studentId'
									pageSize={10}
								/>
						</div>
					: <Empty type="table" title="Ничего не найдено" />
					: <></>
				}
			</div>

        </div>
    );
}

export default AdminTargetSearchView;
