import { useState } from "react";
import './TeacherView.scss';

const fields = [
    { key: 'name', label: 'Фио'},
    { key: 'gender', label: 'Пол' },
    { key: 'position', label: 'Должность' },
    { key: 'disciplines', label: 'Дисциплины' },
    { key: 'institution', label: 'Образовательная организация' },
    { key: 'edu_level', label: 'Уровень образования' },
    { key: 'academic_degree', label: 'Учёная степень' },
    { key: 'academic_title', label: 'Учёное звание' },
    { key: 'qualification', label: 'Квалификация' },
    { key: 'experience', label: 'Стаж работы' },
];

function TeacherView({ teacher }) {
    if (!teacher) return null;

    const renderValue = (key, value) => {
        if (key === 'disciplines') {
            const disciplines = teacher.disciplinesList ?? value;
            return Array.isArray(disciplines) ? disciplines.join(', ') : disciplines ?? '—';
        }

        if (key === 'experience') {
            return !teacher?.experience || teacher?.experience === 0
                ?  '—' : (
                    <div className="TeacherView__experience">
                        <div>{teacher.experience} лет</div>
                    </div>
                );
        }

        return value ?? '—';
    };
    
    return (
        <div className="TeacherView">
            {fields.map(({ key, label }) => (
                <div key={key} className="TeacherView__block">
                    <div className="TeacherView__label">{label}</div>
                    <div className="TeacherView__value">{renderValue(key, teacher[key])}</div>
                </div>
            ))}
        </div>
    );
}

export default TeacherView;