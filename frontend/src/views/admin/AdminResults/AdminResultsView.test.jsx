import { describe, expect, it } from 'vitest';

import { COMPETENCIES_NAMES } from '@utils/utilities.js';
import { expandFilters } from './AdminResultsView.jsx';

describe('Фильтры результатов', () => {
    it('применяет общий диапазон ко всем выбранным компетенциям', () => {
        const fields = Object.keys(COMPETENCIES_NAMES);
        const expanded = expandFilters([{ id: 1, type: 'numeric', fields, min: 400, max: 800 }]);

        expect(expanded).toHaveLength(fields.length);
        expect(expanded.map(filter => filter.field)).toEqual(fields);
        expect(expanded.every(filter => filter.min === 400 && filter.max === 800)).toBe(true);
    });

    it('сохраняет множественный выбор значений базового фильтра', () => {
        const filter = {
            id: 2,
            type: 'basic',
            field: 'institution',
            selectedValues: ['Вуз 1', 'Вуз 2']
        };

        expect(expandFilters([filter])).toEqual([filter]);
    });

    it('поддерживает сохранённые фильтры с одним показателем', () => {
        const expanded = expandFilters([{ id: 3, type: 'numeric', field: 'res_comp_leadership', min: 600, max: 800 }]);

        expect(expanded).toEqual([
            {
                id: '3_res_comp_leadership',
                type: 'numeric',
                field: 'res_comp_leadership',
                min: 600,
                max: 800
            }
        ]);
    });
});
