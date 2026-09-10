import React from 'react';

import Dropdown from './ui/Dropdown';
import logo from '../static/logo_white.png';

import './SidebarLayout.scss';

import { useLocation, Outlet } from 'react-router-dom';
import ToggleLeft from '@icons/toggle_left.png';
import ToggleRight from '@icons/toggle_right.png';
import { LINK_TREE } from '../utilities.js';
export const LAYOUT_STYLE = {
    ADMIN: 'admin',
    MODEUS: 'modeus',
    NORMAL: 'normal'
};

export function SidebarLayout({ style = LAYOUT_STYLE.MODEUS }) {
    return (
        <div className={`SidebarLayout style--${style}`}>
            <Sidebar linkTree={LINK_TREE} />
            <Content />
        </div>
    );
}

export function Header({ title, name }) {
    return (
        <div className="Header">
            <div className="left-side">
                <div className="logo-area">
                    <img
                        src={logo}
                        height="55"
                        alt="Тюменский государственный университет"
                    />
                    <span className="logo-title">StudPortrait</span>
                </div>
                <span className="title">{title}</span>
            </div>
            <div className="right-side">
                <Dropdown label={name}>
                    <span style={{ cursor: 'not-allowed' }}>Выход</span>
                </Dropdown>
            </div>
        </div>
    );
}

export function Sidebar({ links, linkTree }) {
    const [isOpen, setIsOpen] = React.useState(true);
    const location = useLocation();
    const locationName = linkTree.filter(i => !!i.links?.find(link => link.to === location.pathname));
    let title = locationName.length ? locationName[0].links.find(link => link.to === location.pathname).title : '';

    if (!isOpen) {
        return (
            <>
                <Header
                    title={`${title}`}
                    name="Администратор"
                />
                <div
                    className="Sidebar-container"
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
                    name="Администратор"
                />
                <div className="Sidebar-scroll">
                    <div className="Sidebar-container">
                        <nav className="Sidebar">
                            <ul>
                                {linkTree.map((category, index) => (
                                    <li key={index}>
                                        {category.category && <span>{category.category}</span>}
                                        <ul>
                                            {category.links.map((link, index) => (
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
                name="Администратор"
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
