import {
  Bell,
  Building2,
  Calendar,
  CalendarPlus,
  ChevronDown,
  ClipboardList,
  CloudRain,
  Download,
  FilePlus,
  Grid3x3,
  Inbox,
  Landmark,
  LayoutDashboard,
  type LucideIcon,
  MapPin,
  Mic,
  Settings,
  Upload,
} from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';

import { cn } from '../../lib/cn.js';
import { useAuthStore } from '../../stores/authStore.js';

interface NavLeaf {
  id: string;
  label: string;
  to: string;
  icon?: LucideIcon;
  badge?: string | number;
}

interface NavGroupItem {
  id: string;
  label: string;
  icon: LucideIcon;
  children: NavLeaf[];
}

type NavItem = NavLeaf | NavGroupItem;

const NAV_SG: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard global', icon: LayoutDashboard, to: '/' },
  {
    id: 'directive-pres',
    label: 'Directive présidentielle',
    icon: Landmark,
    children: [
      { id: 'ci', label: 'Conseil inter-ministériel', to: '/directives/conseil-interministeriel', badge: 65 },
      { id: 'cm', label: 'Conseil des ministres', to: '/directives/conseil-ministres', badge: 123 },
      { id: 'sgg', label: 'Coordination SGG/SG', to: '/directives/coordination-sg', badge: 10 },
    ],
  },
  {
    id: 'reco-mha',
    label: 'Recommandations MHA',
    icon: ClipboardList,
    children: [
      { id: 'copil', label: 'COPIL', to: '/recommandations/copil', badge: 40 },
      { id: 'reformes', label: 'Réformes', to: '/recommandations/reformes', badge: 13 },
      { id: 'cngi', label: 'CNGI', to: '/recommandations/cngi', badge: 11 },
    ],
  },
  { id: 'reunions-tech', label: 'Suivi Réunions techniques', icon: Calendar, to: '/reunions-techniques', badge: 19 },
  { id: 'missions', label: 'Suivi missions terrain', icon: MapPin, to: '/missions-terrain', badge: 4 },
  { id: 'interpellations', label: 'Interpellations parlementaires', icon: Mic, to: '/interpellations', badge: 12 },
  { id: 'par-direction', label: 'Répartition par direction', icon: Building2, to: '/par-direction' },
];

const NAV_BS: NavItem[] = [
  { id: 'bs-liste', label: 'File de travail', icon: Inbox, to: '/bs/liste', badge: 16 },
  { id: 'bs-alertes', label: 'Mes alertes', icon: Bell, to: '/bs/alertes' },
  { id: 'bs-fiche', label: 'Nouvelle recommandation', icon: FilePlus, to: '/bs/fiche' },
  { id: 'bs-rencontre', label: 'Nouvelle rencontre', icon: CalendarPlus, to: '/bs/rencontre' },
  { id: 'bs-matrice', label: 'Saisie matrices', icon: Grid3x3, to: '/bs/matrice' },
  { id: 'bs-reunion', label: 'Réunion / mission', icon: CloudRain, to: '/bs/reunion' },
  { id: 'bs-import', label: 'Import Excel', icon: Upload, to: '/bs/import' },
  { id: 'bs-export', label: 'Export & rapports', icon: Download, to: '/bs/export' },
  { id: 'bs-config', label: 'Configuration', icon: Settings, to: '/bs/config' },
];

interface SidebarProps {
  mode: 'sg' | 'bs';
  onModeChange: (mode: 'sg' | 'bs') => void;
}

export function Sidebar({ mode, onModeChange }: SidebarProps) {
  const userRole = useAuthStore((s) => s.user?.role);
  const baseItems = mode === 'sg' ? NAV_SG : NAV_BS;
  // L'item "Configuration" n'est visible que pour le role admin
  const navItems = baseItems.filter((it) => {
    if ('id' in it && it.id === 'bs-config') return userRole === 'admin';
    return true;
  });
  const groupLabel = mode === 'sg' ? 'VUE SG' : 'ESPACE BUREAU DE SUIVI';

  return (
    <aside className="bg-sidebar text-sidebar-fg flex flex-col sticky top-0 h-screen overflow-y-auto w-[248px] flex-shrink-0">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-white/10">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-secondary text-white font-bold flex items-center justify-center">
          M
        </div>
        <div className="text-sm leading-tight">
          <div className="text-white font-semibold">MHA · Suivi</div>
          <div className="text-sidebar-muted text-xs">Bureau de Suivi</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3">
        <div className="px-4 mb-1.5 text-[11px] uppercase tracking-wider text-sidebar-muted">
          {groupLabel}
        </div>
        {navItems.map((item) =>
          'children' in item ? <NavGroup key={item.id} item={item} /> : <NavLeafItem key={item.id} item={item} />,
        )}
      </nav>

      {/* Role switch */}
      <RoleSwitch mode={mode} onModeChange={onModeChange} />
    </aside>
  );
}

function NavLeafItem({ item }: { item: NavLeaf }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-2.5 px-3.5 py-2 mx-2 my-0.5 rounded text-sm transition-colors',
          isActive ? 'bg-primary text-white' : 'text-sidebar-fg hover:bg-white/5 hover:text-white',
        )
      }
    >
      {Icon && <Icon className="w-[18px] h-[18px] flex-shrink-0" strokeWidth={1.8} />}
      <span className="flex-1">{item.label}</span>
      {item.badge !== undefined && (
        <span className="bg-white/15 text-white text-[11px] px-1.5 py-0.5 rounded-full font-mono">
          {item.badge}
        </span>
      )}
    </NavLink>
  );
}

function NavGroup({ item }: { item: NavGroupItem }) {
  const location = useLocation();
  const Icon = item.icon;
  const hasActive = item.children.some((c) => location.pathname.startsWith(c.to));

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2.5 px-3.5 py-2 mx-2 text-sidebar-muted font-medium text-sm">
        <Icon className="w-[18px] h-[18px] flex-shrink-0" strokeWidth={1.8} />
        <span className="flex-1">{item.label}</span>
        <ChevronDown
          className={cn(
            'w-3.5 h-3.5 transition-transform opacity-70',
            !hasActive && 'rotate-0',
          )}
          strokeWidth={2.2}
        />
      </div>
      <div className="ml-5 pl-2.5 border-l border-white/10 mt-0.5">
        {item.children.map((c) => (
          <NavLink
            key={c.id}
            to={c.to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2 px-3 py-1.5 mx-1 my-0.5 rounded text-[12.8px] transition-colors',
                isActive ? 'bg-primary text-white' : 'text-sidebar-muted hover:bg-white/5 hover:text-white',
              )
            }
          >
            <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60 flex-shrink-0" />
            <span className="flex-1">{c.label}</span>
            {c.badge !== undefined && (
              <span className="bg-white/15 text-white text-[11px] px-1.5 py-0.5 rounded-full font-mono">
                {c.badge}
              </span>
            )}
          </NavLink>
        ))}
      </div>
    </div>
  );
}

function RoleSwitch({ mode, onModeChange }: SidebarProps) {
  const user = useAuthStore((s) => s.user);
  return (
    <div className="mt-auto mx-2 mb-3.5">
      <div className="text-xs text-sidebar-muted px-2 mb-1">{user?.fullName ?? 'Utilisateur'}</div>
      <div className="bg-white/5 rounded-lg p-1 flex gap-0.5">
        <button
          type="button"
          onClick={() => onModeChange('sg')}
          className={cn(
            'flex-1 py-1.5 px-2.5 text-xs font-medium rounded-md transition-colors',
            mode === 'sg' ? 'bg-primary text-white' : 'text-sidebar-muted hover:text-white',
          )}
        >
          SG
        </button>
        <button
          type="button"
          onClick={() => onModeChange('bs')}
          className={cn(
            'flex-1 py-1.5 px-2.5 text-xs font-medium rounded-md transition-colors',
            mode === 'bs' ? 'bg-primary text-white' : 'text-sidebar-muted hover:text-white',
          )}
        >
          Bureau Suivi
        </button>
      </div>
    </div>
  );
}
