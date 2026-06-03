import { AlertTriangle, CheckCircle2, FileSpreadsheet, Upload, X } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ApiClientError, api } from '../../lib/apiClient.js';
import { cn } from '../../lib/cn.js';

interface ImportResult {
  filename: string;
  sizeBytes: number;
  rencontres: number;
  directives: number;
  copil: number;
  cngi: number;
  reformeAssainissement: number;
  reformeInstitutionnelle: number;
  recommandationsFlat: number;
  projetsSheets: number;
  reunions: number;
  missions: number;
  interpellations: number;
  deputes: number;
  sessions: number;
  directions: number;
  referentiels: number;
}

interface DirectivesOnlyResult {
  filename: string;
  sizeBytes: number;
  totalRows: number;
  imported: number;
  duplicatesSkipped: number;
  skippedNoText: number;
  rencontresCreated: number;
}

interface SheetPreview {
  name: string;
  rowCount: number;
  headers: string[];
  sampleRows: Array<Record<string, string | number | null>>;
  suggestedHeaderRow: number;
}

interface InspectResult {
  filename: string;
  sizeBytes: number;
  sheets: SheetPreview[];
}

interface DedicatedResult {
  filename: string;
  sizeBytes: number;
  sheetName: string;
  totalRows: number;
  imported: number;
  duplicatesSkipped: number;
  skippedInvalid: number;
}

type DedicatedMode = 'interpellations' | 'missions-terrain';

const SHEETS_INFO: { sheet: string; description: string }[] = [
  // Format historique
  { sheet: 'PLAN', description: 'Directives présidentielles (avec leurs rencontres source)' },
  { sheet: 'Suivi Recom Copil', description: 'Recommandations COPIL (PROGEP II, PISEA, PASEA-RD, PDBH, PROMOREN)' },
  { sheet: 'Suivi Recom CNGI', description: 'Recommandations CNGI' },
  { sheet: "Réf sur l'ASS", description: 'Réforme assainissement' },
  { sheet: 'Sui FeuilleR Ref Inst', description: 'Réforme institutionnelle' },
  { sheet: 'Suivi Rtechnique', description: 'Réunions techniques (format historique)' },
  // Format export (roundtrip)
  { sheet: 'Recommandations', description: 'Recommandations à plat (colonne Matrice) — format export' },
  { sheet: 'Réunions techniques', description: 'Réunions techniques (format export, en-têtes nommés)' },
  { sheet: 'Missions terrain', description: 'Missions terrain — format export' },
  { sheet: '<projet>', description: 'Une feuille par projet COPIL (format export "projets")' },
];

function formatBytes(n: number): string {
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} Ko`;
  return `${(n / 1024 / 1024).toFixed(2)} Mo`;
}

export function BsImportView() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // Preview (dry-run) avant insertion
  const [preview, setPreview] = useState<ImportResult | null>(null);
  const [confirming, setConfirming] = useState(false);

  // Mode "Importer Directives uniquement"
  const [directivesPreview, setDirectivesPreview] = useState<DirectivesOnlyResult | null>(null);
  const [directivesResult, setDirectivesResult] = useState<DirectivesOnlyResult | null>(null);
  const [directivesSubmitting, setDirectivesSubmitting] = useState(false);

  // Mode "Import dédié interactif" (interpellations / missions terrain)
  const [dedicatedMode, setDedicatedMode] = useState<DedicatedMode | null>(null);
  const [dedicatedSheets, setDedicatedSheets] = useState<SheetPreview[] | null>(null);
  const [dedicatedSelectedSheet, setDedicatedSelectedSheet] = useState<string>('');
  const [dedicatedResult, setDedicatedResult] = useState<DedicatedResult | null>(null);
  const [dedicatedSubmitting, setDedicatedSubmitting] = useState(false);

  const startDedicatedImport = async (mode: DedicatedMode): Promise<void> => {
    if (!file) return;
    setDedicatedSubmitting(true);
    setError(null);
    setDedicatedMode(mode);
    setDedicatedSheets(null);
    setDedicatedSelectedSheet('');
    setDedicatedResult(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await api.post<InspectResult>('/import/inspect', form);
      setDedicatedSheets(res.sheets);
      // Suggère automatiquement le 1er onglet qui ressemble au mode demandé
      const guessName =
        mode === 'interpellations'
          ? res.sheets.find((s) => /député|deput|interpell/i.test(s.name))?.name
          : res.sheets.find((s) => /mission|terrain/i.test(s.name))?.name;
      setDedicatedSelectedSheet(guessName ?? res.sheets[0]?.name ?? '');
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Erreur d'analyse du fichier.");
      setDedicatedMode(null);
    } finally {
      setDedicatedSubmitting(false);
    }
  };

  const cancelDedicated = (): void => {
    if (dedicatedSubmitting) return;
    setDedicatedMode(null);
    setDedicatedSheets(null);
    setDedicatedSelectedSheet('');
    setDedicatedResult(null);
  };

  const handleDedicatedConfirm = async (): Promise<void> => {
    if (!file || !dedicatedMode || !dedicatedSelectedSheet) return;
    setDedicatedSubmitting(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const url = `/import/${dedicatedMode}`;
      const res = await api.post<DedicatedResult>(url, form, {
        query: { sheet: dedicatedSelectedSheet },
      });
      setDedicatedResult(res);
      setDedicatedSheets(null);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Erreur d'import.");
    } finally {
      setDedicatedSubmitting(false);
    }
  };

  const handleDirectivesPreview = async (): Promise<void> => {
    if (!file) return;
    setDirectivesSubmitting(true);
    setError(null);
    setDirectivesResult(null);
    setDirectivesPreview(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await api.post<DirectivesOnlyResult>('/import/directives', form, {
        query: { dryRun: 'true' },
      });
      setDirectivesPreview(res);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Erreur d'analyse.");
    } finally {
      setDirectivesSubmitting(false);
    }
  };

  const handleDirectivesConfirm = async (): Promise<void> => {
    if (!file) return;
    setDirectivesSubmitting(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await api.post<DirectivesOnlyResult>('/import/directives', form);
      setDirectivesResult(res);
      setDirectivesPreview(null);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Erreur d'import.");
    } finally {
      setDirectivesSubmitting(false);
    }
  };

  const cancelDirectivesPreview = (): void => {
    if (directivesSubmitting) return;
    setDirectivesPreview(null);
  };

  const handlePreview = async (): Promise<void> => {
    if (!file) return;
    setSubmitting(true);
    setError(null);
    setResult(null);
    setPreview(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await api.post<ImportResult>('/import', form, { query: { dryRun: 'true' } });
      setPreview(res);
    } catch (e) {
      if (e instanceof ApiClientError) {
        setError(e.message);
      } else {
        setError("Erreur inattendue pendant l'analyse du fichier.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmImport = async (): Promise<void> => {
    if (!file) return;
    setConfirming(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await api.post<ImportResult>('/import', form);
      setResult(res);
      setPreview(null);
    } catch (e) {
      if (e instanceof ApiClientError) {
        setError(e.message);
      } else {
        setError("Erreur inattendue pendant l'import.");
      }
    } finally {
      setConfirming(false);
    }
  };

  const cancelPreview = (): void => {
    if (confirming) return;
    setPreview(null);
  };

  const totalImported = result
    ? result.rencontres +
      result.directives +
      result.copil +
      result.cngi +
      result.reformeAssainissement +
      result.reformeInstitutionnelle +
      result.recommandationsFlat +
      result.projetsSheets +
      result.reunions +
      result.missions +
      result.interpellations +
      result.deputes +
      result.sessions +
      result.directions +
      result.referentiels
    : 0;

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-semibold text-fg leading-tight">Importer Excel</h1>
      <p className="text-sm text-fg-muted mt-1 mb-3">
        Charge un fichier XLSX. <b>Par défaut, le 1er onglet est lu comme des directives.</b>
        {' '}Si d'autres onglets sont reconnus (PLAN, Suivi Recom Copil, CNGI, etc.),
        leur contenu est aussi importé. Import idempotent — pas de doublons.
      </p>

      <div className="bg-info-bg border-l-4 border-primary px-4 py-2.5 text-xs text-fg-2 rounded-r mb-5">
        <b className="text-primary-700">Mode permissif :</b> le parser détecte
        automatiquement la ligne d'en-tête et accepte les colonnes manquantes
        (CODE DIRECTIVE, CODE RENCONTRE, ANNEE, etc. sont auto-générés si absents).
        Colonnes minimales requises : <code className="font-mono bg-muted px-1 rounded">DIRECTIVES</code>
        {' '}et une date (DATE RENCONTRE, DATE RECONTRE ou ECHEANCE).
      </div>

      {/* Format attendu */}
      <details className="bg-surface border border-border rounded-lg p-4 mb-5">
        <summary className="cursor-pointer text-sm font-semibold flex items-center gap-2">
          <FileSpreadsheet className="w-4 h-4 text-primary" />
          Formats de feuilles reconnus (optionnels)
        </summary>
        <div className="mt-3 space-y-1.5">
          {SHEETS_INFO.map((s) => (
            <div key={s.sheet} className="grid grid-cols-[200px_1fr] gap-3 text-sm">
              <span className="font-mono text-fg-muted">{s.sheet}</span>
              <span className="text-fg-2">{s.description}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-fg-muted mt-3 italic">
          Toutes les feuilles sont optionnelles. Si aucune feuille ne porte ces noms,
          le 1er onglet du classeur est lu comme des directives.
        </p>
      </details>

      {/* Upload zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const dropped = e.dataTransfer.files[0];
          if (dropped) setFile(dropped);
        }}
        className={cn(
          'border-2 border-dashed rounded-xl p-10 text-center transition-colors',
          dragOver ? 'border-primary bg-primary-100' : 'border-border bg-surface',
        )}
      >
        <Upload className="w-10 h-10 mx-auto text-fg-muted" strokeWidth={1.5} />
        <p className="text-sm text-fg-2 mt-3">
          Glisse un fichier XLSX/XLS ici, ou clique pour parcourir.
        </p>
        <label className="inline-block mt-3">
          <input
            type="file"
            accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) setFile(f);
            }}
          />
          <span className="btn btn-secondary cursor-pointer">Parcourir…</span>
        </label>

        {file && (
          <div className="mt-4 inline-flex items-center gap-3 px-3 py-2 bg-muted rounded-lg">
            <FileSpreadsheet className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">{file.name}</span>
            <span className="text-xs text-fg-muted font-mono">{formatBytes(file.size)}</span>
            <button
              type="button"
              onClick={() => setFile(null)}
              className="text-xs text-fg-muted hover:text-danger"
              disabled={submitting}
            >
              Retirer
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap justify-end mt-4 gap-2 sm:gap-3">
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => navigate('/bs/liste')}
          disabled={submitting || directivesSubmitting}
        >
          Annuler
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => void handleDirectivesPreview()}
          disabled={!file || submitting || directivesSubmitting || dedicatedSubmitting}
          title="Lit uniquement le 1er onglet, déduplique par CODE DIRECTIVE"
        >
          {directivesSubmitting ? 'Analyse…' : '📋 Directives (1er onglet)'}
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => void startDedicatedImport('interpellations')}
          disabled={!file || submitting || directivesSubmitting || dedicatedSubmitting}
          title="Scanne les onglets et propose celui à importer comme interpellations parlementaires"
        >
          {dedicatedSubmitting && dedicatedMode === 'interpellations'
            ? 'Scan…'
            : '🎤 Interpellations'}
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => void startDedicatedImport('missions-terrain')}
          disabled={!file || submitting || directivesSubmitting || dedicatedSubmitting}
          title="Scanne les onglets et propose celui à importer comme missions terrain"
        >
          {dedicatedSubmitting && dedicatedMode === 'missions-terrain'
            ? 'Scan…'
            : '📍 Missions terrain'}
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => void handlePreview()}
          disabled={!file || submitting || directivesSubmitting || dedicatedSubmitting}
          title="Détecte tous les onglets reconnus (PLAN, COPIL, CNGI, etc.)"
        >
          {submitting ? 'Analyse…' : 'Analyser tout le fichier'}
        </button>
      </div>

      {error && (
        <div className="mt-5 bg-danger-bg border border-danger text-danger rounded-lg px-4 py-3 text-sm flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold">Échec de l'import</div>
            <div className="mt-0.5">{error}</div>
          </div>
        </div>
      )}

      {result && (
        <div className="mt-5 bg-success-bg border border-success text-success rounded-lg p-5">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-semibold text-base">
                Import réussi · {totalImported} nouvelles ligne{totalImported > 1 ? 's' : ''}
              </div>
              <div className="text-xs mt-0.5 opacity-80 font-mono">
                {result.filename} · {formatBytes(result.sizeBytes)}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4">
            <ResultCell label="Rencontres" value={result.rencontres} />
            <ResultCell label="Directives" value={result.directives} />
            <ResultCell label="Réunions techniques" value={result.reunions} />
            <ResultCell label="Missions terrain" value={result.missions} />
            <ResultCell label="COPIL" value={result.copil} />
            <ResultCell label="CNGI" value={result.cngi} />
            <ResultCell label="Réforme assainissement" value={result.reformeAssainissement} />
            <ResultCell label="Réforme institutionnelle" value={result.reformeInstitutionnelle} />
            <ResultCell label="Recos (à plat)" value={result.recommandationsFlat} />
            <ResultCell label="Recos (par projet)" value={result.projetsSheets} />
          </div>
          <div className="mt-4 flex gap-3 text-sm">
            <button
              type="button"
              onClick={() => navigate('/bs/liste')}
              className="text-white bg-success rounded px-3 py-1.5 font-medium hover:opacity-90"
            >
              Voir la file de travail
            </button>
            <button
              type="button"
              onClick={() => {
                setFile(null);
                setResult(null);
              }}
              className="text-success hover:underline"
            >
              Importer un autre fichier
            </button>
          </div>
        </div>
      )}

      {/* Résultat mode "Directives uniquement" */}
      {directivesResult && (
        <div className="mt-5 bg-success-bg border border-success text-success rounded-lg p-5">
          <div className="flex items-start gap-2.5 mb-3">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-semibold text-base">
                Import directives réussi · {directivesResult.imported} nouvelle
                {directivesResult.imported > 1 ? 's' : ''}
              </div>
              <div className="text-xs mt-0.5 opacity-80 font-mono">
                {directivesResult.filename} · {formatBytes(directivesResult.sizeBytes)}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <ResultCell label="Lignes analysées" value={directivesResult.totalRows} />
            <ResultCell label="Importées" value={directivesResult.imported} />
            <ResultCell label="Doublons ignorés" value={directivesResult.duplicatesSkipped} />
            <ResultCell label="Sans texte (skip)" value={directivesResult.skippedNoText} />
          </div>
          <div className="mt-4 flex gap-3 text-sm">
            <button
              type="button"
              onClick={() => navigate('/bs/liste')}
              className="text-white bg-success rounded px-3 py-1.5 font-medium hover:opacity-90"
            >
              Voir la file de travail
            </button>
            <button
              type="button"
              onClick={() => {
                setFile(null);
                setDirectivesResult(null);
              }}
              className="text-success hover:underline"
            >
              Importer un autre fichier
            </button>
          </div>
        </div>
      )}

      {/* Modale de confirmation mode "Directives uniquement" */}
      {directivesPreview && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={cancelDirectivesPreview}
        >
          <div
            className="bg-surface rounded-xl border border-border w-full max-w-xl shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between px-5 py-4 border-b border-border">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center flex-shrink-0">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold">Confirmer l&apos;import directives</h2>
                  <p className="text-xs text-fg-muted mt-1">
                    {directivesPreview.filename} · {formatBytes(directivesPreview.sizeBytes)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={cancelDirectivesPreview}
                disabled={directivesSubmitting}
                className="p-1 text-fg-muted hover:text-fg rounded hover:bg-muted"
                aria-label="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-5 py-4">
              <p className="text-sm text-fg-2 mb-3">
                Mode strict — 1er onglet uniquement · déduplication par <code className="font-mono bg-muted px-1 rounded">CODE DIRECTIVE</code> :
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <PreviewCell label="Analysées" value={directivesPreview.totalRows} />
                <PreviewCell
                  label="Nouvelles"
                  value={directivesPreview.imported}
                  highlight
                />
                <PreviewCell
                  label="Doublons ignorés"
                  value={directivesPreview.duplicatesSkipped}
                />
                <PreviewCell label="Sans texte" value={directivesPreview.skippedNoText} />
              </div>
              {directivesPreview.imported === 0 && (
                <div className="mt-3 bg-warning-bg border-l-4 border-warning px-3 py-2 text-xs text-fg-2 rounded-r">
                  <AlertTriangle className="inline w-3.5 h-3.5 mr-1 text-warning" />
                  Aucune nouvelle directive. Soit toutes sont déjà en base, soit la colonne
                  DIRECTIVES est manquante / vide.
                </div>
              )}
            </div>
            <div className="px-5 py-3 border-t border-border flex justify-end gap-2">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={cancelDirectivesPreview}
                disabled={directivesSubmitting}
              >
                Annuler
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void handleDirectivesConfirm()}
                disabled={directivesSubmitting}
              >
                {directivesSubmitting ? 'Import…' : "Confirmer l'import"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modale interactive de choix d'onglet (interpellations / missions) */}
      {dedicatedMode && dedicatedSheets && !dedicatedResult && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={cancelDedicated}
        >
          <div
            className="bg-surface rounded-xl border border-border w-full max-w-3xl shadow-xl max-h-[90vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between px-5 py-4 border-b border-border sticky top-0 bg-surface">
              <div>
                <h2 className="text-base font-semibold">
                  {dedicatedMode === 'interpellations'
                    ? '🎤 Importer Interpellations'
                    : '📍 Importer Missions terrain'}
                </h2>
                <p className="text-xs text-fg-muted mt-1">
                  {dedicatedSheets.length} onglet
                  {dedicatedSheets.length > 1 ? 's' : ''} détecté
                  {dedicatedSheets.length > 1 ? 's' : ''} · choisis celui à importer
                </p>
              </div>
              <button
                type="button"
                onClick={cancelDedicated}
                disabled={dedicatedSubmitting}
                className="p-1 text-fg-muted hover:text-fg rounded hover:bg-muted"
                aria-label="Annuler"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-3">
              {dedicatedSheets.map((s) => {
                const isSelected = dedicatedSelectedSheet === s.name;
                return (
                  <button
                    key={s.name}
                    type="button"
                    onClick={() => setDedicatedSelectedSheet(s.name)}
                    className={cn(
                      'w-full text-left border rounded-lg p-3 transition-colors',
                      isSelected
                        ? 'border-primary bg-primary-100/40'
                        : 'border-border hover:border-fg-muted',
                    )}
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <div className="font-semibold text-sm flex items-center gap-2">
                          {isSelected && <span className="text-primary">✓</span>}
                          {s.name}
                        </div>
                        <div className="text-[11px] text-fg-muted font-mono mt-0.5">
                          {s.rowCount} ligne{s.rowCount > 1 ? 's' : ''} · {s.headers.length}{' '}
                          colonne{s.headers.length > 1 ? 's' : ''} · en-tête L
                          {s.suggestedHeaderRow + 1}
                        </div>
                      </div>
                      {isSelected && (
                        <span className="text-[10px] uppercase tracking-wider font-bold text-primary bg-primary-100 px-2 py-0.5 rounded">
                          Sélectionné
                        </span>
                      )}
                    </div>
                    {/* Headers */}
                    <div className="flex flex-wrap gap-1 mb-2">
                      {s.headers.slice(0, 10).map((h, i) => (
                        <span
                          key={`${s.name}-h-${i}`}
                          className="text-[10px] font-mono bg-muted text-fg-2 px-1.5 py-0.5 rounded"
                        >
                          {h}
                        </span>
                      ))}
                    </div>
                    {/* Sample rows */}
                    {s.sampleRows.length > 0 && (
                      <div className="overflow-x-auto">
                        <table className="text-[10.5px] w-full border-collapse">
                          <thead>
                            <tr className="bg-muted/50">
                              {s.headers.slice(0, 4).map((h, i) => (
                                <th
                                  key={`th-${i}`}
                                  className="text-left font-semibold text-fg-2 px-1.5 py-1 border border-border"
                                >
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {s.sampleRows.map((row, ri) => (
                              <tr key={`sr-${ri}`}>
                                {s.headers.slice(0, 4).map((h, ci) => (
                                  <td
                                    key={`td-${ri}-${ci}`}
                                    className="px-1.5 py-1 border border-border text-fg-muted truncate max-w-[160px]"
                                  >
                                    {row[h] === null || row[h] === undefined
                                      ? '—'
                                      : String(row[h])}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="px-5 py-3 border-t border-border flex justify-end gap-2 sticky bottom-0 bg-surface">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={cancelDedicated}
                disabled={dedicatedSubmitting}
              >
                Annuler
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void handleDedicatedConfirm()}
                disabled={!dedicatedSelectedSheet || dedicatedSubmitting}
              >
                {dedicatedSubmitting
                  ? 'Import…'
                  : `Importer la feuille "${dedicatedSelectedSheet}"`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Résultat import dédié */}
      {dedicatedResult && (
        <div className="mt-5 bg-success-bg border border-success text-success rounded-lg p-5">
          <div className="flex items-start gap-2.5 mb-3">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-base">
                Import {dedicatedMode === 'interpellations' ? 'interpellations' : 'missions'} réussi
                · {dedicatedResult.imported} nouvelle{dedicatedResult.imported > 1 ? 's' : ''}
              </div>
              <div className="text-xs mt-0.5 opacity-80 font-mono">
                Feuille « {dedicatedResult.sheetName} » · {dedicatedResult.filename}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <ResultCell label="Lignes analysées" value={dedicatedResult.totalRows} />
            <ResultCell label="Importées" value={dedicatedResult.imported} />
            <ResultCell label="Doublons ignorés" value={dedicatedResult.duplicatesSkipped} />
            <ResultCell label="Invalides (skip)" value={dedicatedResult.skippedInvalid} />
          </div>
          <div className="mt-4 flex gap-3 text-sm">
            <button
              type="button"
              onClick={() =>
                navigate(
                  dedicatedMode === 'interpellations' ? '/interpellations' : '/missions-terrain',
                )
              }
              className="text-white bg-success rounded px-3 py-1.5 font-medium hover:opacity-90"
            >
              Voir {dedicatedMode === 'interpellations' ? 'les interpellations' : 'les missions'}
            </button>
            <button
              type="button"
              onClick={() => {
                setFile(null);
                cancelDedicated();
              }}
              className="text-success hover:underline"
            >
              Importer un autre fichier
            </button>
          </div>
        </div>
      )}

      {/* Modale de preview / confirmation */}
      {preview && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={cancelPreview}
        >
          <div
            className="bg-surface rounded-xl border border-border w-full max-w-xl shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between px-5 py-4 border-b border-border">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center flex-shrink-0">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold">Confirmer l&apos;import</h2>
                  <p className="text-xs text-fg-muted mt-1">
                    {preview.filename} · {formatBytes(preview.sizeBytes)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={cancelPreview}
                disabled={confirming}
                className="p-1 text-fg-muted hover:text-fg rounded hover:bg-muted"
                aria-label="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-5 py-4">
              <p className="text-sm text-fg-2 mb-3">
                Voici ce qui sera <b>nouvellement créé</b> en base (les lignes déjà présentes
                sont ignorées) :
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <PreviewCell label="Directives" value={preview.directives} highlight />
                <PreviewCell label="Rencontres" value={preview.rencontres} />
                <PreviewCell label="Réunions" value={preview.reunions} />
                <PreviewCell label="Missions" value={preview.missions} />
                <PreviewCell label="COPIL" value={preview.copil} />
                <PreviewCell label="CNGI" value={preview.cngi} />
                <PreviewCell label="Réforme Ass." value={preview.reformeAssainissement} />
                <PreviewCell label="Réforme Inst." value={preview.reformeInstitutionnelle} />
                <PreviewCell label="Recos plat" value={preview.recommandationsFlat} />
                <PreviewCell label="Recos projet" value={preview.projetsSheets} />
              </div>
              {preview.directives +
                preview.rencontres +
                preview.reunions +
                preview.missions +
                preview.copil +
                preview.cngi +
                preview.reformeAssainissement +
                preview.reformeInstitutionnelle +
                preview.recommandationsFlat +
                preview.projetsSheets ===
                0 && (
                <div className="mt-3 bg-warning-bg border-l-4 border-warning px-3 py-2 text-xs text-fg-2 rounded-r">
                  <AlertTriangle className="inline w-3.5 h-3.5 mr-1 text-warning" />
                  Aucune nouvelle ligne à insérer. Toutes les données du fichier sont déjà en base.
                </div>
              )}
            </div>
            <div className="px-5 py-3 border-t border-border flex justify-end gap-2">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={cancelPreview}
                disabled={confirming}
              >
                Annuler
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void handleConfirmImport()}
                disabled={confirming}
              >
                {confirming ? 'Import en cours…' : "Confirmer l'import"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PreviewCell({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-lg px-3 py-2.5 ${highlight ? 'bg-primary-100' : 'bg-muted'}`}>
      <div className="text-[10.5px] uppercase tracking-wider text-fg-muted font-medium">{label}</div>
      <div className={`font-mono text-2xl font-bold tabular-nums mt-0.5 ${highlight ? 'text-primary-700' : 'text-fg'}`}>
        {value}
      </div>
    </div>
  );
}

function ResultCell({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-surface rounded-lg px-3 py-2.5">
      <div className="text-[11px] uppercase tracking-wider text-fg-muted font-medium">{label}</div>
      <div className="font-mono text-xl font-semibold tabular-nums mt-0.5 text-fg">{value}</div>
    </div>
  );
}
