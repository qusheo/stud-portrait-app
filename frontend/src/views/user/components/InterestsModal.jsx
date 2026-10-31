import { useEffect, useMemo, useState } from 'react';
import { Checkbox, Input, Modal, Spin } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import StudentService from '@services/StudentService';
import {
    INTEREST_CATEGORIES,
    INTEREST_CATEGORY_NAMES,
    INTEREST_NAMES,
} from '@utils/studentInterests';

import './InterestsModal.scss';

export default function StudentInterestsModal({ open, studentId, onClose }) {
    const queryClient = useQueryClient();
    const [selected, setSelected] = useState([]);
    const [search, setSearch] = useState('');

    const queryKey = ['student', 'interests', studentId];

    const { data, isLoading, isFetching } = useQuery({
        queryKey,
        queryFn: async () => (
            await StudentService.getStudentInterests(studentId)
        ).data,
        enabled: open && studentId != null,
        staleTime: 60_000,
    });

    const saved = data?.interests ?? [];

    useEffect(() => {
        if (!open) {
            setSearch('');
            return;
        }

        if (data) {
            setSelected(data.interests ?? []);
        }
    }, [open, data]);

    const mutation = useMutation({
        mutationFn: changes => StudentService.updateStudentInterests(studentId, changes),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey });
            onClose();
        },
    });

    const selectedSet = useMemo(() => new Set(selected), [selected]);

    const visibleCategories = useMemo(() => {
        const value = search.trim().toLowerCase();

        return Object.entries(INTEREST_CATEGORIES)
            .map(([category, interests]) => {
                const categoryMatches = INTEREST_CATEGORY_NAMES[category]
                    .toLowerCase()
                    .includes(value);

                return {
                    category,
                    interests: interests.filter(code =>
                        !value ||
                        categoryMatches ||
                        INTEREST_NAMES[code].toLowerCase().includes(value)
                    ),
                };
            })
            .filter(item => item.interests.length);
    }, [search]);

    const toggleInterest = (code, checked) => {
        setSelected(current => checked
            ? [...new Set([...current, code])]
            : current.filter(item => item !== code)
        );
    };

    const getChanges = () => {
        const previous = new Set(saved);
        const current = new Set(selected);

        return Object.fromEntries(
            [...new Set([...previous, ...current])]
                .filter(code => previous.has(code) !== current.has(code))
                .map(code => [code, current.has(code)])
        );
    };

    const handleSave = () => {
        const changes = getChanges();

        if (Object.keys(changes).length === 0) {
            onClose();
            return;
        }

        mutation.mutate(changes);
    };

    return (
        <Modal
            title="Мои интересы"
            open={open}
            onCancel={onClose}
            onOk={handleSave}
            okText="Сохранить"
            cancelText="Отмена"
            okButtonProps={{ loading: mutation.isPending, disabled: isLoading || !data }}
            cancelButtonProps={{ disabled: mutation.isPending }}
            closable={!mutation.isPending}
            maskClosable={!mutation.isPending}
            width={650}
            destroyOnHidden
        >
            <div className="student-interests">
                <p className="student-interests__description">
                    Выберите интересующие вас направления для подбора проектов.
                </p>

                <Input.Search
                    placeholder="Поиск интересов"
                    value={search}
                    onChange={event => setSearch(event.target.value)}
                    allowClear
                />

                <div className="student-interests__counter">
                    Выбрано: {selected.length}
                </div>

                <Spin spinning={isLoading || isFetching}>
                    <div className="student-interests__list">
                        {visibleCategories.map(({ category, interests }) => (
                            <div className="student-interests__category" key={category}>
                                <h4>{INTEREST_CATEGORY_NAMES[category]}</h4>

                                <div className="student-interests__options">
                                    {interests.map(code => (
                                        <Checkbox
                                            key={code}
                                            checked={selectedSet.has(code)}
                                            onChange={event =>
                                                toggleInterest(code, event.target.checked)
                                            }
                                        >
                                            {INTEREST_NAMES[code]}
                                        </Checkbox>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </Spin>
            </div>
        </Modal>
    );
}
