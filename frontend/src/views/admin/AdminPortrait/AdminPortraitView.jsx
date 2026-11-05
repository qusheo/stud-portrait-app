
import { useState, useEffect } from 'react';
import Chart from 'react-apexcharts';
import { useLocation } from 'react-router-dom';
import { StudentService } from '@services';
import { toast } from 'react-toastify';
import FlexRow, { WRAP } from '@components/FlexRow';
import {
    COMPETENCIES_NAMES,
    VALUES_NAMES,
    MOTIVATORS_NAMES
} from '@utils/utilities.js';
import LoadingSpinner from '@components/ui/LoadingSpinner';
import Loading from '@components/ui/Loading';
import Empty from '@components/ui/Empty';
import TabButton from '@components/ui/TabButton';
import { useQuery } from '@tanstack/react-query';
import { defaultQueryOptions } from '@utils/queryConfig';
import './AdminPortraitView.scss';

const StudentSearch = ({ value, onSelectStudent, initialStudentId }) => {
    const [searchTerm, setSearchTerm] = useState(
        initialStudentId == null ? '' : String(initialStudentId)
    );
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isDropdownOpen, setIsDropdownOpen] = useState(initialStudentId != null);

    useEffect(() => {
        if (
            isDropdownOpen &&
            (searchTerm.length >= 2 || searchTerm === String(initialStudentId))
        ) {
            searchStudents();
        } else if (searchTerm.length === 0) {
            setStudents([]);
        }
    }, [searchTerm, isDropdownOpen, initialStudentId]);

    const searchStudents = async () => {
        setLoading(true);

        StudentService.getStudentsList(searchTerm, 20)
            .then(data => setStudents(data.data))
            .catch(error => console.error('Ошибка поиска:', error))
            .finally(() => setLoading(false));
    };

    const handleSelectStudent = student => {
        setIsDropdownOpen(false);
        setSearchTerm('');
        setStudents([]);
        onSelectStudent(student.id);
    };

    useEffect(() => {
        if (!value) return;

        setIsDropdownOpen(false);
        setSearchTerm('');
        setStudents([]);
    }, [value]);

    return (
        <div className="student-search">
            <div className="search-label">Поиск студента:</div>

            <div className="search-container">
                <input
                    type="text"
                    className="search-input"
                    placeholder="Введите ID студента, ФИО или название вуза..."
                    value={searchTerm}
                    onChange={e => {
                        setSearchTerm(e.target.value);
                        setIsDropdownOpen(true);
                    }}
                />

                {loading && <LoadingSpinner small />}

                {isDropdownOpen && students.length > 0 && (
                    <div className="search-results">
                        {students.map(student => (
                            <div
                                key={student.id}
                                className="search-result-item"
                                onClick={() => handleSelectStudent(student)}
                            >
                                <div className="result-rsv">{student.rsv_id}</div>

                                <div className="result-info">
                                    {student.institution} • {student.specialty} • {student.course} курс
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

const StudentInfoCard = ({ student }) => {
    if (!student) return null;

    return (
        <div className="profile-card">
            <div className="profile-header">
                <div className="avatar">
                    <svg
                        width="32"
                        height="32"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                        <path d="M6 12v5c3 3 9 3 12 0v-5" />
                    </svg>
                </div>

                <div className="profile-title">
                    <h3>{student.stud_name || 'Имя не указано'}</h3>
                    <p>{student.specialty || 'Направление не указано'}</p>
                </div>
            </div>

            <div className="profile-info-grid">
                <div className="info-item">
                    <span className="info-label">ID студента:</span>
                    <span className="info-value">{student.rsv_id}</span>
                </div>

                <div className="info-item">
                    <span className="info-label">Пол:</span>
                    <span className="info-value">{student.gender}</span>
                </div>

                <div className="info-item">
                    <span className="info-label">Учебное заведение:</span>
                    <span className="info-value">{student.institution}</span>
                </div>

                <div className="info-item">
                    <span className="info-label">Уровень образования:</span>
                    <span className="info-value">{student.edu_level}</span>
                </div>

                <div className="info-item">
                    <span className="info-label">Форма обучения:</span>
                    <span className="info-value">{student.study_form}</span>
                </div>

                <div className="info-item">
                    <span className="info-label">Текущий курс:</span>
                    <span className="info-value">{student.current_course}</span>
                </div>
            </div>
        </div>
    );
};

const TestResultsCard = ({ Results, activeTab }) => {
    const [selectedYear, setSelectedYear] = useState(null);

    useEffect(() => {
        if (Results && Results.length > 0) {
            const yearExists = Results.some(r => r.year === selectedYear);

            if (!yearExists) {
                setSelectedYear(Results[0].year);
            }
        }
    }, [Results, selectedYear]);

    if (!Results || Results.length === 0) {
        return (
            <div className="dashboard-card no-data-card">
                <Empty type="charts" title="Нет данных о тестировании" />
            </div>
        );
    }

    const currentResult = Results.find(r => r.year === selectedYear);

    const hasActualData = obj => {
        if (!obj) return false;

        return Object.values(obj).some(
            val => val !== null && val !== undefined
        );
    };

    const getChartData = () => {
        if (!currentResult) return [];

        let names = {};
        let dataObj = {};

        if (activeTab === 'competences') {
            names = COMPETENCIES_NAMES;
            dataObj = currentResult.competencies || {};
        } else if (activeTab === 'motivators') {
            names = MOTIVATORS_NAMES;
            dataObj = currentResult.motivators || {};
        } else if (activeTab === 'values') {
            names = VALUES_NAMES;
            dataObj = currentResult.values || {};
        }

        return Object.entries(names).map(([key, name]) => ({
            name,
            value:
                dataObj[key] !== undefined && dataObj[key] !== null
                    ? dataObj[key]
                    : 0
        }));
    };

    const chartData = getChartData();

    // Три категории мотиваторов.
    const motivatorGroups = [
        {
            title: 'Мотиваторы',
            emptyMessage: 'Нет данных о мотиваторах',
            items: []
        },
        {
            title: 'Непроявленные',
            emptyMessage: 'Нет данных о непроявленных признаках',
            items: []
        },
        {
            title: 'Демотиваторы',
            emptyMessage: 'Нет данных о демотиваторах',
            items: []
        }
    ];

    // Каждый признак добавляется во все три категории.
    // Значение указывается только в подходящей категории.
    if (activeTab === 'motivators' && currentResult) {
        Object.entries(MOTIVATORS_NAMES).forEach(([key, name]) => {
            const rawValue = currentResult.motivators?.[key];

            let value = null;

            if (
                rawValue !== null &&
                rawValue !== undefined &&
                rawValue !== ''
            ) {
                const number = Number(rawValue);

                if (Number.isFinite(number) && number >= 200) {
                    value = number;
                }
            }

            motivatorGroups.forEach((group, index) => {
                let groupValue = null;

                // Мотиваторы: 600 и выше.
                if (index === 0 && value !== null && value >= 600) {
                    groupValue = value;
                }

                // Непроявленные: от 400 до 599 включительно.
                else if (
                    index === 1 &&
                    value !== null &&
                    value >= 400 &&
                    value < 600
                ) {
                    groupValue = value;
                }

                // Демотиваторы: от 200 до 399 включительно.
                else if (
                    index === 2 &&
                    value !== null &&
                    value >= 200 &&
                    value < 400
                ) {
                    groupValue = value;
                }

                group.items.push({
                    name,
                    value: groupValue
                });
            });
        });
    }

    // Сортировка по возрастанию.
    // Пустые значения располагаются в конце.
    motivatorGroups.forEach(group => {
        group.items.sort((a, b) => {
            if (a.value === null && b.value === null) return 0;
            if (a.value === null) return 1;
            if (b.value === null) return -1;

            return a.value - b.value;
        });
    });

    // Проверяем наличие данных для текущей вкладки.
    let isDataEmpty = true;

    if (currentResult) {
        if (activeTab === 'competences') {
            isDataEmpty = !hasActualData(currentResult.competencies);
        } else if (activeTab === 'motivators') {
            // Для мотиваторов проверка выполняется отдельно по каждой категории.
            isDataEmpty = false;
        } else if (activeTab === 'values') {
            isDataEmpty = !hasActualData(currentResult.values);
        }
    }

    const radarOptions = {
        chart: {
            type: 'radar',
            toolbar: { show: false },
            fontFamily: 'inherit'
        },
        labels: chartData.map(d => d.name),
        xaxis: {
            labels: {
                style: {
                    colors: chartData.map(() => '#1e293b'),
                    fontSize: '12px',
                    fontWeight: 600
                }
            }
        },
        stroke: {
            width: 2,
            colors: ['#3b82f6']
        },
        fill: {
            opacity: 0.2,
            colors: ['#3b82f6']
        },
        markers: {
            size: 4,
            colors: ['#fff'],
            strokeColors: '#3b82f6',
            strokeWidth: 2
        },
        yaxis: {
            show: false,
            min: 0,
            max: 800
        },
        plotOptions: {
            radar: {
                size: 270,
                polygons: {
                    strokeColors: '#e2e8f0',
                    connectorColors: '#e2e8f0',
                    fill: {
                        colors: ['#f8fafc', '#fff']
                    }
                }
            }
        }
    };

    return (
        <div className="test-results-wrapper">
            <div className="year-selector">
                {Results.map(result => (
                    <button
                        key={result.year}
                        className={`year-btn ${selectedYear === result.year ? 'active' : ''}`}
                        onClick={() => setSelectedYear(result.year)}
                    >
                        {result.year}
                    </button>
                ))}
            </div>

            {currentResult ? (
                <div className="dashboard-card">
                    {isDataEmpty ? (
                        <Empty
                            type="charts"
                            title={`Нет данных о ${
                                activeTab === 'competences'
                                    ? 'компетенциях'
                                    : activeTab === 'motivators'
                                        ? 'мотиваторах'
                                        : 'ценностях'
                            } за выбранный год`}
                        />
                    ) : activeTab === 'values' ? (
                        <div className="values-list">
                            {Object.entries(VALUES_NAMES).map(([key, name]) => {
                                const val = currentResult?.values?.[key];

                                if (val === null || val === undefined) {
                                    return null;
                                }

                                return (
                                    <div key={key} className="value-item">
                                        {name}
                                    </div>
                                );
                            })}
                        </div>
                    ) : activeTab === 'competences' ? (
                        <div className="analytics-split-layout">
                            <div className="chart-side">
                                <Chart
                                    options={radarOptions}
                                    series={[
                                        {
                                            name: 'Баллы',
                                            data: chartData.map(d => d.value)
                                        }
                                    ]}
                                    type="radar"
                                    height={600}
                                    width="100%"
                                />
                            </div>
                        </div>
                    ) : activeTab === 'motivators' ? (
                        <div
                            className="motivator-groups"
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '24px',
                                width: '100%'
                            }}
                        >
                            {motivatorGroups.map((group, index) => {
                                // Проверяем, есть ли хотя бы один признак
                                // с реальным значением в этой категории.
                                const hasGroupData = group.items.some(
                                    item => item.value !== null
                                );

                                return (
                                    <div
                                        className="dashboard-card"
                                        key={group.title}
                                        style={{
                                            width: '100%',
                                            minWidth: 0,
                                            margin: 0
                                        }}
                                    >
                                        <h3 className="card-title">
                                            {group.title}
                                        </h3>

                                        {hasGroupData ? (
                                            <Chart
                                                options={{
                                                    chart: {
                                                        type: 'bar',
                                                        toolbar: { show: false },
                                                        fontFamily: 'inherit'
                                                    },
                                                    plotOptions: {
                                                        bar: {
                                                            horizontal: false,
                                                            borderRadius: 4,
                                                            columnWidth: '55%'
                                                        }
                                                    },
                                                    dataLabels: {
                                                        enabled: true,
                                                        formatter: value => {
                                                            return value === null ||
                                                                value === undefined
                                                                ? ''
                                                                : value;
                                                        }
                                                    },
                                                    xaxis: {
                                                        categories: group.items.map(
                                                            item => item.name
                                                        ),
                                                        labels: {
                                                            rotate: -45,
                                                            rotateAlways: true,
                                                            trim: false,
                                                            hideOverlappingLabels: false,
                                                            style: {
                                                                fontSize: '11px'
                                                            }
                                                        }
                                                    },
                                                    yaxis: {
                                                        min: 0
                                                    },
                                                    colors: [
                                                        index === 0
                                                            ? '#16a34a'
                                                            : index === 1
                                                                ? '#eab308'
                                                                : '#dc2626'
                                                    ]
                                                }}
                                                series={[
                                                    {
                                                        name: 'Баллы',
                                                        data: group.items.map(
                                                            item => item.value
                                                        )
                                                    }
                                                ]}
                                                type="bar"
                                                height={380}
                                                width="100%"
                                            />
                                        ) : (
                                            <Empty
                                                type="charts"
                                                title={group.emptyMessage}
                                            />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ) : null}
                </div>
            ) : (
                <div className="dashboard-card no-data-card">
                    <Loading type="charts" title="Загрузка данных..." />
                </div>
            )}
        </div>
    );
};

const AcademicPerformanceCard = ({ grades }) => {
    if (!grades || grades.length === 0) {
        return (
            <div className="dashboard-card">
                <h3 className="card-title">Оценки по дисциплинам</h3>
                <Empty type="table" title="Нет данных об успеваемости" />
            </div>
        );
    }

    const groupedByYear = {};

    grades.forEach(grade => {
        if (!groupedByYear[grade.year]) {
            groupedByYear[grade.year] = [];
        }

        groupedByYear[grade.year].push(grade);
    });

    const getGradeClass = grade => {
        const num = parseInt(grade, 10);

        if (num === 5) return 'grade-excellent';
        if (num === 4) return 'grade-good';
        if (num === 3) return 'grade-satisfactory';

        return 'grade-poor';
    };

    return (
        <div className="dashboard-card">
            <h3 className="card-title">Оценки по дисциплинам</h3>

            {Object.entries(groupedByYear).map(([year, yearGrades]) => (
                <div key={year} className="grades-year">
                    <h4 className="year-subtitle">
                        {year} учебный год
                    </h4>

                    <div className="table-wrapper">
                        <table className="clean-table">
                            <thead>
                                <tr>
                                    <th>Дисциплина</th>
                                    <th style={{ width: '100px', textAlign: 'center' }}>
                                        Оценка
                                    </th>
                                </tr>
                            </thead>

                            <tbody>
                                {yearGrades.map((grade, idx) => (
                                    <tr key={idx}>
                                        <td>{grade.discipline}</td>

                                        <td style={{ textAlign: 'center' }}>
                                            <span
                                                className={`grade-badge ${getGradeClass(grade.main_attestation)}`}
                                            >
                                                {grade.main_attestation || '—'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ))}
        </div>
    );
};

const CoursesCard = ({ courses }) => {
    if (!courses || courses.length === 0) {
        return (
            <div className="dashboard-card">
                <h3 className="card-title">
                    Пройденные образовательные курсы
                </h3>

                <Empty type="table" title="Нет данных о пройденных курсах" />
            </div>
        );
    }

    const courseFields = [
        { key: 'an_dec', name: 'Анализ и принятие решений' },
        { key: 'client_focus', name: 'Клиентоориентированность' },
        { key: 'communication', name: 'Коммуникация' },
        { key: 'leadership', name: 'Лидерство' },
        { key: 'result_orientation', name: 'Ориентация на результат' },
        { key: 'planning_org', name: 'Планирование и организация' },
        { key: 'rules_culture', name: 'Правила и культура' },
        { key: 'self_dev', name: 'Саморазвитие' },
        { key: 'collaboration', name: 'Сотрудничество' },
        { key: 'stress_resistance', name: 'Стрессоустойчивость' },
        { key: 'emotions_communication', name: 'Эмоции в коммуникации' },
        { key: 'negotiations', name: 'Переговоры' },
        { key: 'digital_comm', name: 'Цифровая коммуникация' },
        { key: 'effective_learning', name: 'Эффективное обучение' },
        { key: 'entrepreneurship', name: 'Предпринимательство' },
        { key: 'creativity_tech', name: 'Креативные технологии' },
        { key: 'trendwatching', name: 'Трендвотчинг' },
        { key: 'conflict_management', name: 'Управление конфликтами' },
        { key: 'career_management', name: 'Управление карьерой' },
        { key: 'burnout', name: 'Профессиональное выгорание' },
        { key: 'cross_cultural_comm', name: 'Кросс-культурная коммуникация' },
        { key: 'mentoring', name: 'Наставничество' }
    ];

    return (
        <div className="dashboard-card">
            <h3 className="card-title">
                Пройденные образовательные курсы
            </h3>

            <div className="courses-grid">
                {courses.map((course, idx) => (
                    <div key={idx} className="course-block">
                        <h4 className="course-subtitle">
                            Курс {idx + 1}
                        </h4>

                        <div className="course-tags">
                            {courseFields.map(field => {
                                const value = course[field.key];

                                if (value !== null && value !== undefined) {
                                    return (
                                        <div key={field.key} className="course-tag">
                                            <span className="tag-label">
                                                {field.name}
                                            </span>

                                            <span className="tag-value">
                                                {value}
                                            </span>
                                        </div>
                                    );
                                }

                                return null;
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

function AdminPortraitView() {
    const location = useLocation();
    const initialStudentId = location.state?.studentId ?? null;

    const [selectedStudentId, setSelectedStudentId] = useState(initialStudentId);
    const [studentPortrait, setStudentPortrait] = useState(null);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('personal');

    useEffect(() => {
        setSelectedStudentId(initialStudentId);
    }, [initialStudentId]);

    const { isPending: isLoading } = useQuery({
        queryKey: ['student', selectedStudentId, 'extraData'],
        queryFn: async () => {
            if (!selectedStudentId) return [];

            const response = await StudentService.getStudentById(selectedStudentId);

            setStudentPortrait(prev => ({
                ...prev,
                student_info: response.data || {}
            }));

            return response.data;
        },
        enabled: Boolean(selectedStudentId),
        ...defaultQueryOptions
    });

    useEffect(() => {
        if (selectedStudentId) {
            loadStudentPortrait(selectedStudentId);
        } else {
            setStudentPortrait(null);
        }
    }, [selectedStudentId]);

    const loadStudentPortrait = async studentId => {
        setLoading(true);

        try {
            const data = await StudentService.getStudentPortrait(studentId);
            setStudentPortrait(data.data);
        } catch (error) {
            console.error('Ошибка:', error);
            toast.error('Ошибка при загрузке портрета');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="AdminPortraitView">
            <h2>Цифровой портрет студента</h2>

            <StudentSearch
                value={initialStudentId}
                onSelectStudent={setSelectedStudentId}
                initialStudentId={initialStudentId}
            />

            {loading && <Loading title="Загрузка портрета студента..." />}

            {!loading && studentPortrait && (
                <div className="dashboard-container">
                    <FlexRow
                        margin="0 0 24px 0"
                        wrap={WRAP.DO}
                        className="tabs-row"
                    >
                        <TabButton
                            text="Мои данные"
                            onClick={() => setActiveTab('personal')}
                            isActive={activeTab === 'personal'}
                        />

                        <TabButton
                            text="Компетенции"
                            onClick={() => setActiveTab('competences')}
                            isActive={activeTab === 'competences'}
                        />

                        <TabButton
                            text="Мотиваторы"
                            onClick={() => setActiveTab('motivators')}
                            isActive={activeTab === 'motivators'}
                        />

                        <TabButton
                            text="Ценности"
                            onClick={() => setActiveTab('values')}
                            isActive={activeTab === 'values'}
                        />

                        <TabButton
                            text="Образование"
                            onClick={() => setActiveTab('education')}
                            isActive={activeTab === 'education'}
                        />
                    </FlexRow>

                    {activeTab === 'personal' && (
                        <div className="layout-grid-personal">
                            <div className="col-left">
                                <StudentInfoCard
                                    student={studentPortrait.student_info}
                                />

                                {isLoading ? (
                                    <LoadingSpinner
                                        small
                                        title="Загрузка дополнительных данных..."
                                    />
                                ) : (
                                    <div></div>
                                )}
                            </div>

                            <div className="col-right">
                                <div className="dashboard-card">
                                    <h3 className="card-title">Интересы</h3>
                                    <Empty title="Нет данных об интересах" />
                                </div>

                                <div className="dashboard-card">
                                    <h3 className="card-title">Навыки</h3>
                                    <Empty title="Нет данных о навыках" />
                                </div>
                            </div>
                        </div>
                    )}

                    {(activeTab === 'competences' ||
                        activeTab === 'motivators' ||
                        activeTab === 'values') && (
                        <TestResultsCard
                            Results={studentPortrait.test_results}
                            activeTab={activeTab}
                        />
                    )}

                    {activeTab === 'education' && (
                        <div
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '24px'
                            }}
                        >
                            <AcademicPerformanceCard
                                grades={studentPortrait.academic_performance}
                            />

                            <CoursesCard courses={studentPortrait.courses} />
                        </div>
                    )}
                </div>
            )}

            {!loading && !studentPortrait && selectedStudentId && (
                <Empty title="Не удалось загрузить данные студента" />
            )}
        </div>
    );
}

export default AdminPortraitView;
