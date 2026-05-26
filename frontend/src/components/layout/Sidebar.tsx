import {
  Bell,
  BookOpen,
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
  ShieldCheck,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';

import { useApi } from '../../hooks/useApi.js';
import { api } from '../../lib/apiClient.js';
import { cn } from '../../lib/cn.js';
import { useAuthStore } from '../../stores/authStore.js';

interface NavCounts {
  directives: {
    conseilInterMinisteriel: number;
    conseilMinistres: number;
    coordinationSggSg: number;
  };
  recommandations: { copil: number; reformes: number; cngi: number };
  reunionsTechniques: number;
  missionsTerrain: number;
  interpellations: number;
}

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

function buildNavSg(counts: NavCounts | null): NavItem[] {
  return [
    { id: 'dashboard', label: 'Dashboard global', icon: LayoutDashboard, to: '/' },
    { id: 'sg-validation', label: 'Validation', icon: ShieldCheck, to: '/sg/validation' },
    { id: 'directive-pres', label: 'Directives présidentielles', icon: Landmark, to: '/directives' },
    {
      id: 'reco-mha',
      label: 'Recommandations MHA',
      icon: ClipboardList,
      children: [
        { id: 'copil', label: 'COPIL', to: '/recommandations/copil', badge: counts?.recommandations.copil },
        { id: 'reformes', label: 'Réformes', to: '/recommandations/reformes', badge: counts?.recommandations.reformes },
        { id: 'cngi', label: 'CNGI', to: '/recommandations/cngi', badge: counts?.recommandations.cngi },
      ],
    },
    { id: 'reunions-tech', label: 'Suivi Réunions techniques', icon: Calendar, to: '/reunions-techniques', badge: counts?.reunionsTechniques },
    { id: 'missions', label: 'Suivi missions terrain', icon: MapPin, to: '/missions-terrain', badge: counts?.missionsTerrain },
    { id: 'interpellations', label: 'Interpellations parlementaires', icon: Mic, to: '/interpellations', badge: counts?.interpellations },
    { id: 'par-direction', label: 'Répartition par direction', icon: Building2, to: '/par-direction' },
    { id: 'guide', label: "Guide d'utilisation", icon: BookOpen, to: '/guide' },
  ];
}

const NAV_BS: NavItem[] = [
  { id: 'bs-liste', label: 'File de travail', icon: Inbox, to: '/bs/liste' },
  { id: 'bs-alertes', label: 'Mes alertes', icon: Bell, to: '/bs/alertes' },
  { id: 'bs-fiche', label: 'Nouvelle directive', icon: FilePlus, to: '/bs/fiche' },
  { id: 'bs-reco-new', label: 'Nouvelle recommandation', icon: FilePlus, to: '/bs/recommandation/new' },
  { id: 'bs-rencontre', label: 'Nouvelle rencontre', icon: CalendarPlus, to: '/bs/rencontre' },
  { id: 'bs-matrice', label: 'Saisie matrices', icon: Grid3x3, to: '/bs/matrice' },
  { id: 'bs-reunion', label: 'Réunion / mission', icon: CloudRain, to: '/bs/reunion' },
  { id: 'bs-import', label: 'Importer Excel', icon: Upload, to: '/bs/import' },
  { id: 'bs-export', label: 'Export & rapports', icon: Download, to: '/bs/export' },
  { id: 'bs-users', label: 'Utilisateurs', icon: Users, to: '/admin/users' },
  { id: 'bs-config', label: 'Configuration', icon: Settings, to: '/bs/config' },
  { id: 'bs-guide', label: "Guide d'utilisation", icon: BookOpen, to: '/guide' },
];

interface SidebarProps {
  mode: 'sg' | 'bs';
  onModeChange: (mode: 'sg' | 'bs') => void;
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ mode, onModeChange, isOpen = false, onClose }: SidebarProps) {
  const userRole = useAuthStore((s) => s.user?.role);
  const counts = useApi(() => api.get<NavCounts>('/dashboard/nav-counts'), []);
  const baseItems = mode === 'sg' ? buildNavSg(counts.data) : NAV_BS;
  // Filtres role-based des entrees de menu :
  //  - bs-users     -> admin uniquement
  //  - bs-config    -> admin + bs
  //  - sg-validation -> admin + sg
  const navItems = baseItems.filter((it) => {
    if ('id' in it && it.id === 'bs-users') return userRole === 'admin';
    if ('id' in it && it.id === 'bs-config') return userRole === 'admin' || userRole === 'bs';
    if ('id' in it && it.id === 'sg-validation') return userRole === 'admin' || userRole === 'sg';
    return true;
  });
  const groupLabel = mode === 'sg' ? 'VUE SG' : 'ESPACE BUREAU DE SUIVI';

  return (
    <aside
      className={cn(
        // Drawer mobile : positionne en absolu, sort de la gauche en translate
        'fixed inset-y-0 left-0 z-50 w-[248px]',
        'transform transition-transform duration-300 ease-in-out',
        isOpen ? 'translate-x-0' : '-translate-x-full',
        // Desktop : reprend une place dans le flex parent, slide ou cache via lg:hidden
        'lg:static lg:translate-x-0 lg:transition-none lg:z-auto lg:flex-shrink-0',
        !isOpen && 'lg:hidden',
        // Style commun
        'bg-sidebar text-sidebar-fg flex flex-col h-screen overflow-y-auto',
      )}
      aria-label="Navigation principale"
    >
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-white/10">
        <img
          src="/logo.png"
          alt="Focus MHA"
          className="w-10 h-10 rounded-lg bg-white object-contain p-0.5"
        />
        <div className="text-sm leading-tight flex-1 min-w-0">
          <div className="text-white font-semibold">MHA · Suivi</div>
          <div className="text-sidebar-muted text-xs">Bureau de Suivi</div>
        </div>
        {/* Close button (mobile uniquement — sur desktop on utilise le hamburger Topbar) */}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer le menu"
            className="lg:hidden p-1.5 text-sidebar-muted hover:text-white hover:bg-white/10 rounded transition-colors"
          >
            <X className="w-4 h-4" strokeWidth={1.8} />
          </button>
        )}
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
      {item.badge !== undefined && item.badge !== 0 && (
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
  // Seuls admin et bs peuvent basculer entre SG et BS. Les autres (sg, reader)
  // sont figes sur leur vue par defaut.
  const canSwitch = user?.role === 'admin' || user?.role === 'bs';
  return (
    <div className="mt-auto mx-2 mb-3.5">
      <div className="text-xs text-sidebar-muted px-2 mb-1">{user?.fullName ?? 'Utilisateur'}</div>
      {canSwitch ? (
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
      ) : (
        <div className="text-[11px] text-sidebar-muted px-2 italic">
          {user?.role === 'sg' ? 'Profil Secrétaire général' : 'Profil lecture seule'}
        </div>
      )}
    </div>
  );
}
