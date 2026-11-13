import RadarChart from './RadarChart';
import BarChart from './BarChart';

/**
 * @description Автоматически выбирает столбчатую или радарную диаграмму по числу категорий.
 * @param {Object} props Параметры компонента.
 * @param {string} props.title Заголовок диаграммы.
 * @param {string} props.seriesLabel Название серии данных.
 * @param {Array} props.seriesData Значения серии.
 * @param {Array} props.categories Категории диаграммы.
 * @param {Array} props.competencyKeys Ключи компетенций для подсказок.
 * @param {number} [props.height=450] Высота диаграммы.
 */
function ChartSwitcher({ title, seriesLabel, seriesData, categories, competencyKeys, height = 450 }) {
    // Автоматически выбираем тип диаграммы на основе количества категорий
    const shouldUseBarChart = categories.length <= 3;

    if (shouldUseBarChart) {
        return (
            <BarChart
                title={title}
                seriesLabel={seriesLabel}
                seriesData={seriesData}
                categories={categories}
                height={height}
                competencyKeys={competencyKeys}
            />
        );
    }

    return (
        <RadarChart
            title={title}
            seriesLabel={seriesLabel}
            seriesData={seriesData}
            categories={categories}
            height={height}
            competencyKeys={competencyKeys}
        />
    );
}

export default ChartSwitcher;
