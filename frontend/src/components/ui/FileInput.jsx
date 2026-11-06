import { unpackPaletteOptionsActivable } from './palette';

import './FileInput.scss';

/**
 * @description Поле выбора файла.
 * @param {Object} props Параметры компонента.
 * @param {string} props.id Идентификатор поля.
 * @param {string} props.accept Допустимые типы файлов.
 * @param {Function} props.onChange Обработчик выбора файлов.
 * @param {Object} props.palette Цветовая палитра поля.
 * @param {boolean} [props.disabled=false] Отключает выбор файла.
 */
function FileInput({ id, accept, onChange, palette, disabled = false }) {
    return (
        <input
            className="FileInput"
            id={id}
            type="file"
            accept={accept}
            onChange={e => onChange?.(e.target.files)}
            disabled={disabled}
            style={unpackPaletteOptionsActivable(palette)}
        />
    );
}

export default FileInput;
