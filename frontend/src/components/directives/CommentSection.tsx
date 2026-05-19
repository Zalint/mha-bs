import { Send } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { ApiClientError, api } from '../../lib/apiClient.js';
import { useApi } from '../../hooks/useApi.js';

interface Commentaire {
  id: string;
  texte: string;
  auteurId: string | null;
  auteurFullName: string | null;
  createdAt: string;
}

interface Props {
  directiveId: string | null;
}

export function CommentSection({ directiveId }: Props) {
  const [draft, setDraft] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const query = useApi(
    () =>
      directiveId
        ? api.get<{ items: Commentaire[] }>(`/directives/${directiveId}/commentaires`)
        : Promise.resolve({ items: [] }),
    [directiveId],
  );

  if (!directiveId) {
    return <p className="text-sm text-fg-muted">Enregistrez d'abord la directive pour ajouter des commentaires.</p>;
  }

  const handleSubmit = async (): Promise<void> => {
    const texte = draft.trim();
    if (!texte) return;
    setSubmitting(true);
    try {
      await api.post(`/directives/${directiveId}/commentaires`, { texte });
      setDraft('');
      query.refetch();
      toast.success('Commentaire ajouté');
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : 'Erreur';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const items = query.data?.items ?? [];

  return (
    <div className="space-y-3">
      <div className="space-y-2.5">
        {items.length === 0 && !query.isLoading && (
          <p className="text-sm text-fg-muted italic">Aucun commentaire pour l'instant.</p>
        )}
        {items.map((c) => {
          const initials = c.auteurFullName
            ? c.auteurFullName
                .split(' ')
                .map((s) => s[0])
                .slice(0, 2)
                .join('')
                .toUpperCase()
            : '??';
          const when = formatRelative(c.createdAt);
          return (
            <div key={c.id} className="bg-muted rounded p-3">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-[11px] font-semibold">
                  {initials}
                </div>
                <b className="text-xs font-semibold">{c.auteurFullName ?? 'Inconnu'}</b>
                <span className="text-[11px] text-fg-muted ml-auto font-mono">{when}</span>
              </div>
              <div className="text-sm text-fg-2 whitespace-pre-wrap">{c.texte}</div>
            </div>
          );
        })}
      </div>

      <div className="border-t border-border pt-3">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ajouter un commentaire…"
          rows={2}
          className="w-full px-3 py-2 border border-border rounded text-sm font-sans bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
        />
        <div className="flex justify-end mt-2">
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={submitting || !draft.trim()}
            className="btn btn-primary btn-sm"
          >
            {submitting ? (
              'Envoi…'
            ) : (
              <>
                <Send className="w-3.5 h-3.5" /> Publier
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatRelative(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffSeconds = Math.round((now - then) / 1000);
  if (diffSeconds < 60) return 'à l\'instant';
  if (diffSeconds < 3600) return `il y a ${Math.floor(diffSeconds / 60)} min`;
  if (diffSeconds < 86400) return `il y a ${Math.floor(diffSeconds / 3600)} h`;
  const diffDays = Math.floor(diffSeconds / 86400);
  return `il y a ${diffDays} j`;
}
