import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ScientificActivity from '../../src/components/science/ScientificActivity';
import TeacherService from '../../src/services/TeacherService';

vi.mock('../../src/services/TeacherService', () => ({ default: { getScientificActivity: vi.fn() } }));

const dataset = {
    publications_count: 0,
    teachers_count: 0,
    directions_count: 0,
    popular_topics: [],
    directions: [],
    by_year: [],
    coverage: { with_keywords: 0, with_topics: 0, unknown_year: 0 },
    publications: [],
    institutions: [{ inst_id: 10, inst_name: 'University' }],
    page_size: 20
};
function mount(props = {}) {
    return render(
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
            <ScientificActivity {...props} />
        </QueryClientProvider>
    );
}
describe('Scientific activity', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        TeacherService.getScientificActivity.mockResolvedValue({ data: dataset });
    });
    it('shows a clear empty result and applies an institution filter', async () => {
        mount();
        await screen.findByText('По выбранным условиям публикаций нет.');
        fireEvent.change(screen.getByLabelText('Вуз'), { target: { value: '10' } });
        await waitFor(() =>
            expect(TeacherService.getScientificActivity).toHaveBeenLastCalledWith(expect.objectContaining({ institutionId: '10', page: 1 }))
        );
    });
    it('uses teacher identity and hides the university selector in a personal dashboard', async () => {
        mount({ teacherId: 42 });
        await screen.findByText('По выбранным условиям публикаций нет.');
        expect(screen.queryByLabelText('Вуз')).toBeNull();
        expect(TeacherService.getScientificActivity).toHaveBeenCalledWith(expect.objectContaining({ teacherId: 42 }));
    });
    it('shows request errors instead of an empty success dashboard', async () => {
        TeacherService.getScientificActivity.mockRejectedValue(new Error('Database not ready'));
        mount();
        expect(await screen.findByRole('alert')).toHaveTextContent('Database not ready');
    });
});
