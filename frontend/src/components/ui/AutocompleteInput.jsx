import { useState } from 'react';
import './Autocompleteinput.scss';

function AutocompleteInput({ options = [], value = '', onChange, placeholder = 'Введите значение...' }) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');

    const selectedOption = options.find(option => option.value === value);
    const displayValue = isOpen ? search : (selectedOption?.label ?? value ?? '');

    const filteredOptions = options.filter(option => String(option.label).toLowerCase().includes(String(search).toLowerCase()));

    const handleSelect = option => {
        onChange(option.value);
        setSearch(option.label);
        setIsOpen(false);
    };

    return (
        <div className="autocomplete">
            <input
                type="text"
                value={displayValue}
                placeholder={placeholder}
                onChange={event => {
                    setSearch(event.target.value);
                    onChange(event.target.value);
                    setIsOpen(true);
                }}
                onFocus={() => {
                    setSearch(selectedOption?.label ?? String(value ?? ''));
                    setIsOpen(true);
                }}
                onBlur={() => setIsOpen(false)}
            />

            {isOpen && filteredOptions.length > 0 && (
                <div className="autocomplete__options">
                    {filteredOptions.map(option => (
                        <div
                            key={option.value}
                            className="autocomplete__option"
                            onMouseDown={event => event.preventDefault()}
                            onClick={() => handleSelect(option)}
                        >
                            {option.label}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default AutocompleteInput;
