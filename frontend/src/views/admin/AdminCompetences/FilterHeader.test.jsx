import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import FilterHeader from '@components/FilterHeader.jsx';

const renderWithQueryClient = ui => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const withProvider = children => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    const result = render(withProvider(ui));

    return {
        ...result,
        rerender: nextUi => result.rerender(withProvider(nextUi))
    };
};

const { getFilterOptions } = vi.hoisted(() => ({ getFilterOptions: vi.fn() }));
vi.mock('@services', () => ({ AdminService: { getFilterOptions } }));
vi.mock('react-select', () => ({
    default: ({ name, options = [], value, onChange, placeholder, isLoading }) => (
        <select
            aria-label={name}
            value={value?.value ?? ''}
            disabled={isLoading}
            onChange={e => onChange(options.find(o => o.value === e.target.value) ?? null)}
        >
            <option value="">{placeholder}</option>
            {options.map(o => (
                <option
                    key={o.value}
                    value={o.value}
                >
                    {o.label}
                </option>
            ))}
        </select>
    )
}));
vi.mock('@ui/TabButton', () => ({ default: () => null }));
vi.mock('@ui/Button', () => ({
    default: ({ text, onClick, disabled }) => (
        <button
            disabled={disabled}
            onClick={onClick}
        >
            {text}
        </button>
    )
}));

const allOptions = {
    institutes: [
        { value: 'uni-1', label: 'ВУЗ 1' },
        { value: 'uni-2', label: 'ВУЗ 2' }
    ],
    specialties: [{ value: 'spec-1', label: 'Направление 1' }],
    years: [{ value: '2023/2024', label: '2023/2024' }]
};
const emptyFilters = { institute: '', specialty: '', year: '' };

beforeEach(() => {
    vi.clearAllMocks();
    getFilterOptions.mockResolvedValue({ data: allOptions });
});

describe('FilterHeader', () => {
    it('загружает и отображает варианты фильтров', async () => {
        renderWithQueryClient(
            <FilterHeader
                filters={emptyFilters}
                onFilterChange={vi.fn()}
                onResetFilters={vi.fn()}
            />
        );

        await waitFor(() => {
            expect(getFilterOptions).toHaveBeenCalled();
            expect(screen.getByRole('option', { name: 'ВУЗ 1' })).toBeInTheDocument();
        });

        expect(screen.getByRole('option', { name: 'Направление 1' })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: '2023/2024' })).toBeInTheDocument();
    });

    it('передаёт изменение и очистку фильтра родителю', async () => {
        const onFilterChange = vi.fn();
        renderWithQueryClient(
            <FilterHeader
                filters={emptyFilters}
                onFilterChange={onFilterChange}
                onResetFilters={vi.fn()}
            />
        );
        await screen.findByRole('option', { name: 'ВУЗ 1' });
        fireEvent.change(screen.getByRole('combobox', { name: 'institute' }), { target: { value: 'uni-1' } });
        expect(onFilterChange).toHaveBeenCalledWith('institute', 'uni-1');
        fireEvent.change(screen.getByRole('combobox', { name: 'institute' }), { target: { value: '' } });
        expect(onFilterChange).toHaveBeenCalledWith('institute', '');
    });

    it('передаёт выбор и очистку специальности и учебного года родителю', async () => {
        const onFilterChange = vi.fn();
        renderWithQueryClient(
            <FilterHeader
                filters={emptyFilters}
                onFilterChange={onFilterChange}
                onResetFilters={vi.fn()}
            />
        );

        await screen.findByRole('option', { name: 'Направление 1' });
        fireEvent.change(screen.getByRole('combobox', { name: 'specialty' }), { target: { value: 'spec-1' } });
        fireEvent.change(screen.getByRole('combobox', { name: 'year' }), { target: { value: '2023/2024' } });
        fireEvent.change(screen.getByRole('combobox', { name: 'specialty' }), { target: { value: '' } });
        fireEvent.change(screen.getByRole('combobox', { name: 'year' }), { target: { value: '' } });

        expect(onFilterChange).toHaveBeenNthCalledWith(1, 'specialty', 'spec-1');
        expect(onFilterChange).toHaveBeenNthCalledWith(2, 'year', '2023/2024');
        expect(onFilterChange).toHaveBeenNthCalledWith(3, 'specialty', '');
        expect(onFilterChange).toHaveBeenNthCalledWith(4, 'year', '');
    });

    it('загружает направления для выбранного ВУЗа', async () => {
        getFilterOptions.mockImplementation(async institute => ({
            data: institute ? { specialties: [{ value: 'spec-2', label: 'Направление 2' }] } : allOptions
        }));
        renderWithQueryClient(
            <FilterHeader
                filters={{ ...emptyFilters, institute: 'uni-1' }}
                onFilterChange={vi.fn()}
                onResetFilters={vi.fn()}
            />
        );
        await waitFor(() => expect(getFilterOptions).toHaveBeenCalledWith('uni-1'));
        expect(await screen.findByRole('option', { name: 'Направление 2' })).toBeInTheDocument();
    });

    it('запрашивает направления заново после смены ВУЗа', async () => {
        getFilterOptions.mockImplementation(async institute => ({
            data: institute
                ? {
                      specialties: [
                          { value: `spec-${institute.slice(-1)}`, label: `Направление ${institute.slice(-1)}` }
                      ]
                  }
                : allOptions
        }));
        const onFilterChange = vi.fn();
        const { rerender } = renderWithQueryClient(
            <FilterHeader
                filters={{ ...emptyFilters, institute: 'uni-1' }}
                onFilterChange={onFilterChange}
                onResetFilters={vi.fn()}
            />
        );

        await screen.findByRole('option', { name: 'Направление 1' });
        fireEvent.change(screen.getByRole('combobox', { name: 'institute' }), { target: { value: 'uni-2' } });
        expect(onFilterChange).toHaveBeenCalledWith('institute', 'uni-2');

        rerender(
            <FilterHeader
                filters={{ ...emptyFilters, institute: 'uni-2' }}
                onFilterChange={onFilterChange}
                onResetFilters={vi.fn()}
            />
        );

        expect(await screen.findByRole('option', { name: 'Направление 2' })).toBeInTheDocument();
        expect(getFilterOptions).toHaveBeenCalledWith('uni-2');
    });

    it('сохраняет выбранную специальность, если она есть в загруженных вариантах ВУЗа', async () => {
        getFilterOptions.mockImplementation(async institute => ({
            data: institute
                ? { specialties: [{ value: 'spec-1', label: 'Направление 1' }] }
                : allOptions
        }));
        const onFilterChange = vi.fn();
        renderWithQueryClient(
            <FilterHeader
                filters={{ institute: 'uni-1', specialty: 'spec-1', year: '' }}
                onFilterChange={onFilterChange}
                onResetFilters={vi.fn()}
            />
        );

        await screen.findByRole('option', { name: 'Направление 1' });

        expect(screen.getByRole('combobox', { name: 'specialty' })).toHaveValue('spec-1');
        expect(onFilterChange).not.toHaveBeenCalledWith('specialty', '');
    });

    it('сбрасывает недоступное направление при смене ВУЗа', async () => {
        getFilterOptions.mockImplementation(async institute => ({ data: institute ? { specialties: [] } : allOptions }));
        const onFilterChange = vi.fn();
        renderWithQueryClient(
            <FilterHeader
                filters={{ institute: 'uni-2', specialty: 'spec-1', year: '' }}
                onFilterChange={onFilterChange}
                onResetFilters={vi.fn()}
            />
        );
        await waitFor(() => expect(onFilterChange).toHaveBeenCalledWith('specialty', ''));
    });

    it('вызывает сброс и блокирует кнопку при пустых фильтрах', async () => {
        const onResetFilters = vi.fn();
        const { rerender } = renderWithQueryClient(
            <FilterHeader
                filters={{ ...emptyFilters, institute: 'uni-1' }}
                onFilterChange={vi.fn()}
                onResetFilters={onResetFilters}
            />
        );
        fireEvent.click(screen.getByRole('button', { name: 'Сбросить' }));
        expect(onResetFilters).toHaveBeenCalledOnce();
        rerender(
            <FilterHeader
                filters={emptyFilters}
                onFilterChange={vi.fn()}
                onResetFilters={onResetFilters}
            />
        );
        expect(screen.getByRole('button', { name: 'Сбросить' })).toBeDisabled();
    });

    it('не падает при ошибке API и при пустом списке вариантов', async () => {
        getFilterOptions.mockRejectedValue(new Error('Network error'));
        const { unmount } = renderWithQueryClient(
            <FilterHeader
                filters={emptyFilters}
                onFilterChange={vi.fn()}
                onResetFilters={vi.fn()}
            />
        );
        await waitFor(() => expect(screen.getByRole('combobox', { name: 'institute' })).not.toBeDisabled());
        expect(screen.getByRole('combobox', { name: 'institute' }).options).toHaveLength(1);
        unmount();
        getFilterOptions.mockResolvedValue({ data: { institutes: [], specialties: [], years: [] } });
        renderWithQueryClient(
            <FilterHeader
                filters={emptyFilters}
                onFilterChange={vi.fn()}
                onResetFilters={vi.fn()}
            />
        );
        await waitFor(() => expect(getFilterOptions).toHaveBeenCalled());
        expect(screen.getByRole('combobox', { name: 'institute' }).options).toHaveLength(1);
    });

    it('скрывает фильтр учебного года, если showYearsSelect выключен', async () => {
        renderWithQueryClient(
            <FilterHeader
                filters={emptyFilters}
                onFilterChange={vi.fn()}
                onResetFilters={vi.fn()}
                showYearsSelect={false}
            />
        );

        await screen.findByRole('option', { name: 'ВУЗ 1' });

        expect(screen.queryByRole('combobox', { name: 'year' })).not.toBeInTheDocument();
        expect(screen.getByRole('combobox', { name: 'institute' })).toBeInTheDocument();
        expect(screen.getByRole('combobox', { name: 'specialty' })).toBeInTheDocument();
    });
});
