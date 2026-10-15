import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { BarChartByYears, CompRadar, CompetencyTable, CompetencyTrendLine } from './CompetencesCharts.jsx';

vi.mock('recharts', () => {
    const Container = ({ children }) => <div>{children}</div>;

    return {
        Line: ({ dataKey, hide, strokeOpacity }) => (
            <div
                data-testid={`line-${dataKey}`}
                data-hidden={String(!!hide)}
                data-opacity={String(strokeOpacity)}
            />
        ),
        Radar: ({ dataKey }) => <div data-testid={`radar-${dataKey}`} />,
        Bar: ({ dataKey }) => <div data-testid={`bar-${dataKey}`} />,
        ResponsiveContainer: Container,
        PieChart: Container,
        Pie: Container,
        BarChart: Container,
        LineChart: Container,
        RadarChart: Container,
        CartesianGrid: () => null,
        ReferenceLine: () => null,
        LabelList: () => null,
        XAxis: () => null,
        YAxis: () => null,
        PolarGrid: () => null,
        PolarAngleAxis: () => null,
        PolarRadiusAxis: () => null,
        Tooltip: () => null,
        Legend: ({ onClick }) => (
            <button
                type="button"
                onClick={() => onClick?.({ dataKey: 'Анализ информации' })}
            >
                Легенда
            </button>
        )
    };
});

vi.mock('@utils/utilities.js', () => ({
    COMPETENCIES_NAMES: { res_comp_info_analysis: 'Анализ информации' },
    MOTIVATORS_NAMES: {},
    FIELD_NAMES: {}
}));
vi.mock('xlsx', () => ({
    utils: { aoa_to_sheet: vi.fn(), sheet_add_json: vi.fn(), book_new: vi.fn(), book_append_sheet: vi.fn() },
    writeFile: vi.fn()
}));

const trends = {
    trends: [
        {
            competency: 'res_comp_info_analysis',
            points: [
                { course: 1, avg: 300 },
                { course: 2, avg: 450 }
            ]
        }
    ]
};
const radar = [{ name: 'res_comp_info_analysis', course_1: 300, course_2: 400, course_3: 450, course_4: 500 }];

beforeEach(() => vi.clearAllMocks());

describe('графики компетенций', () => {
    it('показывает сообщение при отсутствии данных динамики', () => {
        render(
            <CompetencyTrendLine
                data={{ trends: [] }}
                loading={false}
            />
        );
        expect(screen.getByText(/Нет данных для построения графика динамики/)).toBeInTheDocument();
    });

    it('отображает график и скрывает/показывает линии', () => {
        render(
            <CompetencyTrendLine
                data={trends}
                loading={false}
            />
        );
        const line = screen.getByTestId('line-Анализ информации');
        expect(line).toHaveAttribute('data-hidden', 'false');
        fireEvent.click(screen.getByRole('button', { name: 'Скрыть все' }));
        expect(line).toHaveAttribute('data-hidden', 'true');
        fireEvent.click(screen.getByRole('button', { name: 'Показать все' }));
        expect(line).toHaveAttribute('data-hidden', 'false');
        fireEvent.click(screen.getByRole('button', { name: /Легенда/ }));
        expect(line).toHaveAttribute('data-hidden', 'true');
    });

    it('отключает соединение точек графика', () => {
        render(
            <CompetencyTrendLine
                data={trends}
                loading={false}
            />
        );
        const line = screen.getByTestId('line-Анализ информации');
        expect(line).toHaveAttribute('data-opacity', '1');
        fireEvent.click(screen.getByRole('checkbox', { name: /Соединять линиями/ }));
        expect(line).toHaveAttribute('data-opacity', '0');
    });

    it('управляет видимостью курсов на радаре', () => {
        render(<CompRadar data={radar} />);
        expect(screen.getByTestId('radar-course_1')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('checkbox', { name: '1 Курс' }));
        expect(screen.queryByTestId('radar-course_1')).not.toBeInTheDocument();
        expect(screen.getByTestId('radar-course_2')).toBeInTheDocument();
    });

    it('выводит сообщение при отсутствии данных радара', () => {
        render(<CompRadar data={null} />);
        expect(screen.getByText('Нет данных для отображения')).toBeInTheDocument();
    });

    it('отображает столбцы за выбранные годы', () => {
        render(
            <BarChartByYears
                data={[{ name: 'res_comp_info_analysis', displayName: 'Анализ информации', '2022/2023': 320, '2023/2024': 430 }]}
                range={['2022/2023', '2023/2024']}
            />
        );
        expect(screen.getByTestId('bar-2022/2023')).toBeInTheDocument();
        expect(screen.getByTestId('bar-2023/2024')).toBeInTheDocument();
    });

    it('открывает таблицу и показывает разницу показателей', () => {
        render(
            <CompetencyTable
                data={[{ name: 'res_comp_info_analysis', displayName: 'Анализ информации', prev_score: 300, score: 350 }]}
                filters={{}}
                range={['2022/2023', '2023/2024']}
            />
        );
        fireEvent.click(screen.getByRole('button', { name: /Показать таблицу/ }));
        expect(screen.getByRole('table')).toBeInTheDocument();
        expect(screen.getByText('+50')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /Скрыть таблицу/ }));
        expect(screen.getByRole('button', { name: /Показать таблицу/ })).toBeInTheDocument();
    });
});
