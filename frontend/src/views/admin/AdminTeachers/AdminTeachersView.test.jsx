import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { useQuery } from '@tanstack/react-query';
import AdminTeachersView from './AdminTeachersView.jsx';

const { navigate } = vi.hoisted(() => ({
    navigate: vi.fn()
}));

vi.mock('@tanstack/react-query', async importOriginal => {
    const actual = await importOriginal();
    return {
        ...actual,
        useQuery: vi.fn()
    };
});

vi.mock('react-router-dom', () => ({
    useNavigate: () => navigate
}));

vi.mock('@services/TeacherService.ts', () => ({
    default: {
        getTeachersTable: vi.fn()
    }
}));

vi.mock('@components/ui/Loading.jsx', () => ({
    default: ({ title }) => <div>{title}</div>
}));

vi.mock('@components/tables/DataTable', () => ({
    default: ({ rows, cellClickHandlers, onSelectionChange }) => (
        <div>
            {rows.map(row => (
                <div key={row.rowId} data-testid={`row-${row.rowId}`}>
                    <button
                        data-testid={`name-${row.rowId}`}
                        onClick={event => cellClickHandlers(row, { id: 'name' }, event)}
                    >
                        {row.name}
                    </button>
                    <button
                        data-testid={`disciplines-${row.rowId}`}
                        onClick={event => cellClickHandlers(row, { id: 'disciplines' }, event)}
                    >
                        Дисциплины: {Array.isArray(row.disciplines) ? row.disciplines.length : 0}
                    </button>
                    <button
                        data-testid={`education-${row.rowId}`}
                        onClick={event => cellClickHandlers(row, { id: 'education_details' }, event)}
                    >
                        Образование
                    </button>
                    <button
                        data-testid={`development-${row.rowId}`}
                        onClick={event => cellClickHandlers(row, { id: 'professional_development' }, event)}
                    >
                        Повышение
                    </button>
                    <button
                        data-testid={`select-${row.rowId}`}
                        onClick={() => onSelectionChange?.([row])}
                    >
                        Выбрать
                    </button>
                </div>
            ))}
        </div>
    )
}));

vi.mock('@components/ui/AutocompleteInput.jsx', () => ({
    default: ({ options = [], value = '', onChange }) => (
        <div>
            <input aria-label="Поиск преподавателя" value={value ?? ''} readOnly />
            {options.map(option => (
                <button key={option.value} onClick={() => onChange(option.value)}>
                    {option.label}
                </button>
            ))}
        </div>
    )
}));

vi.mock('@ui/Button', () => ({
    default: ({ text, onClick }) => <button onClick={onClick}>{text}</button>
}));

vi.mock('react-toastify', () => ({
    toast: { error: vi.fn() }
}));

vi.mock('exceljs', () => ({
    default: {
        Workbook: vi.fn()
    }
}));

vi.mock('@utils/utilities', () => ({
    downloadExcelWorkbook: vi.fn()
}));

const teacher = {
    id: 10,
    name: 'Иванова Анна Петровна',
    gender: 'Ж',
    position: 'Доцент',
    disciplines: ['Алгебра', 'Геометрия'],
    institution: 'Университет',
    edu_level: 'Высшее',
    academic_degree: 'Кандидат наук',
    academic_title: '',
    qualification: 'Преподаватель',
    experience: 12,
    education: [
        {
            education_type: 'Высшее образование',
            direction: 'Математика',
            qualification: 'Математик'
        },
        {
            education_type: 'Дополнительное образование',
            direction: '',
            qualification: 'Педагог'
        }
    ],
    education_details: ['Высшее образование', 'Математика', 'Математик'],
    professional_development: ['Курс 1', 'Курс 2'],
    professional_retraining: ['Программа 1']
};

function mockTeachersTable(data) {
    useQuery.mockReturnValue({
        data: { data },
        isPending: false
    });
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe('AdminTeachersView', () => {
    it('показывает загрузку и затем основные данные преподавателя', () => {
        useQuery.mockReturnValue({
            data: undefined,
            isPending: true
        });

        const { rerender } = render(<AdminTeachersView />);
        expect(screen.getByText('Загрузка таблицы')).toBeInTheDocument();

        mockTeachersTable([teacher]);

        rerender(<AdminTeachersView />);
        expect(screen.getByTestId('row-1')).toBeInTheDocument();
        expect(screen.getByText('Дисциплины: 2')).toBeInTheDocument();
    });

    it('показывает пустую таблицу при пустом массиве или отсутствии data', () => {
        useQuery.mockReturnValue({
            data: { data: [] },
            isPending: false
        });

        const { rerender } = render(<AdminTeachersView />);
        expect(screen.queryByTestId('row-1')).not.toBeInTheDocument();

        useQuery.mockReturnValue({
            data: undefined,
            isPending: false
        });

        rerender(<AdminTeachersView />);
        expect(screen.queryByTestId('row-1')).not.toBeInTheDocument();
    });

    it('открывает карточку выбранного преподавателя и закрывает ее', () => {
        mockTeachersTable([teacher]);

        render(<AdminTeachersView />);
        fireEvent.click(screen.getByTestId('name-1'));

        const teacherCard = document.querySelector('.TeacherView');
        expect(within(teacherCard).getByText('Иванова Анна Петровна')).toBeInTheDocument();
        expect(within(teacherCard).getByText('Университет')).toBeInTheDocument();
        expect(within(teacherCard).getByText('12 лет')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'X Закрыть' }));
        expect(document.querySelector('.TeacherView')).not.toBeInTheDocument();
    });

    it('открывает подробности образования для выбранного преподавателя', () => {
        mockTeachersTable([teacher]);

        render(<AdminTeachersView />);
        fireEvent.click(screen.getByTestId('education-1'));

        expect(screen.getByText(/Тип образования: Высшее образование/)).toBeInTheDocument();
        expect(screen.getByText(/Направление: Математика/)).toBeInTheDocument();
        expect(screen.getByText(/Квалификация: Математик/)).toBeInTheDocument();
        expect(screen.getByText(/Квалификация: Педагог/)).toBeInTheDocument();

        fireEvent.mouseDown(document.body);
        expect(screen.queryByText(/Тип образования:/)).not.toBeInTheDocument();
    });

    it('не открывает окно образования при пустом списке образования', () => {
        mockTeachersTable([
            {
                name: 'Петров Пётр',
                education: [],
                education_details: []
            }
        ]);

        render(<AdminTeachersView />);

        expect(
            screen.queryByText(/Тип образования:/)
        ).not.toBeInTheDocument();
    });

    it('открывает полный список дисциплин и закрывает его вне области', () => {
        mockTeachersTable([teacher]);

        render(<AdminTeachersView />);
        fireEvent.click(screen.getByTestId('disciplines-1'));

        expect(screen.getByText('Алгебра')).toBeInTheDocument();
        expect(screen.getByText('Геометрия')).toBeInTheDocument();

        fireEvent.mouseDown(document.body);
        expect(screen.queryByText('Алгебра')).not.toBeInTheDocument();
    });

    it('выбирает преподавателя через поиск и открывает его карточку', () => {
        mockTeachersTable([teacher]);

        render(<AdminTeachersView />);

        fireEvent.click(
            screen.getByRole('button', {
                name: 'Иванова Анна Петровна, Доцент | Университет'
            })
        );

        const teacherCard = document.querySelector('.TeacherView');
        expect(within(teacherCard).getByText('Иванова Анна Петровна')).toBeInTheDocument();
    });

    it('отображает fallback для отсутствующих полей в карточке', () => {
        mockTeachersTable([
            {
                ...teacher,
                gender: '',
                position: null,
                academic_degree: null,
                academic_title: null,
                experience: null,
                education: [],
                education_details: []
            }
        ]);

        render(<AdminTeachersView />);
        fireEvent.click(screen.getByTestId('name-1'));

        expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    });

    it('передает выбранного преподавателя на переход к профилю', () => {
        mockTeachersTable([teacher]);

        render(<AdminTeachersView />);
        fireEvent.click(screen.getByTestId('name-1'));
        fireEvent.click(screen.getByRole('button', { name: 'Перейти к профилю' }));

        expect(navigate).toHaveBeenCalledWith('/admin/portrait', {
            state: { studentId: null }
        });
    });
});
