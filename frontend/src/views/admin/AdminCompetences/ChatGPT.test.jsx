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

vi.mock('recharts', () => ({
    ResponsiveContainer: ({ children }) => <div>{children}</div>,
    BarChart: ({ data, children }) => (
        <div>
            {data?.map((item, index) => (
                <span key={`${item.discipline}-${index}`}>
                    {item.discipline}
                </span>
            ))}
            {children}
        </div>
    ),
    Bar: () => null,
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Tooltip: () => null,
    Cell: () => null,
    LabelList: () => null
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
                <option key={o.value} value={o.value}>{o.label}</option>
            ))}
        </select>
    )
}));

vi.mock('@ui/TabButton', () => ({ default: () => null }));

vi.mock('@ui/Button', () => ({
    default: ({ text, onClick, disabled }) => (
        <button disabled={disabled} onClick={onClick}>{text}</button>
    )
}));

function deferred() {
    let resolve;
    const promise = new Promise(res => {
        resolve = res;
    });
    return { promise, resolve };
}

function makeResponse(competency, total, average) {
    return {
        ok: true,
        competency,
        competency_name: competency,
        q1: 30,
        q3: 70,
        total_n: total,
        motivator_threshold: 600,
        params: {
            institute: null,
            specialty: null,
            year: null
        },
        groups: [
            {
                name: 'middle',
                label: 'Средний уровень',
                range: [30, 70],
                n: total,
                avg_competency: average,
                avg_grades: [],
                top_motivators: []
            }
        ]
    };
}

describe('ChatGPT — AI-тесты', () => {
    it('не должен заменять новые данные ответом устаревшего запроса', async () => {
        const oldRequest = deferred();
        const newRequest = deferred();

        getCompetencySegmentation.mockImplementation(({ competency }) => {
            if (competency === 'res_comp_planning') {
                return oldRequest.promise;
            }

            if (competency === 'res_comp_leadership') {
                return newRequest.promise;
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
            expect(getCompetencySegmentation).toHaveBeenCalledTimes(1);
        });

        fireEvent.change(screen.getByRole('combobox'), {
            target: { value: 'res_comp_leadership' }
        });

        await waitFor(() => {
            expect(getCompetencySegmentation).toHaveBeenCalledTimes(2);
        });

        await act(async () => {
            newRequest.resolve(makeResponse(217));
        });

        expect(await screen.findByText('217')).toBeInTheDocument();

        await act(async () => {
            oldRequest.resolve(makeResponse(111));
        });

        await waitFor(() => {
            expect(screen.getByText('217')).toBeInTheDocument();
            expect(screen.queryByText('111')).not.toBeInTheDocument();
        });
    });

    it('не должен сбрасывать выбранную специальность при ошибке загрузки списка', async () => {
        const allOptions = {
            institutes: [{ value: 'uni-1', label: 'ВУЗ 1' }],
            specialties: [{ value: 'spec-1', label: 'Направление 1' }],
            years: []
        };

        getFilterOptions.mockImplementation(async selectedInstitute => {
            if (!selectedInstitute) {
                return { data: allOptions };
            }
            throw new Error('Ошибка загрузки специальностей');
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
    it('не позволяет устаревшему ответу перезаписать результат нового запроса (корректный ответ API)', async () => {
        const oldRequest = deferred();
        const newRequest = deferred();

        getCompetencySegmentation.mockReset();
        getCompetencySegmentation.mockImplementation(({ competency }) => {
            if (competency === 'res_comp_planning') {
                return oldRequest.promise;
            }

            if (competency === 'res_comp_leadership') {
                return newRequest.promise;
            }

            throw new Error(`Неожиданная компетенция: ${competency}`);
        });

        render(
            <CompetencySegmentation
                filters={{ institute: '', specialty: '', year: '' }}
            />
        );

        await waitFor(() => {
            expect(getCompetencySegmentation).toHaveBeenCalledWith(
                expect.objectContaining({ competency: 'res_comp_planning' })
            );
        });

        fireEvent.change(screen.getByRole('combobox'), {
            target: { value: 'res_comp_leadership' }
        });

        await waitFor(() => {
            expect(getCompetencySegmentation).toHaveBeenCalledWith(
                expect.objectContaining({ competency: 'res_comp_leadership' })
            );
        });

        await act(async () => {
            newRequest.resolve(
                makeResponse('res_comp_leadership', 217, 64.5)
            );
        });

        await waitFor(() => {
            expect(screen.getAllByText('217')).toHaveLength(2);
        });
        expect(screen.getByText('64.5')).toBeInTheDocument();

        await act(async () => {
            oldRequest.resolve(
                makeResponse('res_comp_planning', 111, 42.5)
            );
        });

        expect(screen.getAllByText('217')).toHaveLength(2);
        expect(screen.queryByText('111')).not.toBeInTheDocument();
    });
    it('отображает сообщение об ошибке при неудачной загрузке сегментации', async () => {
        getCompetencySegmentation.mockReset();
        getCompetencySegmentation.mockRejectedValue(
            new Error('Сервер недоступен')
        );

        render(
            <CompetencySegmentation
                filters={{ institute: '', specialty: '', year: '' }}
            />
        );

        expect(
            await screen.findByText('Нет данных для сегментации')
        ).toBeInTheDocument();

        expect(
            screen.queryByText('Загрузка')
        ).not.toBeInTheDocument();
    });
    it('передаёт актуальные фильтры в запрос сегментации', async () => {
        getCompetencySegmentation.mockReset();
        getCompetencySegmentation.mockResolvedValue(
            makeResponse('res_comp_planning', 100, 55)
        );

        const { rerender } = render(
            <CompetencySegmentation
                filters={{
                    institute: 'uni-1',
                    specialty: 'spec-1',
                    year: '2025'
                }}
            />
        );

        await waitFor(() => {
            expect(getCompetencySegmentation).toHaveBeenCalledWith({
                competency: 'res_comp_planning',
                institute: 'uni-1',
                specialty: 'spec-1',
                year: '2025'
            });
        });

        rerender(
            <CompetencySegmentation
                filters={{
                    institute: 'uni-2',
                    specialty: 'spec-2',
                    year: '2026'
                }}
            />
        );

        await waitFor(() => {
            expect(getCompetencySegmentation).toHaveBeenLastCalledWith({
                competency: 'res_comp_planning',
                institute: 'uni-2',
                specialty: 'spec-2',
                year: '2026'
            });
        });
    });
    it('отображает показатели сегмента, дисциплины и мотиваторы из ответа API', async () => {
        getCompetencySegmentation.mockReset();
        getCompetencySegmentation.mockResolvedValue({
            ...makeResponse('res_comp_planning', 120, 4.2),
            groups: [
                {
                    name: 'middle',
                    label: 'Средний уровень',
                    range: [30, 70],
                    n: 120,
                    avg_competency: 4.2,
                    avg_grades: [
                        {
                            discipline: 'Математика',
                            avg: 4.5,
                            n: 30,
                            kind: 'top'
                        }
                    ],
                    top_motivators: [
                        {
                            key: 'achievement',
                            name: 'Достижение результата',
                            percent: 25,
                            count: 30
                        }
                    ]
                }
            ]
        });

        render(
            <CompetencySegmentation
                filters={{ institute: '', specialty: '', year: '' }}
            />
        );

        expect(await screen.findAllByText('120')).toHaveLength(2);
        expect(screen.getByText('4.2')).toBeInTheDocument();
        expect(screen.getByText('Математика')).toBeInTheDocument();
        expect(screen.getByText('Достижение результата')).toBeInTheDocument();
    });
});
