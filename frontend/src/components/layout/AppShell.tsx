import { useState } from 'react';
import { Outlet } from 'react-router-dom';

import { useAuthStore } from '../../stores/authStore.js';

import { Sidebar } from './Sidebar.js';
import { Topbar } from './Topbar.js';

export function AppShell() {
  const role = useAuthStore((s) => s.user?.role);
  // Mode initial selon le role :
  //  - bs            -> vue Bureau Suivi par defaut
  //  - sg, reader    -> vue SG par defaut (lecture/validation)
  //  - admin         -> SG (peut switcher)
  const initialMode: 'sg' | 'bs' = role === 'bs' ? 'bs' : 'sg';
  const [mode, setMode] = useState<'sg' | 'bs'>(initialMode);

  return (
    <div className="grid grid-cols-[248px_1fr] min-h-screen">
      <Sidebar mode={mode} onModeChange={setMode} />
      <div className="flex flex-col min-w-0">
        <Topbar />
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
