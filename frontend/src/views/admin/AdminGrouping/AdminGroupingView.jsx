import { MatchingService } from '@services';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Checkbox } from 'antd';
import { Loading, TabButton } from '../../../components';
import { StudentSearch } from '../AdminPortrait/AdminPortraitView';
import './AdminGroupingView.scss';

function SearchBar() {
    const [includeTeachers, setIncludeTeachers] = useState(false);
    const [includeStudents, setIncludeStudents] = useState(false);
    return (
        <div className="AdminGroupingView-searchBar">
            <div className="searchMode">
                <p>Искать среди</p> 
                <Checkbox checked={includeTeachers} onChange={(e) => setIncludeTeachers(e.target.checked)}/>
                <p>Преподавателей</p>
                <Checkbox checked={includeStudents} onChange={(e) => setIncludeStudents(e.target.checked)}/>
                <p>Студентов</p>
            </div>
        </div>
    );
}
function AdminGroupingView() {
    const navigate = useNavigate();
    const location = useLocation();
    const initialStudentId = location.state?.studentId ?? null;

    const [isGroupingLoading, setGroupigLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('student');
    const [mainStudent, setMainStudent] = useState(initialStudentId);

    const getGroup = async () => {
        try {
            setGroupigLoading(true);
            const data = await MatchingService.getMatchGroups();
            rows = data ?? [];
        } catch (e) {
        } finally {
            setGroupigLoading(false);
        }
    };
    const redirectToPortrait = (id) => {
        if (!id) return;
        navigate('/admin/portrait', { state: { studentId: id } });
    };
    return (
        <div className="AdminGroupingView">
            <div className='AdminGroupingView-header'>
                <h1>Подбор</h1> 
                <div className="tab-buttons">
                    <TabButton text={'Студент'} onClick={() => setActiveTab('student')} isActive={activeTab === 'student'} />
                    <TabButton text={'Преподаватель'} onClick={() => setActiveTab('teacher')} isActive={activeTab === 'teacher'} />
                </div>
            </div>
            <SearchBar />
            <StudentSearch initialStudentId={initialStudentId} onSelectStudent={(student) => setMainStudent(student)} />
            {mainStudent && <p>Student ID: {mainStudent}</p>}
            {isGroupingLoading && <Loading />}
        </div>
    );
}

export default AdminGroupingView;
