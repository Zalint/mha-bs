import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';

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

  // Sidebar : ouverte par defaut sur desktop, fermee sur mobile.
  // Le hamburger de la Topbar toggle sur tous les viewports.
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.matchMedia('(min-width: 1024px)').matches;
  });
  const location = useLocation();

  // Auto-close mobile uniquement, sur changement de route
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!window.matchMedia('(min-width: 1024px)').matches) {
      setSidebarOpen(false);
    }
  }, [location.pathname]);

  // Echap pour fermer
  useEffect(() => {
    if (!sidebarOpen) return;
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setSidebarOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [sidebarOpen]);

  return (
    <div className="min-h-screen flex">
      <Sidebar
        mode={mode}
        onModeChange={setMode}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      {/* Backdrop mobile uniquement (la sidebar prend la pleine hauteur en drawer) */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-fg/40 backdrop-blur-sm z-40 lg:hidden"
          aria-hidden="true"
        />
      )}
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar onMenuClick={() => setSidebarOpen((o) => !o)} sidebarOpen={sidebarOpen} />
        <main className="flex-1 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
