import './Button.scss';
import Tooltip from './Tooltip';

const TYPES = {
    cancel: 'cancel',
    common: 'common',
    accept: 'accept'
};

/**
 * @description Кнопка с состояниями отключения и загрузки.
 * @param {Object} props Параметры компонента.
 * @param {string} props.text Текст кнопки.
 * @param {Function} props.onClick Обработчик нажатия.
 * @param {string} [props.type] Вариант оформления.
 * @param {boolean} [props.disabled=false] Отключает нажатие.
 * @param {boolean} [props.loading=false] Показывает лоадер и блокирует нажатие.
 * @param {string} [props.tooltip] Текст всплывающей подсказки.
 */
function Button({ text, onClick, type, disabled = false, loading = false, tooltip = undefined }) {
    let style = {};
    style = disabled ? { ...style, cursor: 'not-allowed', filter: 'grayscale(70%)' } : style;
    style = loading ? { ...style, cursor: 'wait', filter: 'brightness(120%) grayscale(40%)' } : style;
    const button = (
        <button
            className={`Button-${type ?? 'common'}`}
            onClick={() => (!disabled && !loading ? onClick() : '')}
            disabled={disabled || loading}
            aria-busy={loading}
            style={style}
        >
            {loading ? (
                <span className="Button__content">
                    <span
                        className="Button__loader"
                        aria-hidden="true"
                    />
                    {text}
                </span>
            ) : (
                text
            )}
        </button>
    );

    return tooltip && tooltip.trim() !== '' ? <Tooltip text={tooltip}>{button}</Tooltip> : button;
}

export default Button;
