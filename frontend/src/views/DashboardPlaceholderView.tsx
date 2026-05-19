import { Construction } from 'lucide-react';

export function DashboardPlaceholderView() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-fg mb-1">Dashboard global</h1>
      <p className="text-sm text-fg-muted mb-6">
        Vue temps réel du suivi des recommandations ministérielles
      </p>

      <div className="card">
        <div className="card-body flex flex-col items-center justify-center py-16 text-center">
          <Construction className="w-12 h-12 text-fg-muted mb-4" strokeWidth={1.5} />
          <h2 className="text-md font-semibold text-fg mb-2">Module en construction</h2>
          <p className="text-sm text-fg-muted max-w-md">
            Le shell de l'application est en place. Les modules métier (Directive présidentielle,
            Recommandations MHA, Réunions, Missions, Interpellations) seront implémentés à partir
            du Sprint 1.
          </p>
        </div>
      </div>
    </div>
  );
}
