import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import type { Rencontre } from '@mha-bs/shared';

import { useReferentiel } from '../../hooks/useReferentiel.js';
import { ApiClientError, api } from '../../lib/apiClient.js';
import { cn } from '../../lib/cn.js';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (rencontre: Rencontre) => void;
  defaultType?: string;
}

// Prefixes specifiques pour generer les codes auto. Fallback genere depuis le code lui-meme.
const TYPE_PREFIX: Record<string, string> = {
  conseilMinistres: 'CM',
  conseilInterMinisteriel: 'CI',
  coordinationSggSg: 'SG',
  copil: 'CO',
  cngi: 'CNGI',
  reunionTechnique: 'RT',
  commissionAn: 'CA',
};

function ymdToCompact(ymd: string): string {
  // "2026-03-04" → "20260304"
  return ymd.replace(/-/g, '');
}

function ymdToFrenchSlash(ymd: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd;
  const [y, m, d] = ymd.split('-');
  return `${d}/${m}/${y}`;
}

function prefixFromCode(code: string): string {
  if (TYPE_PREFIX[code]) return TYPE_PREFIX[code];
  // Fallback : retient les majuscules du camelCase, ou les 2-4 premieres lettres
  const upper = code.replace(/[a-z0-9]/g, '');
  return upper.length >= 2 ? upper.toUpperCase() : code.slice(0, 3).toUpperCase();
}

function generateCode(typeCode: string, dateYmd: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateYmd)) return '';
  return `${prefixFromCode(typeCode)}${ymdToCompact(dateYmd)}`;
}

function generateIntitule(typeLabel: string, dateYmd: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateYmd)) return '';
  return `${typeLabel.toUpperCase()} DU ${ymdToFrenchSlash(dateYmd)}`;
}

const todayYmd = (): string => {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export function NewRencontreModal({ open, onOpenChange, onCreated, defaultType = 'conseilMinistres' }: Props) {
  const typesRef = useReferentiel('typeRencontre');
  const [typeRencontre, setTypeRencontre] = useState<string>(defaultType);
  const [dateRencontre, setDateRencontre] = useState<string>(todayYmd());
  const [codeRencontre, setCodeRencontre] = useState<string>('');
  const [intitule, setIntitule] = useState<string>('');
  const [copilName, setCopilName] = useState<string>('');
  const [codeManuallyEdited, setCodeManuallyEdited] = useState(false);
  const [intituleManuallyEdited, setIntituleManuallyEdited] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Reset à chaque ouverture
  useEffect(() => {
    if (open) {
      setTypeRencontre(defaultType);
      setDateRencontre(todayYmd());
      setCodeRencontre('');
      setIntitule('');
      setCopilName('');
      setCodeManuallyEdited(false);
      setIntituleManuallyEdited(false);
    }
  }, [open, defaultType]);

  // Label du type courant (pour generer l'intitule par defaut)
  const currentTypeLabel = useMemo(() => {
    const found = typesRef.items.find((t) => t.code === typeRencontre);
    return found?.label ?? typeRencontre;
  }, [typesRef.items, typeRencontre]);

  // Auto-génère code et intitulé tant que l'utilisateur ne les a pas édités manuellement
  const suggestedCode = useMemo(() => generateCode(typeRencontre, dateRencontre), [typeRencontre, dateRencontre]);
  const suggestedIntitule = useMemo(
    () => generateIntitule(currentTypeLabel, dateRencontre),
    [currentTypeLabel, dateRencontre],
  );

  useEffect(() => {
    if (!codeManuallyEdited) setCodeRencontre(suggestedCode);
  }, [suggestedCode, codeManuallyEdited]);
  useEffect(() => {
    if (!intituleManuallyEdited) setIntitule(suggestedIntitule);
  }, [suggestedIntitule, intituleManuallyEdited]);

  const annee = useMemo(() => {
    const m = /^(\d{4})-/.exec(dateRencontre);
    return m ? Number(m[1]) : new Date().getUTCFullYear();
  }, [dateRencontre]);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!codeRencontre.trim() || !intitule.trim() || !dateRencontre) {
      toast.error('Code, intitulé et date sont obligatoires');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        typeRencontre,
        codeRencontre: codeRencontre.trim(),
        intitule: intitule.trim(),
        dateRencontre,
        annee,
        copilName: typeRencontre === 'copil' ? (copilName.trim() || null) : null,
      };
      const created = await api.post<Rencontre>('/rencontres', payload);
      toast.success(`Rencontre ${created.codeRencontre} créée`);
      onCreated(created);
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : 'Erreur de création';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-fg/40 backdrop-blur-sm z-50 animate-fade-up" />
        <Dialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50',
            'w-[min(94vw,560px)] bg-surface rounded-lg shadow-lg border border-border',
            'animate-fade-up',
          )}
        >
          <div className="flex items-start justify-between p-5 border-b border-border">
            <div>
              <Dialog.Title className="text-md font-semibold text-fg">
                Nouvelle rencontre
              </Dialog.Title>
              <Dialog.Description className="text-sm text-fg-muted mt-1">
                Le code et l'intitulé sont générés automatiquement à partir du type et de la date.
                Vous pouvez les modifier si besoin.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Fermer"
                className="text-fg-muted hover:text-fg p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </Dialog.Close>
          </div>

          <form onSubmit={(e) => void handleSubmit(e)} className="p-5 space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label htmlFor="new-renc-type" className="field-label">
                  Type de rencontre <span className="text-danger">*</span>
                </label>
                <select
                  id="new-renc-type"
                  className="select"
                  value={typeRencontre}
                  onChange={(e) => setTypeRencontre(e.target.value)}
                >
                  {typesRef.items.length === 0 ? (
                    <option value={typeRencontre}>Chargement…</option>
                  ) : (
                    typesRef.items.map((t) => (
                      <option key={t.id} value={t.code}>
                        {t.label}
                      </option>
                    ))
                  )}
                </select>
              </div>
              <div>
                <label htmlFor="new-renc-date" className="field-label">
                  Date <span className="text-danger">*</span>
                </label>
                <input
                  id="new-renc-date"
                  type="date"
                  className="input font-mono"
                  value={dateRencontre}
                  onChange={(e) => setDateRencontre(e.target.value)}
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="new-renc-code" className="field-label">
                Code rencontre <span className="text-danger">*</span>
              </label>
              <input
                id="new-renc-code"
                type="text"
                className="input font-mono max-w-[260px]"
                value={codeRencontre}
                onChange={(e) => {
                  setCodeRencontre(e.target.value);
                  setCodeManuallyEdited(true);
                }}
                placeholder="ex. CM20260304"
              />
              <p className="field-help">
                Suggéré : <code className="font-mono">{suggestedCode}</code>
                {codeManuallyEdited && (
                  <button
                    type="button"
                    onClick={() => {
                      setCodeManuallyEdited(false);
                      setCodeRencontre(suggestedCode);
                    }}
                    className="ml-2 text-primary underline-offset-2 hover:underline"
                  >
                    réinitialiser
                  </button>
                )}
              </p>
            </div>

            <div>
              <label htmlFor="new-renc-intitule" className="field-label">
                Intitulé <span className="text-danger">*</span>
              </label>
              <input
                id="new-renc-intitule"
                type="text"
                className="input"
                value={intitule}
                onChange={(e) => {
                  setIntitule(e.target.value);
                  setIntituleManuallyEdited(true);
                }}
                placeholder="ex. CONSEIL DES MINISTRES DU 04/03/2026"
              />
              {intituleManuallyEdited && (
                <p className="field-help">
                  <button
                    type="button"
                    onClick={() => {
                      setIntituleManuallyEdited(false);
                      setIntitule(suggestedIntitule);
                    }}
                    className="text-primary underline-offset-2 hover:underline"
                  >
                    Réinitialiser à : {suggestedIntitule}
                  </button>
                </p>
              )}
            </div>

            {typeRencontre === 'copil' && (
              <div>
                <label htmlFor="new-renc-copil" className="field-label">
                  Nom du COPIL
                </label>
                <input
                  id="new-renc-copil"
                  type="text"
                  className="input"
                  value={copilName}
                  onChange={(e) => setCopilName(e.target.value)}
                  placeholder="ex. PROGEP II, PISEA, PASEA-RD…"
                />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4 border-t border-border -mx-5 px-5">
              <Dialog.Close asChild>
                <button type="button" className="btn btn-ghost" disabled={submitting}>
                  Annuler
                </button>
              </Dialog.Close>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Création…' : 'Créer la rencontre'}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
