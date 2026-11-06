import './FlexRow.scss';

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
 * @description Flex-контейнер для горизонтального размещения содержимого.
 * @param {Object} props Параметры компонента.
 * @param {string} props.className Дополнительный CSS-класс.
 * @param {*} props.children Содержимое контейнера.
 * @param {string|number} [props.gap='5'] Отступ между элементами в пикселях.
 * @param {string} [props.margin='0'] Внешние отступы в пикселях.
 * @param {boolean} [props.reverse=false] Меняет направление элементов.
 * @param {string} [props.wrap] Режим переноса элементов.
 * @param {string} [props.justify] Выравнивание по основной оси.
 * @param {string} [props.align] Выравнивание по поперечной оси.
 * @param {string} [props.content] Выравнивание строк контейнера.
 */
function FlexRow({
    className,
    children,
    gap = '5',
    margin = '0',
    reverse = false,
    wrap = WRAP.NO,
    justify = JUSTIFY.START,
    align = ALIGN.STRETCH,
    content = CONTENT.STRETCH
}) {
    return (
        <div
            className={`FlexRow ${className}`}
            style={{
                '--gap': `${gap}px`,
                '--margin': margin
                    .split(' ')
                    .map(value => value + 'px')
                    .join(' '),
                '--direction': reverse ? 'row-reverse' : 'row',
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

export default FlexRow;
