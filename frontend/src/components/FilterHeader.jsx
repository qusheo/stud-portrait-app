import { useEffect, useRef, useState } from 'react';
import { AdminService } from '../services';
import Select from 'react-select';
import './FilterHeader.scss';
import TabButton from '@ui/TabButton';
import Button from '@ui/Button';

export default function FilterHeader({ filters, onFilterChange, onResetFilters }) {
    const [options, setOptions] = useState({ institutes: [], specialties: [], years: [] });
    const [loading, setLoading] = useState(true);
    const reqRef = useRef(0);

    const noFilters = () => {
        if (!filters) return true;

        for (var key in filters) {
            if (!filters[key] || filters[key] === '') return true;
        }
        return false;
    };
    //загрузка вариантов
    useEffect(() => {
        AdminService.getFilterOptions()
            .then(data => setOptions(data.data))
            .catch(err => console.error('Ошибка загрузки опций', err))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        const institute = filters?.institute;
        if (!institute) {
            AdminService.getFilterOptions()
                .then(data => setOptions(data.data))
                .catch(err => console.error('Ошибка загрузки опций', err))
                .finally(() => setLoading(false));
            return;
        }
        const id = ++reqRef.current;
        AdminService.getFilterOptions(institute)
            .then(data => {
                if (id !== reqRef.current) return;
                const newSpecs = data.data.specialties || [];
                if (filters?.specialty && !newSpecs.some(s => s.value === filters.specialty)) {
                    onFilterChange('specialty', '');
                }
                setOptions(prev => ({ ...prev, specialties: newSpecs }));
            })
            .catch(err => console.error('Ошибка загрузки опций', err))
            .finally(() => {
                if (id === reqRef.current) setLoading(false);
            });
    }, [filters?.institute]);

    const handleChange = (opt, name) => {
        onFilterChange(name, opt ? opt.value : '');
    };
    const customStyles = {
        container: base => ({ ...base, flex: 1, minWidth: '200px' }),
        control: base => ({ ...base, borderRadius: '8px', borderColor: '#ddd' })
    };
    const findOption = (opts, value) => {
        if (!value) return null;
        return opts?.find(o => o.value === value) || null;
    };
    const sorted = opts =>
        (opts || []).slice().sort((a, b) => a.label.localeCompare(b.label, 'ru', { numeric: true, sensitivity: 'base' }));

    return (
        <div className="filter-row">
            <Select
                name="institute"
                placeholder="Институт..."
                isClearable
                isSearchable
                options={sorted(options?.institutes) || []}
                value={findOption(options?.institutes, filters?.institute) ?? ''}
                onChange={opt => handleChange(opt, 'institute')}
                styles={customStyles}
                isLoading={loading}
                loadingMessage={() => 'Загрузка...'}
            />

            <Select
                name="specialty"
                placeholder="Направление..."
                isClearable
                isSearchable
                options={sorted(options?.specialties) || []}
                value={findOption(options?.specialties, filters?.specialty) ?? ''}
                onChange={opt => handleChange(opt, 'specialty')}
                styles={customStyles}
                isLoading={loading}
                loadingMessage={() => 'Загрузка...'}
            />

            <Select
                name="year"
                placeholder="Год..."
                isClearable
                isSearchable
                options={sorted(options?.years) || []}
                value={findOption(options?.years, filters?.year) ?? ''}
                onChange={opt => handleChange(opt, 'year')}
                styles={customStyles}
                isLoading={loading}
                loadingMessage={() => 'Загрузка...'}
            />

            <Button
                text={'Сбросить'}
                onClick={onResetFilters}
                disabled={noFilters()}
            />
        </div>
    );
}
