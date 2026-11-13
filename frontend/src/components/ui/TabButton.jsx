import './TabButton.scss';

/**
 * @description Кнопка переключения вкладки.
 * @param {Object} props Параметры компонента.
 * @param {string} props.text Текст вкладки.
 * @param {Function} props.onClick Обработчик выбора вкладки.
 * @param {boolean} [props.isActive=false] Признак активной вкладки.
 */
export default function TabButton({ text, onClick, isActive = false }) {
    return (
        <button
            onClick={onClick}
            className={isActive ? 'active' : 'not-active'}
        >
            {text}
        </button>
    );
}
