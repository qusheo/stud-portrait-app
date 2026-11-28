import { describe, it, expect } from 'vitest';
import { publicationScale } from '../../src/utils/scienceCharts';

describe('publication axes', () => {
    it('produces distinct integer ticks for small and large counts', () => {
        for (const peak of [0, 1, 2, 7, 10, 23, 1786]) {
            const scale = publicationScale([peak]);
            const step = scale.max / scale.tickAmount;
            expect(Number.isInteger(step)).toBe(true);
            expect(step).toBeGreaterThan(0);
            expect(scale.max).toBeGreaterThanOrEqual(peak);
        }
    });
});
