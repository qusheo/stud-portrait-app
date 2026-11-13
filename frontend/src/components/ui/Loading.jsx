import LoadingSpinner from './LoadingSpinner.jsx';
import tableLoadingIcon from '../icons/table-loading.svg';
import chartLoadingIcon from '../icons/chart-loading.svg';

/**
 * @description Компонент отображения состояния загрузки.
 * @param {Object} props Параметры компонента.
 * @param {string} [props.type='default'] Вариант лоадера: default, table или charts.
 * @param {boolean} [props.loading=true] Управляет отображением лоадера.
 * @param {string} [props.title=''] Подпись состояния загрузки.
 */
export default function Loading({ type = 'default', loading = true, title = '' }) {
    const icons = {
        table: tableLoadingIcon,
        charts: chartLoadingIcon
    };

    if (!loading) return null;

    return (
        <div
            className="EmptyView"
            role="status"
            style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', display: 'flex', flexDirection: 'column' }}
        >
            {type === 'default' ? (
                <LoadingSpinner />
            ) : (
                <img
                    src={icons[type]}
                    alt=""
                    style={{ width: '100%', maxWidth: 600, height: 'auto' }}
                />
            )}
            {title && <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '1rem', fontWeight: '550', marginTop: '-10px' }}>{title}</p>}
        </div>
    );
}
