import { useState, useEffect, React, useRef, cloneElement } from 'react';
import { PieChart, Pie, Tooltip as TooltipRecharts, Legend, ResponsiveContainer } from 'recharts';
import { ArrowUp, ArrowDown } from 'lucide-react';
import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';
import { BarChartByYears, CompRadar, CompetencyTable, CompetencyTable_course, CompetencyTrendLine } from './CompetencesCharts.jsx';
import { ToastContainer, toast } from 'react-toastify';
import CompetencySegmentation from './CompetencySegmentation';

import FlexRow, { WRAP } from '@components/FlexRow.jsx';

import LoadingSpinner from '@components/ui/LoadingSpinner.jsx';
import FilterHeader from '@components/FilterHeader';

import { COMPETENCIES_NAMES, FIELD_NAMES, MOTIVATORS_NAMES } from '@utils/utilities.js';
import { AdminService } from '@services';

import './AdminCompetencesView.scss';
import TabButton from '@components/ui/TabButton';
import Tooltip from '@components/ui/Tooltip.jsx';
import DraggablePopover from '@components/ui/DraggablePopover.jsx';

import { useAdminStore } from '@utils/store.jsx';

const competencyLabels = {
    ...COMPETENCIES_NAMES,
    ...MOTIVATORS_NAMES
};
function toFixed(number, to = 1) {
    return Math.round(number * 10 ** to) / 10 ** to;
}

const getLabel = key =>
    competencyLabels[key] ||
    competencyLabels[key.replace('res_comp_', '').replace('_', ' ')] ||
    key.replace('res_comp_', '').replace('_', ' ');

const Stat = ({ label, value, prev = 0, suffix = '', isGrowth = false, isText = false, note = undefined }) => {
    if (prev === 0) {
        return (
            <div className="stat-block">
                <div className="value">
                    {value}
                    {suffix}
                </div>
                <div className="label">{label}</div>
            </div>
        );
    } else if (isText) {
        return (
            <div className="stat-block">
                <div className="value">
                    {value}
                    {suffix}
                </div>
                <div className="prev-year">
                    прошлый год: {prev}
                    {suffix}
                </div>
                <div className="label">{label}</div>
                {note !== undefined ? <div className="note">{note}</div> : ''}
            </div>
        );
    } else {
        const diff = (((value || 0) - (prev || 0)) / prev) * 100;
        const isUp = diff >= 0;

        return (
            <div className="stat-block">
                <div className={`trend ${isUp ? 'up' : 'down'}`}>
                    {isUp ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
                    {Math.abs(isGrowth ? value : diff).toFixed(1)}%
                </div>
                <div className="value">
                    {value}
                    {suffix}
                </div>
                <div className="prev-year">
                    прошлый год: {prev}
                    {suffix}
                </div>
                <div className="label">{label}</div>
            </div>
        );
    }
};

function BarChartWithTable({ data, year = '2025', yearsOptions = [], filters = {} }) {
    if (!data) return;

    const years = [];
    const yearsMap = {};
    yearsOptions.forEach(item => {
        const yearValue = parseInt(item.value.split('/')[1]);
        years.push(yearValue);
        yearsMap[yearValue] = item.label;
    });

    const [minValue, setMinValue] = useState(Math.min(...years));
    const [maxValue, setMaxValue] = useState(Math.max(...years));

    const grouped = {};
    data.forEach(item => {
        if (!grouped[item.name]) {
            grouped[item.name] = {
                name: item.name,
                displayName: getLabel(item.name)
            };
        }
        grouped[item.name][item.year] = item.average;
    });
    const chartData = Object.values(grouped);
    const tableData = chartData.map(item => ({
        name: item.name,
        displayName: item.displayName,
        prev_score: item[yearsMap[minValue]] ?? 0,
        score: item[yearsMap[maxValue]] ?? 0
    }));
    const colors = ['#658ed0', '#904acc'];

    return (
        <div className="dashboard-chart-row">
            <div style={{ display: 'flex', alignItems: 'center', paddingLeft: 50, maxWidth: '100%', justifyContent: 'space-between' }}>
                <h4 className="section-label">Распределение по компетенциям (средний балл)</h4>
                <div className="slider-wrapper">
                    <Slider
                        range
                        min={Math.min(...years)}
                        max={Math.max(...years)}
                        step={1}
                        value={[minValue, maxValue]}
                        onChange={([min, max]) => {
                            setMinValue(min);
                            setMaxValue(max);
                        }}
                        marks={yearsMap}
                        style={{ width: '90%', marginRight: '50px' }}
                        handleRender={(node, handleProps) => {
                            const isStart = handleProps.index === 0;
                            return cloneElement(node, {
                                style: {
                                    ...node.props.style,
                                    backgroundColor: isStart ? colors[0] : colors[1],
                                    borderColor: isStart ? colors[0] : colors[1]
                                }
                            });
                        }}
                        styles={{
                            rail: {
                                backgroundColor: '#e5e7eb',
                                height: 6
                            },
                            track: {
                                backgroundColor: '#a2bce6',
                                height: 6
                            }
                        }}
                    />
                </div>
            </div>
            <div className="chart-container">
                <BarChartByYears
                    data={chartData}
                    range={[yearsMap[minValue], yearsMap[maxValue]]}
                    colors={colors}
                />
                <div style={{ padding: 5, marginBottom: 20 }}>
                    <CompetencyTable
                        data={tableData}
                        filters={filters}
                        range={[yearsMap[minValue], yearsMap[maxValue]]}
                    />
                </div>
            </div>
        </div>
    );
}
function CompRadarWithTable({ data, filters }) {
    const [open, setOpen] = useState(false);
    const [position, setPosition] = useState({ x: 600, y: 350 });

    return (
        <div>
            <CompRadar data={data} />
            <button
                className="ct-toggle"
                onMouseDown={e => e.stopPropagation()}
                onClick={() => setOpen(!open)}
            >
                {open ? 'Скрыть таблицу' : 'Показать таблицу'}
            </button>
            <div className={`ct-table-wrap ${open ? 'open' : ''}`}></div>
            <DraggablePopover
                open={open}
                onClose={() => setOpen(false)}
                width={600}
                initialPosition={position}
                onPositionChange={pos => setPosition(pos)}
            >
                <CompetencyTable_course
                    data={data}
                    filters={filters}
                />
            </DraggablePopover>
        </div>
    );
}
function YearsSelect({ year, yearsOptions, onChange }) {
    const [isActive, setIsActive] = useState(false);
    const [isFocused, setIsFocused] = useState(false);

    const selectedYear = useRef(year);
    const options = yearsOptions ?? [];

    const onChangeSelect = value => {
        selectedYear.current = parseInt(value);
        onChange(value);
    };

    return (
        <div className="years-select">
            <div className="extra-title">
                <span>за</span>

                <div
                    className="selected-year"
                    onMouseEnter={() => setIsActive(true)}
                    onMouseLeave={() => {
                        if (!isFocused) setIsActive(false);
                    }}
                    onClick={() => setIsActive(true)}
                >
                    {isActive ? (
                        <select
                            value={year}
                            onFocus={() => setIsFocused(true)}
                            onBlur={() => {
                                setIsFocused(false);
                                setIsActive(false);
                            }}
                            onChange={e => onChangeSelect(e.target.value)}
                        >
                            {options.length &&
                                options.map(option => (
                                    <option
                                        key={option.value}
                                        value={option.value}
                                    >
                                        {option.label}
                                    </option>
                                ))}
                        </select>
                    ) : (
                        <span style={{ fontWeight: 600 }}>{year}</span>
                    )}
                </div>

                <span>учебный год</span>
            </div>
        </div>
    );
}
function Dashboard({ data, filters, onYearChange, yearsOptions }) {
    if (!data) return null;
    const year = data.year;
    const pieData = [
        { 'name': 'Прошли', 'value': data.col2.participated?.amount_in, fill: '#1f66b6' },
        { 'name': 'Не прошли', 'value': data.col2.participated?.students_all - data.col2.participated?.amount_in, fill: 'transparent' }
    ];
    //col2 uni
    const col2_data = { 'header': 'Лидирующий ВУЗ', 'name': data.col2.uni_name, 'score': data.col2.uni_score };

    if (data.col2.uni_place === -1) {
        col2_data['header'] = 'Нет данных за этот год';
        col2_data['name'] = 'Рейтинг';
    } else if (data.col2.uni_place !== 0) {
        col2_data['header'] = 'Рейтинг ВУЗа';
        col2_data['name'] = 'Топ ' + toFixed(data.col2.uni_place, 1).toString() + '%';
    }
    return (
        <div>
            <div className="dashboard-container">
                <div className="dashboard-title">
                    <p> Статистика </p>
                    <YearsSelect
                        year={`${year - 1}/${year}`}
                        yearsOptions={yearsOptions}
                        onChange={onYearChange}
                    />
                </div>
                <div className="dashboard-grid">
                    {/* Левая колонка */}
                    <div className="col-left">
                        <Stat
                            label="студентов прошли курсы"
                            value={data.col1.courses.val}
                            prev={data.col1.courses.prev}
                            suffix="%"
                        />
                        <Stat
                            label="средний уровень компетенций"
                            value={data.col1.avg_lvl.val}
                            prev={data.col1.avg_lvl.prev}
                        />
                        <span className="line-separator"></span>
                        <Stat
                            label={
                                data.col1.motiv.count.curr !== 0
                                    ? `Наибольший мотиватор (${data.col1.motiv.count.curr}%)*`
                                    : 'Нет данных за этот год'
                            }
                            value={getLabel(data.col1.motiv.name.curr)}
                            prev={
                                data.col1.motiv.count.prev != 0
                                    ? getLabel(data.col1.motiv.name.prev) + ` (${data.col1.motiv.count.prev}%)`
                                    : 0
                            }
                            isText={true}
                            note={'*По доли среди студентов'}
                        />
                        <Stat
                            label={
                                data.col1.demotiv.count.curr !== 0
                                    ? `Наибольший демотиватор (${data.col1.demotiv.count.curr}%)*`
                                    : 'Нет данных за этот год'
                            }
                            value={getLabel(data.col1.demotiv.name.curr)}
                            prev={
                                data.col1.demotiv.count.prev != 0
                                    ? getLabel(data.col1.demotiv.name.prev) + ` (${data.col1.demotiv.count.prev}%)`
                                    : 0
                            }
                            isText={true}
                            note={'*По доли среди студентов'}
                        />
                        <span className="line-separator"></span>

                        <div className="col-center">
                            {data.col2.uni_place !== 0 ? (
                                <Stat
                                    label={col2_data['header']}
                                    value={col2_data['name']}
                                />
                            ) : (
                                <div className="uni-info mb-6">
                                    <h4 className="text-xs uppercase text-gray-400 font-bold">{col2_data['header']}</h4>
                                    <div className="text-xl font-bold text-blue-600">
                                        <Tooltip
                                            text={col2_data['name']}
                                            placement="right"
                                        >
                                            {col2_data['name'].length > 50 ? `${col2_data['name'].substring(0, 50)}...` : col2_data['name']}
                                        </Tooltip>
                                    </div>
                                    <div className="text-sm text-gray-500">{toFixed(col2_data['score'], 1)} баллов (среднее)</div>
                                </div>
                            )}
                            <div className="chart-wrapper">
                                <ResponsiveContainer
                                    width="100%"
                                    height="300"
                                >
                                    <PieChart>
                                        <Pie
                                            data={pieData}
                                            dataKey={'value'}
                                            nameKey={'name'}
                                            innerRadius="80"
                                            outerRadius="100"
                                            startAngle={90}
                                            endAngle={-270}
                                        ></Pie>
                                    </PieChart>
                                </ResponsiveContainer>

                                <div className="absolute-center">
                                    {data.col2.participated.students_all === 0 ? (
                                        <p> Нет данных </p>
                                    ) : (
                                        <>
                                            <h2>
                                                {toFixed(
                                                    (data.col2.participated?.amount_in / data.col2.participated?.students_all) * 100,
                                                    1
                                                )}
                                                %
                                            </h2>
                                            <p>Студентов прошли тестирование</p>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Правая колонка */}
                    <div className="col-right">
                        <h4 className="text-xs uppercase text-gray-400 font-bold mb-6">Компетенции</h4>
                        <div style={{ display: 'flex', whiteSpace: 'wrap', gap: '30px', maxWidth: '900px' }}>
                            <Stat
                                label={`Наиболее развитая. Средний балл: ${data.col3.best.val}`}
                                value={getLabel(data.col3.best.name)}
                                isText={true}
                                prev={
                                    data.col3.best_prev.val != 0 ? `${getLabel(data.col3.best_prev.name)} (${data.col3.best_prev.val})` : 0
                                }
                            />
                            <div style={{ height: 20 }}></div>
                            <Stat
                                label={`Наименее развитая. Средний балл: ${data.col3.worst.val}`}
                                value={getLabel(data.col3.worst.name)}
                                isText={true}
                                prev={
                                    data.col3.worst_prev.val != 0
                                        ? `${getLabel(data.col3.worst_prev.name)} (${data.col3.worst_prev.val})`
                                        : 0
                                }
                            />
                        </div>
                        <div className="chart-radar">
                            <CompRadarWithTable
                                data={data?.radar}
                                filters={filters}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function AdminCompetencesView() {
    const savedFilters = useAdminStore(state => state.savedFilters);
    const saveFilters = useAdminStore(state => state.saveFilters); // данные хранилища
    const [dashboardData, setDashboardData] = useState(null);
    const [loadingDash, setLoadingDash] = useState(false);

    const [filters_, setFilters_] = useState(() => {
        const saved = useAdminStore.getState().savedFilters?.Admin;

        return saved && Object.keys(saved).length ? saved : { institute: '', specialty: '', year: '' };
    });

    const [yearsCompetencyData, setYearsCompetencyData] = useState(null);
    const [trendData, setTrendData] = useState(null);
    const [loadingTrend, setLoadingTrend] = useState(false);

    const [activeTab, setActiveTab] = useState('dashboard');
    const loadDashboardStats = async currentFilters => {
        setLoadingDash(true);
        try {
            const data = await AdminService.getDashboardStats(currentFilters.institute, currentFilters.specialty, currentFilters.year);

            if (!data) return;
            setDashboardData(data);
        } finally {
            setLoadingDash(false);
        }
    };

    const loadYearsCompetencyData = async currentFilters => {
        const data = await AdminService.getCompetencyAverageByYears(currentFilters.institute, currentFilters.specialty);
        setYearsCompetencyData(data?.data);
    };

    const [yearsOptions, setYearsOptions] = useState([]);
    const getYearsOptions = async () => {
        const years = await AdminService.getAvailableYears();
        setYearsOptions(years ?? []);
    };
    useEffect(() => {
        getYearsOptions();
    }, []);

    useEffect(() => {
        if (activeTab !== 'dashboard') return;
        loadDashboardStats(filters_);
        loadYearsCompetencyData(filters_);
    }, [filters_, activeTab]);

    const updateFilter = (name, value) => {
        setFilters_(prev => {
            const updated = { ...prev, [name]: value };
            if (name === 'institute') updated.specialty = '';

            saveFilters('Admin', updated); // сохраняем фильтры в хранилище

            return updated;
        });
    };
    const resetFilters = () => {
        setFilters_({ institute: '', specialty: '', year: '' });
    };
    const loadCompetencyTrend = async currentFilters => {
        setLoadingTrend(true);
        try {
            const data = await AdminService.getCompetencyTrendByYear(currentFilters.institute, currentFilters.specialty);
            setTrendData(data);
        } catch (err) {
            console.error('Ошибка при загрузке динамики:', err);
        } finally {
            setLoadingTrend(false);
        }
    };
    useEffect(() => {
        if (activeTab !== 'segmentation') return;
        loadCompetencyTrend(filters_);
    }, [filters_, activeTab]);

    const handleYearChange = selectedYear => {
        setFilters_(prev => {
            const updated = { ...prev, year: selectedYear };
            return updated;
        });
    };

    return (
        <div className="AdminCompetencesView">
            <div className="filters-cont">
                <FilterHeader
                    onFilterChange={updateFilter}
                    filters={filters_}
                    onResetFilters={resetFilters}
                    showYearsSelect={activeTab !== 'dashboard'}
                />
            </div>
            <FlexRow
                margin="0 0 30 0"
                wrap={WRAP.DO}
            >
                <TabButton
                    text={'Дашборд'}
                    onClick={() => setActiveTab('dashboard')}
                    isActive={activeTab === 'dashboard'}
                />
                <TabButton
                    text={'Динамика'}
                    onClick={() => setActiveTab('graphics')}
                    isActive={activeTab === 'graphics'}
                />
                <TabButton
                    text={'Сегментация'}
                    onClick={() => setActiveTab('segmentation')}
                    isActive={activeTab === 'segmentation'}
                />
            </FlexRow>

            {activeTab === 'dashboard' && (
                <>
                    {loadingDash ? (
                        <div className="loading-content">
                            <LoadingSpinner text="Загрузка статистики..." />
                        </div>
                    ) : (
                        <>
                            <Dashboard
                                data={dashboardData}
                                filters={filters_}
                                onYearChange={handleYearChange}
                                yearsOptions={yearsOptions}
                            />
                            <BarChartWithTable
                                data={yearsCompetencyData}
                                yearsOptions={yearsOptions}
                                filters={filters_}
                            />
                        </>
                    )}
                </>
            )}
            {activeTab === 'graphics' && (
                <>
                    {loadingTrend ? (
                        <LoadingSpinner text="Загрузка диаграммы..." />
                    ) : (
                        <CompetencyTrendLine
                            data={trendData}
                            loading={loadingTrend}
                        />
                    )}
                </>
            )}
            {activeTab === 'segmentation' && (
                <>{loadingTrend ? <LoadingSpinner text="Загрузка диаграммы..." /> : <CompetencySegmentation filters={filters_} />}</>
            )}

            <ToastContainer
                position="bottom-right"
                autoClose={3000}
                hideProgressBar={true}
                newestOnTop={false}
                closeOnClick={true}
                rtl={false}
                theme="light"
            />
        </div>
    );
}
export default AdminCompetencesView;
