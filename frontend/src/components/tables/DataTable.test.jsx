import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import DataTable from './DataTable.jsx';

const observerInstances = [];

vi.mock('./DataTable.scss', () => ({}));
vi.mock('antd', () => ({
    Select: ({ options = [], value = [], onChange }) => (
        <div>
            {options.map(option => (
                <label key={option.value}>
                    <input
                        type="checkbox"
                        checked={value.includes(option.value)}
                        onChange={event => {
                            const next = event.target.checked ? [...value, option.value] : value.filter(item => item !== option.value);
                            onChange(next);
                        }}
                    />
                    {option.label}
                </label>
            ))}
        </div>
    )
}));

const columns = [
    { id: 'name', title: 'Имя', sortable: true, searchable: true, tooltip: true },
    { id: 'score', title: 'Баллы', sortable: true, filterable: true, filterType: 'number', results: true },
    { id: 'category', title: 'Категория', filterable: true },
    { id: 'subjects', title: 'Дисциплины', filterable: true, filterType: 'combined' },
    { id: 'details', title: 'Детали', clickable: true }
];

const rows = [
    { id: 1, name: 'Студент 10', score: 300, category: 'А', subjects: ['Математика', 'Физика'], details: 'Первый' },
    { id: 2, name: 'Студент 2', score: 450, category: 'Б', subjects: ['Математика'], details: 'Второй' },
    { id: 3, name: 'Альфа', score: 700, category: 'А', subjects: ['Химия', 'Математика', 'Физика'], details: 'Третий' },
    { id: 4, name: 'Без оценки', score: null, category: '', subjects: [], details: 'Четвёртый' }
];

const rowNames = () =>
    Array.from(document.querySelectorAll('.data-table__row')).map(row => row.querySelector('.data-table__cell')?.textContent);

const headerFor = title =>
    Array.from(document.querySelectorAll('th.data-table__header')).find(
        header => header.querySelector('.data-table__header-title > span:first-child')?.textContent.trim() === title
    );

const openFilter = title => {
    fireEvent.click(headerFor(title).querySelector('.data-table__header-button'));
    return document.querySelector('.data-table__filter-popover');
};

beforeEach(() => {
    observerInstances.length = 0;
    class MockIntersectionObserver {
        constructor(callback, options) {
            this.callback = callback;
            this.options = options;
            this.observe = vi.fn();
            this.disconnect = vi.fn();
            observerInstances.push(this);
        }
    }
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('DataTable', () => {
    it('показывает пустое состояние и таблицу без выбора строк', () => {
        const { rerender } = render(
            <DataTable
                columns={columns}
                rows={[]}
            />
        );
        expect(screen.getByText('Нет данных')).toBeInTheDocument();
        expect(screen.queryByRole('table')).not.toBeInTheDocument();

        rerender(
            <DataTable
                columns={columns}
                rows={rows}
                selection={false}
            />
        );
        expect(screen.getByRole('table')).toBeInTheDocument();
        expect(screen.getAllByRole('columnheader')).toHaveLength(columns.length);
        expect(headerFor('Имя').querySelector('.data-table__header-title')).toHaveAttribute('title', 'Имя');
        expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    });

    it('сортирует строки по возрастанию, убыванию и возвращает исходный порядок', () => {
        render(
            <DataTable
                columns={columns}
                rows={rows}
            />
        );
        const nameHeader = headerFor('Имя').querySelector('.data-table__header-title');

        fireEvent.click(nameHeader);
        expect(rowNames()).toEqual(['Альфа', 'Без оценки', 'Студент 2', 'Студент 10']);
        expect(nameHeader.textContent).toContain('↑');

        fireEvent.click(nameHeader);
        expect(rowNames()).toEqual(['Студент 10', 'Студент 2', 'Без оценки', 'Альфа']);
        expect(nameHeader.textContent).toContain('↓');

        fireEvent.click(nameHeader);
        expect(rowNames()).toEqual(rows.map(row => row.name));
        expect(nameHeader.textContent).toContain('↕');

        fireEvent.click(headerFor('Баллы').querySelector('.data-table__header-title'));
        expect(rowNames()).toEqual(['Студент 10', 'Студент 2', 'Альфа', 'Без оценки']);
    });

    it('ищет без учёта регистра, очищает поиск и сочетает его с фильтром', () => {
        render(
            <DataTable
                columns={columns}
                rows={rows}
            />
        );
        fireEvent.click(headerFor('Имя').querySelector('.data-table__search-button'));
        const searchInput = screen.getByPlaceholderText('Поиск...');
        fireEvent.change(searchInput, { target: { value: 'СТУДЕНТ' } });
        expect(rowNames()).toEqual(['Студент 10', 'Студент 2']);

        fireEvent.click(screen.getByRole('button', { name: '×' }));
        expect(rowNames()).toEqual(rows.map(row => row.name));

        fireEvent.click(headerFor('Имя').querySelector('.data-table__search-button'));
        expect(screen.queryByPlaceholderText('Поиск...')).not.toBeInTheDocument();
        fireEvent.click(headerFor('Имя').querySelector('.data-table__search-button'));
        fireEvent.change(screen.getByPlaceholderText('Поиск...'), { target: { value: 'альфа' } });
        const filterPanel = openFilter('Категория');
        fireEvent.change(filterPanel.querySelector('select'), { target: { value: 'Б' } });
        expect(rowNames()).toEqual([]);
        expect(screen.getByText('Нет данных')).toBeInTheDocument();
        expect(screen.queryByPlaceholderText('Поиск...')).not.toBeInTheDocument();
        fireEvent.click(headerFor('Категория').querySelector('.data-table__header-button'));
        expect(document.querySelector('.data-table__filter-popover')).not.toBeInTheDocument();
    });

    it('применяет select- и числовые фильтры, сбрасывает их и показывает пустое состояние результата', () => {
        render(
            <DataTable
                columns={columns}
                rows={rows}
            />
        );

        let panel = openFilter('Категория');
        fireEvent.change(panel.querySelector('select'), { target: { value: 'Б' } });
        expect(rowNames()).toEqual(['Студент 2']);
        fireEvent.click(screen.getByRole('button', { name: 'Сбросить' }));
        expect(rowNames()).toEqual(rows.map(row => row.name));

        panel = openFilter('Баллы');
        fireEvent.change(panel.querySelector('.data-table__filter-input select'), { target: { value: '>' } });
        fireEvent.change(panel.querySelector('input[type="number"]'), { target: { value: '400' } });
        expect(rowNames()).toEqual(['Студент 2', 'Альфа']);

        fireEvent.change(panel.querySelector('.data-table__filter-input select'), { target: { value: '=' } });
        fireEvent.change(panel.querySelector('input[type="number"]'), { target: { value: '450' } });
        expect(rowNames()).toEqual(['Студент 2']);

        fireEvent.change(panel.querySelector('.data-table__filter-input select'), { target: { value: '<' } });
        fireEvent.change(panel.querySelector('input[type="number"]'), { target: { value: '400' } });
        expect(rowNames()).toEqual(['Студент 10']);

        fireEvent.click(screen.getByRole('button', { name: 'Сбросить' }));
        expect(rowNames()).toEqual(rows.map(row => row.name));
    });

    it('фильтрует combined-колонку по количеству и выбранным значениям дисциплин', () => {
        render(
            <DataTable
                columns={columns}
                rows={rows}
            />
        );
        const panel = openFilter('Дисциплины');

        fireEvent.change(panel.querySelector('.data-table__filter-input select'), { target: { value: '>' } });
        fireEvent.change(panel.querySelector('input[type="number"]'), { target: { value: '1' } });
        expect(rowNames()).toEqual(['Студент 10', 'Альфа']);

        fireEvent.change(panel.querySelector('.data-table__filter-combined > select'), { target: { value: 'text' } });
        fireEvent.click(screen.getByLabelText('Химия'));
        expect(rowNames()).toEqual(['Альфа']);

        fireEvent.click(screen.getByLabelText('Математика'));
        expect(rowNames()).toEqual(['Студент 10', 'Студент 2', 'Альфа']);

        fireEvent.click(screen.getByRole('button', { name: 'Сбросить' }));
        expect(rowNames()).toEqual(rows.map(row => row.name));
    });

    it('выбирает отдельные и отфильтрованные строки и сообщает актуальный выбор', () => {
        const onSelectionChange = vi.fn();
        render(
            <DataTable
                columns={columns}
                rows={rows}
                onSelectionChange={onSelectionChange}
            />
        );

        const rowCheckboxes = () => document.querySelectorAll('tbody .data-table__select-cell input');
        fireEvent.click(rowCheckboxes()[0]);
        expect(onSelectionChange).toHaveBeenLastCalledWith([rows[0]]);
        expect(document.querySelector('.data-table__row')).toHaveClass('data-table__row--selected');

        const panel = openFilter('Категория');
        fireEvent.change(panel.querySelector('select'), { target: { value: 'А' } });
        fireEvent.click(document.querySelector('thead .data-table__select-cell input'));
        expect(onSelectionChange).toHaveBeenLastCalledWith([rows[0], rows[2]]);
        expect(Array.from(rowCheckboxes()).every(checkbox => checkbox.checked)).toBe(true);

        fireEvent.click(document.querySelector('thead .data-table__select-cell input'));
        expect(onSelectionChange).toHaveBeenLastCalledWith([]);
        expect(Array.from(rowCheckboxes()).every(checkbox => !checkbox.checked)).toBe(true);
    });

    it('вызывает обработчик клика ячейки и форматирует значения результата', () => {
        const clickHandler = vi.fn();
        const formattingRows = [
            ...rows,
            { id: 5, name: 'Ноль', score: 0, subjects: [], details: 'Ноль' },
            { id: 6, name: 'Ниже порога', score: 199, subjects: [], details: 'Низкий' },
            { id: 7, name: 'Красный порог', score: 200, subjects: [], details: '200' },
            { id: 8, name: 'Жёлтый порог', score: 400, subjects: [], details: '400' },
            { id: 9, name: 'Зелёный порог', score: 600, subjects: [], details: '600' }
        ];
        render(
            <DataTable
                columns={[
                    { id: 'name', title: 'Имя' },
                    { id: 'score', title: 'Результат', results: true },
                    { id: 'subjects', title: 'Дисциплины', filterType: 'combined' },
                    { id: 'details', title: 'Детали', clickable: true }
                ]}
                rows={formattingRows}
                selection={false}
                cellClickHandlers={{ details: clickHandler }}
            />
        );

        const cells = Array.from(document.querySelectorAll('tbody tr')).map(row => row.querySelectorAll('td'));
        expect(cells[0][1]).toHaveClass('data-table__cell--red');
        expect(cells[1][1]).toHaveClass('data-table__cell--yellow');
        expect(cells[2][1]).toHaveClass('data-table__cell--green');
        expect(cells[3][1]).toHaveTextContent('-');
        expect(cells[4][1]).toHaveTextContent('-');
        for (const index of [4, 5]) {
            expect(cells[index][1]).not.toHaveClass('data-table__cell--red');
            expect(cells[index][1]).not.toHaveClass('data-table__cell--yellow');
            expect(cells[index][1]).not.toHaveClass('data-table__cell--green');
        }
        expect(cells[6][1]).toHaveClass('data-table__cell--red');
        expect(cells[7][1]).toHaveClass('data-table__cell--yellow');
        expect(cells[8][1]).toHaveClass('data-table__cell--green');
        expect(cells[0][2]).toHaveTextContent('2');
        expect(cells[3][2]).toHaveTextContent('0');
        expect(cells[0][3]).toHaveClass('data-table__cell--clickable');

        fireEvent.click(cells[0][3]);
        expect(clickHandler).toHaveBeenCalledWith(rows[0], expect.any(Object));

        const functionHandler = vi.fn();
        const { container: functionHandlerContainer } = render(
            <DataTable
                columns={[{ id: 'details', title: 'Детали', clickable: true }]}
                rows={[rows[0]]}
                selection={false}
                cellClickHandlers={functionHandler}
            />
        );
        fireEvent.click(functionHandlerContainer.querySelector('.data-table__cell--clickable'));
        expect(functionHandler).toHaveBeenCalledWith(rows[0], { id: 'details', title: 'Детали', clickable: true }, expect.any(Object));
    });

    it('показывает строки страницами и загружает следующую порцию по пересечению sentinel', () => {
        const manyRows = Array.from({ length: 5 }, (_, index) => ({
            id: index + 1,
            name: `Студент ${index + 1}`
        }));
        const { unmount } = render(
            <DataTable
                columns={[{ id: 'name', title: 'Имя' }]}
                rows={manyRows}
                selection={false}
                pageSize={2}
            />
        );

        expect(rowNames()).toEqual(['Студент 1', 'Студент 2']);
        expect(observerInstances[0].observe).toHaveBeenCalled();
        expect(observerInstances[0].options.rootMargin).toBe('200px');

        act(() => observerInstances.at(-1).callback([{ isIntersecting: false }]));
        expect(rowNames()).toHaveLength(2);

        act(() => observerInstances.at(-1).callback([{ isIntersecting: true }]));
        expect(rowNames()).toEqual(['Студент 1', 'Студент 2', 'Студент 3', 'Студент 4']);
        expect(observerInstances[0].disconnect).toHaveBeenCalled();

        act(() => observerInstances.at(-1).callback([{ isIntersecting: true }]));
        expect(rowNames()).toHaveLength(5);
        expect(document.querySelector('.data-table__sentinel')).not.toBeInTheDocument();

        unmount();
        expect(observerInstances.at(-1).disconnect).toHaveBeenCalled();
    });

    it('закрывает фильтр по повторному нажатию и по клику вне панели', () => {
        render(
            <DataTable
                columns={columns}
                rows={rows}
            />
        );
        const filterButton = headerFor('Категория').querySelector('.data-table__header-button');

        fireEvent.click(filterButton);
        expect(document.querySelector('.data-table__filter-popover')).toBeInTheDocument();
        fireEvent.mouseDown(document.querySelector('.data-table__filter-popover'));
        expect(document.querySelector('.data-table__filter-popover')).toBeInTheDocument();

        fireEvent.mouseDown(document.body);
        expect(document.querySelector('.data-table__filter-popover')).not.toBeInTheDocument();

        fireEvent.click(filterButton);
        fireEvent.click(filterButton);
        expect(document.querySelector('.data-table__filter-popover')).not.toBeInTheDocument();
    });

    it('выделяет строки, переданные через _selectedRows, и обновляет выделение при изменении props', () => {
        const { rerender } = render(
            <DataTable
                columns={columns}
                rows={rows}
                _selectedRows={[rows[1]]}
            />
        );

        const getSelectedRows = () =>
            Array.from(document.querySelectorAll('.data-table__row--selected'));

        expect(getSelectedRows()).toHaveLength(1);
        expect(getSelectedRows()[0]).toHaveTextContent('Студент 2');

        rerender(
            <DataTable
                columns={columns}
                rows={rows}
                _selectedRows={[rows[0], rows[2]]}
            />
        );

        expect(getSelectedRows()).toHaveLength(2);
        expect(getSelectedRows()[0]).toHaveTextContent('Студент 10');
        expect(getSelectedRows()[1]).toHaveTextContent('Альфа');
    });
});
