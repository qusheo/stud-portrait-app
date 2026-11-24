import React from 'react';
import {
    describe,
    expect,
    it,
    vi,
    beforeEach,
    afterEach
} from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import {
    QueryClient,
    QueryClientProvider
} from '@tanstack/react-query';

const mocks = vi.hoisted(() => ({
    getStudentPortrait: vi.fn(),
    getStudentById: vi.fn(),
    getStudentsList: vi.fn(),
    navigate: vi.fn(),
    toastError: vi.fn(),
    location: { state: { studentId: 42 } }
}));

vi.mock('@services', () => ({
    StudentService: {
        getStudentPortrait: mocks.getStudentPortrait,
        getStudentById: mocks.getStudentById,
        getStudentsList: mocks.getStudentsList
    }
}));

vi.mock('react-router-dom', () => ({
    useLocation: () => mocks.location,
    useNavigate: () => mocks.navigate
}));

vi.mock('react-toastify', () => ({
    toast: { error: mocks.toastError }
}));

vi.mock('@utils/queryConfig', () => ({
    defaultQueryOptions: {
        retry: false,
        refetchOnWindowFocus: false
    }
}));

vi.mock('react-apexcharts', () => ({
    default: ({ type, series }) => (
        <div
            data-testid="chart"
            data-chart-type={type}
            data-series={JSON.stringify(series)}
        />
    )
}));

vi.mock('@constants', () => ({
    COMPETENCIES_NAMES: {
        res_comp_leadership: 'Лидерство',
        res_comp_planning: 'Планирование'
    },
    VALUES_NAMES: {
        res_val_humanism: 'Гуманизм',
        res_val_health: 'Здоровье'
    },
    MOTIVATORS_NAMES: {
        res_mot_salary: 'Зарплата',
        res_mot_career: 'Карьера'
    }
}));

vi.mock('@components/FlexRow', () => ({
    default: ({ children }) => <div>{children}</div>,
    WRAP: { DO: 'wrap' }
}));

vi.mock('@components/ui/LoadingSpinner', () => ({
    default: ({ title }) => <div role="status">{title || 'Загрузка'}</div>
}));

vi.mock('@components/ui/Loading', () => ({
    default: ({ title }) => <div role="status">{title || 'Загрузка'}</div>
}));

vi.mock('@components/ui/Empty', () => ({
    default: ({ title }) => <div>{title}</div>
}));

vi.mock('@components/ui/TabButton', () => ({
    default: ({ text, onClick, isActive }) => (
        <button
            type="button"
            data-active={isActive}
            onClick={onClick}
        >
            {text}
        </button>
    )
}));

vi.mock('../../../components', () => ({
    Button: ({ text, onClick }) => (
        <button type="button" onClick={onClick}>
            {text}
        </button>
    )
}));

import AdminPortraitView from './AdminPortraitView.jsx';

function createQueryClient() {
    return new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
                gcTime: 0,
                staleTime: 0
            }
        }
    });
}

function renderView() {
    return render(
        <QueryClientProvider client={createQueryClient()}>
            <AdminPortraitView />
        </QueryClientProvider>
    );
}

function portraitData(overrides = {}) {
    return {
        student_info: {
            stud_name: 'Иван Иванов',
            specialty: 'Информатика',
            rsv_id: 'RSV-42',
            gender: 'М',
            institution: 'Университет',
            edu_level: 'Бакалавриат',
            study_form: 'Очная',
            current_course: 3
        },
        test_results: [
            {
                year: '2024',
                competencies: {
                    res_comp_leadership: 720,
                    res_comp_planning: 510
                },
                motivators: {
                    res_mot_salary: 650,
                    res_mot_career: 350
                },
                values: {
                    res_val_humanism: 700,
                    res_val_health: null
                }
            }
        ],
        academic_performance: [
            {
                year: '2024/2025',
                discipline: 'Математика',
                main_attestation: '5'
            }
        ],
        courses: [
            {
                leadership: 88,
                communication: 76
            }
        ],
        ...overrides
    };
}

describe('AdminPortraitView', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        mocks.location.state = { studentId: 42 };

        mocks.getStudentsList.mockResolvedValue({ data: [] });

        mocks.getStudentById.mockResolvedValue({
            data: portraitData().student_info
        });

        mocks.getStudentPortrait.mockResolvedValue({
            data: portraitData()
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('загружает и отображает основные сведения о студенте', async () => {
        renderView();

        expect(await screen.findByText('Иван Иванов')).toBeInTheDocument();
        expect(screen.getByText('Информатика')).toBeInTheDocument();
        expect(screen.getByText('RSV-42')).toBeInTheDocument();
        expect(screen.getByText('Университет')).toBeInTheDocument();
        expect(screen.getByText('Очная')).toBeInTheDocument();

        expect(mocks.getStudentPortrait).toHaveBeenCalledWith(42);
        expect(mocks.getStudentById).toHaveBeenCalledWith(42);
    });

    it('показывает состояние загрузки до завершения запроса портрета', async () => {
        let resolvePortrait;

        mocks.getStudentPortrait.mockReturnValue(
            new Promise(resolve => {
                resolvePortrait = resolve;
            })
        );

        renderView();

        expect(
            await screen.findByText('Загрузка портрета студента...')
        ).toBeInTheDocument();

        resolvePortrait({ data: portraitData() });

        expect(
            await screen.findByText('Иван Иванов')
        ).toBeInTheDocument();
    });

    it('отображает оценки и курсы на вкладке образования', async () => {
        renderView();

        await screen.findByText('Иван Иванов');

        fireEvent.click(
            screen.getByRole('button', { name: 'Образование' })
        );

        expect(
            screen.getByText('Оценки по дисциплинам')
        ).toBeInTheDocument();
        expect(screen.getByText('Математика')).toBeInTheDocument();
        expect(screen.getByText('5')).toBeInTheDocument();

        expect(
            screen.getByText('Пройденные образовательные курсы')
        ).toBeInTheDocument();
        expect(screen.getByText('Лидерство')).toBeInTheDocument();
        expect(screen.getByText('88')).toBeInTheDocument();
    });

    it('отображает аналитические данные на соответствующих вкладках', async () => {
        renderView();

        await screen.findByText('Иван Иванов');

        fireEvent.click(
            screen.getByRole('button', { name: 'Компетенции' })
        );

        expect(screen.getByTestId('chart')).toHaveAttribute(
            'data-chart-type',
            'radar'
        );

        fireEvent.click(
            screen.getByRole('button', { name: 'Мотиваторы' })
        );

        expect(screen.getAllByTestId('chart').length).toBeGreaterThan(0);

        fireEvent.click(
            screen.getByRole('button', { name: 'Ценности' })
        );

        expect(screen.getByText('Гуманизм')).toBeInTheDocument();
    });

    it('показывает пустые состояния при отсутствии оценок и курсов', async () => {
        mocks.getStudentPortrait.mockResolvedValue({
            data: portraitData({
                academic_performance: [],
                courses: []
            })
        });

        renderView();

        await screen.findByText('Иван Иванов');

        fireEvent.click(
            screen.getByRole('button', { name: 'Образование' })
        );

        expect(
            screen.getByText('Нет данных об успеваемости')
        ).toBeInTheDocument();

        expect(
            screen.getByText('Нет данных о пройденных курсах')
        ).toBeInTheDocument();
    });

    it('показывает сообщение при ошибке загрузки портрета', async () => {
        const consoleError = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});

        mocks.getStudentPortrait.mockRejectedValue(
            new Error('Network error')
        );

        // getStudentById не должен заполнить studentPortrait.student_info.
        // Иначе компонент продолжит отображать профиль, даже если
        // основной запрос getStudentPortrait завершился ошибкой.
        mocks.getStudentById.mockReturnValue(
            new Promise(() => {})
        );

        renderView();

        expect(
            await screen.findByText(
                'Не удалось загрузить данные студента'
            )
        ).toBeInTheDocument();

        expect(mocks.toastError).toHaveBeenCalledWith(
            'Ошибка при загрузке портрета'
        );

        consoleError.mockRestore();
    });

    it('переходит к подбору студентов с выбранным studentId', async () => {
        renderView();

        await screen.findByText('Иван Иванов');

        fireEvent.click(
            screen.getByRole('button', {
                name: 'Подбор студентов'
            })
        );

        expect(mocks.navigate).toHaveBeenCalledWith(
            '/admin/grouping',
            {
                state: {
                    studentId: 42
                }
            }
        );
    });
});