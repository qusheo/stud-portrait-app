import React from 'react';
import {
    describe,
    expect,
    it,
    vi,
    beforeEach,
    afterEach
} from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
        res_comp_planning: 'Планирование',
        res_comp_info_analysis: 'Анализ информации'
    },
    VALUES_NAMES: {
        res_val_humanism: 'Гуманизм',
        res_val_health: 'Здоровье',
        res_val_honesty_justice: 'Честность и справедливость'
    },
    MOTIVATORS_NAMES: {
        res_mot_salary: 'Зарплата',
        res_mot_career: 'Карьера',
        res_mot_autonomy: 'Автономия',
        res_mot_challenge: 'Интересная работа'
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
                communication: 76,
                an_dec: 600
            }
        ],
        ...overrides
    };
}

const multiYearPortrait = {
    student_info: {
        stud_name: 'Иванова Анна Петровна',
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
    academic_performance: [],
    courses: []
};

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

    it('ищет студента и загружает портрет после выбора результата', async () => {
        mocks.location.state = null;
        mocks.getStudentById.mockResolvedValue({ data: {} });
        mocks.getStudentsList.mockResolvedValue({
            data: [
                {
                    id: 42,
                    rsv_id: 'RSV-42',
                    institution: 'Университет 1',
                    specialty: 'Математика',
                    course: 3
                }
            ]
        });

        renderView();

        const input = screen.getByPlaceholderText(
            'Введите ID студента, ФИО или название вуза...'
        );
        fireEvent.change(input, { target: { value: 'Иванова' } });

        await waitFor(() =>
            expect(mocks.getStudentsList).toHaveBeenCalledWith('Иванова', 20)
        );

        fireEvent.click(
            await screen.findByText(/Университет 1 • Математика • 3 курс/)
        );

        await waitFor(() =>
            expect(mocks.getStudentPortrait).toHaveBeenCalledWith(42)
        );
        await screen.findByText('Иван Иванов');
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
        expect(
            screen.getByText('Анализ и принятие решений')
        ).toBeInTheDocument();
        expect(screen.getByText('600')).toBeInTheDocument();
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

    it('переключает учебный год на вкладке компетенций', async () => {
        mocks.getStudentPortrait.mockResolvedValue({
            data: multiYearPortrait
        });
        mocks.getStudentById.mockResolvedValue({
            data: multiYearPortrait.student_info
        });

        renderView();

        await screen.findByText('Иванова Анна Петровна');
        fireEvent.click(screen.getByRole('button', { name: 'Компетенции' }));
        fireEvent.click(screen.getByRole('button', { name: '2024/2025' }));

        const chart = await screen.findByTestId('chart');
        expect(JSON.parse(chart.getAttribute('data-series'))).toEqual([
            {
                name: 'Баллы',
                data: expect.any(Array)
            }
        ]);
    });

    it('группирует мотиваторы по категориям', async () => {
        mocks.getStudentPortrait.mockResolvedValue({
            data: multiYearPortrait
        });
        mocks.getStudentById.mockResolvedValue({
            data: multiYearPortrait.student_info
        });

        renderView();

        await screen.findByText('Иванова Анна Петровна');
        fireEvent.click(screen.getByRole('button', { name: 'Мотиваторы' }));

        expect(screen.getAllByText('Мотиваторы').length).toBeGreaterThan(0);
        expect(screen.getByText('Непроявленные')).toBeInTheDocument();
        expect(screen.getByText('Демотиваторы')).toBeInTheDocument();
    });

    it('отображает только заполненные ценности и переключает год', async () => {
        mocks.getStudentPortrait.mockResolvedValue({
            data: multiYearPortrait
        });
        mocks.getStudentById.mockResolvedValue({
            data: multiYearPortrait.student_info
        });

        renderView();

        await screen.findByText('Иванова Анна Петровна');
        fireEvent.click(screen.getByRole('button', { name: 'Ценности' }));

        expect(
            screen.getByText('Честность и справедливость')
        ).toBeInTheDocument();
        expect(screen.getByText('Здоровье')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: '2024/2025' }));
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

    it('показывает сообщение при пустом ответе API', async () => {
        mocks.getStudentPortrait.mockResolvedValue({ data: null });
        mocks.getStudentById.mockReturnValue(new Promise(() => {}));

        renderView();

        expect(
            await screen.findByText(
                'Не удалось загрузить данные студента'
            )
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
});
