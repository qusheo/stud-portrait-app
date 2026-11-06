import Card from './Card';

import './ValueCard.scss';

/**
 * @description Карточка отображения числового или текстового показателя.
 * @param {Object} props Параметры компонента.
 * @param {*} props.value Значение показателя.
 * @param {string} props.text Подпись показателя.
 */
function ValueCard({ value, text }) {
    return (
        <Card>
            <div className="value">{value}</div>
            <div className="text">{text}</div>
        </Card>
    );
}

export default ValueCard;
