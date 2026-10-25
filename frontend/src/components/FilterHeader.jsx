import { useEffect, useRef, useState } from 'react';
import { AdminService } from '../services';
import { defaultQueryOptions } from '@utils/queryConfig';
import { useQuery } from '@tanstack/react-query';
import Select from 'react-select';
import './FilterHeader.scss';
import Button from '@ui/Button';

export default function FilterHeader({ filters, onFilterChange, onResetFilters, showYearsSelect = true }) {
    const noFilters = () => {
        if (!filters) return true;

        return Object.values(filters).every(value => !value || value === '');
    };

    const institute = filters?.institute || '';

    const { data: baseOptions = { institutes: [], specialties: [], years: [] }, isPending: loadingBase } = useQuery({
        queryKey: ['admin', 'filter-options'],
        queryFn: async () => (await AdminService.getFilterOptions()).data,
        ...defaultQueryOptions
    });

    const { data: instituteOptions, isPending: loadingSpecialties } = useQuery({
        queryKey: ['admin', 'filter-options', 'specialties', institute],
        queryFn: async () => (await AdminService.getFilterOptions(institute)).data,
        ...defaultQueryOptions,
        enabled: Boolean(institute)
    });

    const options = {
        ...baseOptions,
        specialties: institute ? (instituteOptions?.specialties ?? []) : baseOptions.specialties
    };

    const loading = loadingBase || (Boolean(institute) && loadingSpecialties);

    useEffect(() => {
        if (loading || !filters?.specialty) return;

        if (!options.specialties.some(s => s.value === filters.specialty)) {
            onFilterChange('specialty', '');
        }
    }, [loading, options.specialties, filters?.specialty, onFilterChange]);

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
                value={findOption(options?.institutes, filters?.institute) ?? null}
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
                value={findOption(options?.specialties, filters?.specialty) ?? null}
                onChange={opt => handleChange(opt, 'specialty')}
                styles={customStyles}
                isLoading={loading}
                loadingMessage={() => 'Загрузка...'}
            />
            {showYearsSelect && (
                <Select
                    name="year"
                    placeholder="Год..."
                    isClearable
                    isSearchable
                    options={sorted(options?.years) || []}
                    value={findOption(options?.years, filters?.year) ?? null}
                    onChange={opt => handleChange(opt, 'year')}
                    styles={customStyles}
                    isLoading={loading}
                    loadingMessage={() => 'Загрузка...'}
                />
            )}

            <Button
                text={'Сбросить'}
                onClick={onResetFilters}
                disabled={noFilters()}
            />
        </div>
    );
}
