
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useUserStore } from '../../user/store/userStore.js';

import { StudentService } from '@services';
import { COMPETENCIES_NAMES, MOTIVATORS_NAMES, VALUES_NAMES, COURSES_NAMES } from '@constants';
import { getAvailableProfiles, getAvailableCategories, getAvailableYears, getCategoryDataForYear } from '@utils/utilities';

import { Content, LAYOUT_STYLE, Sidebar, SidebarLayout } from '@components/SidebarLayout';
import StudentComparisonStats from '@components/StudentComparisonStats';
import StudentInterestsModal from './components/InterestsModal';
import Button from '@components/ui/Button';
import { STUDENT_PALETTE } from '@components/ui/palette';
import Select, { Option } from '@components/ui/Select';
import Loading from '@components/ui/Loading';
import Empty from '@components/ui/Empty';
import { toast } from 'react-toastify';

import ChartSwitcher from '@components/charts/ChartSwitcher';
import StudentVamChart from '@components/charts/StudentVamChart';
import StudentLgmChart from '@components/charts/StudentLgmChart';
import StudentDisciplineImpact from '@components/charts/StudentDisciplineImpact';
import PlanetaryChart from '@components/charts/PlanetaryChart';

import './UserView.scss';

function UserView() {
    const { userId: studentId } = useParams();
    const participantId = useUserStore(state => state.participantId);
    const isOwnProfile = Number(studentId) === Number(participantId);
    const [studResults, setStudResults] = useState();
    const [publicStudent, setPublicStudent] = useState(null);
    const [chartsData, setChartsData] = useState([]);
    const [availableYears, setAvailableYears] = useState([]);
    const [selectedYear, setSelectedYear] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab] = useState('personal');

    const [analyticsData, setAnalyticsData] = useState(null);
    const [analyticsLoading, setAnalyticsLoading] = useState(false);
    const [showAnalytics, setShowAnalytics] = useState(false);

    const [vamCompetency, setVamCompetency] = useState('res_comp_leadership');
    const [lgmCompetency, setLgmCompetency] = useState('res_comp_leadership');
    const [lgmData, setLgmData] = useState([]);

    const [comparisonStats, setComparisonStats] = useState(null);
    const [loadingComparison, setLoadingComparison] = useState(false);
    const [resumeGenerating, setResumeGenerating] = useState(false);

    // Состояния для редактирования профиля
    const [isEditing, setIsEditing] = useState(false);
    const [interests, setInterests] = useState('');
    const [skills, setSkills] = useState('');
    const [saving, setSaving] = useState(false);

    const [interestsModalOpen, setInterestsModalOpen] = useState(false);

    useEffect(() => {
        if (showAnalytics && selectedYear) {
            loadAnalytics(selectedYear);
        }
    }, [selectedYear, showAnalytics]);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);

            try {
                // Загружаем общедоступные сведения о студенте по точному ID.
                const publicResponse = await StudentService.getStudentsList(
                    '',
                    1,
                    studentId
                );

                setPublicStudent(publicResponse.data?.[0] || null);

                // Приватные результаты загружаем только владельцу профиля.
                if (isOwnProfile) {
                    const data = await StudentService.getStudentResults(studentId);

                    setStudResults({
                        student: data.student,
                        results: data.results
                    });

                    prepareLgmData(data.results);

                    if (data.student) {
                        setInterests(data.student.interests || '');
                        setSkills(data.student.skills || '');
                    }
                } else {
                    setStudResults(null);
                    setInterests('');
                    setSkills('');
                }
            } catch (error) {
                console.error('Ошибка загрузки профиля студента:', error);
            } finally {
                setLoading(false);
            }
        };

        if (studentId) {
            fetchData();
        }
    }, [studentId, isOwnProfile]);

    useEffect(() => {
        const defineAvailableData = () => {
            if (!studResults?.results?.length) return;

            const years = getAvailableYears(studResults.results);
            setAvailableYears(years);

            if (years.length > 0 && !selectedYear) {
                setSelectedYear(years[0]);
            }

            updateChartsData(years.length > 0 ? selectedYear || years[0] : null);
        };

        if (studResults) {
            defineAvailableData();
        }
    }, [studResults]);

    useEffect(() => {
        if (studResults?.results?.length && selectedYear) {
            updateChartsData(selectedYear);
        }
    }, [selectedYear, studResults]);

    const loadComparisonStats = async () => {
        if (!isOwnProfile || !studentId || !selectedYear) return;

        setLoadingComparison(true);
        StudentService.getStudentComparisonStats(studentId, selectedYear)
            .then(data => setComparisonStats(data.data))
            .catch(error => console.error('Ошибка загрузки сравнения:', error))
            .finally(() => setLoadingComparison(false));
    };

    useEffect(() => {
        if (isOwnProfile && selectedYear) {
            loadComparisonStats();
        }
    }, [selectedYear, isOwnProfile]);

    const updateChartsData = year => {
        if (!studResults?.results?.length || !year) return;

        const availableProfiles = getAvailableProfiles(studResults.results);
        const charts = [];

        availableProfiles.forEach(profile => {
            const availableCategories = getAvailableCategories(studResults.results, profile.key);

            availableCategories.forEach(category => {
                const yearData = getCategoryDataForYear(studResults.results, profile.key, category.key, year);

                if (yearData.labels.length > 0) {
                    const competencyKeys = category.fields.filter(field => yearData.labels.includes(field.label)).map(field => field.key);

                    charts.push({
                        profile: profile,
                        category: category,
                        title: `${profile.title}: ${category.title}`,
                        year: yearData.year,
                        labels: yearData.labels,
                        data: yearData.data,
                        competencyKeys: competencyKeys
                    });
                }
            });
        });

        setChartsData(charts);
    };

    const loadAnalytics = async year => {
        if (analyticsData && analyticsData.year === year) {
            setShowAnalytics(true);
            return;
        }
        setAnalyticsLoading(true);
        StudentService.getStudentResumeData(studentId, year)
            .then(data => {
                setAnalyticsData({ ...data.data, year });
                setShowAnalytics(true);
            })
            .catch(err => {
                console.error('Ошибка загрузки аналитики:', err);
                toast.error('Ошибка подключения к серверу: ' + err.message);
            })
            .finally(() => setAnalyticsLoading(false));
    };

    const toggleAnalytics = () => {
        if (showAnalytics) {
            setShowAnalytics(false);
        } else {
            loadAnalytics(selectedYear);
        }
    };

    const prepareLgmData = results => {
        if (!results || results.length === 0) {
            setLgmData([]);
            return;
        }
        const byCourse = {};
        results.forEach(res => {
            const course = res.res_course_num;
            if (!course) return;
            if (!byCourse[course]) byCourse[course] = {};
            Object.keys(COMPETENCIES_NAMES).forEach(comp => {
                const score = res[comp];
                if (score !== undefined && score !== null) {
                    byCourse[course][comp] = score;
                }
            });
        });
        const courses = Object.keys(byCourse).sort((a, b) => Number(a) - Number(b));
        if (courses.length < 2) {
            setLgmData([]);
            return;
        }
        const chartData = courses.map(course => {
            const point = { course: `${course} курс` };
            Object.keys(COMPETENCIES_NAMES).forEach(comp => {
                point[comp] = byCourse[course][comp] || null;
            });
            return point;
        });
        setLgmData(chartData);
    };

    const generateDocxResume = async () => {
        setResumeGenerating(true);
        StudentService.generateDocxResume(studentId)
            .onTimeout(() => setResumeGenerating(false))
            .onError(err => {
                console.error(err);
                toast.error('Ошибка генерации резюме: ' + err.message);
                setResumeGenerating(false);
            })
            .open();
    };

    const handleSaveProfile = async () => {
        setSaving(true);
        try {
            await new Promise(resolve => setTimeout(resolve, 600));
            toast.success('Данные сохранены (тестовая заглушка)!');
            setIsEditing(false);
            setStudResults(prev => ({
                ...prev,
                student: { ...prev.student, interests, skills }
            }));
        } catch (error) {
            toast.error('Ошибка при сохранении данных');
        } finally {
            setSaving(false);
        }
    };

    const prepareCategoryData = (namesDict) => {
        if (!studResults?.results?.length || !selectedYear || !namesDict) return [];
        const yearResults = studResults.results.find(r => r.res_year === selectedYear);
        if (!yearResults) return [];

        const items = [];
        Object.keys(namesDict).forEach(key => {
            const value = yearResults[key];
            if (value !== undefined && value !== null) {
                items.push({ name: namesDict[key], value: value });
            }
        });
        return items;
    };

    const competencyData = prepareCategoryData(COMPETENCIES_NAMES);
    const motivatorData = prepareCategoryData(MOTIVATORS_NAMES);
    const valuesData = prepareCategoryData(VALUES_NAMES);
    const coursesData = prepareCategoryData(COURSES_NAMES);

    const compCharts = chartsData.filter(c => c.profile.key === 'competences');
    const motCharts = chartsData.filter(c => c.profile.key === 'motivators');
    const valCharts = chartsData.filter(c => c.profile.key === 'values');

    const profileStudent = isOwnProfile
        ? {
            name: studResults?.student?.stud_name,
            id: studResults?.student?.stud_id,
            institution: studResults?.student?.institution,
            specialty: studResults?.student?.specialty,
            course: studResults?.student?.course,
            eduLevel: studResults?.student?.edu_level
        }
        : {
            name: publicStudent?.name,
            id: publicStudent?.id,
            institution: publicStudent?.institution,
            specialty: publicStudent?.specialty,
            course: publicStudent?.course,
            eduLevel: null
        };

    
    return (
        <div className="UserView">
            <div className="UserView-body">
                {loading ? (
                    <Loading type="charts" title="Загрузка профиля..." />
                ) : (
                    <div className="personal-tab">
                        <div className="main-controls">
                            {isOwnProfile && (
                                <div className="action-buttons">
                                    <Button
                                        text={resumeGenerating ? 'Загрузка...' : 'Скачать резюме DOCX'}
                                        onClick={generateDocxResume}
                                        disabled={resumeGenerating}
                                        palette={STUDENT_PALETTE.GREEN}
                                    />
                                </div>
                            )}
                        </div>

                        <div className="layout-grid-personal">
                            <div className="col-left">
                                <div className="profile-card">
                                    <div className="profile-header">
                                        <div className="avatar">
                                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                                                <path d="M6 12v5c3 3 9 3 12 0v-5" />
                                            </svg>
                                        </div>
                                        <div className="profile-title">
                                            <h3>{profileStudent.name || 'Имя не указано'}</h3>
                                            <p>{profileStudent.specialty || 'Направление не указано'}</p>
                                        </div>
                                    </div>

                                    <div className="profile-info-grid">
                                        <div className="info-item">
                                            <span className="info-label">ID студента:</span>
                                            <span className="info-value">{profileStudent.id || 'Нет данных'}</span>
                                        </div>

                                        {profileStudent.institution && (
                                            <div className="info-item">
                                                <span className="info-label">Вуз:</span>
                                                <span className="info-value">{profileStudent.institution}</span>
                                            </div>
                                        )}

                                        {profileStudent.course && (
                                            <div className="info-item">
                                                <span className="info-label">Курс:</span>
                                                <span className="info-value">{profileStudent.course}</span>
                                            </div>
                                        )}

                                        {profileStudent.eduLevel && (
                                            <div className="info-item">
                                                <span className="info-label">Уровень образования:</span>
                                                <span className="info-value">{profileStudent.eduLevel}</span>
                                            </div>
                                        )}
                                    </div>

                                    {isOwnProfile && (
                                        <div className="editable-section">
                                            <div className="edit-header">
                                                <h4>Интересы</h4>
                                            </div>

                                            <Button
                                                onClick={() => setInterestsModalOpen(true)}
                                                text="Изменить интересы"
                                            />

                                            <p className="read-only-text">
                                                {interests || 'Нет данных об интересах'}
                                            </p>

                                            <div className="edit-header" style={{ marginTop: '15px' }}>
                                                <h4>Навыки</h4>
                                            </div>

                                            {isEditing ? (
                                                <textarea
                                                    className="edit-textarea"
                                                    value={skills}
                                                    onChange={e => setSkills(e.target.value)}
                                                    placeholder="Введите ваши навыки..."
                                                />
                                            ) : (
                                                <p className="read-only-text">
                                                    {skills || 'Нет данных о навыках'}
                                                </p>
                                            )}

                                            <div style={{ marginTop: '15px', display: 'flex', gap: '10px' }}>
                                                {isEditing ? (
                                                    <>
                                                        <Button
                                                            text="Отмена"
                                                            onClick={() => setIsEditing(false)}
                                                            palette={STUDENT_PALETTE.RED}
                                                        />
                                                        <Button
                                                            text={saving ? 'Сохранение...' : 'Сохранить'}
                                                            onClick={handleSaveProfile}
                                                            disabled={saving}
                                                            palette={STUDENT_PALETTE.GREEN}
                                                        />
                                                    </>
                                                ) : (
                                                    <Button
                                                        text="Редактировать"
                                                        onClick={() => setIsEditing(true)}
                                                        palette={STUDENT_PALETTE.BLUE}
                                                    />
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="col-right">
                                <div className="dashboard-card">
                                    <h3 className="card-title">Дополнительная информация</h3>
                                    <Empty title="Здесь будет ваша активность" />
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {isOwnProfile && (
                <StudentInterestsModal
                    open={interestsModalOpen}
                    studentId={studentId}
                    onClose={() => setInterestsModalOpen(false)}
                />
            )}
            </div>
    );
}

export default UserView;