import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CompetencySegmentation from './CompetencySegmentation.jsx';
import FilterHeader from '@components/FilterHeader.jsx';

const { getCompetencySegmentation, getFilterOptions } = vi.hoisted(() => ({
    getCompetencySegmentation: vi.fn(),
    getFilterOptions: vi.fn()
}));

vi.mock('@services', () => ({
    AdminService: {
        getCompetencySegmentation,
        getFilterOptions
    }
}));

vi.mock('@utils/utilities.js', () => ({
    COMPETENCIES_NAMES: {
        res_comp_planning: 'Планирование',
        res_comp_leadership: 'Лидерство'
    }
}));

vi.mock('@components/ui/Loading', () => ({
    default: () => <div>Загрузка</div>
}));

vi.mock('@components/ui/Empty', () => ({
    default: ({ title }) => <div>{title}</div>
}));

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

function deferred() {
    let resolve;
    const promise = new Promise(res => {
        resolve = res;
    });
    return { promise, resolve };
}

function makeResponse(total) {
    return {
        total_n: total,
        q1: 30,
        q3: 70,
        groups: []
    };
}

describe('GitHub Copilot — AI-тесты', () => {
    it('[AI-COPILOT] не позволяет старым ответам перезаписать данные после смены компетенции', async () => {
        getCompetencySegmentation.mockReset();

        const oldRequests = [];
        const newRequests = [];

        getCompetencySegmentation.mockImplementation(({ competency }) => {
            const request = deferred();

            if (competency === 'res_comp_planning') {
                oldRequests.push(request);
                return request.promise;
            }

            if (competency === 'res_comp_leadership') {
                newRequests.push(request);
                return request.promise;
            }

            throw new Error(`Неожиданная компетенция: ${competency}`);
        });

        render(
            <React.StrictMode>
                <CompetencySegmentation
                    filters={{ institute: '', specialty: '', year: '' }}
                />
            </React.StrictMode>
        );

        await waitFor(() => {
            expect(oldRequests.length).toBeGreaterThan(0);
        });

        fireEvent.change(screen.getByRole('combobox'), {
            target: { value: 'res_comp_leadership' }
        });

        await waitFor(() => {
            expect(newRequests).toHaveLength(1);
        });

        await act(async () => {
            newRequests[0].resolve(makeResponse(217));
            await newRequests[0].promise;
        });

        // Новый результат должен появиться, пока старые запросы ещё ожидают ответа.
        expect(await screen.findByText('217')).toBeInTheDocument();

        await act(async () => {
            oldRequests.forEach(request => request.resolve(makeResponse(111)));
            await Promise.all(oldRequests.map(request => request.promise));
        });

        // При дефекте поздний старый ответ перезапишет 217 значением 111.
        expect(screen.getByText('217')).toBeInTheDocument();
        expect(screen.queryByText('111')).not.toBeInTheDocument();
    });

    it('сохраняет выбранную специальность при ошибке загрузки направлений', async () => {
        const allOptions = {
            institutes: [{ value: 'uni-1', label: 'ВУЗ 1' }],
            specialties: [{ value: 'spec-1', label: 'Направление 1' }],
            years: []
        };

        getFilterOptions.mockImplementation(async selectedInstitute => {
            if (selectedInstitute) {
                throw new Error('Ошибка загрузки специальностей');
            }

            return { data: allOptions };
        });

        const queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } }
        });
        const onFilterChange = vi.fn();

        render(
            <QueryClientProvider client={queryClient}>
                <FilterHeader
                    filters={{
                        institute: 'uni-1',
                        specialty: 'spec-1',
                        year: ''
                    }}
                    onFilterChange={onFilterChange}
                    onResetFilters={vi.fn()}
                />
            </QueryClientProvider>
        );

        await waitFor(() => {
            expect(
                queryClient.getQueryState([
                    'admin',
                    'filter-options',
                    'specialties',
                    'uni-1'
                ])?.status
            ).toBe('error');
        });

        expect(onFilterChange).not.toHaveBeenCalledWith('specialty', '');
    });

    it('[AI-COPILOT] оставляет выбор компетенции доступным после ошибки API', async () => {
        getCompetencySegmentation.mockReset();
        getCompetencySegmentation.mockRejectedValueOnce(new Error('Network error'));

        render(
            <CompetencySegmentation
                filters={{ institute: '', specialty: '', year: '' }}
            />
        );

        expect(await screen.findByText('Нет данных для сегментации')).toBeInTheDocument();
        expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    it('[AI-COPILOT] показывает пустое состояние для успешного ответа без групп', async () => {
        getCompetencySegmentation.mockReset();
        getCompetencySegmentation.mockResolvedValueOnce({
            total_n: 0,
            q1: null,
            q3: null,
            groups: [],
            message: 'Нет студентов под выбранные фильтры'
        });

        render(
            <CompetencySegmentation
                filters={{ institute: '', specialty: '', year: '' }}
            />
        );

        expect(
            await screen.findByText('Нет данных для выбранных фильтров.')
        ).toBeInTheDocument();
        expect(screen.getByText('0')).toBeInTheDocument();
    });

    it('[AI-COPILOT] передаёт выбранные фильтры в запрос сегментации', async () => {
        getCompetencySegmentation.mockReset();
        getCompetencySegmentation.mockResolvedValueOnce(makeResponse(42));

        const filters = {
            institute: 'uni-1',
            specialty: 'spec-1',
            year: '2024/2025'
        };

        render(<CompetencySegmentation filters={filters} />);

        expect(await screen.findByText('42')).toBeInTheDocument();
        expect(getCompetencySegmentation).toHaveBeenCalledWith({
            competency: 'res_comp_planning',
            institute: 'uni-1',
            specialty: 'spec-1',
            year: '2024/2025'
        });
    });

    it('[AI-COPILOT] повторяет загрузку после ошибки при изменении фильтра', async () => {
        getCompetencySegmentation.mockReset();
        getCompetencySegmentation
            .mockRejectedValueOnce(new Error('Network error'))
            .mockResolvedValueOnce(makeResponse(217));

        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

        try {
            const { rerender } = render(
                <CompetencySegmentation
                    filters={{ institute: 'uni-1', specialty: '', year: '' }}
                />
            );

            expect(
                await screen.findByText('Нет данных для сегментации')
            ).toBeInTheDocument();

            rerender(
                <CompetencySegmentation
                    filters={{ institute: 'uni-2', specialty: '', year: '' }}
                />
            );

            expect(await screen.findByText('217')).toBeInTheDocument();
            expect(getCompetencySegmentation).toHaveBeenCalledTimes(2);
            expect(getCompetencySegmentation.mock.calls[0][0].institute).toBe('uni-1');
            expect(getCompetencySegmentation.mock.calls[1][0].institute).toBe('uni-2');
        } finally {
            consoleError.mockRestore();
        }
    });

    it('[AI-COPILOT] игнорирует ошибку устаревшего запроса после успешной загрузки новых данных', async () => {
        getCompetencySegmentation.mockReset();

        const oldRequests = [];
        const newRequest = deferred();

        getCompetencySegmentation.mockImplementation(({ institute }) => {
            if (institute === 'uni-old') {
                let reject;
                const promise = new Promise((_, rejectPromise) => {
                    reject = rejectPromise;
                });

                oldRequests.push({ promise, reject });
                return promise;
            }

            if (institute === 'uni-new') {
                return newRequest.promise;
            }

            throw new Error(`Неожиданный институт: ${institute}`);
        });

        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

        try {
            const { rerender } = render(
                <CompetencySegmentation
                    filters={{ institute: 'uni-old', specialty: '', year: '' }}
                />
            );

            await waitFor(() => {
                expect(oldRequests.length).toBeGreaterThan(0);
            });

            rerender(
                <CompetencySegmentation
                    filters={{ institute: 'uni-new', specialty: '', year: '' }}
                />
            );

            await waitFor(() => {
                expect(
                    getCompetencySegmentation.mock.calls.some(
                        ([params]) => params.institute === 'uni-new'
                    )
                ).toBe(true);
            });

            await act(async () => {
                newRequest.resolve(makeResponse(217));
                await newRequest.promise;
            });

            expect(await screen.findByText('217')).toBeInTheDocument();

            await act(async () => {
                oldRequests.forEach(request => {
                    request.reject(new Error('Ошибка старого запроса'));
                });

                await Promise.all(
                    oldRequests.map(request => request.promise.catch(() => {}))
                );
            });

            expect(screen.queryByText('Нет данных для сегментации')).not.toBeInTheDocument();
            expect(screen.getByText('217')).toBeInTheDocument();
        } finally {
            consoleError.mockRestore();
        }
    });

    it('[AI-COPILOT] сохраняет индикатор загрузки, пока новый запрос ещё выполняется', async () => {
        getCompetencySegmentation.mockReset();

        const oldRequests = [];
        const newRequests = [];

        getCompetencySegmentation.mockImplementation(({ competency }) => {
            const request = deferred();

            if (competency === 'res_comp_planning') {
                oldRequests.push(request);
                return request.promise;
            }

            if (competency === 'res_comp_leadership') {
                newRequests.push(request);
                return request.promise;
            }

            throw new Error(`Неожиданная компетенция: ${competency}`);
        });

        render(
            <CompetencySegmentation
                filters={{ institute: '', specialty: '', year: '' }}
            />
        );

        await waitFor(() => {
            expect(oldRequests.length).toBeGreaterThan(0);
        });

        fireEvent.change(screen.getByRole('combobox'), {
            target: { value: 'res_comp_leadership' }
        });

        await waitFor(() => {
            expect(newRequests.length).toBeGreaterThan(0);
        });

        expect(screen.getByText('Загрузка')).toBeInTheDocument();

        await act(async () => {
            oldRequests[0].resolve(makeResponse(111));
            await oldRequests[0].promise;
        });

        // Выбранный сейчас запрос ещё не завершён, поэтому индикатор должен остаться.
        expect(screen.getByText('Загрузка')).toBeInTheDocument();
    });
});