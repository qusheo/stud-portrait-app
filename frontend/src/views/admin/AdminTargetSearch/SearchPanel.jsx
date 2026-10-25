import { MOTIVATORS_NAMES, COMPETENCIES_NAMES, VALUES_NAMES } from '@utils/utilities';
import Button from '@ui/Button';
import { useEffect, useState } from 'react';
import { defaultQueryOptions } from '@utils/queryConfig';
import { useQuery } from '@tanstack/react-query';
import { Select } from 'antd';
import './SearchPanel.scss';
import { AdminService } from '@services';
import { TabButton } from '../../../components';

const COMPETENCY_LEVEL_OPTIONS = [
    { value: '', label: 'Не выбрано' },
    { value: 'basic', label: 'Базовый' },
    { value: 'medium', label: 'Средний' },
    { value: 'high', label: 'Высокий' }
];

const VALUE_LEVEL_OPTIONS = [
    { value: '', label: 'Не выбрано' },
    { value: 'basic', label: 'Слабовыраженный' },
    { value: 'medium', label: 'Средний' },
    { value: 'high', label: 'Высокий' }
];

const MOTIVATOR_STATE_OPTIONS = [
    { value: '', label: 'Не выбрано' },
    { value: 'demotivator', label: 'Демотиватор' },
    { value: 'not_manifested', label: 'Не проявленный' },
    { value: 'motivator', label: 'Мотиватор' }
];

function SearchPanel({ onApply, loading }) {
    const [institute, setInstitute ] = useState(null);
    const [specialties, setSpecialties] = useState(null);
    const [projectSearchEnabled, setProjectSearchEnabled] = useState(false);

    const { data: baseOptions, isLoading: loadingInstitutes } = useQuery({
		queryKey: ['admin', 'filter-options'],
		queryFn: async () => (await AdminService.getFilterOptions()).data,
		enabled: true,
		...defaultQueryOptions
	});
	const instituteOptions = () => baseOptions?.institutes ?? [];

	const { data: specialtyOptions, isLoading: loadingSpecialties } = useQuery({
		queryKey: ['admin', 'search-options-uni', 'specialties', institute],
		queryFn: async () => (await AdminService.getFilterOptions(institute)).data,
		...defaultQueryOptions,
		enabled: Boolean(institute)
	});

    useEffect(() =>{
        setSpecialties(specialtyOptions?.specialties || []);
    }, [specialtyOptions])
    
    const { data: filterOptions, isLoading: loadingOptions } = useQuery({
        queryKey: ['admin', 'student-search'],
        queryFn: async () => (await AdminService.getStudentSearchOptions()).data,
        ...defaultQueryOptions,
        enabled: true
    });
    const searchItems = () => [
        {
            key: 'competencies',
            name: 'Компетенции',
            options: COMPETENCY_LEVEL_OPTIONS,
            items: Object.keys(COMPETENCIES_NAMES).map(key => ({
                value: key,
                label: COMPETENCIES_NAMES[key]
            }))
        },
        {
            key: 'motivators',
            name: 'Мотиваторы',
            options: MOTIVATOR_STATE_OPTIONS,
            items: Object.keys(MOTIVATORS_NAMES).map(key => ({
                value: key,
                label: MOTIVATORS_NAMES[key]
            }))
        },
        {
            key: 'values',
            name: 'Ценности',
            options: VALUE_LEVEL_OPTIONS,
            items: Object.keys(VALUES_NAMES).map(key => ({
                value: key,
                label: VALUES_NAMES[key]
            }))
        },
        {
            key: 'sphere',
            name: 'Сфера',
            items: [
                {
                    value: 'interests',
                    label: 'Интересы',
                    type: 'multiple',
                    options: filterOptions?.interests || []
                },
                {
                    value: 'specialty',
                    label: 'Специальность',
                    type: 'multiple',
                    options: specialties || []
                }
            ]
        },
        {
            key: 'extra',
            name: 'Дополнительно',
            items: [
                {
                    value: 'course',
                    label: 'Курс',
                    type: 'multiple',
                    options: [1, 2, 3, 4].map(c => ({value: c, label: c.toString()})),
                }
            ]
        },
    ];
    const [checked, setChecked] = useState(() => Object.fromEntries(searchItems().map(item => [item.key, false])));
	
    const disabled = () => Object.values(checked).every(item => item === false);
    const [values, setValues] = useState(() =>
        Object.fromEntries(
            searchItems().map(item => [
                item.key,
                Object.fromEntries(
                    item.items.map(option => [
                        option.value,
                        option.type === 'multiple' ? [] : null
                    ])
                )
            ])
        )
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
                [itemKey]: value
            }
        }));
    }

    function handleApply() {
        const result = Object.fromEntries(
            searchItems().map(item => [
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
                <div className='input_institute'>
                    <span className='input_institute_label'>ВУЗ</span>
                    <Select 
						showSearch
                        placeholder="Выберите Вуз"
                        className="itemOption__select"
                        value={institute ?? ''}
                        onChange={value => { 
									setInstitute(value); 
									setValues(prev => ({
										...prev,
										sphere: {
											...prev.sphere,
											specialty: []
										}}));
								}}
                        notFoundContent="Ничего не найдено"
                        getPopupContainer={trigger => trigger.parentElement}
                        options={instituteOptions()}
                        status={!institute ? "error" : undefined}
                        prefix={!institute ? "*" : undefined}
                    />
                </div>
                {searchItems().map(item => (
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
                                    disabled={!institute}
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

                                            {option.type === 'multiple' ? (
                                                <Select
                                                    mode="multiple"
                                                    allowClear
                                                    showSearch
                                                    maxTagCount={4}
                                                    placeholder="Выберите значения..."
                                                    className="itemOption__select"
                                                    value={values[item.key][option.value] || []}
                                                    options={option.options}
                                                    filterOptions='label'
                                                    loading={option.value === 'specialty' ? loadingSpecialties : loadingOptions}
                                                    onChange={selected => onChangeItems(item.key, option.value, selected)}
                                                    notFoundContent="Ничего не найдено"
                                                    getPopupContainer={trigger => trigger.parentElement}
                                                />
                                            ) : (
                                                <Select
                                                    allowClear
                                                    placeholder="Не выбрано"
                                                    className="itemOption__select"
                                                    value={values[item.key][option.value] ?? ''}
                                                    onChange={value => onChangeItems(item.key, option.value, value || null)}
                                                    notFoundContent="Ничего не найдено"
                                                    getPopupContainer={trigger => trigger.parentElement}
                                                    options={item.options}
                                                />
                                            )}
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
					loading={loading}
					disabled={disabled()}
					tooltip={disabled() ? 'Выберите параметры' : undefined}
                />
            </div>
        </div>
    );
}

export default SearchPanel;
