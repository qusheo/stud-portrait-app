import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AdminCompetencesView from './AdminCompetencesView.jsx';

const { service, storeState, pageState } = vi.hoisted(() => ({
    service: {
        getDashboardStats: vi.fn(),
        getCompetencyAverageByYears: vi.fn(),
        getAvailableYears: vi.fn(),
        getCompetencyTrendByYear: vi.fn()
    },
    storeState: { savedFilters: { Admin: {} }, saveFilters: vi.fn() },
    pageState: { setPageName: vi.fn() }
}));
vi.mock('@services', () => ({ AdminService: service }));
vi.mock('@utils/store.jsx', () => {
    const useAdminStore = selector => selector(storeState);
    useAdminStore.getState = () => storeState;
    const usePageStore = selector => selector(pageState);
    return { useAdminStore, usePageStore };
});
vi.mock('@utils/utilities.js', () => ({ COMPETENCIES_NAMES: {}, MOTIVATORS_NAMES: {}, FIELD_NAMES: {} }));
vi.mock('@components/FilterHeader', () => ({
    default: ({ filters, onFilterChange, onResetFilters }) => (
        <div>
            <button onClick={() => onFilterChange('institute', 'uni-1')}>Выбрать ВУЗ</button>
            <button onClick={() => onFilterChange('specialty', 'spec-1')}>Выбрать направление</button>
            <button onClick={onResetFilters}>Сбросить</button>
            <output data-testid="filters">{JSON.stringify(filters)}</output>
        </div>
    )
}));
vi.mock('@components/FlexRow.jsx', () => ({ default: ({ children }) => <div>{children}</div>, WRAP: { DO: 'wrap' } }));
vi.mock('@components/ui/TabButton', () => ({ default: ({ text, onClick }) => <button onClick={onClick}>{text}</button> }));
vi.mock('@components/ui/LoadingSpinner.jsx', () => ({ default: ({ text }) => <div>{text}</div> }));
vi.mock('@components/ui/Tooltip.jsx', () => ({ default: ({ children }) => <div>{children}</div> }));
vi.mock('@components/ui/DraggablePopover.jsx', () => ({ default: ({ children, open }) => (open ? <div>{children}</div> : null) }));
vi.mock('../CompetencySegmentation', () => ({ default: () => <div>Сегментация загружена</div> }));
vi.mock('rc-slider', () => ({ default: () => <div data-testid="year-slider" /> }));
vi.mock('./CompetencesCharts.jsx', () => ({
    BarChartByYears: ({ data }) => <div data-testid="bar-chart">{data.length} компетенций</div>,
    CompRadar: () => <div data-testid="radar-chart" />,
    CompetencyTable: () => <div data-testid="competency-table" />,
    CompetencyTable_course: () => <div data-testid="competency-table-course" />,
    CompetencyTrendLine: ({ data, loading }) => {
        if (loading) return <div>Загрузка графика динамики...</div>;
        if (!data?.trends?.length) return <div>Нет данных для построения графика динамики компетенций</div>;
        return <div data-testid="trend-chart" />;
    }
}));
vi.mock('react-toastify', () => ({ ToastContainer: () => null, toast: { success: vi.fn(), error: vi.fn() } }));

const blank = { institute: '', specialty: '', year: '' };
const renderWithQueryClient = ui => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
};
const stats = {
    year: 2024,
    col1: {
        courses: { val: 50, prev: 40 },
        avg_lvl: { val: 450, prev: 430 },
        motiv: { name: { curr: 'mot', prev: 'mot' }, count: { curr: 20, prev: 10 } },
        demotiv: { name: { curr: 'demot', prev: 'demot' }, count: { curr: 15, prev: 10 } }
    },
    col2: { uni_name: 'ВУЗ', uni_score: 450, uni_place: -1, participated: { students_all: 100, amount_in: 70 } },
    col3: {
        best: { name: 'best', val: 500 },
        best_prev: { name: 'best', val: 490 },
        worst: { name: 'worst', val: 300 },
        worst_prev: { name: 'worst', val: 310 }
    },
    radar: []
};

beforeEach(() => {
    vi.clearAllMocks();
    storeState.savedFilters = { Admin: {} };
    service.getDashboardStats.mockResolvedValue(stats);
    service.getCompetencyAverageByYears.mockResolvedValue({ data: [{ name: 'res_comp_info_analysis', year: '2022/2023', average: 400 }] });
    service.getAvailableYears.mockResolvedValue([
        { value: '2022/2023', label: '2022/2023' },
        { value: '2023/2024', label: '2023/2024' }
    ]);
    service.getCompetencyTrendByYear.mockResolvedValue({ trends: [] });
});

describe('AdminCompetencesView', () => {
    it('запрашивает статистику и отображает графики', async () => {
        renderWithQueryClient(<AdminCompetencesView />);
        await waitFor(() => expect(service.getDashboardStats).toHaveBeenCalledWith(blank));
        expect(await screen.findByTestId('radar-chart')).toBeInTheDocument();
        expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
        expect(screen.getByTestId('competency-table')).toBeInTheDocument();
    });

    it('отправляет выбранные фильтры в API, а смена ВУЗа очищает направление', async () => {
        renderWithQueryClient(<AdminCompetencesView />);
        fireEvent.click(screen.getByRole('button', { name: 'Выбрать направление' }));
        fireEvent.click(screen.getByRole('button', { name: 'Выбрать ВУЗ' }));
        await waitFor(() => expect(service.getDashboardStats).toHaveBeenCalledWith({ institute: 'uni-1', specialty: '', year: '' }));
        expect(JSON.parse(screen.getByTestId('filters').textContent)).toEqual({ institute: 'uni-1', specialty: '', year: '' });
    });

    it('сбрасывает фильтры и повторно запрашивает нефильтрованные данные', async () => {
        renderWithQueryClient(<AdminCompetencesView />);
        fireEvent.click(screen.getByRole('button', { name: 'Выбрать ВУЗ' }));
        await waitFor(() => expect(service.getDashboardStats).toHaveBeenCalledWith({ institute: 'uni-1', specialty: '', year: '' }));
        fireEvent.click(screen.getByRole('button', { name: 'Сбросить' }));
        await waitFor(() => expect(JSON.parse(screen.getByTestId('filters').textContent)).toEqual(blank));
        await waitFor(() => expect(service.getDashboardStats).toHaveBeenCalledWith(blank));
    });

    it('не показывает графики при отсутствии статистики', async () => {
        service.getDashboardStats.mockResolvedValue(null);
        service.getCompetencyAverageByYears.mockResolvedValue({ data: null });
        renderWithQueryClient(<AdminCompetencesView />);
        await waitFor(() => expect(service.getDashboardStats).toHaveBeenCalled());
        expect(screen.queryByTestId('radar-chart')).not.toBeInTheDocument();
    });

    it('показывает пустое состояние для вкладки Динамика', async () => {
        renderWithQueryClient(<AdminCompetencesView />);

        fireEvent.click(screen.getByRole('button', { name: 'Динамика' }));

        expect(await screen.findByText(/Нет данных для построения графика динамики/)).toBeInTheDocument();
    });
});
