import './Button.scss';

const TYPES = {
    cancel: 'cancel',
    common: 'common',
    accept: 'accept'
};

function Button({ text, onClick, type, disabled = false, loading = false }) {
    let style = {};
    style = loading ? { ...style, cursor: 'wait', filter: 'brightness(150%)' } : style;
    style = disabled ? { ...style, cursor: 'not-allowed', filter: 'brightness(150%)' } : style;
    return (
        <button
            className={`Button-${TYPES[type] ?? 'common'}`}
            onClick={() => (!disabled && !loading ? onClick() : '')}
            disabled={disabled}
            style={style}
        >
            {text}
        </button>
    );
}

export default Button;
