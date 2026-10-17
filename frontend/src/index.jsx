import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { QueryClientProvider } from '@tanstack/react-query';

import App from './views/App';
import ErrorView from './views/ErrorView';

import {
    AdminAnalysisAdvancedView,
    AdminAnalysisDisciplinesView,
    AdminAiAnalyticsView,
    AdminAnalysisEduProfilesView,
    AdminTransferAnalysisView,
    AdminAnomalousStudentView,
    AdminDuplicateAccountsChecker,
    AdminAPView,
    AdminCoursesView,
    AdminGeographyView,
    AdminGroupedDiagramsView,
    AdminHelpView,
    AdminMotivatorsView,
    AdminResultsView,
    AdminStatsView,
    AdminCompetencesView,
    AdminPortraitView,
    AdminTargetSearchView,
    AdminTeachersView,
    AdminGroupingView
} from './views/admin';

import UserView from './views/user/UserView';
import UserReportView from './views/user/UserReportView';

import SuperAuditView from './views/super/SuperAuditView';
import SuperSqlView from './views/super/SuperSqlView';
import SuperUploadView from './views/super/SuperUploadView';
import { SidebarLayout, Content } from '@components/SidebarLayout';
import PermissionGuard from './user/components/PermissionGuard.jsx';
import { Permission } from './user/entities/permissions.ts';
import reportWebVitals from './reportWebVitals';
import { queryClient } from './utils/queryConfig';
import './index.css';

const router = createBrowserRouter([
    {
        element: <PermissionGuard />,
        children: [
            {
                element: <SidebarLayout />,
                children: [
                    { path: '/', element: <App />, errorElement: <ErrorView /> },
                    { path: '/admin/geography', element: <AdminGeographyView />, handle: { permission: Permission.GEOGRAPHY } },
                    { path: '/admin/help', element: <AdminHelpView />, handle: { permission: Permission.HELP } },
                    { path: '/admin/stats', element: <AdminStatsView />, handle: { permission: Permission.STATS } },
                    { path: '/admin/search', element: <AdminTargetSearchView />, handle: { permission: Permission.SEARCH } },
                    { path: '/admin/grouping', element: <AdminGroupingView />, handle: { permission: Permission.GROUPING } },
                    { path: '/admin/results', element: <AdminResultsView />, handle: { permission: Permission.RESULTS } },
                    {
                        path: '/admin/analysis/disciplines',
                        element: <AdminAnalysisDisciplinesView />,
                        handle: { permission: Permission.ANALYSIS_DISCIPLINES }
                    },
                    {
                        path: '/admin/analysis/advanced',
                        element: <AdminAnalysisAdvancedView />,
                        handle: { permission: Permission.ANALYSIS_ADVANCED }
                    },
                    {
                        path: '/admin/analysis/ai-analytics',
                        element: <AdminAiAnalyticsView />,
                        handle: { permission: Permission.AI_ANALYTICS }
                    },
                    {
                        path: '/admin/analysis/edu-profiles',
                        element: <AdminAnalysisEduProfilesView />,
                        handle: { permission: Permission.EDU_PROFILES }
                    },
                    {
                        path: '/admin/analysis/transfered-students',
                        element: <AdminTransferAnalysisView />,
                        handle: { permission: Permission.TRANSFER_ANALYSIS }
                    },
                    {
                        path: '/admin/analysis/dublicate-accounts',
                        element: <AdminDuplicateAccountsChecker />,
                        handle: { permission: Permission.DUPLICATE_ACCOUNTS }
                    },
                    {
                        path: '/admin/analysis/anomalous-students',
                        element: <AdminAnomalousStudentView />,
                        handle: { permission: Permission.ANOMALOUS_STUDENTS }
                    },
                    { path: '/admin/courses', element: <AdminCoursesView />, handle: { permission: Permission.COURSES } },
                    { path: '/admin/grouping', element: <AdminGroupedDiagramsView />, handle: { permission: Permission.GROUPING } },
                    { path: '/admin/competences', element: <AdminCompetencesView />, handle: { permission: Permission.COMPETENCES } },
                    { path: '/admin/motivators', element: <AdminMotivatorsView />, handle: { permission: Permission.MOTIVATORS } },
                    { path: '/admin/AP', element: <AdminAPView />, handle: { permission: Permission.AP } },
                    { path: '/admin/portrait', element: <AdminPortraitView />, handle: { permission: Permission.PORTRAIT } },
                    { path: '/admin/teachers', element: <AdminTeachersView />, handle: { permission: Permission.TEACHERS } },
                    { path: '/super/audit', element: <SuperAuditView />, handle: { permission: Permission.AUDIT } },
                    { path: '/super/upload', element: <SuperUploadView />, handle: { permission: Permission.UPLOAD } },
                    { path: '/super/sql', element: <SuperSqlView />, handle: { permission: Permission.SQL } }
                ]
            },
            {
                element: <Content />,
                children: [
                    { path: '/user/:userId', element: <UserView />, handle: { permission: Permission.OWN_PORTRAIT } },
                    {
                        path: '/user/:userId/report/:reportType',
                        element: <UserReportView />,
                        handle: { permission: Permission.OWN_REPORT }
                    }
                ]
            }
        ]
    }
]);

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
    <React.StrictMode>
        <QueryClientProvider client={queryClient}>
            <RouterProvider router={router} />
            <ToastContainer position="bottom-right" autoClose={3000} hideProgressBar theme="light" />
        </QueryClientProvider>
    </React.StrictMode>
);

reportWebVitals();
