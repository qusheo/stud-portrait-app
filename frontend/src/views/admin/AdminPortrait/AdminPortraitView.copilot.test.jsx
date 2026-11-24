import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useQuery } from '@tanstack/react-query';
import AdminPortraitView from './AdminPortraitView.jsx';

const { navigate, location } = vi.hoisted(() => ({
    navigate: vi.fn(),
    location: { current: { state: null } }
}));

vi.mock('@tanstack/react-query', async importOriginal => {
    const actual = await importOriginal();
    return {
        ...actual,
        useQuery: vi.fn()
    };
});

vi.mock('react-router-dom', () => ({
    useLocation: () => location.current,
    useNavigate: () => navigate
}));

vi.mock('@services', () => ({
    StudentService: {
        getStudentPortrait: vi.fn(),
        getStudentById: vi.fn(),
        getStudentsList: vi.fn()
    }
}));

vi.mock('@components/ui/LoadingSpinner', () => ({
    default: ({ title }) => <div>{title || 'Загрузка'}</div>
}));

vi.mock('@components/ui/Loading', () => ({
    default: ({ title }) => <div role="status">{title}</div>
}));

vi.mock('@components/ui/Empty', () => ({
    default: ({ title }) => <div>{title || 'Нет данных'}</div>
}));

vi.mock('../../../components', () => ({
    Button: ({ text, onClick }) => (
        <button onClick={onClick}>{text}</button>
    )
}));

vi.mock('react-apexcharts', () => ({
    default: ({ options, series, type }) => (
        <div
            data-testid={`chart-${type}`}
            data-labels={JSON.stringify(options?.labels || options?.xaxis?.categories || [])}
            data-series={JSON.stringify(series)}
        />
    )
}));

vi.mock('react-toastify', () => ({
    toast: {
        error: vi.fn()
    }
}));

import { StudentService } from '@services';

const portrait = {
    student_info: {
        name: 'Иванова Анна Петровна',
        rsv_id: 'RSV-42',
        gender: 'Женский',
        institution: 'Университет 1',
        specialty: 'Математика',
        edu_level: 'Высшее',
        study_form: 'Очная',
        current_course: 3
    },
    test_results: [
        {
            year: '2023/2024',
            competencies: {
                res_comp_info_analysis: 500,
                res_comp_planning: 620
            },
            motivators: {
                res_mot_autonomy: 650,
                res_mot_salary: 350,
                res_mot_challenge: 450
            },
            values: {
                res_val_honesty_justice: 1,
                res_val_health: 1
            }
        },
        {
            year: '2024/2025',
            competencies: {
                res_comp_info_analysis: 700
            },
            motivators: {
                res_mot_autonomy: 300
            },
            values: {
                res_val_humanism: 1
            }
        }
    ],
    academic_performance: [
        {
            year: '2024/2025',
            discipline: 'Математика',
            main: 5,
            final: 5
        }
    ],
    courses: [
        {
            id: 1,
            an_dec: 600,
            communication: 450,
            leadership: null,
            stress_resistance: 350
        }
    ]
};

beforeEach(() => {
    vi.clearAllMocks();
    location.current = { state: null };
    useQuery.mockReset();
    useQuery.mockReturnValue({ isPending: false });
    StudentService.getStudentById.mockResolvedValue({
        ok: true,
        data: {
            student_id: 42,
            transfer: [],
            duplicate_account: [],
            repeated_year: false,
            expelled: null,
            education: [],
            interests: []
        }
    });
    StudentService.getStudentsList.mockResolvedValue({ data: [] });
});

describe('AdminPortraitView', () => {
    it('загружает портрет выбранного студента и показывает основные сведения', async () => {
        location.current = { state: { studentId: 42 } };
        let resolvePortrait;
        StudentService.getStudentPortrait.mockReturnValue(new Promise(resolve => {
            resolvePortrait = resolve;
        }));

        render(<AdminPortraitView />);

        expect(await screen.findByRole('status')).toBeInTheDocument();

        resolvePortrait({
            ok: true,
            data: portrait
        });

        await screen.findByRole('button', { name: 'Подбор студентов' });
        expect(await screen.findByRole('heading', {
            name: 'Иванова Анна Петровна'
        })).toBeInTheDocument();
        expect(screen.getByText('Математика')).toBeInTheDocument();
        expect(screen.getByText('RSV-42')).toBeInTheDocument();
        expect(StudentService.getStudentPortrait).toHaveBeenCalledWith(42);
    });

    it('не заменяет карточку студента данными дополнительного endpoint', async () => {
        location.current = { state: { studentId: 42 } };
        StudentService.getStudentPortrait.mockResolvedValue({
            ok: true,
            data: portrait
        });

        useQuery.mockImplementationOnce(config => {
            void config.queryFn();
            return { isPending: false };
        });

        render(<AdminPortraitView />);

        await waitFor(() =>
            expect(StudentService.getStudentById).toHaveBeenCalledWith(42)
        );

        await screen.findByRole('button', { name: 'Подбор студентов' });
        expect(screen.getByText('Математика')).toBeInTheDocument();
        expect(screen.getByText('RSV-42')).toBeInTheDocument();
        expect(screen.getByText('Университет 1')).toBeInTheDocument();
    });

    it('ищет студента и загружает портрет после выбора результата', async () => {
        StudentService.getStudentsList.mockResolvedValue({
            data: [{
                id: 42,
                rsv_id: 'RSV-42',
                institution: 'Университет 1',
                specialty: 'Математика',
                course: 3
            }]
        });
        StudentService.getStudentPortrait.mockResolvedValue({
            ok: true,
            data: portrait
        });

        render(<AdminPortraitView />);

        const input = screen.getByPlaceholderText(
            'Введите ID студента, ФИО или название вуза...'
        );
        fireEvent.change(input, { target: { value: 'Иванова' } });

        await waitFor(() =>
            expect(StudentService.getStudentsList).toHaveBeenCalledWith(
                'Иванова',
                20
            )
        );

        fireEvent.click(
            await screen.findByText(/Университет 1 • Математика • 3 курс/)
        );

        await waitFor(() =>
            expect(StudentService.getStudentPortrait).toHaveBeenCalledWith(42)
        );
        await screen.findByRole('button', { name: 'Подбор студентов' });
    });

    it('переключает компетенции и учебный год', async () => {
        location.current = { state: { studentId: 42 } };
        StudentService.getStudentPortrait.mockResolvedValue({
            ok: true,
            data: portrait
        });

        render(<AdminPortraitView />);

        await screen.findByRole('button', { name: 'Подбор студентов' });
        fireEvent.click(screen.getByRole('button', { name: 'Компетенции' }));
        fireEvent.click(screen.getByRole('button', { name: '2024/2025' }));

        const chart = await screen.findByTestId('chart-radar');
        expect(JSON.parse(chart.getAttribute('data-series'))).toEqual([
            {
                name: 'Баллы',
                data: expect.any(Array)
            }
        ]);
    });

    it('отображает мотиваторы по категориям', async () => {
        location.current = { state: { studentId: 42 } };
        StudentService.getStudentPortrait.mockResolvedValue({
            ok: true,
            data: portrait
        });

        render(<AdminPortraitView />);

        await screen.findByRole('button', { name: 'Подбор студентов' });
        fireEvent.click(screen.getByRole('button', { name: 'Мотиваторы' }));

        expect(screen.getAllByText('Мотиваторы').length).toBeGreaterThan(0);
        expect(screen.getByText('Непроявленные')).toBeInTheDocument();
        expect(screen.getByText('Демотиваторы')).toBeInTheDocument();
    });

    it('отображает только заполненные ценности и переключает год', async () => {
        location.current = { state: { studentId: 42 } };
        StudentService.getStudentPortrait.mockResolvedValue({
            ok: true,
            data: portrait
        });

        render(<AdminPortraitView />);

        await screen.findByRole('button', { name: 'Подбор студентов' });
        fireEvent.click(screen.getByRole('button', { name: 'Ценности' }));

        expect(screen.getByText('Честность и справедливость')).toBeInTheDocument();
        expect(screen.getByText('Здоровье')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: '2024/2025' }));
        expect(screen.getByText('Гуманизм')).toBeInTheDocument();
    });

    it('отображает успеваемость и курсы по реальной структуре API', async () => {
        location.current = { state: { studentId: 42 } };
        StudentService.getStudentPortrait.mockResolvedValue({
            ok: true,
            data: portrait
        });

        render(<AdminPortraitView />);

        await screen.findByRole('button', { name: 'Подбор студентов' });
        fireEvent.click(screen.getByRole('button', { name: 'Образование' }));

        expect(screen.getByText('Оценки по дисциплинам')).toBeInTheDocument();
        expect(screen.getByText('Математика')).toBeInTheDocument();
        expect(screen.getByText('5')).toBeInTheDocument();
        expect(screen.getByText('Пройденные образовательные курсы')).toBeInTheDocument();
        expect(screen.getByText('Анализ и принятие решений')).toBeInTheDocument();
    });

    it('показывает пустое состояние при пустом ответе и при ошибке загрузки', async () => {
        location.current = { state: { studentId: 42 } };
        StudentService.getStudentPortrait.mockResolvedValue({
            ok: true,
            data: null
        });

        const { unmount } = render(<AdminPortraitView />);

        expect(
            await screen.findByText('Не удалось загрузить данные студента')
        ).toBeInTheDocument();

        unmount();
        location.current = { state: { studentId: 43 } };
        StudentService.getStudentPortrait.mockRejectedValue(
            new Error('Network error')
        );

        render(<AdminPortraitView />);
        expect(
            await screen.findByText('Не удалось загрузить данные студента')
        ).toBeInTheDocument();
    });
});