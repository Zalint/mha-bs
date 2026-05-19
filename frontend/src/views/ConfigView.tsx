import { Plus, Settings, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { ConfirmDialog } from '../components/ui/ConfirmDialog.js';
import { FormField } from '../components/ui/FormField.js';
import { Spinner } from '../components/ui/Spinner.js';
import { useApi } from '../hooks/useApi.js';
import { type Referentiel } from '../hooks/useReferentiel.js';
import { ApiClientError, api } from '../lib/apiClient.js';
import { cn } from '../lib/cn.js';

interface RefType {
  codeType: string;
  label: string;
  description: string;
  readOnly?: boolean;
}

const REF_TYPES: RefType[] = [
  {
    codeType: 'sousSecteur',
    label: 'Sous-secteurs',
    description: 'Domaines metier pour les reunions et missions (Eau, GIRE, Assainissement, etc.)',
  },
  {
    codeType: 'copilProjet',
    label: 'COPIL / Projets',
    description: 'Comites de pilotage et projets du portefeuille MHA (PROGEP, PISEA, PASEA-RD, ...)',
  },
  {
    codeType: 'typeOuvrage',
    label: "Types d'ouvrage",
    description: "Categories d'ouvrages visites lors des missions terrain",
  },
  {
    codeType: 'etatOuvrage',
    label: "Etats d'ouvrage",
    description: "Etats possibles pour un ouvrage (fonctionnel, maintenance, hors service, ...)",
  },
  {
    codeType: 'typeCause',
    label: 'Types de cause',
    description: "Causes des retards d'execution des directives",
  },
  {
    codeType: 'lieuReunion',
    label: 'Lieux de reunion',
    description: 'Salles et lieux frequents pour les reunions techniques',
  },
  {
    codeType: 'regionSenegal',
    label: 'Regions du Senegal',
    description: 'Decoupage administratif (14 regions) pour la localisation des missions',
  },
  {
    codeType: 'typeRencontre',
    label: 'Types de rencontre',
    description: 'Conseils, COPIL, CNGI, reunions techniques, commissions AN',
  },
  {
    codeType: 'typeMatrice',
    label: 'Types de matrice',
    description: '8 matrices initiales : 5 COPIL + 2 reformes + CNGI. Extensible.',
  },
  {
    codeType: 'typeInterpellation',
    label: "Types d'interpellation",
    description: 'Question orale, ecrite, interpellation en commission',
  },
  {
    codeType: 'etatInterpellation',
    label: "Etats d'interpellation",
    description: 'Recue, en preparation, a valider, repondue',
  },
  {
    codeType: 'groupeParlementaire',
    label: 'Groupes parlementaires',
    description: "Groupes politiques representes a l'Assemblee Nationale",
  },
];

export function ConfigView() {
  const [activeType, setActiveType] = useState<string>('sousSecteur');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const query = useApi(
    () => api.get<{ items: Referentiel[] }>('/referentiels', { query: { codeType: activeType, includeInactive: 'true' } }),
    [activeType],
  );

  const items = useMemo(() => query.data?.items ?? [], [query.data]);
  const activeMeta = REF_TYPES.find((t) => t.codeType === activeType);

  const handleDelete = async (): Promise<void> => {
    if (!confirmDeleteId) return;
    try {
      await api.delete(`/referentiels/${confirmDeleteId}`);
      toast.success('Entree supprimee');
      query.refetch();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Erreur');
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-3">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-primary-100 text-primary-700 rounded text-[11.5px] font-semibold uppercase tracking-wider mb-2">
            <Settings className="w-3.5 h-3.5" /> Configuration
          </div>
          <h1 className="text-2xl font-semibold text-fg leading-tight">Referentiels</h1>
          <p className="text-sm text-fg-muted mt-1">
            Gerez les listes utilisees dans toute l'application : sous-secteurs, COPIL, types d'ouvrage, etc.
          </p>
        </div>
      </div>

      {/* Type selector */}
      <div className="grid gap-2.5 mb-5 grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-6">
        {REF_TYPES.map((t) => (
          <button
            key={t.codeType}
            type="button"
            onClick={() => setActiveType(t.codeType)}
            className={cn(
              'bg-surface border rounded p-3 cursor-pointer text-left transition-colors',
              activeType === t.codeType
                ? 'border-primary bg-primary-50'
                : 'border-border hover:border-primary',
            )}
          >
            <div className="text-sm font-semibold text-fg">{t.label}</div>
            <div className="text-[11px] text-fg-muted mt-1 leading-tight">{t.description}</div>
          </button>
        ))}
      </div>

      {/* Add form */}
      <AddReferentielForm codeType={activeType} onCreated={() => query.refetch()} />

      {/* List */}
      <div className="bg-surface border border-border rounded-lg overflow-hidden mt-4">
        <div className="bg-surface2 px-4 py-3 border-b border-border flex items-center">
          <h2 className="text-md font-semibold">{activeMeta?.label}</h2>
          <span className="ml-2 text-sm text-fg-muted font-mono">{items.length} entree(s)</span>
        </div>
        {query.isLoading ? (
          <Spinner label="Chargement..." />
        ) : items.length === 0 ? (
          <div className="text-center text-fg-muted py-10 text-sm">
            Aucune valeur enregistree pour ce type.
          </div>
        ) : (
          <table className="w-full text-sm border-separate border-spacing-0">
            <thead className="bg-surface2">
              <tr>
                <th className="text-left px-4 py-2.5 text-[11.5px] uppercase tracking-wider text-fg-muted border-b border-border w-32">
                  Code
                </th>
                <th className="text-left px-4 py-2.5 text-[11.5px] uppercase tracking-wider text-fg-muted border-b border-border">
                  Libelle
                </th>
                <th className="text-center px-4 py-2.5 text-[11.5px] uppercase tracking-wider text-fg-muted border-b border-border w-20">
                  Ordre
                </th>
                <th className="text-center px-4 py-2.5 text-[11.5px] uppercase tracking-wider text-fg-muted border-b border-border w-20">
                  Actif
                </th>
                <th className="w-12 border-b border-border" />
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <RefRow key={it.id} item={it} onChange={() => query.refetch()} onDelete={() => setConfirmDeleteId(it.id)} />
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmDialog
        open={confirmDeleteId !== null}
        onOpenChange={(o) => !o && setConfirmDeleteId(null)}
        title="Supprimer cette entree ?"
        description="Cette action est irreversible. Si l'entree est utilisee ailleurs dans l'application, les references existantes ne seront pas modifiees mais elle n'apparaitra plus dans les listes."
        confirmLabel="Supprimer"
        variant="danger"
        onConfirm={() => handleDelete()}
      />
    </div>
  );
}

interface RefRowProps {
  item: Referentiel;
  onChange: () => void;
  onDelete: () => void;
}

function RefRow({ item, onChange, onDelete }: RefRowProps) {
  const [label, setLabel] = useState(item.label);
  const [ordre, setOrdre] = useState(item.ordreAffichage);
  const [isActive, setIsActive] = useState(item.isActive);

  const persist = async (patch: Partial<{ label: string; ordreAffichage: number; isActive: boolean }>): Promise<void> => {
    try {
      await api.put(`/referentiels/${item.id}`, patch);
      onChange();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Erreur');
    }
  };

  return (
    <tr className={cn('border-b border-border last:border-0 hover:bg-muted', !isActive && 'opacity-60')}>
      <td className="px-4 py-2.5 font-mono text-xs">{item.code}</td>
      <td className="px-4 py-2.5">
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={() => label !== item.label && void persist({ label })}
          className="w-full px-2 py-1 text-sm border border-transparent hover:border-border focus:border-primary focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20 rounded bg-transparent"
        />
      </td>
      <td className="px-4 py-2.5 text-center">
        <input
          type="number"
          value={ordre}
          onChange={(e) => setOrdre(Number(e.target.value))}
          onBlur={() => ordre !== item.ordreAffichage && void persist({ ordreAffichage: ordre })}
          className="w-16 px-2 py-1 text-sm text-center border border-transparent hover:border-border focus:border-primary focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20 rounded bg-transparent font-mono"
        />
      </td>
      <td className="px-4 py-2.5 text-center">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(e) => {
            const next = e.target.checked;
            setIsActive(next);
            void persist({ isActive: next });
          }}
          className="accent-primary"
        />
      </td>
      <td className="px-2 py-2.5 text-center">
        <button
          type="button"
          onClick={onDelete}
          className="text-fg-muted hover:text-danger p-1"
          title="Supprimer"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </td>
    </tr>
  );
}

function AddReferentielForm({ codeType, onCreated }: { codeType: string; onCreated: () => void }) {
  const [code, setCode] = useState('');
  const [label, setLabel] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!code.trim() || !label.trim()) {
      toast.error('Code et libelle sont obligatoires');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/referentiels', { codeType, code: code.trim(), label: label.trim() });
      toast.success('Entree creee');
      setCode('');
      setLabel('');
      onCreated();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Erreur');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className="bg-surface border border-border rounded-lg p-4 flex flex-wrap items-end gap-3"
    >
      <FormField label="Code (technique)" htmlFor="code">
        <input
          id="code"
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="ex. nouveauSousSecteur"
          className="input font-mono w-52"
        />
      </FormField>
      <FormField label="Libelle (affiche)" htmlFor="label" className="flex-1 min-w-[240px]">
        <input
          id="label"
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="ex. Nouveau sous-secteur"
          className="input"
        />
      </FormField>
      <button type="submit" disabled={submitting} className="btn btn-primary">
        <Plus className="w-3.5 h-3.5" />
        {submitting ? 'Creation...' : 'Ajouter'}
      </button>
    </form>
  );
}
