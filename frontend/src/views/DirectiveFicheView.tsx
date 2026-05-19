import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Loader2,
  MinusCircle,
  Plus,
  Save,
  Send,
  Trash2,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';

import {
  type Direction,
  type Directive,
  type DirectiveEtat,
  type Rencontre,
} from '@mha-bs/shared';

import { CommentSection } from '../components/directives/CommentSection.js';
import { NewRencontreModal } from '../components/directives/NewRencontreModal.js';
import { WorkflowStepper } from '../components/directives/WorkflowStepper.js';
import { ConfirmDialog } from '../components/ui/ConfirmDialog.js';
import { FormField } from '../components/ui/FormField.js';
import { RadioCards } from '../components/ui/RadioCards.js';
import { Spinner } from '../components/ui/Spinner.js';
import { StateBadge } from '../components/ui/StateBadge.js';
import { Textarea } from '../components/ui/Textarea.js';
import { useApi } from '../hooks/useApi.js';
import { useReferentiel } from '../hooks/useReferentiel.js';
import { ApiClientError, api } from '../lib/apiClient.js';
import { daysBetween, formatShort, todayYmd } from '../lib/formatDate.js';

interface FormValues {
  rencontreId: string;
  codeDirective: string;
  texteDirective: string;
  responsableId: string;
  ministeresAssocies: string;
  echeance: string;
  debutExecution: string;
  finExecution: string;
  etat: DirectiveEtat;
  typeCause: string;
  commentaires: string;
}

const ETAT_OPTIONS = [
  { value: 'attente' as const, label: 'En attente', icon: Clock, variant: 'default' as const },
  { value: 'enCours' as const, label: 'En cours', icon: Loader2, variant: 'warning' as const },
  { value: 'realisee' as const, label: 'Réalisée', icon: CheckCircle2, variant: 'success' as const },
  { value: 'ineligible' as const, label: 'Inéligible', icon: MinusCircle, variant: 'neutral' as const },
];

const TYPE_RENCONTRE_LABELS: Record<string, string> = {
  conseilMinistres: 'Conseil des ministres',
  conseilInterMinisteriel: 'Conseil inter-ministériel',
  coordinationSggSg: 'Coordination SGG/SG',
  copil: 'COPIL',
  cngi: 'CNGI',
  reunionTechnique: 'Réunion technique',
  commissionAn: 'Commission AN',
};

export function DirectiveFicheView() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);

  const directiveQuery = useApi(
    () => (id ? api.get<Directive>(`/directives/${id}`) : Promise.resolve(null)),
    [id],
  );
  const directionsQuery = useApi(() => api.get<{ items: Direction[] }>('/directions'), []);
  const rencontresQuery = useApi(() => api.get<{ items: Rencontre[] }>('/rencontres'), []);

  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [newRencontreOpen, setNewRencontreOpen] = useState(false);

  const directive = directiveQuery.data;
  const directions = directionsQuery.data?.items ?? [];
  const rencontres = rencontresQuery.data?.items ?? [];

  // Referentiels dynamiques (gerables via /bs/config)
  const typeCauseRef = useReferentiel('typeCause');

  const defaultValues = useMemo<FormValues>(
    () => ({
      rencontreId: directive?.rencontreId ?? '',
      codeDirective: directive?.codeDirective ?? '',
      texteDirective: directive?.texteDirective ?? '',
      responsableId: directive?.responsableId ? String(directive.responsableId) : '',
      ministeresAssocies: directive?.ministeresAssocies.join(', ') ?? 'MHA',
      echeance: directive?.echeance ?? '',
      debutExecution: directive?.debutExecution ?? '',
      finExecution: directive?.finExecution ?? '',
      etat: directive?.etat ?? 'attente',
      typeCause: directive?.typeCause ?? '',
      commentaires: directive?.commentaires ?? '',
    }),
    [directive],
  );

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    formState: { errors, isDirty },
  } = useForm<FormValues>({ defaultValues });

  useEffect(() => {
    reset(defaultValues);
  }, [defaultValues, reset]);

  const selectedRencontre = rencontres.find((r) => r.id === defaultValues.rencontreId);

  const indicators = useMemo(() => {
    if (!directive) return null;
    const today = todayYmd();
    const echeance = directive.echeance;
    let retardJours: number | null = null;
    if (echeance && (directive.etat === 'enCours' || directive.etat === 'attente') && echeance < today) {
      retardJours = daysBetween(echeance, today);
    }
    return {
      joursPrevu: directive.joursPrevu,
      joursReel: directive.joursReel,
      joursRetardDemarrage: directive.joursRetardDemarrage,
      retardJours,
    };
  }, [directive]);

  const onSubmit = async (values: FormValues): Promise<void> => {
    setSubmitting(true);
    const payload = {
      rencontreId: values.rencontreId,
      codeDirective: values.codeDirective,
      texteDirective: values.texteDirective,
      responsableId: values.responsableId ? Number(values.responsableId) : null,
      ministeresAssocies: values.ministeresAssocies
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      echeance: values.echeance || null,
      debutExecution: values.debutExecution || null,
      finExecution: values.finExecution || null,
      etat: values.etat,
      typeCause: values.typeCause || null,
      commentaires: values.commentaires || null,
    };

    try {
      if (isEdit && id) {
        await api.put(`/directives/${id}`, payload);
        toast.success('Directive mise à jour');
        directiveQuery.refetch();
      } else {
        const created = await api.post<Directive>('/directives', payload);
        toast.success('Directive créée');
        navigate(`/bs/fiche/${created.id}`, { replace: true });
      }
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : 'Erreur d\'enregistrement';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSoumettre = async (): Promise<void> => {
    if (!id) return;
    try {
      await api.post(`/directives/${id}/soumettre`);
      toast.success('Directive soumise au workflow de validation');
      directiveQuery.refetch();
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : 'Erreur';
      toast.error(msg);
    }
  };

  const handleValider = async (): Promise<void> => {
    if (!id) return;
    try {
      await api.post(`/directives/${id}/valider`);
      toast.success('Directive validée');
      directiveQuery.refetch();
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : 'Erreur';
      toast.error(msg);
    }
  };

  const handleDelete = async (): Promise<void> => {
    if (!id) return;
    try {
      await api.delete(`/directives/${id}`);
      toast.success('Directive supprimée');
      navigate('/bs/liste');
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : 'Erreur';
      toast.error(msg);
    }
  };

  if (isEdit && directiveQuery.isLoading) return <Spinner label="Chargement de la fiche…" />;
  if (isEdit && !directive) {
    return (
      <div className="bg-danger-bg border border-danger text-danger rounded-lg px-4 py-3 text-sm">
        Directive introuvable.
      </div>
    );
  }

  return (
    <div>
      <Link
        to="/bs/liste"
        className="inline-flex items-center gap-1.5 text-sm text-fg-muted mb-3 hover:text-fg"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Retour à la file de travail
      </Link>

      {directive && (
        <div className="flex items-center gap-3 mb-1 flex-wrap">
          <span className="bg-muted px-2.5 py-1 rounded text-xs font-mono">{directive.codeDirective}</span>
          <StateBadge etat={directive.etat} />
          <span className="text-xs text-fg-muted">
            Statut workflow : <b className="text-fg">{directive.statutValidation}</b>
          </span>
        </div>
      )}

      <h1 className="text-2xl font-semibold text-fg leading-tight">
        {isEdit ? 'Fiche recommandation' : 'Nouvelle recommandation'}
      </h1>
      <p className="text-sm text-fg-muted mt-1 mb-6">
        {isEdit ? "Édition complète d'une directive" : 'Création d\'une nouvelle directive'}
      </p>

      <form
        onSubmit={(e) => void handleSubmit(onSubmit)(e)}
        className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5 items-start"
      >
        {/* Main card */}
        <div className="card overflow-hidden">
          {/* Section 1 — Rencontre */}
          <fieldset className="p-5 border-b border-border">
            <legend className="text-xs font-semibold uppercase tracking-wider text-fg flex items-center gap-2 mb-4">
              <SectionNumber n={1} /> Rencontre source
            </legend>
            <FormField
              label="Rencontre"
              htmlFor="rencontreId"
              required
              error={errors.rencontreId?.message}
              help={
                selectedRencontre
                  ? `${TYPE_RENCONTRE_LABELS[selectedRencontre.typeRencontre]} · ${formatShort(selectedRencontre.dateRencontre)}`
                  : "Si la rencontre n'existe pas encore, cliquez sur « + Nouvelle rencontre »."
              }
            >
              <div className="flex gap-2 items-stretch">
                <select
                  id="rencontreId"
                  className="select flex-1 min-w-0"
                  {...register('rencontreId', { required: 'Sélectionnez une rencontre' })}
                >
                  <option value="">— Sélectionner —</option>
                  {rencontres.slice(0, 500).map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.codeRencontre} · {r.intitule.slice(0, 90)}
                      {r.intitule.length > 90 ? '…' : ''}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setNewRencontreOpen(true)}
                  className="btn btn-secondary whitespace-nowrap"
                  title="Créer une nouvelle rencontre"
                >
                  <Plus className="w-3.5 h-3.5" /> Nouvelle rencontre
                </button>
              </div>
            </FormField>
          </fieldset>

          {/* Section 2 — Directive */}
          <fieldset className="p-5 border-b border-border">
            <legend className="text-xs font-semibold uppercase tracking-wider text-fg flex items-center gap-2 mb-4">
              <SectionNumber n={2} /> Directive
            </legend>
            <FormField
              label="Code directive"
              htmlFor="codeDirective"
              required
              error={errors.codeDirective?.message}
              help="Format : CM{date}-{NNNN} ou CI{date}-{NNNN}"
            >
              <input
                id="codeDirective"
                type="text"
                className="input font-mono max-w-[260px]"
                {...register('codeDirective', { required: 'Code requis' })}
              />
            </FormField>
            <FormField
              label="Texte de la directive"
              htmlFor="texteDirective"
              required
              error={errors.texteDirective?.message}
            >
              <Textarea
                id="texteDirective"
                rows={5}
                invalid={Boolean(errors.texteDirective)}
                {...register('texteDirective', {
                  required: 'Texte requis',
                  minLength: { value: 3, message: 'Minimum 3 caractères' },
                })}
              />
            </FormField>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <FormField label="Responsable" htmlFor="responsableId">
                <select id="responsableId" className="select" {...register('responsableId')}>
                  <option value="">—</option>
                  {directions.map((d) => (
                    <option key={d.id} value={String(d.id)}>
                      {d.code} · {d.fullName}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField
                label="Ministères associés"
                htmlFor="ministeresAssocies"
                help="Séparer par virgules (ex. MHA, MFB, MEPC)"
              >
                <input
                  id="ministeresAssocies"
                  type="text"
                  className="input"
                  {...register('ministeresAssocies')}
                />
              </FormField>
            </div>
          </fieldset>

          {/* Section 3 — Execution */}
          <fieldset className="p-5">
            <legend className="text-xs font-semibold uppercase tracking-wider text-fg flex items-center gap-2 mb-4">
              <SectionNumber n={3} /> Suivi d'exécution
            </legend>
            <FormField label="État" required>
              <Controller
                control={control}
                name="etat"
                render={({ field }) => (
                  <RadioCards
                    name="etat"
                    value={field.value}
                    onChange={field.onChange}
                    options={ETAT_OPTIONS}
                  />
                )}
              />
            </FormField>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <FormField label="Échéance" htmlFor="echeance" help="Format YYYY-MM-DD">
                <input
                  id="echeance"
                  type="date"
                  className="input font-mono"
                  {...register('echeance', {
                    pattern: { value: /^\d{4}-\d{2}-\d{2}$/, message: 'Format YYYY-MM-DD' },
                  })}
                />
              </FormField>
              <FormField label="Début d'exécution" htmlFor="debutExecution">
                <input
                  id="debutExecution"
                  type="date"
                  className="input font-mono"
                  {...register('debutExecution')}
                />
              </FormField>
              <FormField label="Fin d'exécution" htmlFor="finExecution">
                <input
                  id="finExecution"
                  type="date"
                  className="input font-mono"
                  {...register('finExecution')}
                />
              </FormField>
            </div>
            <FormField
              label="Type de cause (si retard)"
              htmlFor="typeCause"
              help={
                typeCauseRef.items.length === 0 && !typeCauseRef.isLoading
                  ? 'Aucun type de cause défini. Ajoutez-en via Configuration.'
                  : undefined
              }
            >
              <select id="typeCause" className="select" {...register('typeCause')}>
                <option value="">—</option>
                {typeCauseRef.items.map((c) => (
                  <option key={c.id} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Commentaires de suivi" htmlFor="commentaires">
              <Textarea
                id="commentaires"
                rows={3}
                placeholder="Décrivez l'avancement, les blocages, les prochaines étapes…"
                {...register('commentaires')}
              />
            </FormField>
          </fieldset>

          {/* Sticky actions */}
          <div className="sticky bottom-0 bg-surface border-t border-border px-5 py-3.5 flex flex-wrap justify-end items-center gap-2">
            <Link to="/bs/liste" className="btn btn-ghost">
              Annuler
            </Link>
            <button type="submit" disabled={submitting} className="btn btn-secondary">
              <Save className="w-3.5 h-3.5" />
              {submitting ? 'Enregistrement…' : isEdit ? 'Enregistrer' : 'Créer'}
            </button>
            {isEdit && directive?.statutValidation === 'brouillon' && (
              <button
                type="button"
                onClick={() => void handleSoumettre()}
                disabled={submitting || isDirty}
                className="btn btn-primary"
                title={isDirty ? 'Enregistrez d\'abord vos modifications' : ''}
              >
                <Send className="w-3.5 h-3.5" /> Soumettre
              </button>
            )}
            {isEdit && directive?.statutValidation === 'soumis' && (
              <button
                type="button"
                onClick={() => void handleValider()}
                className="btn btn-primary"
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Valider
              </button>
            )}
          </div>
        </div>

        {/* Side column */}
        <div className="space-y-4">
          {directive && (
            <div className="card p-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-fg-muted mb-3">
                Workflow de validation
              </h4>
              <WorkflowStepper
                statut={directive.statutValidation}
                createdAt={directive.createdAt}
                validatedAt={directive.validatedAt}
              />
            </div>
          )}

          {indicators && (
            <div className="card p-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-fg-muted mb-3">
                Indicateurs calculés
              </h4>
              <div className="space-y-2 text-sm">
                <IndicatorRow label="Jours de traitement prévus" value={indicators.joursPrevu ?? '—'} />
                <IndicatorRow label="Jours de traitement réels" value={indicators.joursReel ?? '—'} />
                <IndicatorRow
                  label="Retard sur échéance"
                  value={indicators.retardJours !== null ? `+${indicators.retardJours} j` : '—'}
                  variant={indicators.retardJours ? 'danger' : 'default'}
                />
                <IndicatorRow label="Jours retard démarrage" value={indicators.joursRetardDemarrage ?? '—'} />
              </div>
            </div>
          )}

          {isEdit && id && (
            <div className="card p-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-fg-muted mb-3">
                Commentaires
              </h4>
              <CommentSection directiveId={id} />
            </div>
          )}

          {isEdit && id && (
            <div className="card p-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-fg-muted mb-3">
                Actions
              </h4>
              <button
                type="button"
                onClick={() => setConfirmDeleteOpen(true)}
                className="btn btn-ghost btn-sm w-full justify-start text-danger hover:bg-danger-bg"
              >
                <Trash2 className="w-3.5 h-3.5" /> Supprimer la directive
              </button>
            </div>
          )}
        </div>
      </form>

      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title="Supprimer la directive ?"
        description={`Cette action est irréversible. La directive ${directive?.codeDirective ?? ''} et son historique seront définitivement supprimés.`}
        confirmLabel="Supprimer définitivement"
        cancelLabel="Annuler"
        variant="danger"
        onConfirm={() => handleDelete()}
      />

      <NewRencontreModal
        open={newRencontreOpen}
        onOpenChange={setNewRencontreOpen}
        onCreated={(created) => {
          // Recharge la liste des rencontres puis pré-sélectionne la nouvelle
          rencontresQuery.refetch();
          setValue('rencontreId', created.id, { shouldDirty: true, shouldValidate: true });
        }}
      />
    </div>
  );
}

function SectionNumber({ n }: { n: number }) {
  return (
    <span className="bg-primary-100 text-primary w-5 h-5 rounded-full inline-flex items-center justify-center text-[11px] font-semibold">
      {n}
    </span>
  );
}

function IndicatorRow({
  label,
  value,
  variant = 'default',
}: {
  label: string;
  value: string | number;
  variant?: 'default' | 'danger';
}) {
  return (
    <div className="flex justify-between border-b border-border last:border-0 pb-2 last:pb-0">
      <span className="text-fg-muted">{label}</span>
      <span className={`font-mono font-medium ${variant === 'danger' ? 'text-danger' : 'text-fg'}`}>
        {value}
      </span>
    </div>
  );
}

