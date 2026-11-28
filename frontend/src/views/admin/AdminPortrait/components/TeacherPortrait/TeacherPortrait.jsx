import './TeacherPortrait.scss';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import TeacherService from '@services/TeacherService.ts';
import ScientificActivity from '@components/science/ScientificActivity';
import TeacherView from '../../../AdminTeachers/TeacherView';
import TabButton from '@components/ui/TabButton';

/** @description Teacher digital profile, separated from student-only analytics. */
export default function TeacherPortrait({ teacherId }) {
    const [tab, setTab] = useState('personal');
    const { data, isPending, error } = useQuery({
        queryKey: ['teacherPortrait', teacherId],
        queryFn: () => TeacherService.getTeacherById(teacherId)
    });
    if (isPending) return <p>Загрузка профиля преподавателя…</p>;
    if (error) return <p role="alert">{error.message}</p>;
    return (
        <div className="TeacherPortrait">
            <h1>Цифровой профиль преподавателя: {data.data.name}</h1>
            <nav aria-label="Разделы профиля">
                <TabButton
                    text="Личные данные"
                    isActive={tab === 'personal'}
                    onClick={() => setTab('personal')}
                />
                <TabButton
                    text="Научная деятельность"
                    isActive={tab === 'science'}
                    onClick={() => setTab('science')}
                />
            </nav>
            {tab === 'science' ? (
                <ScientificActivity
                    key={teacherId}
                    teacherId={teacherId}
                />
            ) : (
                <TeacherView teacher={data.data} />
            )}
        </div>
    );
}
