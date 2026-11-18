import React from 'react';

import { Dropdown, Tooltip } from '@ui';
import logo from '@icons/utmn/logo_white.png';

import './SidebarLayout.scss';
import { ChevronDown, ChevronUp, UserRound, LogOut } from 'lucide-react';
import { useLocation, useNavigate, Outlet } from 'react-router-dom';
import { toast } from 'react-toastify';
import ToggleLeft from '@icons/toggle_left.png';
import ToggleRight from '@icons/toggle_right.png';
import {
    LINK_TREE,
    SUPER_LINK_TREE,
    STUDENT_LINK_TREE,
    TEACHER_LINK_TREE
} from '../constants/linkTree.js';
import { filterLinkTree } from '../user/entities/permissions.ts';
import { ACCOUNT_TYPE_LABELS } from '../user/entities/accountType.ts';
import { useUserStore } from '../user/store/userStore.js';
import Api from '../api.js';

export const LAYOUT_STYLE = {
    ADMIN: 'admin',
    NORMAL: 'normal'
};

/**
 * @description Макет страницы с боковой панелью и областью содержимого.
 * @param {Object} props Параметры компонента.
 * @param {string} [props.style='normal'] Вариант оформления макета.
 * @param {boolean} [props.sidebar=true] Показывает боковую панель.
 */
export function SidebarLayout({ style = LAYOUT_STYLE.NORMAL, sidebar = true }) {
    const location = useLocation();
    const accountType = useUserStore(state => state.accountType);
    const userId = useUserStore(state => state.userId);
    const participantId = useUserStore(state => state.participantId);

    let linkTree = LINK_TREE;

    if (location.pathname.startsWith('/super')) {
        linkTree = SUPER_LINK_TREE;
    } else if (accountType === 'student') {
        linkTree = STUDENT_LINK_TREE.map(category => ({
            ...category,
            links: category.links.map(link => {
                const reportRoutes = {
                    '/user/competences': `/user/${participantId}/report/competences`,
                    '/user/motivators': `/user/${participantId}/report/motivators`,
                    '/user/values': `/user/${participantId}/report/values`
                };

                if (link.to === '/user/profile') {
                    return { ...link, to: `/user/${participantId}` };
                }

                if (reportRoutes[link.to]) {
                    return { ...link, to: reportRoutes[link.to] };
                }

                return link;
            })
        }));
    } else if (accountType === 'teacher') {
        linkTree = TEACHER_LINK_TREE;
    }

    return (
        <div className={`SidebarLayout style--${style}`}>
            {sidebar && <Sidebar linkTree={linkTree} />}
            <Content />
        </div>
    );
}

/**
 * @description Шапка страницы с названием и действиями аккаунта.
 * @param {Object} props Параметры компонента.
 * @param {string} props.title Заголовок страницы.
 * @param {string} props.name Имя пользователя.
 * @param {Function} [props.onAccountClick] Обработчик перехода к аккаунту.
 * @param {Function} [props.onLogout] Обработчик выхода из аккаунта.
 */
export function Header({ title, name, onAccountClick, onLogout }) {
    return (
        <div className="Header">
                <div className="left-side">
                    <div className="logo-area">
                        <img
                            src={logo}
                            height="55"
                            alt="Тюменский государственный университет"
                        />
                        <span className="logo-title">ВУЗPortrait</span>
                    </div>
                    <span className="title">{title}</span>
                </div>
                <div className="right-side">
                    <div className="user">
                        <UserRound
                            color="white"
                            size={15}
                        />
                        {onAccountClick ? (
                            <span
                                className="user-name user-name--button"
                                onClick={onAccountClick}
                            >
                                {name}
                            </span>
                        ) : (
                            <span className="user-name">{name}</span>
                        )}
                    </div>
                    <Tooltip
                        text="Выйти"
                        placement="bottom"
                    >
                        <LogOut
                            color="white"
                            size={17}
                            onClick={onLogout}
                            style={{ cursor: 'pointer' }}
                        />
                    </Tooltip>
                </div>
        </div>
    );
}

/**
 * @description Боковая панель навигации.
 * @param {Object} props Параметры компонента.
 * @param {Array} props.links Пользовательский список ссылок.
 * @param {Array} props.linkTree Дерево ссылок с группами.
 */
export function Sidebar({ links, linkTree }) {
    const [isOpen, setIsOpen] = React.useState(true);
    const location = useLocation();
    const navigate = useNavigate();
    const resetAuth = useUserStore(state => state.resetAuth);

    async function onLogout() {
        try {
            const response = await Api.postLogout();

            if (!response.ok) {
                toast.error('Не удалось завершить сессию на сервере');
                return;
            }

            resetAuth();
            navigate('/login', { replace: true });
        } catch {
            toast.error('Ошибка при выходе из аккаунта');
        }
    }
    const [categoryOpenState, setCategoryOpenState] = React.useState({});
    const permissions = useUserStore(state => state.permissions);
    const accountType = useUserStore(state => state.accountType);
    const userId = useUserStore(state => state.userId);
    const participantId = useUserStore(state => state.participantId);
    const isAuthenticated = useUserStore(state => state.isAuthenticated);
    const visibleLinkTree = React.useMemo(() => (linkTree ? filterLinkTree(linkTree, permissions) : null), [linkTree, permissions]);

    const locationName = visibleLinkTree?.filter(i => !!i.links?.find(link => link.to === location.pathname)) ?? [];
    let title = locationName.length ? locationName[0].links.find(link => link.to === location.pathname).title : '';

    React.useEffect(() => {
        if (!visibleLinkTree) return;

        const categories = Object.fromEntries(visibleLinkTree.map(category => [category.category, true]));

        setCategoryOpenState(categories);
    }, [visibleLinkTree]);

    function onCategoryClick(category) {
        if (categoryOpenState[category] === undefined) return;
        setCategoryOpenState({ ...categoryOpenState, [category]: !categoryOpenState[category] });
    }

    function onAccountClick() {
        const profileId = accountType === 'student' ? participantId : userId;

        if (!isAuthenticated || !profileId) {
            toast.error('Не выполнен вход в аккаунт');
            return;
        }

        navigate(`/user/${profileId}`);
    }
    if (!isOpen) {
        return (
            <>
                <Header
                    title={`${title}`}
                    name={ACCOUNT_TYPE_LABELS[accountType]}
                    onAccountClick={onAccountClick}
                    onLogout={onLogout}
                />
                <div
                    className="Sidebar-container-closed"
                    style={{ width: '30px', height: 'calc(100vdh - 50px)' }}
                >
                    <nav className="Sidebar-closed"></nav>
                    <div className="SideBar-btn-container">
                        <img
                            src={ToggleRight}
                            onClick={() => setIsOpen(true)}
                        />
                    </div>
                </div>
            </>
        );
    }
    if (linkTree) {
        return (
            <>
                <Header
                    title={`${title}`}
                    name={ACCOUNT_TYPE_LABELS[accountType]}
                    onAccountClick={onAccountClick}
                    onLogout={onLogout}
                />
                <div className="Sidebar-scroll">
                    <div className="Sidebar-container">
                        <nav className="Sidebar">
                            <ul>
                                {visibleLinkTree.map((category, index) => (
                                    <li key={index}>
                                        {category.category && (
                                            <span onClick={() => onCategoryClick(category.category)}>
                                                {category.category}

                                                <div className="icon">
                                                    {categoryOpenState[category.category] === false ? (
                                                        <ChevronUp size={15} />
                                                    ) : (
                                                        <ChevronDown size={15} />
                                                    )}
                                                </div>
                                            </span>
                                        )}
                                        <ul style={categoryOpenState[category.category] === false ? { height: '0px' } : {}}>
                                            {categoryOpenState[category.category] !== false &&
                                                category.links.map((link, index) => (
                                                    <li key={index}>
                                                        <a
                                                            href={link.to}
                                                            className={
                                                                link.to === location.pathname ? 'Sidebar-item-active' : 'Sidebar-item'
                                                            }
                                                        >
                                                            {link.title}
                                                        </a>
                                                    </li>
                                                ))}
                                        </ul>
                                    </li>
                                ))}
                            </ul>
                        </nav>
                        <div className="SideBar-btn-container">
                            <img
                                src={ToggleLeft}
                                onClick={() => setIsOpen(false)}
                            />
                        </div>
                    </div>
                </div>
            </>
        );
    }

    return (
        <>
            <Header
                title={`${title}`}
                name={ACCOUNT_TYPE_LABELS[accountType]}
                onAccountClick={onAccountClick}
                onLogout={onLogout}
            />
            <div className="Sidebar-scroll">
                <div className="Sidebar-container">
                    <nav className="Sidebar">
                        <ul>
                            {links?.map?.((link, index) => (
                                <li key={index}>
                                    <a
                                        href={link.to}
                                        className={link.to === location.pathname ? 'Sidebar-item-active' : 'Sidebar-item'}
                                    >
                                        {link.title}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </nav>
                    <div className="SideBar-btn-container">
                        <img
                            src={ToggleLeft}
                            onClick={() => setIsOpen(false)}
                        />
                    </div>
                </div>
            </div>
        </>
    );
}

export function Content() {
    return (
        <div className="Content">
            <Outlet />
        </div>
    );
}
