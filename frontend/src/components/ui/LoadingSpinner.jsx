import './LoadingSpinner.scss';

/**
 * @description Спиннер загрузки с необязательной подписью.
 * @param {Object} props Параметры компонента.
 * @param {boolean} [props.loading=true] Управляет отображением спиннера.
 * @param {string} [props.text] Текст под спиннером.
 */
function LoadingSpinner({ loading = true, text }) {
    if (!loading) {
        return <></>;
    }

    return (
        <div className="LoadingSpinner">
            <div className="spinner" />
            <div className="text">{text}</div>
        </div>
    );
}

export default LoadingSpinner;
