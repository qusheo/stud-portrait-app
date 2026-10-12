import { useEffect } from 'react';
import { X } from 'lucide-react';

const fields = [
    ['Должность', 'position'],
    ['Образовательная организация', 'institution'],
    ['Уровень образования', 'edu_level'],
    ['Учёная степень', 'academic_degree'],
    ['Учёное звание', 'academic_title'],
    ['Квалификация', 'qualification'],
    ['Стаж работы', 'experience_text'],
];

function TeacherView({ teacher, onClose }) {
    useEffect(() => {
        const onKeyDown = event => { if (event.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [onClose]);

    return (
        <div className="TeacherView__backdrop" onClick={onClose}>
            <div
                className="TeacherView"
                role="dialog"
                aria-modal="true"
                aria-label={teacher.name}
                onClick={event => event.stopPropagation()}
            >
                <header className="TeacherView__header">
                    <h2>{teacher.name}</h2>
                    <button type="button" title="Закрыть" aria-label="Закрыть" onClick={onClose}>
                        <X size={18} />
                    </button>
                </header>
                <div className="TeacherView__body">
                    <dl className="TeacherView__fields">
                        {fields.map(([label, key]) => (
                            <div key={key}>
                                <dt>{label}</dt>
                                <dd>{teacher[key] || 'Не указано'}</dd>
                            </div>
                        ))}
                    </dl>
                    {[
                        ['Дисциплины', teacher.disciplines],
                        ['Повышение квалификации', teacher.professional_development],
                        ['Профессиональная переподготовка', teacher.professional_retraining],
                    ].map(([title, items]) => items?.length > 0 && (
                        <section key={title}>
                            <h3>{title}</h3>
                            <ul>{items.map((item, index) => <li key={index}>{item}</li>)}</ul>
                        </section>
                    ))}
                    <a href={teacher.source_url} target="_blank" rel="noreferrer">Источник: ТюмГУ</a>
                </div>
            </div>
        </div>
    );
}

export default TeacherView;
