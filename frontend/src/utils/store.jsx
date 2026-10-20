import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useLocation } from 'react-router-dom';

const DEFAULT_PAGE = '/admin/stats';
const APP_NAME = 'StudPortrait';

export const useAdminStore = create(
    persist(
        set => ({
            currentPage: DEFAULT_PAGE,

            savedFilters: {
                Admin: {}
            },

            saveFilters: (page, data) =>
                set(state => ({
                    savedFilters: {
                        ...state.savedFilters,
                        [page]: { ...data }
                    }
                }))
        }),
        {
            name: 'admin-filters'
        }
    ),
    persist(set => ({}), {
        name: 'admin-profile-redirect'
    })
);

export const usePageStore = create(
    persist(
        set => ({
            pageName: APP_NAME,

            setPageName: (name) =>
                set(state => {
                    let title = name;
                    if (!title) {
                        const location = useLocation();
                        title = location.pathname.title;
                    }
                    return ({
                        pageName: title,
                    })
                })
        }),
        {
            name: 'page-name'
        }
    ),
    persist(set => ({}), {
        name: 'page-redirect'
    })
);
