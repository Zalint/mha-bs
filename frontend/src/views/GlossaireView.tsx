/**
 * GlossaireView — référence centralisée des projets du MHA.
 *
 * Affiche les fiches projet (PROGEP II, PISEA, PDBH, PROMOREN, GTE…) avec :
 *   - recherche full-text (code + nom + description + domaines + régions)
 *   - filtres par catégorie + région
 *   - cartes compactes avec chips + bouton "Voir le détail" qui développe
 *     le longDescription
 *
 * Source des données : frontend/src/data/projetsGlossaire.ts (statique).
 * Plus tard, ces données pourront être migrées vers une table éditable.
 */

import {
  BookOpen,
  Calendar,
  ChevronDown,
  ChevronUp,
  Coins,
  MapPin,
  Search,
  Sparkles,
  Target,
  Users,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import { cn } from '../lib/cn.js';
import {
  PROJETS_CATEGORIES,
  PROJETS_GLOSSAIRE,
  PROJETS_REGIONS,
  type ProjetGlossaire,
} from '../data/projetsGlossaire.js';

/** Normalise une chaine pour la recherche (NFD, lowercase, sans accents). */
function normalize(s: string | null | undefined): string {
  return (s ?? '')
    .toString()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

export function GlossaireView() {
  const [searchQuery, setSearchQuery] = useState('');
  const [categorieFilter, setCategorieFilter] = useState<string>('tous');
  const [regionFilter, setRegionFilter] = useState<string>('tous');
  const [expandedCodes, setExpandedCodes] = useState<Set<string>>(new Set());

  const toggleExpand = (code: string): void => {
    const next = new Set(expandedCodes);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    setExpandedCodes(next);
  };

  const filtered = useMemo(() => {
    const needle = normalize(searchQuery);
    return PROJETS_GLOSSAIRE.filter((p) => {
      if (categorieFilter !== 'tous' && p.categorie !== categorieFilter) return false;
      if (regionFilter !== 'tous' && !p.regions.includes(regionFilter)) return false;
      if (needle === '') return true;
      const haystack = [
        p.code,
        p.fullName,
        p.shortDescription,
        p.longDescription,
        ...(p.domaines ?? []),
        ...(p.regions ?? []),
        ...(p.villes ?? []),
        ...(p.partenaires ?? []),
      ]
        .map(normalize)
        .join(' ');
      return haystack.includes(needle);
    });
  }, [searchQuery, categorieFilter, regionFilter]);

  const hasActiveFilter =
    searchQuery !== '' || categorieFilter !== 'tous' || regionFilter !== 'tous';

  const resetFilters = (): void => {
    setSearchQuery('');
    setCategorieFilter('tous');
    setRegionFilter('tous');
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-2xl font-semibold text-fg leading-tight flex items-center gap-2.5">
          <BookOpen className="w-6 h-6 text-primary" strokeWidth={1.8} />
          Glossaire des projets MHA
        </h1>
        <p className="text-sm text-fg-muted mt-1">
          Fiches synthétiques des principaux projets pilotés ou suivis par le Ministère
          (sécurité de l'eau, assainissement, gestion des inondations, transferts d'eau…)
        </p>
      </div>

      {/* Barre de recherche + filtres */}
      <div className="bg-surface border border-border rounded-xl p-4 mb-5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-fg-muted pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher (code, ville, partenaire…)"
              className="input pl-8 pr-8 w-full text-sm"
              aria-label="Rechercher dans le glossaire"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-fg-muted hover:text-fg p-0.5"
                aria-label="Effacer la recherche"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <select
            value={categorieFilter}
            onChange={(e) => setCategorieFilter(e.target.value)}
            className="input input-sm text-xs"
            aria-label="Filtrer par catégorie"
          >
            <option value="tous">Toutes les catégories</option>
            {PROJETS_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            value={regionFilter}
            onChange={(e) => setRegionFilter(e.target.value)}
            className="input input-sm text-xs"
            aria-label="Filtrer par région"
          >
            <option value="tous">Toutes les régions</option>
            {PROJETS_REGIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <span className="text-xs text-fg-muted font-mono ml-auto">
            {filtered.length} / {PROJETS_GLOSSAIRE.length} projet{PROJETS_GLOSSAIRE.length > 1 ? 's' : ''}
          </span>
          {hasActiveFilter && (
            <button
              type="button"
              onClick={resetFilters}
              className="text-xs text-fg-muted hover:text-fg underline"
            >
              Réinitialiser
            </button>
          )}
        </div>
      </div>

      {/* Grille de projets */}
      {filtered.length === 0 ? (
        <div className="bg-surface border border-border rounded-xl py-12 text-center text-sm text-fg-muted">
          Aucun projet ne correspond à votre recherche.
          <br />
          <button
            type="button"
            onClick={resetFilters}
            className="text-primary hover:underline mt-2"
          >
            Réinitialiser les filtres
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((p) => (
            <ProjetCard
              key={p.code}
              projet={p}
              expanded={expandedCodes.has(p.code)}
              onToggle={() => toggleExpand(p.code)}
            />
          ))}
        </div>
      )}

      <p className="text-xs text-fg-muted italic mt-4">
        Sources : communiqués ministériels, articles de presse spécialisés. À mettre
        à jour à chaque évolution majeure (lancement officiel, % d'avancement, etc.).
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Carte projet
// ---------------------------------------------------------------------------

interface ProjetCardProps {
  projet: ProjetGlossaire;
  expanded: boolean;
  onToggle: () => void;
}

function ProjetCard({ projet, expanded, onToggle }: ProjetCardProps) {
  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden hover:shadow-md transition-shadow flex flex-col">
      {/* Header de carte */}
      <div className="px-5 pt-4 pb-3 border-b border-border bg-surface2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-block px-2 py-0.5 rounded bg-primary text-white text-xs font-bold font-mono tracking-wide">
                {projet.code}
              </span>
              <span className="text-[10.5px] uppercase tracking-wider text-fg-muted font-medium">
                {projet.categorie}
              </span>
            </div>
            <h2 className="text-md font-semibold text-fg leading-snug">{projet.fullName}</h2>
          </div>
        </div>
      </div>

      {/* Corps */}
      <div className="px-5 py-3 flex-1 flex flex-col gap-3">
        <p className="text-sm text-fg-2 leading-relaxed">{projet.shortDescription}</p>

        {/* Méta — chips */}
        <div className="space-y-1.5">
          {projet.regions.length > 0 && (
            <MetaRow icon={MapPin} label="Régions">
              {projet.regions.map((r) => (
                <Chip key={r}>{r}</Chip>
              ))}
            </MetaRow>
          )}
          {projet.domaines.length > 0 && (
            <MetaRow icon={Target} label="Domaines">
              {projet.domaines.map((d) => (
                <Chip key={d} variant="soft">
                  {d}
                </Chip>
              ))}
            </MetaRow>
          )}
          {projet.budget && (
            <MetaRow icon={Coins} label="Budget">
              <span className="text-xs font-mono text-fg-2">{projet.budget}</span>
            </MetaRow>
          )}
          {projet.periode && (
            <MetaRow icon={Calendar} label="Période">
              <span className="text-xs text-fg-2">{projet.periode}</span>
            </MetaRow>
          )}
          {projet.statut && (
            <MetaRow icon={Sparkles} label="Statut">
              <span className="text-xs text-fg-2">{projet.statut}</span>
            </MetaRow>
          )}
        </div>

        {/* Détail expansible */}
        {expanded && (
          <div className="mt-1 pt-3 border-t border-border space-y-3">
            <div className="text-sm text-fg-2 leading-relaxed whitespace-pre-line">
              {projet.longDescription}
            </div>
            {projet.partenaires && projet.partenaires.length > 0 && (
              <MetaRow icon={Users} label="Partenaires">
                {projet.partenaires.map((p) => (
                  <Chip key={p} variant="soft">
                    {p}
                  </Chip>
                ))}
              </MetaRow>
            )}
            {projet.villes && projet.villes.length > 0 && (
              <MetaRow icon={MapPin} label="Villes / sites">
                {projet.villes.map((v) => (
                  <Chip key={v} variant="soft">
                    {v}
                  </Chip>
                ))}
              </MetaRow>
            )}
            {projet.sources && projet.sources.length > 0 && (
              <div className="text-[11px] text-fg-muted italic">
                Sources : {projet.sources.map((s) => s.label).join(' · ')}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer : toggle */}
      <button
        type="button"
        onClick={onToggle}
        className="text-xs font-medium text-primary hover:bg-primary/5 px-5 py-2.5 border-t border-border flex items-center justify-center gap-1 transition-colors"
      >
        {expanded ? (
          <>
            Replier <ChevronUp className="w-3.5 h-3.5" />
          </>
        ) : (
          <>
            Voir le détail <ChevronDown className="w-3.5 h-3.5" />
          </>
        )}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Petits helpers de présentation
// ---------------------------------------------------------------------------

interface MetaRowProps {
  icon: typeof MapPin;
  label: string;
  children: React.ReactNode;
}

function MetaRow({ icon: Icon, label, children }: MetaRowProps) {
  return (
    <div className="flex items-start gap-2 flex-wrap text-xs">
      <span className="inline-flex items-center gap-1 text-fg-muted min-w-[5.5rem]">
        <Icon className="w-3 h-3" /> {label}
      </span>
      <div className="flex flex-wrap gap-1 flex-1">{children}</div>
    </div>
  );
}

interface ChipProps {
  children: React.ReactNode;
  variant?: 'default' | 'soft';
}

function Chip({ children, variant = 'default' }: ChipProps) {
  return (
    <span
      className={cn(
        'inline-block px-2 py-0.5 rounded text-[11px] font-medium',
        variant === 'soft'
          ? 'bg-muted text-fg-2'
          : 'bg-primary-100 text-primary-700',
      )}
    >
      {children}
    </span>
  );
}
