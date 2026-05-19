import { Navigate, Outlet, useLocation } from 'react-router-dom';

import type { UserRole } from '@mha-bs/shared';

import { useAuthStore } from '../../stores/authStore.js';

interface Props {
  roles?: UserRole[];
}

export function ProtectedRoute({ roles }: Props) {
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);

  if (!accessToken || !user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (roles && roles.length > 0 && !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
