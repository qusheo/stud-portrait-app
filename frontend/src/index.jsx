import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';

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
    AdminStudentView,
    AdminTargetSearchView,
    AdminTeachersView,
    AdminGroupingView
} from './views/admin';

import StudentMainView from './views/student/StudentMainView';
import StudentReportView from './views/student/StudentReportView';

import SuperAuditView from './views/super/SuperAuditView';
import SuperSqlView from './views/super/SuperSqlView';
import SuperUploadView from './views/super/SuperUploadView';
import { SidebarLayout, Content } from '@components/SidebarLayout';
import reportWebVitals from './reportWebVitals';
import './index.css';

const router = createBrowserRouter([
    {
        element: <SidebarLayout />,
        children: [
            {
                path: '/',
                element: <App />,
                errorElement: <ErrorView />
            },
            {
                path: '/admin/geography',
                element: <AdminGeographyView />
            },
            {
                path: '/admin/help',
                element: <AdminHelpView />
            },
            {
                path: '/admin/stats',
                element: <AdminStatsView />
            },
            {
                path: '/admin/search',
                element: <AdminTargetSearchView />
            },
            {
                path: '/admin/grouping',
                element: <AdminGroupingView />
            },
            {
                path: '/admin/results',
                element: <AdminResultsView />
            },
            {
                path: '/admin/analysis/disciplines',
                element: <AdminAnalysisDisciplinesView />
            },
            {
                path: '/admin/analysis/advanced',
                element: <AdminAnalysisAdvancedView />
            },
            {
                path: '/admin/analysis/ai-analytics',
                element: <AdminAiAnalyticsView />
            },
            {
                path: '/admin/analysis/edu-profiles',
                element: <AdminAnalysisEduProfilesView />
            },
            {
                path: '/admin/analysis/transfered-students',
                element: <AdminTransferAnalysisView />
            },
            {
                path: '/admin/analysis/dublicate-accounts',
                element: <AdminDuplicateAccountsChecker />
            },
            {
                path: '/admin/analysis/anomalous-students',
                element: <AdminAnomalousStudentView />
            },
            {
                path: '/admin/courses',
                element: <AdminCoursesView />
            },
            {
                path: '/admin/grouping',
                element: <AdminGroupedDiagramsView />
            },
            {
                path: '/admin/competences',
                element: <AdminCompetencesView />
            },
            {
                path: '/admin/motivators',
                element: <AdminMotivatorsView />
            },
            {
                path: '/admin/AP',
                element: <AdminAPView />
            },
            {
                path: '/admin/student/',
                element: <AdminStudentView />
            },
            {
                path: '/admin/teachers',
                element: <AdminTeachersView />
            },

            /* SUPERADMIN VIEWS */

            {
                path: '/super/audit',
                element: <SuperAuditView />
            },
            {
                path: '/super/upload',
                element: <SuperUploadView />
            },
            {
                path: '/super/sql',
                element: <SuperSqlView />
            }
        ]
    },
    {
        element: <Content />,
        children: [
            {
                path: '/student/:studentId',
                element: <StudentMainView />
            },
            {
                path: '/student/:studentId/report/:reportType',
                element: <StudentReportView />
            }
        ]
    }
]);

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
    <React.StrictMode>
        <RouterProvider router={router} />
    </React.StrictMode>
);

reportWebVitals();
