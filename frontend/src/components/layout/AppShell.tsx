import { useState } from 'react';
import { Outlet } from 'react-router-dom';

import { Sidebar } from './Sidebar.js';
import { Topbar } from './Topbar.js';

export function AppShell() {
  const [mode, setMode] = useState<'sg' | 'bs'>('sg');

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
