// components/charts/StudentDisciplineImpact.jsx
import React, { useState, useEffect } from 'react';

import { StudentService } from '@services';
import { COMPETENCIES_NAMES } from '@utils/utilities';

const StudentDisciplineImpact = ({ studentId }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!studentId) return;
        setLoading(true);
        const load = async () => {
            try {
                const result = await StudentService.getStudentDisciplineImpact(studentId);
                setData(result.data);
            } catch (err) {
                console.error(err);
                setError('Ошибка загрузки данных');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [studentId]);

    if (loading) return <div className="loading">Загрузка влияния дисциплин...</div>;
    if (error) return <div className="no-data">Ошибка: {error}</div>;
    if (!data || data.length === 0) return <div className="no-data">Нет данных о влиянии дисциплин</div>;

    return (
        <div className="student-discipline-impact">
            <h3>📚 Влияние дисциплин на ваши компетенции</h3>
            <p className="info-text">Для каждой дисциплины показаны баллы компетенций до и после её изучения, а также изменение.</p>
            <div className="disciplines-list">
                {data.map((item, idx) => (
                    <div
                        key={idx}
                        className="discipline-card"
                    >
                        <div className="discipline-header">
                            <strong>{item.discipline}</strong>
                            <span>Оценка: {item.grade}</span>
                            <span>Год: {item.year}</span>
                        </div>
                        <table className="impact-table">
                            <thead>
                                <tr>
                                    <th>Компетенция</th>
                                    <th>До</th>
                                    <th>После</th>
                                    <th>Изменение</th>
                                </tr>
                            </thead>
                            <tbody>
                                {Object.entries(item.competencies_before).map(([comp, before]) => {
                                    const after = item.competencies_after[comp];
                                    if (after === undefined) return null;
                                    const diff = after - before;
                                    const diffClass = diff > 0 ? 'positive' : diff < 0 ? 'negative' : 'neutral';
                                    return (
                                        <tr key={comp}>
                                            <td>{COMPETENCIES_NAMES[comp] || comp}</td>
                                            <td>{before}</td>
                                            <td>{after}</td>
                                            <td className={`diff ${diffClass}`}>
                                                {diff > 0 ? '+' : ''}
                                                {diff}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default StudentDisciplineImpact;
