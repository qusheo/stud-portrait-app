import React, { createContext, useContext, useState } from 'react';

import Dropdown, { DropdownContext } from './Dropdown';
import { ADMIN_PALETTE } from './palette';

import './Select.scss';

const SelectContext = createContext({
    selectedValue: undefined,
    valueSetter: undefined,
    labelSetter: undefined,
    onChangeCallback: undefined
});

/**
 * @description Выпадающий список одиночного выбора.
 * @param {Object} props Параметры компонента.
 * @param {*} props.children Элементы Option и OptionGroup.
 * @param {*} [props.initValue] Начальное значение.
 * @param {Function} props.onChange Обработчик изменения значения.
 * @param {string} [props.placeholder='Выберите...'] Текст до выбора значения.
 * @param {Object} [props.palette] Цветовая палитра списка.
 * @param {boolean} [props.disabled=false] Отключает список.
 */
function Select({ children, initValue, onChange, placeholder = 'Выберите...', palette = ADMIN_PALETTE.GRAY, disabled = false }) {
    const arr = React.Children.toArray(children);

    const [value, setValue] = useState(initValue);
    const [label, setLabel] = useState(
        [
            ...arr.filter(child => child.type === Option),
            ...arr
                .filter(child => child.type === OptionGroup)
                .reduce(
                    (acc, group) => [...acc, ...React.Children.toArray(group.props.children).filter(child => child.type === Option)],
                    []
                )
        ].find(child => child.props.value === initValue)?.props?.label
    );

    return (
        <Dropdown
            label={label ?? placeholder}
            palette={palette}
            disabled={disabled}
        >
            <SelectContext.Provider
                value={{
                    selectedValue: value,
                    valueSetter: setValue,
                    labelSetter: setLabel,
                    onChangeCallback: onChange
                }}
            >
                {arr.filter(child => child.type === Option)}
                {arr.filter(child => child.type === OptionGroup)}
            </SelectContext.Provider>
        </Dropdown>
    );
}

/**
 * @description Элемент выпадающего списка Select.
 * @param {Object} props Параметры компонента.
 * @param {*} props.value Значение варианта.
 * @param {string} props.label Отображаемая подпись.
 * @param {Function} [props.onClick] Дополнительный обработчик выбора.
 */
export function Option({ value, label, onClick }) {
    const { selectedValue, valueSetter, labelSetter, onChangeCallback } = useContext(SelectContext);
    const { setOpen } = useContext(DropdownContext);
    return (
        <div
            className={`Option ${selectedValue === value ? 'selected' : ''}`}
            onClick={() => {
                onClick?.(value);
                valueSetter?.(value);
                labelSetter?.(label);
                onChangeCallback?.(value);
                setOpen(false);
            }}
        >
            {label}
        </div>
    );
}

/**
 * @description Группа элементов выпадающего списка Select.
 * @param {Object} props Параметры компонента.
 * @param {*} props.children Элементы Option.
 * @param {string} props.label Название группы.
 */
export function OptionGroup({ children, label }) {
    const arr = React.Children.toArray(children);
    return (
        <div className="OptionGroup">
            <span className="group-label">{label}</span>
            {arr.filter(child => child.type === Option)}
        </div>
    );
}

export default Select;
