import { useState } from 'react';
import './Tooltip.scss';

/**
 * @description Всплывающая подсказка для содержимого.
 * @param {Object} props Параметры компонента.
 * @param {*} props.children Содержимое, при наведении на которое показывается подсказка.
 * @param {string} props.text Текст подсказки.
 * @param {string} [props.placement='top'] Расположение подсказки.
 */
export default function Tooltip({ children, text, placement = 'top' }) {
    const [show, setShow] = useState(false);

    return (
        <div
            className="Tooltip"
            onMouseEnter={() => setShow(true)}
            onMouseLeave={() => setShow(false)}
        >
            {children}

            {show && <div className={`tooltip tooltip-${placement}`}>{text}</div>}
        </div>
    );
}
