import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
    getTeachersTable: vi.fn()
}));

vi.mock('@services/TeacherService.ts', () => ({
    default: {
        getTeachersTable: mocks.getTeachersTable
    }
}));

vi.mock('@tanstack/react-query', () => ({
    useQuery: ({ queryFn }) => ({
        data: queryFn(),
        isPending: false
    })
}));

vi.mock('@utils/queryConfig', () => ({
    defaultQueryOptions: {}
}));

vi.mock('@utils/utilities', () => ({
    downloadExcelWorkbook: vi.fn()
}));

vi.mock('react-router-dom', () => ({
    useNavigate: () => vi.fn()
}));

vi.mock('@components/ui/Loading.jsx', () => ({
    default: () => <div>Загрузка</div>
}));

vi.mock('../../../components/index.js', () => ({
    AutocompleteInput: ({ options, onChange }) => (
        <select
            aria-label="Поиск преподавателя"
            onChange={event => onChange(Number(event.target.value))}
        >
            <option value="">Выберите</option>

            {options.map(option => (
                <option
                    key={option.value}
                    value={option.value}
                >
                    {option.label}
                </option>
            ))}
        </select>
    ),

    Button: ({ text, onClick }) => (
        <button onClick={onClick}>{text}</button>
    )
}));

vi.mock('./TeacherView.jsx', () => ({
    default: ({ teacher }) => (
        <div data-testid="teacher-view">{teacher.name}</div>
    )
}));

vi.mock('@components/tables/DataTable', () => ({
    default: ({ rows, cellClickHandlers }) => (
        <div>
            {rows.map(row => (
                <div key={row.rowId}>
                    <span>{row.position}</span>

                    <button
                        onClick={event =>
                            cellClickHandlers(
                                row,
                                { id: 'name' },
                                event
                            )
                        }
                    >
                        {row.name}
                    </button>

                    <button
                        onClick={event =>
                            cellClickHandlers(
                                row,
                                { id: 'education_details' },
                                event
                            )
                        }
                    >
                        {row.education_details}
                    </button>
                </div>
            ))}
        </div>
    )
}));

import AdminTeachersView from './AdminTeachersView';

describe('AdminTeachersView', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        mocks.getTeachersTable.mockReturnValue({
            data: [
                {
                    id: 10,
                    name: 'Иванов Иван',
                    gender: 'М',
                    position: 'Доцент',
                    institution: 'Университет',
                    disciplines: ['Математика', 'Физика'],
                    education: [
                        {
                            education_type: 'Высшее',
                            direction: 'Математика',
                            qualification: 'Магистр'
                        }
                    ],
                    education_details: [
                        'Высшее',
                        'Математика',
                        'Магистр'
                    ],
                    professional_development: ['Курс 1'],
                    professional_retraining: []
                }
            ]
        });
    });

    it('отображает преподавателя после загрузки данных', () => {
        render(<AdminTeachersView />);

        expect(screen.getByText('Иванов Иван')).toBeInTheDocument();
        expect(screen.getByText('Доцент')).toBeInTheDocument();
    });

    it('открывает TeacherView при выборе ФИО', () => {
        render(<AdminTeachersView />);

        fireEvent.click(
            screen.getByRole('button', {
                name: 'Иванов Иван'
            })
        );

        expect(screen.getByTestId('teacher-view'))
            .toHaveTextContent('Иванов Иван');
    });

    it('открывает подробную информацию об образовании', () => {
        render(<AdminTeachersView />);

        fireEvent.click(
            screen.getByRole('button', {
                name: 'Математика'
            })
        );

        const educationDetails = screen.getByText(
            'Тип образования: Высшее; Направление: Математика; Квалификация: Магистр'
        );

        expect(educationDetails).toBeInTheDocument();
        expect(educationDetails)
            .toHaveTextContent('Тип образования: Высшее');
        expect(educationDetails)
            .toHaveTextContent('Направление: Математика');
        expect(educationDetails)
            .toHaveTextContent('Квалификация: Магистр');
    });

    it('не открывает окно для пустого образования', () => {
        mocks.getTeachersTable.mockReturnValue({
            data: [
                {
                    name: 'Петров Пётр',
                    education: [],
                    education_details: []
                }
            ]
        });

        render(<AdminTeachersView />);

        expect(
            screen.queryByText('Тип образования:')
        ).not.toBeInTheDocument();
    });
});