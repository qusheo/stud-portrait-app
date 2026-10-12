import { MOTIVATORS_NAMES, COMPETENCIES_NAMES, VALUES_NAMES } from '@utils/utilities';
import Button from '@ui/Button';
import { useState } from 'react';

import './SearchPanel.scss';

const LEVEL_OPTIONS = [
    { value: '', label: 'Не выбрано' },
    { value: 'low', label: 'Низкий' },
    { value: 'medium', label: 'Средний' },
    { value: 'high', label: 'Высокий' }
];

function SearchPanel({ onApply }) {
    const searchItems = [
        {
            key: 'competencies',
            name: 'Компетенции',
            items: Object.keys(COMPETENCIES_NAMES).map(key => ({
                value: key,
                label: COMPETENCIES_NAMES[key]
            }))
        },
        {
            key: 'motivators',
            name: 'Мотиваторы',
            items: Object.keys(MOTIVATORS_NAMES).map(key => ({
                value: key,
                label: MOTIVATORS_NAMES[key]
            }))
        },
        {
            key: 'values',
            name: 'Ценности',
            items: Object.keys(VALUES_NAMES).map(key => ({
                value: key,
                label: VALUES_NAMES[key]
            }))
        },
        {
            key: 'sphere',
            name: 'Сфера',
            items: []
        }
    ];

    const [checked, setChecked] = useState(() => Object.fromEntries(searchItems.map(item => [item.key, false])));

    const [values, setValues] = useState(() =>
        Object.fromEntries(searchItems.map(item => [item.key, Object.fromEntries(item.items.map(option => [option.value, null]))]))
    );

    function toggleItem(key) {
        setChecked(prev => ({
            ...prev,
            [key]: !prev[key]
        }));
    }

    function onChangeItems(groupKey, itemKey, value) {
        setValues(prev => ({
            ...prev,
            [groupKey]: {
                ...prev[groupKey],
                [itemKey]: value || null
            }
        }));
    }

    function handleApply() {
        const result = Object.fromEntries(
            searchItems.map(item => [
                item.key,
                {
                    enabled: checked[item.key],
                    values: values[item.key]
                }
            ])
        );

        onApply?.(result);
    }

    return (
        <div className="searchPanel">
            <div className="searchPanel__content">
                {searchItems.map(item => (
                    <div
                        className={`searchItem ${checked[item.key] ? 'searchItem--active' : ''}`}
                        key={item.key}
                    >
                        <div className="searchItem__main">
                            <label className="searchItem__checkbox">
                                <input
                                    type="checkbox"
                                    checked={checked[item.key]}
                                    onChange={() => toggleItem(item.key)}
                                />

                                <span className="searchItem__checkmark" />

                                <span className="searchItem__title">{item.name}</span>
                            </label>
                        </div>

                        {checked[item.key] && (
                            <div className="searchItem__options">
                                {item.items.length > 0 ? (
                                    item.items.map(option => (
                                        <div
                                            className="itemOption"
                                            key={option.value}
                                        >
                                            <span
                                                className="itemOption__label"
                                                title={option.label}
                                            >
                                                {option.label}
                                            </span>

                                            <select
                                                className="itemOption__select"
                                                value={values[item.key][option.value] ?? ''}
                                                onChange={event => onChangeItems(item.key, option.value, event.target.value)}
                                            >
                                                {LEVEL_OPTIONS.map(level => (
                                                    <option
                                                        key={level.value}
                                                        value={level.value}
                                                    >
                                                        {level.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    ))
                                ) : (
                                    <span className="searchItem__empty">Нет доступных параметров</span>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <div className="searchPanel__bottom">
                <Button
                    text="Применить"
                    type="accept"
                    onClick={handleApply}
                />
            </div>
        </div>
    );
}

export default SearchPanel;
