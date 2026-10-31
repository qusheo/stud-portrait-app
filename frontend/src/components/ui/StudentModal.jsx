import { Modal } from 'antd';
import { useNavigate } from 'react-router-dom';

import { COMPETENCIES_NAMES, MOTIVATORS_NAMES, VALUES_NAMES } from '@utils/utilities.js';
import Button from './Button.jsx';
import './StudentModal.scss';

const getScores = (student, names, nestedKey) =>
    Object.entries(names)
        .map(([key, name]) => ({
            name,
            score: Number(student?.[key] ?? student?.[nestedKey]?.[key])
        }))
        .filter(item => Number.isFinite(item.score) && item.score > 0)
        .sort((a, b) => b.score - a.score);

const formatValue = value => (value === null || value === undefined || value === '' ? '—' : value);

function ScoreSection({ title, items, type }) {
    if (!items.length) {
		return (
			<section className={`StudentModal__score-section StudentModal__score-section--${type}`}>
				<h4>{title}</h4>
				<ul>
					<span>Отсутствуют</span>
				</ul>
			</section>
		);
	}

    return (
        <section className={`StudentModal__score-section StudentModal__score-section--${type}`}>
            <h4>{title}</h4>
            <ul>
                {items.map(item => (
                    <li key={item.name}>
                        <span>{item.name}</span>
                        <strong>{item.score}</strong>
                    </li>
                ))}
            </ul>
        </section>
    );
}

function StudentModal({ open, student, onClose }) {
    const navigate = useNavigate();
    const competencies = getScores(student, COMPETENCIES_NAMES, 'competences');
    const motivators = getScores(student, MOTIVATORS_NAMES, 'motivators');
    const values = getScores(student, VALUES_NAMES, 'values');
    const averageCompetency = competencies.length
        ? Math.round((competencies.reduce((sum, item) => sum + item.score, 0) / competencies.length) * 10) / 10
        : null;

    const studentName =
        student?.name || student?.part_name || (student?.participant != null ? `Студент № ${student.participant}` : 'Студент');

    const generalInfo = [
        ['ID РСВ', student?.participant],
        ['Пол', student?.part_gender],
        ['Учебный год', student?.res_year],
        ['Центр', student?.center],
        ['Образовательная организация', student?.institution],
        ['Уровень образования', student?.edu_level],
        ['Курс', student?.res_course_num],
        ['Форма обучения', student?.study_form],
        ['Специальность', student?.specialty]
    ];

    const redirectToPortrait = () => {
        if (student?.part_id) {
            navigate('/admin/portrait', { state: { studentId: student.part_id } });
        }
    };

    return (
        <Modal
            className="StudentModal"
            open={open}
            centered
            footer={null}
            onCancel={onClose}
            title={studentName}
            width={760}
        >
            <div className="StudentModal__body">
                <section>
                    <h3>Общие сведения</h3>
                    <dl className="StudentModal__info">
                        {generalInfo.map(([label, value]) => (
                            <div
                                className="StudentModal__info-item"
                                key={label}
                            >
                                <dt>{label}</dt>
                                <dd>{formatValue(value)}</dd>
                            </div>
                        ))}
                    </dl>
                </section>

                {averageCompetency !== null && (
                    <section className="StudentModal__average">
                        <span>Средний результат по компетенциям</span>
                        <strong>{averageCompetency}</strong>
                    </section>
                )}

                <div className="StudentModal__scores">
                    <ScoreSection
                        title="Лучшие компетенции (600+)"
                        items={competencies.filter(item => item.score >= 600)}
                        type="competencies"
                    />
					<div className="StudentModal__scores_mot">
						<ScoreSection
							title="Мотиваторы (600+)"
							items={motivators.filter(item => item.score >= 600)}
							type="motivators"
						/>
						<ScoreSection
							title="Демотиваторы (до 400)"
							items={motivators.filter(item => item.score < 400)}
							type="demotivators"
						/>
					</div>
                    <ScoreSection
                        title="Ценности (600+)"
                        items={values.filter(item => item.score >= 600)}
                        type="values"
                    />
                </div>

                <div className="StudentModal__footer">
                    <Button
                        text="Открыть портрет"
                        onClick={redirectToPortrait}
                        disabled={!student?.part_id}
                    />
                </div>
            </div>
        </Modal>
    );
}

export default StudentModal;
