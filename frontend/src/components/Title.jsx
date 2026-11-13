import './Title.scss';

/**
 * @description Основной заголовок страницы.
 * @param {Object} props Параметры компонента.
 * @param {string} props.title Текст заголовка.
 */
function Title({ title }) {
    return (
        <div className="Title">
            <h1>{title}</h1>
        </div>
    );
}

export default Title;
