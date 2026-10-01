import { useState, useEffect, React, useRef, cloneElement } from 'react';
import {
    PieChart,
    Pie,
    ReferenceLine,
    LabelList,
    BarChart,
    Bar,
    Cell,
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as TooltipRecharts,
    Legend,
    ResponsiveContainer
} from 'recharts';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from 'recharts';
import { ArrowUp, ArrowDown } from 'lucide-react';
import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';
import * as XLSX from 'xlsx';

import { ToastContainer, toast } from 'react-toastify';
import CompetencySegmentation from './CompetencySegmentation';

import FlexRow, { ALIGN, JUSTIFY, WRAP } from '@components/FlexRow.jsx';
import ReactApexChart from 'react-apexcharts';

import LoadingSpinner from '@components/ui/LoadingSpinner.jsx';
import FilterHeader from '@components/FilterHeader';

import { COMPETENCIES_NAMES, FIELD_NAMES, LINK_TREE, MOTIVATORS_NAMES } from '@utils/utilities.js';
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
// для сравнения

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

//таблица
function CompetencyTable({ data, filters, range }) {
    const [ prevYear, year] = range;
    const [tableOpen, setTableOpen] = useState(false);
    if (!data) return null;

    const exportToExcel = () => {
        try {
            const excelData = [];
            data.forEach(row => {
                if (!row) return;

                const hasPrev = row.prev_score !== 0 && row.prev_score;
                const hasCurrent = row.score !== 0 && row.score;

                const delta = hasPrev && hasCurrent ? toFixed(row.score, 1) - toFixed(row.prev_score, 1) : null;

                const procent = delta !== null && hasPrev ? toFixed((delta * 100) / toFixed(row.prev_score, 1), 2) : null;

                const formatValue = val => (val === 0 ? 0 : val || '—');
                const formatDelta = val => (val === null ? '—' : val > 0 ? `+${val}` : val);
                const formatPercent = val => (val === null ? '—' : val > 0 ? `+${val}%` : `${val}%`);

                excelData.push({
                    'Компетенция': row.displayName || '—',
                    [`Средний балл ${prevYear}`]: formatValue(hasPrev ? Math.round(row.prev_score) : null),
                    [`Средний балл ${year}`]: formatValue(hasCurrent ? Math.round(row.score) : null),
                    'Разница': formatDelta(delta),
                    '%': formatPercent(procent)
                });
            });

            const header = `${filters.institute ? `${filters.institute}, ` : ''} ${filters.specialty ? `${filters.specialty}, ` : ''} ${prevYear} - ${year} учебные года `;
            const worksheet = XLSX.utils.aoa_to_sheet([[header]]);
            XLSX.utils.sheet_add_json(worksheet, excelData, { origin: 'A2', skipHeader: false });

            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, `Компетенции ${prevYear.split('/')[0]}-${year.split('/')[1]}`);
            XLSX.writeFile(workbook, `Показатели_Компетенций_${prevYear.split('/')[0]}_${year.split('/')[1]}.xlsx`);
            toast.success('Файл сформирован');
        } catch (error) {
            console.error('Ошибка при генерации Excel файла:', error);
            toast.error('Не удалось сформировать Excel файл.');
        }
    };

    return (
        <div className="table">
            <button
                className="ct-toggle"
                onClick={() => setTableOpen(v => !v)}
            >
                <span className={`ct-arrow ${tableOpen ? 'open' : ''}`}>▼</span>
                {tableOpen ? 'Скрыть таблицу' : 'Показать таблицу'}
            </button>
            <div className={`ct-table-wrap ${tableOpen ? 'open' : ''}`}>
                <div className="table-container">
                    <div className="ct-top">
                        <button
                            className="btnExcel"
                            onClick={() => exportToExcel()}
                            onMouseOver={e => (e.target.style.backgroundColor = '#15803d')}
                            onMouseOut={e => (e.target.style.backgroundColor = '#16a34a')}
                        >
                            Скачать
                        </button>
                    </div>
                    <table className="ct-table">
                        <thead>
                            <tr>
                                <th rowSpan={2}>Компетенция</th>
                                <th colSpan={3}>Средний балл</th>
                                <th rowSpan={2}>%</th>
                            </tr>
                            <tr>
                                <th style={{ textAlign: 'center' }}>
                                    {prevYear}
                                </th>
                                <th style={{ textAlign: 'center' }}>
                                    {year}
                                </th>
                                <th style={{ textAlign: 'center' }}>Разница</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.map(row => {
                                const delta =
                                    row.score !== 0 && row.prev_score !== 0 ? toFixed(row.score, 1) - toFixed(row.prev_score, 1) : null;
                                const procent = delta != null ? toFixed((delta * 100) / toFixed(row.prev_score, 1), 2) : null;
                                return (
                                    <tr key={row.displayName}>
                                        <td className="ct-name">{row.displayName}</td>
                                        <td>{row.prev_score !== 0 ? toFixed(row.prev_score, 1) : '—'}</td>
                                        <td>{row.score !== 0 ? toFixed(row.score, 1) : '—'}</td>
                                        <td>
                                            {delta === null ? (
                                                '—'
                                            ) : (
                                                <span className={delta > 0 ? 'ct-pos' : delta < 0 ? 'ct-neg' : 'ct-zero'}>
                                                    {delta > 0 ? '+' : ''}
                                                    {toFixed(delta, 2)}
                                                </span>
                                            )}
                                        </td>
                                        <td>
                                            {procent === null ? (
                                                '—'
                                            ) : (
                                                <span className={procent > 0 ? 'ct-pos' : procent < 0 ? 'ct-neg' : 'ct-zero'}>
                                                    {procent > 0 ? '+' : ''}
                                                    {procent}
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

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
                displayName: getLabel(item.name),
            };
        }
        grouped[item.name][item.year] = item.average;
    });
    const chartData = Object.values(grouped);
    const tableData = chartData.map(item => ({
        name: item.name,
        displayName: item.displayName,
        prev_score: item[yearsMap[minValue]] ?? 0,
        score: item[yearsMap[maxValue]] ?? 0,
    }));
    const colors = ['#658ed0', '#904acc'];

    return (
        <div className="dashboard-chart-row">
            <div style={{ display: 'flex', alignItems: 'center', gap: 50, paddingLeft: 50 }}>
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
                        style={{ width: '400px' }}
                        handleRender={(node, handleProps) => {
                            const isStart = handleProps.index === 0;
                            return cloneElement(node, {
                                style: {
                                    ...node.props.style,
                                    backgroundColor: isStart ? colors[0] : colors[1],
                                    borderColor: isStart ? colors[0] : colors[1],
                                },
                            });
                        }}
                        styles={{
                            rail: {
                                backgroundColor: '#e5e7eb',
                                height: 6,
                            },
                            track: {
                                backgroundColor: '#a2bce6',
                                height: 6,
                            },
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
    )
}

function BarChartByYears({ data, range, colors = ['#658ed0', '#904acc'] }) {
    const [minYear, maxYear] = range;
    return (
        <>
            <div style={{ width: '100%', height: 400 }}>
                <ResponsiveContainer>
                    <BarChart
                        data={data}
                        barGap={5}
                        barCategoryGap="25%"
                        margin={{ top: 20, right: 30, left: 10, bottom: 70 }}
                    >
                        <CartesianGrid
                            strokeDasharray="3 3"
                            vertical={false}
                            stroke="#f1f5f9"
                        />

                        <ReferenceLine
                            y={0}
                            stroke="#333"
                            strokeWidth={1.5}
                        />
                        <XAxis
                            dataKey="displayName"
                            interval={0}
                            angle={-20}
                            tick={{
                                fontSize: 11,
                                fill: ' #64748b',
                                dy: 11
                            }}
                            tickMargin={12}
                            tickLine={false}
                            dx={-50}
                            height={45}
                            textAnchor="end"
                        />
                        <YAxis
                            domain={[0, 850]}
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                            tick={{ fill: ' #94a3b8' }}
                            label={{ value: 'Средний балл', angle: -90, position: 'insideLeft', fontSize: 11, fill: 'rgb(122, 136, 156)' }}
                        />
                        <TooltipRecharts
                            cursor={{ fill: '#f8fafc' }}
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                            labelFormatter={label => `Компетенция: ${label}`}
                            formatter={value => [value, 'баллы ']}
                        />

                        <Bar
                            name={range[1]}
                            dataKey={range[1]}
                            fill={colors[0]}
                            radius={[6, 6, 0, 0]}
                            barSize={22}
                        >
                            <LabelList
                                formatter={value => Math.round(value)}
                                position="top"
                                offset={5}
                                fontSize={12}
                                fill="rgb(81, 87, 110)"
                            />
                        </Bar>
                        <Bar
                            name={range[0]}
                            dataKey={range[0]}
                            fill={colors[1]}
                            radius={[6, 6, 0, 0]}
                            barSize={22}
                        >
                            <LabelList
                                formatter={value => Math.round(value)}
                                position="top"
                                offset={5}
                                fontSize={11}
                                fill="rgb(139, 148, 174)"
                            />
                        </Bar>
                        <Legend
                            verticalAlign="top"
                            align="right"
                            fontSize={8}
                        ></Legend>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </>
    );
}
function CompetencyTable_course({ data, filters }) {
    const [range, setRange] = useState([1, 4]);
    if (!data) return null;
    const course = [
        { key: 'course_1', name: '1 Курс' },
        { key: 'course_2', name: '2 Курс' },
        { key: 'course_3', name: '3 Курс' },
        { key: 'course_4', name: '4 Курс' }
    ];
    const DeltaCell = ({ value }) => {
        if (value === null) return <span style={{ color: '#ccc' }}>—</span>;

        const className = value > 0 ? 'ct-pos' : value < 0 ? 'ct-neg' : 'ct-zero';
        const prefix = value > 0 ? '+' : '';
        return (
            <span className={className}>
                {prefix}
                {value}%
            </span>
        );
    };
    const calculateDelta = row => {
        const [start, end] = range;
        const vStart = Number(row[`course_${start}`]) || 0;
        const vEnd = Number(row[`course_${end}`]) || 0;

        if (vStart === 0 || vEnd === 0) return null;

        const delta = vEnd - vStart;
        return Math.round((delta * 100) / vStart);
    };
    const exportToExcel = () => {
        try {
            const year = filters.year.split('/')[1];
            const excelData = [];
            data.forEach(row => {
                if (!row) return;

                const label = getLabel(row.name);

                // Вычисляем динамику по ползунку
                let deltaValue = '—';
                const delta = calculateDelta(row);

                if (delta) {
                    deltaValue = delta > 0 ? `+${delta}` : delta;
                }

                const rowObject = {
                    'Компетенция': label
                };

                for (let i = 1; i <= 4; i++) {
                    const val = row[`course_${i}`];
                    const columnName = `${i} курс`;

                    rowObject[columnName] = val !== 0 && !val ? '—' : Math.round(val);
                }

                const deltaHeader = range && range.length === 2 ? `Динамика (курсы с ${range[0]} по ${range[1]})` : 'Динамика';

                rowObject[deltaHeader] = deltaValue;

                excelData.push(rowObject);
            });
            const header = `${filters.institute ? `${filters.institute}, ` : ''} ${filters.specialty ? `${filters.specialty}, ` : ''} ${filters.year ? `${filters.year} учебный год ` : ''}`;
            const worksheet = XLSX.utils.aoa_to_sheet([[header]]);
            XLSX.utils.sheet_add_json(worksheet, excelData, { origin: 'A2', skipHeader: false });

            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, `Компетенции ${year ? `${year - 1}/${year}` : ''}`);
            XLSX.writeFile(workbook, `Компетенции_по_курсам_${year || ''}.xlsx`);
            toast.success('Файл загружен');
        } catch (error) {
            console.error('Ошибка при генерации Excel файла:', error);
            toast.error('Не удалось сформировать Excel файл.');
        }
    };

    return (
        <div className="table-container">
            <div className="ct-top">
                <button
                    className="btnExcel"
                    onClick={() => exportToExcel()}
                    onMouseOver={e => (e.target.style.backgroundColor = '#15803d')}
                    onMouseOut={e => (e.target.style.backgroundColor = '#16a34a')}
                >
                    Скачать
                </button>
                <p className="slider-note">*перетащите полузнки, чтобы изменить</p>
            </div>
            <table className="ct-table">
                <thead>
                    <tr>
                        <th rowSpan={2}>Компетенция</th>
                        <th colSpan={4}>Средний балл</th>
                        <th rowSpan={2} style={{minWidth: '120px'}}>
                            <div className="slider-wrapper">
                                <div className="slider-container">
                                    <p className="slider-label">
                                        Динамика по курсам с {range[0]} по {range[1]}
                                    </p>
                                    <Slider
                                        range
                                        min={1}
                                        max={4}
                                        step={1}
                                        value={range}
                                        onChange={setRange}
                                        marks={{
                                            1: '1',
                                            2: '2',
                                            3: '3',
                                            4: '4'
                                        }}
                                    />
                                </div>
                            </div>
                        </th>
                    </tr>
                    <tr>
                        {course.map(i => {
                            return <th style={{ textAlign: 'center' }}>{i.name}</th>;
                        })}
                    </tr>
                </thead>
                <tbody>
                    {data.map(row => (
                        <tr key={row.name}>
                            <td className="ct-name">{getLabel(row.name)}</td>
                            {Array.from({ length: 4 }, (_, i) => {
                                const value = row[`course_${i + 1}`];
                                const prev = i > 1 ? row[`course_${i + 1}`] : value;
                                const className = value > prev ? 'ct-pos' : value < prev ? 'ct-neg' : 'ct-zero';
                                return (
                                    <td
                                        className={className}
                                        key={i}
                                    >
                                        {value != 0 || value ? Math.round(value) : '—'}
                                    </td>
                                );
                            })}
                            <td className="ct-zero">
                                {(() => {
                                    const delta = calculateDelta(row);
                                    return <DeltaCell value={delta} />;
                                })()}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

//паутинка
function CompRadar({ data }) {
    const [hoveredCourse, setHoveredCourse] = useState(null);
    const [visibleCourses, setVisibleCourses] = useState({
        course_1: true,
        course_2: true,
        course_3: true,
        course_4: true
    });

    const courseConfig = [
        { key: 'course_1', name: '1 Курс', color: '#8884d8' },
        { key: 'course_2', name: '2 Курс', color: '#82ca9d' },
        { key: 'course_3', name: '3 Курс', color: '#ffc658' },
        { key: 'course_4', name: '4 Курс', color: '#ff8042' }
    ];
    if (!data) {
        console.log('CompRadar: ошибка загрузки данных');
        return <div className="p-4 text-gray-500">Нет данных для отображения</div>;
    }

    const getStrokeOpacity = course => {
        if (!hoveredCourse) return 1;
        return hoveredCourse === course ? 1 : 0.1;
    };

    const toggleCourse = courseKey => {
        setVisibleCourses(prev => ({
            ...prev,
            [courseKey]: !prev[courseKey]
        }));
    };

    return (
        <div className="RadarContainer">
            {/*панель с чекбоксами */}
            <div className="chooseBoxes">
                <h3 style={{ fontSize: '16px', marginBottom: '25px' }}>Курсы</h3>
                {courseConfig.map(course => (
                    <label
                        key={course.key}
                        style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '8px', cursor: 'pointer' }}
                    >
                        <input
                            type="checkbox"
                            checked={visibleCourses[course.key]}
                            onChange={() => toggleCourse(course.key)}
                            style={{ accentColor: course.color }}
                        />
                        <span style={{ fontSize: '12px' }}>{course.name}</span>
                    </label>
                ))}
            </div>

            <div
                className="radarChart"
                style={{ flex: 1 }}
            >
                <ResponsiveContainer
                    width="110%"
                    height="100%"
                >
                    <RadarChart
                        cx="50%"
                        cy="50%"
                        outerRadius="80%"
                        data={data}
                        marginLeft={50}
                    >
                        <PolarGrid stroke="#e0e0e0" />
                        <PolarAngleAxis
                            dataKey="name"
                            tickFormatter={getLabel}
                            tick={{ fill: '#666', fontSize: 10 }}
                        />
                        <PolarRadiusAxis
                            angle={30}
                            domain={[0, 800]}
                            tick={false}
                            axisLine={false}
                        />

                        {courseConfig.map(
                            course =>
                                visibleCourses[course.key] && (
                                    <Radar
                                        key={course.key}
                                        name={course.name}
                                        dataKey={course.key}
                                        stroke={course.color}
                                        fill={course.color}
                                        fillOpacity={0.09}
                                        strokeOpacity={getStrokeOpacity(course.key)}
                                        onMouseEnter={() => setHoveredCourse(course.key)}
                                        onMouseLeave={() => setHoveredCourse(null)}
                                        animationDuration={400}
                                    />
                                )
                        )}

                        <TooltipRecharts
                            labelFormatter={label => getLabel(label)}
                            // name имя из конфига
                            formatter={(value, name) => [value.toFixed(1), name]}
                            contentStyle={{
                                borderRadius: '8px',
                                border: 'none',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                            }}
                        />
                        {/*<Legend
                            verticalAlign="bottom"
                            onMouseEnter={o => setHoveredCourse(o.dataKey)}
                            onMouseLeave={() => setHoveredCourse(null)}
                        />*/}
                    </RadarChart>
                </ResponsiveContainer>
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
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => setOpen(!open)}
            >
                {open ? 'Скрыть таблицу' : 'Показать таблицу'}
            </button>
            <div className={`ct-table-wrap ${open ? 'open' : ''}`}></div>
            <DraggablePopover open={open} onClose={() => setOpen(false)} width={600} 
                                initialPosition={position} onPositionChange={(pos) => setPosition(pos)}>
                <CompetencyTable_course 
                                data={data}
                                filters={filters}/>
            </DraggablePopover>
        </div>
    )
}
function YearsSelect({ year, yearsOptions, onChange }) {
    const [isActive, setIsActive] = useState(false);
    const [isFocused, setIsFocused] = useState(false);

    const selectedYear = useRef(year);
    const options = yearsOptions ?? [];

    const onChangeSelect = (value) => {
        selectedYear.current = parseInt(value);
        onChange(value);
    };

    return (
        <div className="years-select">
            <div
                className="extra-title"
            >
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
                            {options.length && options.map(option => (
                                <option key={option.value} value={option.value}>
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
    )
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
                    <YearsSelect year={`${year-1}/${year}`} yearsOptions={yearsOptions} onChange={onYearChange} />
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
                        <span className='line-separator'></span>
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
                        <span className='line-separator'></span>

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
                                    <Tooltip text={col2_data['name']} placement='right'>
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
                                            {toFixed((data.col2.participated?.amount_in / data.col2.participated?.students_all) * 100, 1)}%
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
                        <div style={{display: 'flex', whiteSpace: 'wrap', gap: '30px', maxWidth: '900px'}}>
                        <Stat
                            label={`Наиболее развитая. Средний балл: ${data.col3.best.val}`}
                            value={getLabel(data.col3.best.name)}
                            isText={true}
                            prev={data.col3.best_prev.val != 0 ? `${getLabel(data.col3.best_prev.name)} (${data.col3.best_prev.val})` : 0}
                        />
                        <div style={{ height: 20 }}></div>
                        <Stat
                            label={`Наименее развитая. Средний балл: ${data.col3.worst.val}`}
                            value={getLabel(data.col3.worst.name)}
                            isText={true}
                            prev={
                                data.col3.worst_prev.val != 0 ? `${getLabel(data.col3.worst_prev.name)} (${data.col3.worst_prev.val})` : 0
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

const TREND_COLORS = [
    '#1f66b6',
    '#e74c3c',
    '#27ae60',
    '#f39c12',
    '#9b59b6',
    '#16a085',
    '#e67e22',
    '#34495e',
    '#d35400',
    '#2980b9',
    '#c0392b',
    '#7f8c8d'
];

function CompetencyTrendLine({ data, loading }) {
    const [hiddenLines, setHiddenLines] = useState({});
    const [connectDots, setConnectDots] = useState(true);

    if (loading) return <div style={{ padding: 20 }}>Загрузка графика динамики...</div>;
    if (!data || !data.trends || data.trends.length === 0) {
        return (
            <div style={{ padding: 20, textAlign: 'center', color: '#888' }}>Нет данных для построения графика динамики компетенций</div>
        );
    }

    const allCourses = new Set();
    data.trends.forEach(t => t.points.forEach(p => allCourses.add(p.course)));
    const sortedCourses = Array.from(allCourses).sort((a, b) => a - b);

    const chartData = sortedCourses.map(course => {
        const row = { course: `${course} курс` };
        data.trends.forEach(t => {
            const point = t.points.find(p => p.course === course);
            const label = COMPETENCIES_NAMES[t.competency] || t.competency;
            row[label] = point ? point.avg : null;
        });
        return row;
    });

    return (
        <div
            className="competency-trend-line"
            style={{
                background: '#fff',
                borderRadius: 8,
                marginTop: 20,
                boxShadow: '0 2px 4px rgba(0,0,0,0.08)'
            }}
        >
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 16,
                    flexWrap: 'wrap',
                    gap: 12
                }}
            >
                <h2 style={{ margin: 0, color: '#333' }}>Динамика компетенций по курсам обучения</h2>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {/* Переключатель соединения точек */}
                    <label
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '6px 12px',
                            border: '1px solid #ccc',
                            borderRadius: 4,
                            background: connectDots ? '#eaf3fb' : '#fff',
                            cursor: 'pointer',
                            fontSize: 13,
                            userSelect: 'none'
                        }}
                        title="Соединить точки прямыми отрезками"
                    >
                        <input
                            type="checkbox"
                            checked={connectDots}
                            onChange={e => setConnectDots(e.target.checked)}
                            style={{ cursor: 'pointer' }}
                        />
                        Соединять линиями
                    </label>
                    <button
                        type="button"
                        onClick={() => setHiddenLines({})}
                        style={{
                            padding: '6px 12px',
                            border: '1px solid #ccc',
                            borderRadius: 4,
                            background: '#fff',
                            cursor: 'pointer',
                            fontSize: 13
                        }}
                    >
                        Показать все
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            const all = {};
                            data.trends.forEach(t => {
                                const lbl = COMPETENCIES_NAMES[t.competency] || t.competency;
                                all[lbl] = true;
                            });
                            setHiddenLines(all);
                        }}
                        style={{
                            padding: '6px 12px',
                            border: '1px solid #ccc',
                            borderRadius: 4,
                            background: '#fff',
                            cursor: 'pointer',
                            fontSize: 13
                        }}
                    >
                        Скрыть все
                    </button>
                </div>
            </div>
            <ResponsiveContainer
                width="100%"
                height={500}
            >
                <LineChart
                    data={chartData}
                    margin={{ top: 20, right: 30, left: 0, bottom: 20 }}
                >
                    <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#e0e0e0"
                    />
                    <XAxis
                        dataKey="course"
                        tick={{ fill: '#555', fontSize: 12 }}
                    />
                    <YAxis
                        tick={{ fill: '#555', fontSize: 12 }}
                        domain={['dataMin - 20', 'dataMax + 20']}
                        allowDecimals={false}
                        label={{
                            value: 'Среднее значение',
                            angle: -90,
                            position: 'insideLeft',
                            style: { textAnchor: 'middle', fill: '#555' }
                        }}
                    />
                    <TooltipRecharts
                        contentStyle={{
                            background: '#fff',
                            border: '1px solid #ccc',
                            borderRadius: 4
                        }}
                    />
                    <Legend
                        wrapperStyle={{ paddingTop: 10, cursor: 'pointer' }}
                        iconType="circle"
                        onClick={entry => {
                            setHiddenLines(prev => ({
                                ...prev,
                                [entry.dataKey]: !prev[entry.dataKey]
                            }));
                        }}
                        formatter={value => (
                            <span
                                style={{
                                    color: hiddenLines[value] ? '#bbb' : '#333',
                                    textDecoration: hiddenLines[value] ? 'line-through' : 'none'
                                }}
                            >
                                {value}
                            </span>
                        )}
                    />
                    {data.trends.map((trend, idx) => {
                        const label = COMPETENCIES_NAMES[trend.competency] || trend.competency;
                        const color = TREND_COLORS[idx % TREND_COLORS.length];
                        return (
                            <Line
                                key={trend.competency}
                                // type="linear" — прямые отрезки между точками, без плавной кривой.
                                // Это статистически корректно для категориальных значений (курсы 1-4).
                                type="linear"
                                dataKey={label}
                                // Если переключатель ВЫКЛ — линию делаем полностью прозрачной (видны только точки).
                                // Если ВКЛ — рисуем прямые отрезки между точками.
                                stroke={color}
                                strokeWidth={2}
                                strokeOpacity={connectDots ? 1 : 0}
                                // Точки: крупные кружки с белой обводкой — заметные на любом фоне.
                                dot={{
                                    r: 6,
                                    fill: color,
                                    stroke: '#fff',
                                    strokeWidth: 2
                                }}
                                activeDot={{
                                    r: 8,
                                    fill: color,
                                    stroke: '#fff',
                                    strokeWidth: 2
                                }}
                                connectNulls={false}
                                hide={!!hiddenLines[label]}
                                isAnimationActive={false}
                            />
                        );
                    })}
                </LineChart>
            </ResponsiveContainer>
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

        return saved && Object.keys(saved).length
            ? saved
            : { institute: '', specialty: '', year: '' };
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
        }
        finally{ 
            setLoadingDash(false);
        }
    };

    const loadYearsCompetencyData = async currentFilters => {
        const data = await AdminService.getCompetencyAverageByYears(currentFilters.institute, currentFilters.specialty);
        setYearsCompetencyData(data?.data);
    }

    const [yearsOptions, setYearsOptions] = useState([]);
    const getYearsOptions = async () => {
        const years = await AdminService.getAvailableYears();
        setYearsOptions(years ?? []);
    };
    useEffect(() => {
        getYearsOptions();
    }, []);

    useEffect(() => {
        loadDashboardStats(filters_);
        loadYearsCompetencyData(filters_);
    }, [filters_]);
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
        loadCompetencyTrend(filters_);
    }, [filters_]);

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
                    ) : (<>
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
