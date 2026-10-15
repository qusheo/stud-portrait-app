import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import FilterHeader from '@components/FilterHeader.jsx';

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
        render(
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
        render(
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

    it('загружает направления для выбранного ВУЗа', async () => {
        getFilterOptions.mockImplementation(async institute => ({
            data: institute ? { specialties: [{ value: 'spec-2', label: 'Направление 2' }] } : allOptions
        }));
        render(
            <FilterHeader
                filters={{ ...emptyFilters, institute: 'uni-1' }}
                onFilterChange={vi.fn()}
                onResetFilters={vi.fn()}
            />
        );
        await waitFor(() => expect(getFilterOptions).toHaveBeenCalledWith('uni-1'));
        expect(await screen.findByRole('option', { name: 'Направление 2' })).toBeInTheDocument();
    });

    it('сбрасывает недоступное направление при смене ВУЗа', async () => {
        getFilterOptions.mockImplementation(async institute => ({ data: institute ? { specialties: [] } : allOptions }));
        const onFilterChange = vi.fn();
        render(
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
        const { rerender } = render(
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
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        getFilterOptions.mockRejectedValue(new Error('Network error'));
        const { unmount } = render(
            <FilterHeader
                filters={emptyFilters}
                onFilterChange={vi.fn()}
                onResetFilters={vi.fn()}
            />
        );
        await waitFor(() => expect(errorSpy).toHaveBeenCalled());
        expect(screen.getByRole('combobox', { name: 'institute' })).toBeInTheDocument();
        unmount();
        errorSpy.mockRestore();
        getFilterOptions.mockResolvedValue({ data: { institutes: [], specialties: [], years: [] } });
        render(
            <FilterHeader
                filters={emptyFilters}
                onFilterChange={vi.fn()}
                onResetFilters={vi.fn()}
            />
        );
        await waitFor(() => expect(getFilterOptions).toHaveBeenCalled());
        expect(screen.getByRole('combobox', { name: 'institute' }).options).toHaveLength(1);
    });
});
