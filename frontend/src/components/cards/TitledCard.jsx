import Card from './Card';

import './TitledCard.scss';

/**
 * @description Карточка с заголовком.
 * @param {Object} props Параметры компонента.
 * @param {*} props.children Содержимое карточки.
 * @param {string} props.title Заголовок карточки.
 */
function TitledCard({ children, title }) {
    return (
        <Card>
            <div className="title">{title}</div>
            {children}
        </Card>
    );
}

export default TitledCard;
