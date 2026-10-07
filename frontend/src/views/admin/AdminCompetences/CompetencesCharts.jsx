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
import * as XLSX from 'xlsx';
import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';

import { ToastContainer, toast } from 'react-toastify';
import { COMPETENCIES_NAMES } from '@utils/utilities.js';

import './AdminCompetencesView.scss';

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
    
export function BarChartByYears({ data, range, colors = ['#658ed0', '#904acc'] }) {
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
//таблица
export function CompetencyTable({ data, filters, range }) {
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

export function CompetencyTable_course({ data, filters }) {
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
export function CompRadar({ data }) {
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

export function CompetencyTrendLine({ data, loading }) {
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