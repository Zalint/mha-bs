import { createBrowserRouter, Navigate } from 'react-router-dom';

import { ProtectedRoute } from '../components/auth/ProtectedRoute.js';
import { AppShell } from '../components/layout/AppShell.js';
import { DashboardView } from '../views/DashboardView.js';
import { DirectiveFicheView } from '../views/DirectiveFicheView.js';
import { ConseilInterMinisterielView } from '../views/directives/ConseilInterMinisterielView.js';
import { ConseilMinistresView } from '../views/directives/ConseilMinistresView.js';
import { CoordinationSgView } from '../views/directives/CoordinationSgView.js';
import { BsListeView } from '../views/bs/BsListeView.js';
import { BsMatriceView } from '../views/bs/BsMatriceView.js';
import { BsRencontreView } from '../views/bs/BsRencontreView.js';
import { BsReunionMissionView } from '../views/bs/BsReunionMissionView.js';
import { ConfigView } from '../views/ConfigView.js';
import { LoginView } from '../views/LoginView.js';
import { MissionsTerrainView } from '../views/MissionsTerrainView.js';
import { CngiView } from '../views/recommandations/CngiView.js';
import { CopilView } from '../views/recommandations/CopilView.js';
import { ReformesView } from '../views/recommandations/ReformesView.js';
import { ReunionsTechniquesView } from '../views/ReunionsTechniquesView.js';
import { UsersView } from '../views/UsersView.js';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginView />,
  },
  {
    path: '/',
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <DashboardView /> },
          { path: 'directives/conseil-ministres', element: <ConseilMinistresView /> },
          { path: 'directives/conseil-interministeriel', element: <ConseilInterMinisterielView /> },
          { path: 'directives/coordination-sg', element: <CoordinationSgView /> },
          { path: 'directives/:id', element: <DirectiveFicheView /> },
          { path: 'recommandations/copil', element: <CopilView /> },
          { path: 'recommandations/reformes', element: <ReformesView /> },
          { path: 'recommandations/cngi', element: <CngiView /> },
          { path: 'reunions-techniques', element: <ReunionsTechniquesView /> },
          { path: 'missions-terrain', element: <MissionsTerrainView /> },
          { path: 'bs/liste', element: <BsListeView /> },
          { path: 'bs/fiche', element: <DirectiveFicheView /> },
          { path: 'bs/fiche/:id', element: <DirectiveFicheView /> },
          { path: 'bs/rencontre', element: <BsRencontreView /> },
          { path: 'bs/matrice', element: <BsMatriceView /> },
          { path: 'bs/reunion', element: <BsReunionMissionView /> },
          {
            path: 'bs/config',
            // Route reservee aux administrateurs : ProtectedRoute imbrique avec roles=['admin']
            element: <ProtectedRoute roles={['admin']} />,
            children: [{ index: true, element: <ConfigView /> }],
          },
          {
            path: 'admin/users',
            element: <ProtectedRoute roles={['admin']} />,
            children: [{ index: true, element: <UsersView /> }],
          },
          { path: '*', element: <Navigate to="/" replace /> },
        ],
      },
    ],
  },
]);
