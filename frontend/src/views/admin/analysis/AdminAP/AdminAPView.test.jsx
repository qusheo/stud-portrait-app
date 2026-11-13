import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AdminAPView from './AdminAPView.jsx';
import CorrelationHeatmap from './CorrelationHeatmap.jsx';
import CorrelationScatter from './CorrelationScatter.jsx';
import TopCorrelationsTable from './TopCorrelationsTable.jsx';

const { queryState, service, storeState } = vi.hoisted(() => ({
    queryState: {
        scores: { data: null, isPending: false, error: null },
        correlation: { data: null, isPending: false, error: null },
        selectedCorrelation: { data: null, isPending: false }
    },
    service: {
        getTopCorrelations: vi.fn()
    },
    storeState: {
        savedFilters: {},
        saveFilters: vi.fn()
    }
}));

vi.mock('@tanstack/react-query', () => ({
    useQuery: vi.fn(({ queryKey }) => {
        if (queryKey[1] === 'scores-result') return queryState.scores;
        if (queryKey.length > 3) return queryState.selectedCorrelation;
        return queryState.correlation;
    })
}));

vi.mock('@services', () => ({ AdminService: service }));
vi.mock('@utils/store', () => ({
    useAdminStore: selector => selector(storeState)
}));
vi.mock('@utils/utilities.js', () => ({
    COMPETENCIES_NAMES: { res_comp_info_analysis: 'Анализ информации' },
    COURSES_NAMES: {},
    LINK_TREE: []
}));
vi.mock('@utils/queryConfig', () => ({ defaultQueryOptions: {} }));
vi.mock('@components/FilterHeader', () => ({
    default: ({ filters, onFilterChange, onResetFilters }) => (
        <div>
            <button onClick={() => onFilterChange('institute', 'uni-1')}>Выбрать ВУЗ</button>
            <button onClick={onResetFilters}>Сбросить фильтры</button>
            <output data-testid="filters">{JSON.stringify(filters)}</output>
        </div>
    )
}));
vi.mock('@components/ui/TabButton', () => ({
    default: ({ text, onClick, isActive }) => (
        <button
            aria-pressed={isActive}
            onClick={onClick}
        >
            {text}
        </button>
    )
}));
vi.mock('@components/FlexRow.jsx', () => ({
    default: ({ children }) => <div>{children}</div>,
    WRAP: { DO: 'wrap' }
}));
vi.mock('@components/ui/LoadingSpinner', () => ({
    default: ({ text }) => <div>{text}</div>
}));
vi.mock('react-apexcharts', () => ({
    default: ({ series }) => <pre data-testid="apex-series">{JSON.stringify(series)}</pre>
}));
vi.mock('recharts', () => {
    const Container = ({ children }) => <div>{children}</div>;
    return {
        ScatterChart: Container,
        ResponsiveContainer: Container,
        CartesianGrid: () => null,
        ReferenceLine: () => null,
        XAxis: () => null,
        YAxis: () => null,
        Tooltip: () => null,
        Scatter: ({ data }) => <pre data-testid="discipline-points">{JSON.stringify(data)}</pre>
    };
});
vi.mock('./AdminAPView.scss', () => ({}));

const correlationData = {
    disciplines: ['Математика'],
    competencies: ['res_comp_info_analysis'],
    correlations: [{ discipline: 'Математика', competency: 'res_comp_info_analysis', value: 0.4567, n: 12 }],
    scatter: [
        { discipline: 'Математика', competency: 'res_comp_info_analysis', grade: 2, comp_value: 300 },
        { discipline: 'Математика', competency: 'res_comp_info_analysis', grade: 4, comp_value: 500 }
    ]
};

const scoreData = {
    names: ['ПИР', 'УП', 'Практика 3', 'Практика 4'],
    data: [
        {
            discipline: 'ПИР',
            participants: [
                { avg: 350, res_comp_info_analysis: 400, grade: 5, participant_id: 1 },
                { avg: 0, res_comp_info_analysis: 0, grade: 3, participant_id: 2 },
                { avg: 420, res_comp_info_analysis: 450, grade: null, participant_id: 3 }
            ]
        },
        { discipline: 'УП', participants: [{ avg: 360, grade: 4, participant_id: 4 }] },
        { discipline: 'Практика 3', participants: [{ avg: 370, grade: 4, participant_id: 5 }] },
        { discipline: 'Практика 4', participants: [{ avg: 380, grade: 4, participant_id: 6 }] }
    ]
};

beforeEach(() => {
    vi.clearAllMocks();
    queryState.scores = { data: null, isPending: false, error: null };
    queryState.correlation = { data: null, isPending: false, error: null };
    queryState.selectedCorrelation = { data: null, isPending: false };
    storeState.savedFilters = {};
    service.getTopCorrelations.mockResolvedValue({ top: [], total_pairs: 0, total_disciplines: 0 });
});

describe('AdminAPView', () => {
    it('показывает состояние загрузки и ошибку отсутствующих оценок', () => {
        queryState.scores = { data: null, isPending: true, error: null };
        const { rerender } = render(<AdminAPView />);
        expect(screen.getByText('Загрузка...')).toBeInTheDocument();

        queryState.scores = { data: null, isPending: false, error: new Error('request failed') };
        rerender(<AdminAPView />);
        expect(screen.getByText('Страница недоступна')).toBeInTheDocument();
    });

    it('переключает дисциплины, строит допустимые точки и обновляет фильтры', () => {
        queryState.scores = { data: scoreData, isPending: false, error: null };
        queryState.correlation = { data: correlationData, isPending: false, error: null };
        render(<AdminAPView />);

        expect(screen.getByRole('heading', { name: 'ПИР' })).toBeInTheDocument();
        expect(JSON.parse(screen.getByTestId('discipline-points').textContent)).toEqual([{ x: 350, y: 5, id: 1 }]);

        fireEvent.click(screen.getByRole('button', { name: 'УП' }));
        expect(screen.getByRole('heading', { name: 'УП' })).toBeInTheDocument();
        expect(JSON.parse(screen.getByTestId('discipline-points').textContent)).toEqual([{ x: 360, y: 4, id: 4 }]);

        fireEvent.click(screen.getByRole('button', { name: 'Выбрать ВУЗ' }));
        expect(JSON.parse(screen.getByTestId('filters').textContent)).toEqual({
            institute: 'uni-1',
            specialty: '',
            year: ''
        });
        expect(storeState.saveFilters).toHaveBeenCalledWith('Admin', {
            institute: 'uni-1',
            specialty: '',
            year: ''
        });
    });
});

describe('CorrelationHeatmap', () => {
    it('показывает состояния загрузки и отсутствия данных', () => {
        const { rerender } = render(
            <CorrelationHeatmap
                data={null}
                loading
            />
        );
        expect(screen.getByText('Загрузка тепловой карты...')).toBeInTheDocument();

        rerender(
            <CorrelationHeatmap
                data={{ correlations: [] }}
                loading={false}
            />
        );
        expect(screen.getByText(/Нет данных для построения тепловой карты/)).toBeInTheDocument();
    });

    it('сортирует дисциплины по объёму и отображает округлённые значения', () => {
        const data = {
            competencies: ['res_comp_info_analysis', 'unknown'],
            correlations: [
                { discipline: 'Малый объём', competency: 'res_comp_info_analysis', value: 0.1234, n: 2 },
                { discipline: 'Большой объём', competency: 'res_comp_info_analysis', value: -0.5678, n: 10 },
                { discipline: 'Большой объём', competency: 'unknown', value: null, n: 5 }
            ]
        };
        render(
            <CorrelationHeatmap
                data={data}
                loading={false}
            />
        );

        expect(screen.getByRole('heading', { name: 'Корреляция оценок и компетенций' })).toBeInTheDocument();
        const series = JSON.parse(screen.getByTestId('apex-series').textContent);
        expect(series).toEqual([
            {
                name: 'Анализ информации',
                data: [
                    { x: 'Большой объём', y: -0.57 },
                    { x: 'Малый объём', y: 0.12 }
                ]
            },
            {
                name: 'unknown',
                data: [
                    { x: 'Большой объём', y: null },
                    { x: 'Малый объём', y: null }
                ]
            }
        ]);

        fireEvent.change(screen.getByRole('combobox'), { target: { value: '10' } });
        expect(screen.getByRole('combobox')).toHaveValue('10');
    });
});

describe('CorrelationScatter', () => {
    it('показывает состояния загрузки и отсутствия данных', () => {
        const { rerender } = render(
            <CorrelationScatter
                correlationData={null}
                loading
                filters={{}}
            />
        );
        expect(screen.getByText('Загрузка диаграммы рассеяния...')).toBeInTheDocument();

        rerender(
            <CorrelationScatter
                correlationData={{ disciplines: [] }}
                loading={false}
                filters={{}}
            />
        );
        expect(screen.getByText(/Нет данных для построения диаграммы рассеяния/)).toBeInTheDocument();
    });

    it('выбирает первую пару, показывает статистику и линию тренда', async () => {
        queryState.selectedCorrelation = { data: correlationData, isPending: false };
        const random = vi.spyOn(Math, 'random').mockReturnValue(0.5);
        render(
            <CorrelationScatter
                correlationData={correlationData}
                loading={false}
                filters={{ institute: 'uni-1', specialty: '', year: '2024' }}
            />
        );

        expect(await screen.findByText('0.457')).toBeInTheDocument();
        expect(screen.getAllByText(/1\s+студ\./)).toHaveLength(2);
        expect(screen.getByText('300.0')).toBeInTheDocument();
        expect(screen.getByText('500.0')).toBeInTheDocument();

        const series = JSON.parse(screen.getByTestId('apex-series').textContent);
        expect(series).toHaveLength(3);
        expect(series[0]).toMatchObject({
            name: 'Оценка 2 (Неуд.)',
            data: [{ x: 2, y: 300 }]
        });
        expect(series[2]).toMatchObject({
            name: 'Линия тренда',
            data: [
                { x: 2, y: 300 },
                { x: 4, y: 500 }
            ]
        });
        expect(screen.getAllByRole('combobox')[0]).toHaveValue('Математика');
        expect(screen.getAllByRole('combobox')[1]).toHaveValue('res_comp_info_analysis');
        random.mockRestore();
    });
});

describe('TopCorrelationsTable', () => {
    it('запрашивает данные с фильтрами и отображает направления корреляции', async () => {
        service.getTopCorrelations.mockResolvedValue({
            total_pairs: 2,
            total_disciplines: 1,
            top: [
                {
                    rank: 1,
                    discipline: 'Математика',
                    competency_key: 'res_comp_info_analysis',
                    competency_name: 'Анализ информации',
                    value: 0.3456,
                    n: 1250
                },
                {
                    rank: 2,
                    discipline: 'Физика',
                    competency_key: 'other',
                    competency_name: 'Другая компетенция',
                    value: -0.25,
                    n: 40
                }
            ]
        });
        render(<TopCorrelationsTable filters={{ institute: 'uni-1', specialty: '', year: '2024' }} />);

        expect(await screen.findByRole('table')).toBeInTheDocument();
        expect(screen.getByText('0.346')).toBeInTheDocument();
        expect(screen.getByText('↑ положительная')).toBeInTheDocument();
        expect(screen.getByText('↓ отрицательная')).toBeInTheDocument();
        expect(screen.getByText(/1.?250/)).toBeInTheDocument();
        expect(service.getTopCorrelations).toHaveBeenCalledWith({
            topN: 20,
            sortBy: 'abs',
            minN: 30,
            institute: 'uni-1',
            specialty: null,
            year: '2024'
        });

        fireEvent.change(screen.getByDisplayValue('По силе связи'), { target: { value: 'negative' } });
        await waitFor(() =>
            expect(service.getTopCorrelations).toHaveBeenLastCalledWith({
                topN: 20,
                sortBy: 'negative',
                minN: 30,
                institute: 'uni-1',
                specialty: null,
                year: '2024'
            })
        );
    });

    it('показывает пустое состояние, если рейтинг пуст', async () => {
        render(<TopCorrelationsTable filters={{}} />);
        expect(await screen.findByText(/Нет данных для выбранных фильтров/)).toBeInTheDocument();
    });
});
