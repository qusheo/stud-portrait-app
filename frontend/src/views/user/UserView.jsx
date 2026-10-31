import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

import { StudentService } from '@services';
import {
    getAvailableProfiles,
    getAvailableCategories,
    getAvailableYears,
    getCategoryDataForYear,
    COMPETENCIES_NAMES,
    MOTIVATORS_NAMES,
    VALUES_NAMES,
    COURSES_NAMES
} from '@utils/utilities';

import { Content, Header, LAYOUT_STYLE, Sidebar, SidebarLayout } from '@components/SidebarLayout';
import StudentComparisonStats from '@components/StudentComparisonStats';
import StudentInterestsModal from './components/InterestsModal';
import Button from '@components/ui/Button';
import { STUDENT_PALETTE } from '@components/ui/palette';
import Select, { Option } from '@components/ui/Select';
import TabButton from '@components/ui/TabButton';
import FlexRow, { ALIGN, JUSTIFY, WRAP } from '@components/FlexRow.jsx';
import { toast } from 'react-toastify';

import ChartSwitcher from '@components/charts/ChartSwitcher';
import StudentVamChart from '@components/charts/StudentVamChart';
import StudentLgmChart from '@components/charts/StudentLgmChart';
import StudentDisciplineImpact from '@components/charts/StudentDisciplineImpact';
import PlanetaryChart from '@components/charts/PlanetaryChart';

import './UserView.scss';

function UserView() {
    const { userId: studentId } = useParams();
    const [studResults, setStudResults] = useState();
    const [chartsData, setChartsData] = useState([]);
    const [availableYears, setAvailableYears] = useState([]);
    const [selectedYear, setSelectedYear] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('personal');

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
            StudentService.getStudentResults(studentId)
                .then(data => {
                    setStudResults({ student: data.student, results: data.results });
                    prepareLgmData(data.results);
                    // Если в базе есть поля interests и skills, они подтянутся сюда
                    if (data.student) {
                        setInterests(data.student.interests || '');
                        setSkills(data.student.skills || '');
                    }
                })
                .catch(error => console.error(error))
                .finally(() => setLoading(false));
        };
        if (studentId) {
            fetchData();
        }
    }, [studentId]);

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
        if (!studentId || !selectedYear) return;
        setLoadingComparison(true);
        StudentService.getStudentComparisonStats(studentId, selectedYear)
            .then(data => setComparisonStats(data.data))
            .catch(error => console.error('Ошибка загрузки сравнения:', error))
            .finally(() => setLoadingComparison(false));
    };

    useEffect(() => {
        if (selectedYear) {
            loadComparisonStats();
        }
    }, [selectedYear]);

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

    return (
        <div className="UserView">
            <Header
                title="Профиль Студента"
                name={`${studResults?.student?.stud_name}`}
            />
            <div className="UserView-body">
                <FlexRow margin="0 0 24px 0" wrap={WRAP.DO} className="tabs-row">
                    <TabButton text="Мои данные" onClick={() => setActiveTab('personal')} isActive={activeTab === 'personal'} />
                    <TabButton text="Компетенции" onClick={() => setActiveTab('competences')} isActive={activeTab === 'competences'} />
                    <TabButton text="Мотиваторы" onClick={() => setActiveTab('motivators')} isActive={activeTab === 'motivators'} />
                    <TabButton text="Ценности" onClick={() => setActiveTab('values')} isActive={activeTab === 'values'} />
                    <TabButton text="Образование" onClick={() => setActiveTab('education')} isActive={activeTab === 'education'} />
                </FlexRow>

                {activeTab === 'personal' && (
                    <div className="personal-tab">
                        <div className="main-controls" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            {availableYears.length > 0 && (
                                <div className="year-selector">
                                    <span className="year-label" style={{ marginRight: '10px' }}>Год данных:</span>
                                    <Select initValue={selectedYear} onChange={setSelectedYear}>
                                        {availableYears.map(year => (
                                            <Option value={year} label={year} key={year} />
                                        ))}
                                    </Select>
                                </div>
                            )}
                            <div className="action-buttons">
                                <Button
                                    text={resumeGenerating ? 'Загрузка...' : 'Скачать резюме DOCX'}
                                    onClick={generateDocxResume}
                                    disabled={resumeGenerating}
                                    palette={STUDENT_PALETTE.GREEN}
                                />
                            </div>
                        </div>

                        <div className="layout-grid-personal">
                            <div className="col-left">
                                <div className="profile-card">
                                    <div className="profile-header">
                                        <div className="avatar">
                                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
                                                <path d="M6 12v5c3 3 9 3 12 0v-5"/>
                                            </svg>
                                        </div>
                                        <div className="profile-title">
                                            <h3>{studResults?.student?.stud_name || 'Имя не указано'}</h3>
                                            <p>{studResults?.student?.specialty || 'Направление не указано'}</p>
                                        </div>
                                    </div>
                                    
                                    <div className="profile-info-grid">
                                        <div className="info-item">
                                            <span className="info-label">ID студента:</span>
                                            <span className="info-value">{studResults?.student?.stud_id || 'Нет данных'}</span>
                                        </div>
                                        {studResults?.student?.institution && (
                                            <div className="info-item">
                                                <span className="info-label">Вуз:</span>
                                                <span className="info-value">{studResults.student.institution}</span>
                                            </div>
                                        )}
                                        {studResults?.student?.course && (
                                            <div className="info-item">
                                                <span className="info-label">Курс:</span>
                                                <span className="info-value">{studResults.student.course}</span>
                                            </div>
                                        )}
                                        {studResults?.student?.edu_level && (
                                            <div className="info-item">
                                                <span className="info-label">Уровень образования:</span>
                                                <span className="info-value">{studResults.student.edu_level}</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Редактируемый блок */}
                                    <div className="editable-section">
                                        <div className="edit-header">
                                            <h4>Интересы</h4>
                                        </div>
										
										<Button onClick={() => setInterestsModalOpen(true)} text={'Изменить интересы'}/>

                                        <p className="read-only-text">{interests || 'Нет данных об интересах'}</p>

                                        <div className="edit-header" style={{ marginTop: '15px' }}>
                                            <h4>Навыки</h4>
                                        </div>
                                        {isEditing ? (
                                            <textarea 
                                                className="edit-textarea" 
                                                value={skills} 
                                                onChange={(e) => setSkills(e.target.value)}
                                                placeholder="Введите ваши навыки..."
                                            />
                                        ) : (
                                            <p className="read-only-text">{skills || 'Нет данных о навыках'}</p>
                                        )}
                                        
                                        <div style={{ marginTop: '15px', display: 'flex', gap: '10px' }}>
                                            {isEditing ? (
                                                <>
                                                    <Button text="Отмена" onClick={() => setIsEditing(false)} palette={STUDENT_PALETTE.RED} />
                                                    <Button text={saving ? 'Сохранение...' : 'Сохранить'} onClick={handleSaveProfile} disabled={saving} palette={STUDENT_PALETTE.GREEN} />
                                                </>
                                            ) : (
                                                <Button text="Редактировать" onClick={() => setIsEditing(true)} palette={STUDENT_PALETTE.BLUE} />
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="col-right">
                                <div className="dashboard-card" style={{ background: '#fff', padding: '24px', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
                                    <h3 className="card-title" style={{ margin: '0 0 20px 0', fontSize: '18px', color: '#1e293b', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>Дополнительная информация</h3>
                                    <div className="no-data" style={{ color: '#64748b', fontStyle: 'italic', padding: '15px 0', textAlign: 'center' }}>Здесь будет ваша активность</div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'competences' && (
                    <div className="competences-tab">
                        <div className="action-buttons" style={{ marginBottom: '20px' }}>
                            <Button
                                text={analyticsLoading ? 'Загрузка...' : showAnalytics ? 'Скрыть аналитику' : 'Показать аналитику'}
                                onClick={toggleAnalytics}
                                disabled={analyticsLoading}
                                palette={STUDENT_PALETTE.BLUE}
                            />
                        </div>

                        {showAnalytics && analyticsData && (
                            <div className="analytics-section">
                                <div className="analytics-header">
                                    <h2>Аналитика надпрофессиональных компетенций</h2>
                                    <p className="analytics-description">Анализ результатов тестирования с рекомендациями по развитию</p>
                                </div>

                                {analyticsData.general_interpretation && (
                                    <div className="general-interpretation">
                                        <p>{analyticsData.general_interpretation}</p>
                                    </div>
                                )}

                                <div className="analytics-cards-grid">
                                    {analyticsData.competencies?.map(comp => {
                                        if (!comp.ai) return null;
                                        return (
                                            <div key={comp.field} className="analytics-card">
                                                <div className="analytics-card-header">
                                                    <div className="competency-title">
                                                        <h3>{comp.name}</h3>
                                                    </div>
                                                    <div className="score-badge">{comp.score}/800</div>
                                                </div>
                                                <div className="progress-bar">
                                                    <div className="progress-fill" style={{ width: `${comp.percentage}%`, backgroundColor: comp.ai.color }}></div>
                                                </div>
                                                <div className="level-indicator" style={{ color: comp.ai.color }}>
                                                    <strong>{comp.ai.level.toUpperCase()}</strong> уровень
                                                    <span className="percentile">({comp.ai.percentile}-й процентиль)</span>
                                                </div>
                                                <div className="interpretation">
                                                    <p>{comp.ai.interpretation}</p>
                                                </div>
                                                {comp.ai.recommendations && comp.ai.recommendations.length > 0 && (
                                                    <div className="recommendations">
                                                        <strong>Рекомендации:</strong>
                                                        <ul>
                                                            {comp.ai.recommendations.map((rec, idx) => (
                                                                <li key={idx}>{rec}</li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        <div className="charts-grid">
                            {loading ? (
                                <div className="loading">Загрузка данных...</div>
                            ) : compCharts.length > 0 ? (
                                compCharts.map((chart, index) => (
                                    <div key={index} className="chart-card">
                                        <div className="chart-header">
                                            <h3>{chart.title}</h3>
                                            {chart.year && <span className="chart-year">{chart.year}</span>}
                                        </div>
                                        <div className="chart-container">
                                            <ChartSwitcher
                                                seriesLabel={`${chart.year} год`}
                                                seriesData={chart.data}
                                                categories={chart.labels}
                                                competencyKeys={chart.competencyKeys}
                                            />
                                        </div>
                                    </div>
                                ))
                            ) : null}
                            
                            {competencyData.length > 0 && (
                                <div className="planetary-chart-card">
                                    <PlanetaryChart
                                        title="Карта компетенций"
                                        items={competencyData}
                                        type="competency"
                                        height={500}
                                    />
                                </div>
                            )}
                        </div>

                        <StudentComparisonStats studentId={studentId} year={selectedYear} />

                        <div className="student-vam-section">
                            <h3>Value-Added (индивидуальный анализ)</h3>
                            <div className="vam-controls">
                                <label>Компетенция:</label>
                                <Select initValue={vamCompetency} onChange={setVamCompetency}>
                                    {Object.entries(COMPETENCIES_NAMES).map(([key, name]) => (
                                        <Option value={key} label={name} key={key} />
                                    ))}
                                </Select>
                            </div>
                            <StudentVamChart studentId={studentId} competency={vamCompetency} />
                        </div>

                        <div className="student-lgm-section">
                            <h3>Динамика развития компетенций (LGM)</h3>
                            <div className="lgm-controls">
                                <label>Компетенция:</label>
                                <Select initValue={lgmCompetency} onChange={setLgmCompetency}>
                                    {Object.entries(COMPETENCIES_NAMES).map(([key, name]) => (
                                        <Option value={key} label={name} key={key} />
                                    ))}
                                </Select>
                            </div>
                            {lgmData.length === 0 ? (
                                <div className="no-data">Нет данных для отображения</div>
                            ) : (
                                <StudentLgmChart
                                    data={lgmData}
                                    competency={lgmCompetency}
                                    competencyLabel={COMPETENCIES_NAMES[lgmCompetency]}
                                />
                            )}
                        </div>

                        <div className="student-discipline-impact-section">
                            <h3>Влияние дисциплин на ваши компетенции</h3>
                            <StudentDisciplineImpact studentId={studentId} />
                        </div>
                    </div>
                )}

                {activeTab === 'motivators' && (
                    <div className="motivators-tab">
                        <div className="charts-grid">
                            {motCharts.map((chart, index) => (
                                <div key={index} className="chart-card">
                                    <div className="chart-header">
                                        <h3>{chart.title}</h3>
                                        {chart.year && <span className="chart-year">{chart.year}</span>}
                                    </div>
                                    <div className="chart-container">
                                        <ChartSwitcher
                                            seriesLabel={`${chart.year} год`}
                                            seriesData={chart.data}
                                            categories={chart.labels}
                                            competencyKeys={chart.competencyKeys}
                                        />
                                    </div>
                                </div>
                            ))}

                            {motivatorData.length > 0 ? (
                                <div className="planetary-chart-card">
                                    <PlanetaryChart
                                        title="Карта мотиваторов"
                                        items={motivatorData}
                                        type="motivator"
                                        height={500}
                                    />
                                </div>
                            ) : motCharts.length === 0 && (
                                <div className="no-data">Нет данных по мотиваторам за выбранный год</div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'values' && (
                    <div className="values-tab">
                        <div className="charts-grid">
                            {valCharts.map((chart, index) => (
                                <div key={index} className="chart-card">
                                    <div className="chart-header">
                                        <h3>{chart.title}</h3>
                                        {chart.year && <span className="chart-year">{chart.year}</span>}
                                    </div>
                                    <div className="chart-container">
                                        <ChartSwitcher
                                            seriesLabel={`${chart.year} год`}
                                            seriesData={chart.data}
                                            categories={chart.labels}
                                            competencyKeys={chart.competencyKeys}
                                        />
                                    </div>
                                </div>
                            ))}

                            {valuesData.length > 0 ? (
                                <div className="planetary-chart-card">
                                    <PlanetaryChart
                                        title="Карта ценностей"
                                        items={valuesData}
                                        type="value"
                                        height={500}
                                    />
                                </div>
                            ) : valCharts.length === 0 && (
                                <div className="no-data">Нет данных по ценностям за выбранный год</div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'education' && (
                    <div className="education-tab">
                        {coursesData.length > 0 ? (
                            <div className="charts-grid">
                                <div className="planetary-chart-card">
                                    <PlanetaryChart
                                        title="Образовательные курсы"
                                        items={coursesData}
                                        type="course"
                                        height={500}
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="no-data-large" style={{ textAlign: 'center', padding: '40px', color: '#64748b', background: '#fff', borderRadius: '12px' }}>Нет данных об образовательных курсах</div>
                        )}
                    </div>
                )}
            </div>
			<StudentInterestsModal
				open={interestsModalOpen}
				studentId={studentId}
				onClose={() => setInterestsModalOpen(false)}
			/>
        </div>
    );
}

export default UserView;