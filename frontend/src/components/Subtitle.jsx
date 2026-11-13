import './Subtitle.scss';

/**
 * @description Подзаголовок раздела.
 * @param {Object} props Параметры компонента.
 * @param {string} props.text Текст подзаголовка.
 */
function Subtitle({ text }) {
    return <div className="Subtitle">{text}</div>;
}

export default Subtitle;
