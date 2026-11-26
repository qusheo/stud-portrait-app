import './ScientificActivity.scss';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import TeacherService from '@services/TeacherService.ts';
import Chart from 'react-apexcharts';
import { publicationScale } from '@utils/scienceCharts';
import { SCIENCE_CLASSIFIERS } from '@constants';

/**
 * @description Dashboard of confirmed teacher publication links.
 * @param {{teacherId?: number}} props Optional teacher ID for a personal dashboard.
 */
export default function ScientificActivity({ teacherId }) {
    const [institutionId, setInstitutionId] = useState('');
    const [year, setYear] = useState('');
    const [page, setPage] = useState(1);
    const [topicLanguage, setTopicLanguage] = useState('ru');
    const [classifier, setClassifier] = useState('rubric_oecd');
    const {
        data: response,
        isPending,
        error,
        refetch
    } = useQuery({
        queryKey: ['scientificActivity', teacherId, institutionId, year, page],
        queryFn: () => TeacherService.getScientificActivity({ teacherId, institutionId, year, page }),
        placeholderData: previousData => previousData,
        retry: false
    });
    const data = response?.data;
    const groups = data?.direction_groups || {};
    const activeClassifier = groups[classifier] ? classifier : Object.keys(groups)[0];
    const directions = groups[activeClassifier]?.items || [];
    const topics =
        data?.topic_groups?.[topicLanguage] ??
        (data?.popular_topics || []).filter(
            t =>
                topicLanguage === 'all' ||
                (topicLanguage === 'ru' ? /[а-яё]/i.test(t.name) : !/[а-яё]/i.test(t.name) && /[a-z]/i.test(t.name))
        );
    return (
        <section className="ScientificActivity">
            <h2>Научная деятельность</h2>
            <p>По загруженным публикациям с подтверждёнными связями. Вуз определяется по текущему справочнику преподавателей.</p>
            <div className="ScientificActivity__filters">
                {!teacherId && (
                    <label>
                        Вуз
                        <select
                            value={institutionId}
                            onChange={e => {
                                setInstitutionId(e.target.value);
                                setPage(1);
                            }}
                        >
                            <option value="">Все вузы</option>
                            {(data?.institutions || []).map(i => (
                                <option
                                    key={i.inst_id}
                                    value={i.inst_id}
                                >
                                    {i.inst_name}
                                </option>
                            ))}
                        </select>
                    </label>
                )}
                <label>
                    Год публикации
                    <select
                        value={year}
                        onChange={e => {
                            setYear(e.target.value);
                            setPage(1);
                        }}
                    >
                        <option value="">Все годы</option>
                        {(data?.available_years || []).map(value => (
                            <option
                                key={value}
                                value={value}
                            >
                                {value}
                            </option>
                        ))}
                    </select>
                </label>
            </div>
            {isPending && <p role="status">Загрузка статистики…</p>}
            {error && (
                <div role="alert">
                    {error.message} <button onClick={() => refetch()}>Повторить</button>
                </div>
            )}
            {data && (
                <>
                    <div className="ScientificActivity__metrics">
                        <p>
                            Работ: <b>{data.publications_count}</b>
                        </p>
                        <p>
                            Преподавателей: <b>{data.teachers_count}</b>
                        </p>
                        <p>
                            Направлений ({SCIENCE_CLASSIFIERS[activeClassifier] || activeClassifier || 'рубрики'}):{' '}
                            <b>{groups[activeClassifier]?.count || 0}</b>
                        </p>
                    </div>
                    {!data.publications_count && <p>По выбранным условиям публикаций нет.</p>}
                    {!data.publications_count && (
                        <p>
                            В загруженной выборке не найдено подтверждённых связей с публикациями. Это не означает, что у преподавателя нет
                            научных работ.
                        </p>
                    )}
                    <p>
                        С ключевыми словами: {data.coverage.with_keywords}; с рубриками: {data.coverage.with_topics}; без года:{' '}
                        {data.coverage.unknown_year}.
                    </p>
                    <h3>Популярные темы по ключевым словам</h3>
                    <label>
                        Язык ключевых слов{' '}
                        <select
                            value={topicLanguage}
                            onChange={e => setTopicLanguage(e.target.value)}
                        >
                            <option value="ru">Русские термины</option>
                            <option value="latin">Термины латиницей</option>
                            <option value="all">Все термины</option>
                        </select>
                    </label>
                    <p>Переводы одного понятия не объединяются автоматически. Фильтр меняет только список тем, а не количество работ.</p>
                    {topics.length > 0 && (
                        <Chart
                            type="bar"
                            height={360}
                            series={[{ name: 'Публикации', data: topics.slice(0, 10).map(t => t.count) }]}
                            options={{
                                chart: { toolbar: { show: false } },
                                plotOptions: { bar: { horizontal: true } },
                                xaxis: {
                                    categories: topics.slice(0, 10).map(t => t.name),
                                    ...publicationScale(topics.slice(0, 10).map(t => t.count))
                                },
                                yaxis: { labels: { maxWidth: 260 } },
                                dataLabels: { enabled: false }
                            }}
                        />
                    )}
                    <details>
                        <summary>Показать таблицу тем</summary>
                        <ul className="ScientificActivity__topics">
                            {topics.map(t => (
                                <li key={t.name}>
                                    {t.name}: <b>{t.count}</b>{' '}
                                </li>
                            ))}
                        </ul>
                    </details>
                    {!topics.length && <p>Нет ключевых слов для выбранного языка.</p>}
                    <h3>Направления по рубрикам</h3>
                    {activeClassifier && (
                        <label>
                            Классификатор{' '}
                            <select
                                value={activeClassifier}
                                onChange={e => setClassifier(e.target.value)}
                            >
                                {Object.keys(groups).map(key => (
                                    <option
                                        key={key}
                                        value={key}
                                    >
                                        {SCIENCE_CLASSIFIERS[key] || key}
                                    </option>
                                ))}
                            </select>
                        </label>
                    )}
                    <p>Количество направлений рассчитывается отдельно в выбранной классификации.</p>
                    <ul>
                        {directions.map(t => (
                            <li key={t.name}>
                                {t.name}: {t.count}
                            </li>
                        ))}
                    </ul>
                    {!directions.length && <p>Рубрики не указаны.</p>}
                    <h3>Публикации по годам</h3>
                    {data.by_year.length > 0 && (
                        <Chart
                            type="bar"
                            height={280}
                            series={[{ name: 'Публикации', data: data.by_year.map(y => y.count) }]}
                            options={{
                                chart: { toolbar: { show: false } },
                                xaxis: { categories: data.by_year.map(y => String(y.year)) },
                                yaxis: publicationScale(data.by_year.map(y => y.count)),
                                dataLabels: { enabled: false }
                            }}
                        />
                    )}
                    <details>
                        <summary>Показать таблицу по годам</summary>
                        <ul>
                            {data.by_year.map(y => (
                                <li key={y.year}>
                                    {y.year}: {y.count}
                                </li>
                            ))}
                        </ul>
                    </details>
                    <h3>Публикации</h3>
                    <ul className="ScientificActivity__publications">
                        {data.publications.map(p => (
                            <li key={p.id}>
                                <a
                                    href={p.url}
                                    target="_blank"
                                    rel="noreferrer"
                                >
                                    {p.title}
                                </a>{' '}
                                — {p.year ?? 'Год не указан'}
                            </li>
                        ))}
                    </ul>
                    <div className="ScientificActivity__pages">
                        <button
                            disabled={page === 1}
                            onClick={() => setPage(page - 1)}
                        >
                            Назад
                        </button>
                        <span>Страница {page}</span>
                        <button
                            disabled={page * data.page_size >= data.publications_count}
                            onClick={() => setPage(page + 1)}
                        >
                            Далее
                        </button>
                    </div>
                </>
            )}
        </section>
    );
}
