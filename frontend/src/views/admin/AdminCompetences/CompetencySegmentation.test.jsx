import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import CompetencySegmentation from './CompetencySegmentation.jsx';

const { getCompetencySegmentation } = vi.hoisted(() => ({
    getCompetencySegmentation: vi.fn()
}));

vi.mock('@services', () => ({
    AdminService: {
        getCompetencySegmentation
    }
}));

vi.mock('@constants', () => ({
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

function deferred() {
    let resolve;
    const promise = new Promise(res => {
        resolve = res;
    });
    return { promise, resolve };
}

function makeResponse(total, average = null) {
    return {
        total_n: total,
        q1: 30,
        q3: 70,
        avg_competency: average,
        groups: average === null
            ? []
            : [
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

beforeEach(() => {
    getCompetencySegmentation.mockReset();
});

describe('CompetencySegmentation', () => {
    it('не должен заменять новые данные ответом устаревшего запроса', async () => {
        const oldRequest = deferred();
        const newRequest = deferred();

        getCompetencySegmentation
            .mockReturnValueOnce(oldRequest.promise)
            .mockReturnValueOnce(newRequest.promise);

        render(<CompetencySegmentation filters={{ institute: '', specialty: '', year: '' }} />);

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

    it('передаёт актуальные фильтры в запрос сегментации', async () => {
        getCompetencySegmentation.mockResolvedValue(makeResponse(100, 55));

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

    it('показывает пустое состояние для успешного ответа без групп', async () => {
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

    it('отображает сообщение об ошибке при неудачной загрузке сегментации', async () => {
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

    it('повторяет загрузку после ошибки при изменении фильтра', async () => {
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

    it('оставляет выбор компетенции доступным после ошибки API', async () => {
        getCompetencySegmentation.mockRejectedValueOnce(new Error('Network error'));

        render(
            <CompetencySegmentation
                filters={{ institute: '', specialty: '', year: '' }}
            />
        );

        expect(await screen.findByText('Нет данных для сегментации')).toBeInTheDocument();
        expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    it('отображает показатели сегмента, дисциплины и мотиваторы из ответа API', async () => {
        getCompetencySegmentation.mockResolvedValue({
            total_n: 120,
            q1: 30,
            q3: 70,
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
