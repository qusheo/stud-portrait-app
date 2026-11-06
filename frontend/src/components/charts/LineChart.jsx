import ReactApexChart from 'react-apexcharts';

/**
 * @description Линейный график для одной или нескольких серий данных.
 * @param {Object} props Параметры компонента.
 * @param {string} props.title Заголовок графика.
 * @param {Array} props.seriesLabels Подписи оси категорий.
 * @param {Array} props.chartSeries Серии данных графика.
 */
function LineChart({ title, seriesLabels, chartSeries }) {
    const chartOptions = {
        chart: {
            type: 'line',
            zoom: { enabled: false }
        },
        title: { text: title, align: 'center' },
        stroke: { curve: 'smooth' },
        labels: seriesLabels,
        xaxis: {}
    };

    return (
        <ReactApexChart
            type="line"
            options={chartOptions}
            series={chartSeries}
        />
    );
}

export default LineChart;
