import './FlexColumn.scss';

export const WRAP = {
    NO: 'nowrap',
    DO: 'wrap'
};

export const JUSTIFY = {
    START: 'flex-start',
    END: 'flex-end',
    CENTER: 'center',
    SPACE_BETWEEN: 'space-between'
};

export const ALIGN = {
    START: 'flex-start',
    END: 'flex-end',
    CENTER: 'center',
    STRETCH: 'stretch'
};

export const CONTENT = {
    START: 'flex-start',
    END: 'flex-end',
    CENTER: 'center',
    STRETCH: 'stretch'
};

/**
 * @description Flex-контейнер для вертикального размещения содержимого.
 * @param {Object} props Параметры компонента.
 * @param {string} props.className Дополнительный CSS-класс.
 * @param {*} props.children Содержимое контейнера.
 * @param {boolean} [props.reverse=false] Меняет направление элементов.
 * @param {string} [props.wrap] Режим переноса элементов.
 * @param {string} [props.justify] Выравнивание по основной оси.
 * @param {string} [props.align] Выравнивание по поперечной оси.
 * @param {string} [props.content] Выравнивание строк контейнера.
 */
function FlexColumn({
    className,
    children,
    reverse = false,
    wrap = WRAP.NO,
    justify = JUSTIFY.START,
    align = ALIGN.STRETCH,
    content = CONTENT.STRETCH
}) {
    return (
        <div
            className={`FlexColumn ${className}`}
            style={{
                '--direction': reverse ? 'column-reverse' : 'column',
                '--wrap': wrap,
                '--justify': justify,
                '--align': align,
                '--content': content
            }}
        >
            {children}
        </div>
    );
}

export default FlexColumn;
