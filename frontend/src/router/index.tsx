import { createBrowserRouter, Navigate } from 'react-router-dom';

import { ProtectedRoute } from '../components/auth/ProtectedRoute.js';
import { AppShell } from '../components/layout/AppShell.js';
import { DashboardView } from '../views/DashboardView.js';
import { GuideView } from '../views/GuideView.js';
import { DirectiveFicheView } from '../views/DirectiveFicheView.js';
import { ConseilInterMinisterielView } from '../views/directives/ConseilInterMinisterielView.js';
import { ConseilMinistresView } from '../views/directives/ConseilMinistresView.js';
import { CoordinationSgView } from '../views/directives/CoordinationSgView.js';
import { DirectivesPresidentiellesView } from '../views/directives/DirectivesPresidentiellesView.js';
import { BsImportView } from '../views/bs/BsImportView.js';
import { BsListeView } from '../views/bs/BsListeView.js';
import { BsMatriceView } from '../views/bs/BsMatriceView.js';
import { BsRecommandationNewView } from '../views/bs/BsRecommandationNewView.js';
import { BsRencontreView } from '../views/bs/BsRencontreView.js';
import { BsReunionMissionView } from '../views/bs/BsReunionMissionView.js';
import { ConfigView } from '../views/ConfigView.js';
import { LoginView } from '../views/LoginView.js';
import { MissionsTerrainView } from '../views/MissionsTerrainView.js';
import { CngiView } from '../views/recommandations/CngiView.js';
import { CopilView } from '../views/recommandations/CopilView.js';
import { ReformesView } from '../views/recommandations/ReformesView.js';
import { ReunionsTechniquesView } from '../views/ReunionsTechniquesView.js';
import { SgValidationView } from '../views/sg/SgValidationView.js';
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
          { path: 'guide', element: <GuideView /> },
          {
            path: 'directives',
            element: <DirectivesPresidentiellesView />,
            children: [
              { index: true, element: <Navigate to="/directives/conseil-interministeriel" replace /> },
              { path: 'conseil-interministeriel', element: <ConseilInterMinisterielView /> },
              { path: 'conseil-ministres', element: <ConseilMinistresView /> },
              { path: 'coordination-sg', element: <CoordinationSgView /> },
            ],
          },
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
          { path: 'bs/recommandation/new', element: <BsRecommandationNewView /> },
          { path: 'bs/reunion', element: <BsReunionMissionView /> },
          { path: 'bs/import', element: <BsImportView /> },
          {
            path: 'bs/config',
            // Route ouverte au BS et aux administrateurs
            element: <ProtectedRoute roles={['admin', 'bs']} />,
            children: [{ index: true, element: <ConfigView /> }],
          },
          {
            path: 'admin/users',
            element: <ProtectedRoute roles={['admin']} />,
            children: [{ index: true, element: <UsersView /> }],
          },
          {
            path: 'sg/validation',
            element: <ProtectedRoute roles={['sg', 'admin']} />,
            children: [{ index: true, element: <SgValidationView /> }],
          },
          { path: '*', element: <Navigate to="/" replace /> },
        ],
      },
    ],
  },
]);
