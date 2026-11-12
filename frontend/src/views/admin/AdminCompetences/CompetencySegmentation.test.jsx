import React from 'react';
import { describe, it, expect, vi } from 'vitest';
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

describe('CompetencySegmentation', () => {
    it('[AI-CHATGPT] не должен заменять новые данные ответом устаревшего запроса', async () => {
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
        it('[AI-COPILOT] не позволяет старому ответу перезаписать данные после смены компетенции', async () => {
    getCompetencySegmentation.mockReset();

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
            <CompetencySegmentation filters={{ institute: '', specialty: '', year: '' }} />
        </React.StrictMode>
    );

    await waitFor(() => {
        expect(
            getCompetencySegmentation.mock.calls.some(
                ([params]) => params.competency === 'res_comp_planning'
            )
        ).toBe(true);
    });

    fireEvent.change(screen.getByRole('combobox'), {
        target: { value: 'res_comp_leadership' }
    });

    await waitFor(() => {
        expect(
            getCompetencySegmentation.mock.calls.some(
                ([params]) => params.competency === 'res_comp_leadership'
            )
        ).toBe(true);
    });

    await act(async () => {
        newRequest.resolve(makeResponse(217));
        await newRequest.promise;
    });

    expect(await screen.findByText('217')).toBeInTheDocument();

    await act(async () => {
        oldRequest.resolve(makeResponse(111));
        await oldRequest.promise;
    });

    expect(screen.getByText('217')).toBeInTheDocument();
    expect(screen.queryByText('111')).not.toBeInTheDocument();
});
});
