import { Empty as EmptyAnt } from 'antd';

/**
 * @description Компонент отображения пустого состояния.
 * @param {Object} props Параметры компонента.
 * @param {string} [props.type='default'] Вариант отображения: default, table, charts или books.
 * @param {string} [props.title='Нет данных'] Текст пустого состояния.
 */
export default function Empty({ type = 'default', title = 'Нет данных' }) {
    return (
        <div
            className={`EmptyView EmptyView-${type}`}
            style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', display: 'flex', color: '#64748b', flexDirection: 'column', gap: '10px' }}
        >
            <EmptyAnt description={title} tooltip={''}/>
        </div>
    );
}
