
import React, { useEffect, useState } from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer
} from 'recharts';
import { StudentService } from '@services';

const StudentVamChart = ({
    studentId,
    competency = 'res_comp_leadership'
}) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            if (!studentId) {
                setData({
                    hasData: false,
                    message: 'Студент не выбран',
                    chartData: [],
                    info: null,
                    avgVam: null
                });
                return;
            }

            setLoading(true);
            setData(null);

            try {
                const result = await StudentService.getAnalyzeStudentVam(
                    studentId,
                    competency
                );

                // Сервер сообщил, что данных для VAM недостаточно
                if (result.has_data === false) {
                    if (!cancelled) {
                        setData({
                            hasData: false,
                            message: result.message || 'Нет данных для VAM',
                            chartData: [],
                            info: null,
                            avgVam: null
                        });
                    }
                    return;
                }

                // Преобразуем результаты для графика
                const chartData = (result.growth_by_period || []).map(item => ({
                    period: `${item.course} курс`,
                    actual: item.actual_growth,
                    value_added: item.value_added
                }));

                if (!cancelled) {
                    setData({
                        hasData: chartData.length > 0,
                        message: chartData.length > 0
                            ? ''
                            : 'Нет данных для построения графика',
                        info: result.student_info,
                        measurements: result.measurements,
                        avgVam: result.average_value_added,
                        chartData
                    });
                }

            } catch (error) {
                if (!cancelled) {
                    setData({
                        hasData: false,
                        message: 'Не удалось загрузить данные VAM',
                        chartData: [],
                        info: null,
                        avgVam: null
                    });
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        load();

        return () => {
            cancelled = true;
        };
    }, [studentId, competency]);

    // Пока данные загружаются
    if (loading || !data) {
        return <div className="loading">Загрузка VAM...</div>;
    }

    const hasData = data.hasData;
    const averageVam = Number(data.avgVam);

    return (
        <div className="student-vam-chart">
            <h4>
                Value-Added
                {data.info?.name ? ` для ${data.info.name}` : ''}
            </h4>

            {hasData && Number.isFinite(averageVam) ? (
                <p>Средний VAM: {averageVam.toFixed(2)}</p>
            ) : (
                <p>{data.message || 'Нет данных для расчёта VAM'}</p>
            )}

            <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data.chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="period" />
                    <YAxis />
                    <Tooltip />
                    <Legend />

                    <Line
                        type="monotone"
                        dataKey="actual"
                        stroke="#1976d2"
                        name="Фактический прирост"
                    />

                    <Line
                        type="monotone"
                        dataKey="value_added"
                        stroke="#ff9800"
                        name="Value-Added"
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
};

export default StudentVamChart;
