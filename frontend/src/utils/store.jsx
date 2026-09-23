import React, { createContext, useState, useContext } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const DEFAULT_PAGE = '/admin/stats';

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
    )
);