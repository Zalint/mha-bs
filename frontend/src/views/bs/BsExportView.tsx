import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Download,
  FileSpreadsheet,
  Landmark,
  Layers,
  Package,
  ShieldAlert,
  Trash2,
  X,
} from 'lucide-react';
import { type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { ApiClientError, api } from '../../lib/apiClient.js';
import { cn } from '../../lib/cn.js';
import { env } from '../../lib/env.js';
import { useAuthStore } from '../../stores/authStore.js';

type Scope = 'all' | 'directives' | 'recommandations' | 'activite' | 'projets';

interface CardDef {
  scope: Scope;
  title: string;
  description: string;
  sheets: string[];
  icon: LucideIcon;
  accent: string;
  primary?: boolean;
}

const CARDS: CardDef[] = [
  {
    scope: 'all',
    title: 'Tout exporter',
    description:
      "Un classeur unique avec une feuille Sommaire + toutes les données (directives, recommandations, réunions, missions). Compatible avec la fonction d'import.",
    sheets: ['Sommaire', 'PLAN', 'Recommandations', 'Réunions techniques', 'Missions terrain'],
    icon: Package,
    accent: 'bg-primary-100 text-primary-700 border-primary',
    primary: true,
  },
  {
    scope: 'directives',
    title: 'Directives présidentielles',
    description:
      'Toutes les directives issues des Conseils des ministres, Conseils inter-ministériels et Coordinations SGG/SG, avec leur rencontre source.',
    sheets: ['PLAN'],
    icon: Landmark,
    accent: 'bg-success-bg text-success border-success',
  },
  {
    scope: 'recommandations',
    title: 'Recommandations MHA',
    description:
      'Recommandations de toutes les matrices (COPIL, CNGI, Réformes) avec état, observations, priorité et échéance.',
    sheets: ['Recommandations'],
    icon: ClipboardList,
    accent: 'bg-warning-bg text-warning border-warning',
  },
  {
    scope: 'activite',
    title: 'Activité du MHA',
    description:
      'Réunions techniques + missions terrain : dates, thèmes, sous-secteurs, COPIL, participants, constats, géolocalisation.',
    sheets: ['Réunions techniques', 'Missions terrain'],
    icon: Activity,
    accent: 'bg-danger-bg text-danger border-danger',
  },
  {
    scope: 'projets',
    title: 'Projets COPIL (une feuille par projet)',
    description:
      'Une feuille Excel par projet COPIL (PROGEP II, PISEA, PASEA-RD, PDBH, PROMOREN…). Chaque feuille liste les recommandations du projet, avec état, échéance et observations.',
    sheets: ['<une feuille par projet>'],
    icon: Layers,
    accent: 'bg-primary-100 text-primary-700 border-primary',
  },
];

interface WipeResult {
  ok: boolean;
  totalDeleted: number;
  before: Record<string, number>;
  tables: string[];
}

export function BsExportView() {
  const [downloading, setDownloading] = useState<Scope | null>(null);
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin';

  // Flow Vider la base
  const [wipeStep, setWipeStep] = useState<'idle' | 'backup' | 'confirm' | 'wiping' | 'done'>(
    'idle',
  );
  const [wipeConfirmation, setWipeConfirmation] = useState('');
  const [wipeResult, setWipeResult] = useState<WipeResult | null>(null);

  const downloadExport = async (scope: Scope): Promise<string | null> => {
    const url = `${env.apiBaseUrl.replace(/\/$/, '')}/export?scope=${scope}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      credentials: 'include',
    });
    if (!res.ok) {
      throw new ApiClientError(res.status, 'EXPORT_ERROR', `Erreur HTTP ${res.status}`);
    }
    const blob = await res.blob();
    const cd = res.headers.get('Content-Disposition') ?? '';
    const match = cd.match(/filename="([^"]+)"/);
    const filename = match?.[1] ?? `mha-export-${scope}.xlsx`;

    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(blobUrl);
    return filename;
  };

  const handleExport = async (scope: Scope): Promise<void> => {
    setDownloading(scope);
    try {
      const filename = await downloadExport(scope);
      toast.success(`Téléchargement de ${filename}`);
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Échec de l'export");
    } finally {
      setDownloading(null);
    }
  };

  const startWipeFlow = async (): Promise<void> => {
    setWipeStep('backup');
    setWipeConfirmation('');
    setWipeResult(null);
    try {
      const filename = await downloadExport('all');
      toast.success(`Backup automatique : ${filename}`);
      setWipeStep('confirm');
    } catch (err) {
      toast.error(
        err instanceof ApiClientError
          ? `Backup échoué : ${err.message}`
          : 'Backup automatique échoué. Wipe annulé pour ta sécurité.',
      );
      setWipeStep('idle');
    }
  };

  const cancelWipe = (): void => {
    if (wipeStep === 'wiping') return;
    setWipeStep('idle');
    setWipeConfirmation('');
    setWipeResult(null);
  };

  const handleConfirmWipe = async (): Promise<void> => {
    if (wipeConfirmation !== 'VIDER') return;
    setWipeStep('wiping');
    try {
      const res = await api.post<WipeResult>('/admin/wipe-database', { confirmation: 'VIDER' });
      setWipeResult(res);
      setWipeStep('done');
      toast.success(`Base vidée · ${res.totalDeleted} lignes supprimées`);
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Échec du wipe.');
      setWipeStep('confirm');
    }
  };

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-semibold text-fg leading-tight flex items-center gap-2.5">
        <FileSpreadsheet className="w-6 h-6 text-primary" strokeWidth={1.8} />
        Export & rapports
      </h1>
      <p className="text-sm text-fg-muted mt-1 mb-6">
        Télécharge tes données au format Excel (.xlsx). Chaque export contient les données à jour
        de la base, avec mise en forme professionnelle (en-têtes colorés, états surlignés, lignes
        figées).
      </p>

      <div className="grid gap-3 grid-cols-1 lg:grid-cols-2">
        {CARDS.map((c) => {
          const Icon = c.icon;
          const isLoading = downloading === c.scope;
          return (
            <div
              key={c.scope}
              className={cn(
                'bg-surface border rounded-xl p-5 flex flex-col',
                c.primary ? 'border-primary border-2' : 'border-border',
              )}
            >
              <div className="flex items-start gap-3 mb-3">
                <div
                  className={cn(
                    'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
                    c.accent.split(' ').slice(0, 2).join(' '),
                  )}
                >
                  <Icon className="w-5 h-5" strokeWidth={1.8} />
                </div>
                <div className="flex-1">
                  <h2 className="text-base font-semibold text-fg leading-tight">
                    {c.title}
                    {c.primary && (
                      <span className="ml-2 text-[10.5px] uppercase tracking-wider bg-primary text-white px-1.5 py-0.5 rounded">
                        Tout
                      </span>
                    )}
                  </h2>
                  <p className="text-xs text-fg-muted mt-1 leading-relaxed">{c.description}</p>
                </div>
              </div>
              <div className="mb-4 text-xs text-fg-muted">
                <span className="font-semibold">Feuilles :</span>{' '}
                {c.sheets.map((s) => (
                  <span
                    key={s}
                    className="inline-block bg-muted px-2 py-0.5 rounded font-mono text-[10.5px] mr-1 mb-1"
                  >
                    {s}
                  </span>
                ))}
              </div>
              <button
                type="button"
                onClick={() => void handleExport(c.scope)}
                disabled={isLoading || downloading !== null}
                className={cn(
                  'mt-auto btn',
                  c.primary ? 'btn-primary' : 'btn-secondary',
                  isLoading && 'opacity-70',
                )}
              >
                <Download className="w-4 h-4" />
                {isLoading ? 'Génération…' : 'Télécharger'}
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-6 bg-primary-50 border-l-4 border-primary px-4 py-3 text-sm text-fg-2 rounded-r">
        <b className="text-primary-700">Astuce :</b> tous les formats d&apos;export sont compatibles
        avec la fonction d&apos;import. Tu peux donc faire un cycle{' '}
        <i>export → modifier → re-import</i> en gardant la cohérence des données (les codes uniques
        préviennent les doublons). L&apos;export <b>"Projets COPIL"</b> est particulièrement utile
        pour partager une feuille de suivi dédiée à un chef de projet.
      </div>

      {/* Zone dangereuse — admin uniquement */}
      {isAdmin && (
        <div className="mt-10 border-2 border-danger rounded-xl p-5 bg-danger-bg/30">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-danger-bg text-danger flex items-center justify-center flex-shrink-0">
              <ShieldAlert className="w-5 h-5" strokeWidth={1.8} />
            </div>
            <div className="flex-1">
              <h2 className="text-base font-semibold text-danger leading-tight">
                Zone dangereuse · Administrateur
              </h2>
              <p className="text-xs text-fg-2 mt-1 leading-relaxed">
                Vider la base supprime <b>toutes</b> les directives, recommandations, réunions,
                missions et interpellations. Les utilisateurs et référentiels sont préservés. Un
                export complet sera <b>automatiquement téléchargé</b> avant le wipe pour servir de
                backup.
              </p>
              <button
                type="button"
                onClick={() => void startWipeFlow()}
                disabled={wipeStep !== 'idle'}
                className="mt-3 btn bg-danger text-white hover:bg-danger/90 disabled:opacity-60"
              >
                <Trash2 className="w-4 h-4" />
                {wipeStep === 'backup'
                  ? 'Backup en cours…'
                  : wipeStep === 'idle'
                    ? 'Vider la base (avec backup auto)'
                    : 'Wipe en cours…'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmation wipe */}
      {(wipeStep === 'confirm' || wipeStep === 'wiping') && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={cancelWipe}
        >
          <div
            className="bg-surface rounded-xl border-2 border-danger w-full max-w-lg shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between px-5 py-4 border-b border-border bg-danger-bg/40">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-danger text-white flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-danger">Confirmer le vidage</h2>
                  <p className="text-xs text-fg-2 mt-1">
                    Action <b>irréversible</b>. Le backup vient d&apos;être téléchargé.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={cancelWipe}
                disabled={wipeStep === 'wiping'}
                className="p-1 text-fg-muted hover:text-fg rounded hover:bg-muted disabled:opacity-50"
                aria-label="Annuler"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div className="bg-success-bg border-l-4 border-success px-3 py-2 text-xs text-fg-2 rounded-r flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
                <div>
                  <b>Backup téléchargé.</b> Vérifie que le fichier{' '}
                  <code className="font-mono">mha-export-all-*.xlsx</code> est bien sur ton disque
                  avant de continuer.
                </div>
              </div>
              <p className="text-sm text-fg-2">
                Pour confirmer, tape <code className="font-mono bg-muted px-1.5 py-0.5 rounded text-danger font-bold">VIDER</code>{' '}
                dans le champ ci-dessous :
              </p>
              <input
                type="text"
                value={wipeConfirmation}
                onChange={(e) => setWipeConfirmation(e.target.value)}
                disabled={wipeStep === 'wiping'}
                placeholder="VIDER"
                autoFocus
                className="w-full px-3 py-2 border-2 border-danger/50 rounded font-mono text-center text-lg focus:border-danger focus:outline-none disabled:opacity-50"
              />
              <ul className="text-xs text-fg-muted space-y-1 mt-2">
                <li>• Directives + rencontres seront supprimées</li>
                <li>• Toutes les recommandations matrices seront supprimées</li>
                <li>• Réunions techniques + missions terrain + interpellations seront supprimées</li>
                <li>
                  • <b>Préservés :</b> utilisateurs, référentiels, directions, députés, sessions
                </li>
              </ul>
            </div>
            <div className="px-5 py-3 border-t border-border flex justify-end gap-2">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={cancelWipe}
                disabled={wipeStep === 'wiping'}
              >
                Annuler
              </button>
              <button
                type="button"
                className="btn bg-danger text-white hover:bg-danger/90 disabled:opacity-50"
                onClick={() => void handleConfirmWipe()}
                disabled={wipeConfirmation !== 'VIDER' || wipeStep === 'wiping'}
              >
                <Trash2 className="w-4 h-4" />
                {wipeStep === 'wiping' ? 'Suppression…' : 'Confirmer le vidage'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de succès post-wipe */}
      {wipeStep === 'done' && wipeResult && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={cancelWipe}
        >
          <div
            className="bg-surface rounded-xl border border-success w-full max-w-lg shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 px-5 py-4 border-b border-border">
              <div className="w-10 h-10 rounded-full bg-success text-white flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h2 className="text-base font-semibold text-success">Base vidée avec succès</h2>
                <p className="text-xs text-fg-muted mt-1">
                  {wipeResult.totalDeleted} ligne{wipeResult.totalDeleted > 1 ? 's' : ''} supprimée
                  {wipeResult.totalDeleted > 1 ? 's' : ''} au total.
                </p>
              </div>
            </div>
            <div className="px-5 py-4">
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                {Object.entries(wipeResult.before)
                  .filter(([, n]) => n > 0)
                  .map(([table, n]) => (
                    <div
                      key={table}
                      className="flex justify-between bg-muted px-2.5 py-1.5 rounded"
                    >
                      <span className="font-mono text-fg-muted">{table}</span>
                      <span className="font-bold tabular-nums">{n}</span>
                    </div>
                  ))}
              </div>
            </div>
            <div className="px-5 py-3 border-t border-border flex justify-end">
              <button type="button" className="btn btn-primary" onClick={cancelWipe}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
