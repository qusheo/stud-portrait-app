import { ADMIN_PALETTE, unpackPaletteOptions } from './palette';

import './NumberField.scss';

/**
 * @description Поле ввода числового значения.
 * @param {Object} props Параметры компонента.
 * @param {number} props.value Текущее значение.
 * @param {number} props.min Минимальное значение.
 * @param {number} props.max Максимальное значение.
 * @param {Function} props.onChange Обработчик изменения значения.
 * @param {Object} [props.palette] Цветовая палитра поля.
 */
function NumberField({ value, min, max, onChange, palette = ADMIN_PALETTE.GRAY }) {
    return (
        <input
            className="NumberField"
            type="number"
            value={value}
            min={min}
            max={max}
            onChange={e => onChange?.(parseInt(e.target.value))}
            style={unpackPaletteOptions(palette)}
        />
    );
}

export default NumberField;
