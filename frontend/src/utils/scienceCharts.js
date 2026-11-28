/** @description Integer count scale with at most five intervals and no repeated labels. */
export function publicationScale(counts) {
    const peak = Math.max(1, ...counts);
    const step = Math.max(1, Math.ceil(peak / 5));
    const max = Math.ceil(peak / step) * step;
    return { min: 0, max, tickAmount: max / step, decimalsInFloat: 0 };
}
