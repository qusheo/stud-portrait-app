import './Button.scss';
import Tooltip from './Tooltip';

const TYPES = {
    cancel: 'cancel',
    common: 'common',
    accept: 'accept'
};

function Button({ text, onClick, type, disabled = false, loading = false, tooltip = undefined}) {
    let style = {};
    style = loading ? { ...style, cursor: 'wait', filter: 'brightness(150%)' } : style;
    style = disabled ? { ...style, cursor: 'not-allowed', filter: 'brightness(150%)' } : style;
    const button = (
        <button
            className={`Button-${TYPES[type] ?? 'common'}`}
            onClick={() => (!disabled && !loading ? onClick() : '')}
            disabled={disabled}
            style={style}
        >
            {text}
        </button>
    );

    return tooltip && tooltip.trim() !== '' ? (
        <Tooltip text={tooltip}>
            {button}
        </Tooltip>
    ) : (
        button
    );
}

export default Button;
