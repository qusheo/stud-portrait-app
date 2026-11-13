import './Card.scss';

/**
 * @description Базовый контейнер-карточка
 * @param {Object} props Параметры компонента
 * @param {*} props.children Содержимое карточки
 */
function Card({ children }) {
    return <div className="Card">{children}</div>;
}

export default Card;
