import {
  BookOpen,
  Building2,
  Calendar,
  CheckCircle2,
  ClipboardList,
  FilePlus,
  Inbox,
  KeyRound,
  Landmark,
  MapPin,
  Mic,
  Settings,
  ShieldCheck,
  Users,
} from 'lucide-react';

import { cn } from '../lib/cn.js';

export function GuideView() {
  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-primary-100 text-primary-700 rounded text-[11.5px] font-semibold uppercase tracking-wider mb-2">
          <BookOpen className="w-3.5 h-3.5" /> Documentation
        </div>
        <h1 className="text-2xl font-semibold text-fg leading-tight">Guide d'utilisation</h1>
        <p className="text-sm text-fg-muted mt-1">
          Tout ce qu'il faut savoir pour utiliser l'application MHA Bureau de Suivi.
        </p>
      </div>

      <Toc />

      <Section id="introduction" title="1. À quoi sert cette application ?">
        <p>
          L'application <strong>MHA Bureau de Suivi</strong> est l'outil officiel de pilotage des
          recommandations ministérielles au sein du Ministère de l'Hydraulique et de
          l'Assainissement du Sénégal. Elle centralise dans un seul endroit&nbsp;:
        </p>
        <ul className="list-disc pl-5 mt-2 space-y-1">
          <li>les <b>directives présidentielles</b> (issues des Conseils des ministres, Conseils interministériels, et coordinations SGG/SG)</li>
          <li>les <b>recommandations MHA</b> (COPIL projets, Réformes assainissement et institutionnelle, CNGI)</li>
          <li>les <b>réunions techniques</b> et <b>missions terrain</b></li>
          <li>les <b>interpellations parlementaires</b></li>
        </ul>
        <p className="mt-3">
          Chaque action est tracée (auteur, date) et l'état d'avancement est calculé en temps réel
          dans les tableaux de bord.
        </p>
      </Section>

      <Section id="roles" title="2. Les profils utilisateur">
        <p className="mb-3">Quatre rôles avec des droits distincts&nbsp;:</p>
        <div className="grid sm:grid-cols-2 gap-3">
          <RoleCard
            color="bg-danger-bg text-danger"
            name="Administrateur"
            desc="Accès complet à toutes les fonctionnalités. Gère les utilisateurs et la configuration des référentiels."
          />
          <RoleCard
            color="bg-success-bg text-success"
            name="Secrétaire général (SG)"
            desc="Valide les directives soumises par le BS. Accès en lecture aux tableaux de bord SG."
          />
          <RoleCard
            color="bg-primary-100 text-primary-700"
            name="Bureau de Suivi (BS)"
            desc="Saisit et met à jour les directives, recommandations, réunions et missions. Soumet les fiches au SG pour validation."
          />
          <RoleCard
            color="bg-muted text-fg-2"
            name="Lecteur"
            desc="Accès en lecture seule aux tableaux de bord SG. Aucune modification possible."
          />
        </div>
      </Section>

      <Section id="vues" title="3. Vue SG vs vue Bureau de Suivi">
        <p>
          L'interface offre <b>deux modes de navigation</b>, sélectionnables en bas de la barre
          latérale&nbsp;:
        </p>
        <div className="grid sm:grid-cols-2 gap-3 mt-3">
          <Card>
            <h4 className="font-semibold text-fg mb-1">Vue SG</h4>
            <p className="text-sm text-fg-2">
              Tableaux de bord agrégés, indicateurs, listes par catégorie. Lecture principalement.
              C'est la vue par défaut pour les profils Admin, SG et Lecteur.
            </p>
          </Card>
          <Card>
            <h4 className="font-semibold text-fg mb-1">Vue Bureau de Suivi</h4>
            <p className="text-sm text-fg-2">
              Espace de saisie&nbsp;: file de travail, formulaires de création/édition,
              import Excel, configuration. Vue par défaut pour le profil BS.
            </p>
          </Card>
        </div>
        <Note>
          Les profils <b>SG</b> et <b>Lecteur</b> sont figés sur la vue SG. <b>Admin</b> et{' '}
          <b>BS</b> peuvent basculer librement.
        </Note>
      </Section>

      <Section id="concepts" title="4. Les concepts principaux">
        <ConceptItem icon={Landmark} title="Directive présidentielle">
          Une instruction émise par le Président lors d'un Conseil des ministres, d'un Conseil
          interministériel ou d'une Coordination SGG/SG. Chaque directive a un code unique (ex.{' '}
          <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">CI20260204-0007</code>),
          un texte, une échéance, un état, et une rencontre d'origine.
        </ConceptItem>
        <ConceptItem icon={Calendar} title="Rencontre">
          Une réunion de haut niveau (Conseil des ministres, Conseil interministériel,
          Coordination SGG/SG) à laquelle sont rattachées des directives. Identifiée par un code
          (ex. <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">CI20260204</code>).
        </ConceptItem>
        <ConceptItem icon={ClipboardList} title="Recommandation MHA (matrice)">
          Liste de recommandations issues d'un cadre interne au MHA&nbsp;:
          <ul className="list-disc pl-5 mt-1 space-y-0.5">
            <li><b>COPIL</b> — comités de pilotage des projets (PROGEP II, PISEA, PASEA-RD, PDBH, PROMOREN)</li>
            <li><b>Réformes</b> — Réforme de l'assainissement et Réforme institutionnelle</li>
            <li><b>CNGI</b> — Comité national de gestion intégrée</li>
          </ul>
        </ConceptItem>
        <ConceptItem icon={Calendar} title="Réunion technique">
          Réunion interne MHA (Eau, GIRE, Assainissement, etc.) avec thème, lieu, participants,
          décisions. Sert au reporting hebdomadaire du SG.
        </ConceptItem>
        <ConceptItem icon={MapPin} title="Mission terrain">
          Déplacement dans une région du Sénégal pour visiter des ouvrages (forages, châteaux
          d'eau, stations). Géolocalisée sur la carte, avec constats et recommandations.
        </ConceptItem>
        <ConceptItem icon={Mic} title="Interpellation parlementaire">
          Question (orale, écrite ou en commission) posée par un député au MHA, avec préparation
          de la réponse et suivi.
        </ConceptItem>
      </Section>

      <Section id="etats" title="5. Les états d'une directive">
        <p className="mb-3">Chaque directive a un état métier (avancement de l'exécution)&nbsp;:</p>
        <table className="w-full text-sm border-separate border-spacing-0 mb-4">
          <thead className="bg-surface2">
            <tr>
              <Th>État</Th>
              <Th>Code interne</Th>
              <Th>Signification</Th>
            </tr>
          </thead>
          <tbody>
            <EtatRow badge="bg-info-bg text-info" label="En attente" code="attente" desc="Pas encore commencé. État par défaut à la création." />
            <EtatRow badge="bg-warning-bg text-warning" label="En cours" code="enCours" desc="Exécution démarrée, en cours de traitement." />
            <EtatRow badge="bg-success-bg text-success" label="Réalisée" code="realisee" desc="Action terminée et validée." />
            <EtatRow badge="bg-neutral-bg text-neutral" label="Inéligible" code="ineligible" desc="Hors périmètre du MHA, non applicable, ou doublonnée." />
          </tbody>
        </table>
        <Note>
          <b>En retard</b> n'est pas un état mais une dérivation&nbsp;: une directive est en retard
          si son <i>échéance est dépassée</i> et son état n'est pas Réalisée.
        </Note>
      </Section>

      <Section id="workflow" title="6. Le workflow de validation">
        <p className="mb-4">
          Indépendamment de l'état métier, chaque directive suit un cycle de validation à trois
          étapes&nbsp;:
        </p>

        <div className="bg-surface border border-border rounded-lg p-5 mb-4">
          <div className="flex items-center justify-between gap-2 text-center">
            <WorkflowStep color="bg-muted text-fg-2" label="Brouillon" subtitle="BS crée la fiche" />
            <Arrow />
            <WorkflowStep color="bg-info-bg text-info" label="Soumis" subtitle="BS clique Soumettre" />
            <Arrow />
            <WorkflowStep color="bg-success-bg text-success" label="Validé" subtitle="SG clique Valider" />
          </div>
        </div>

        <ol className="list-decimal pl-5 space-y-2">
          <li>
            <b>Brouillon</b> &middot; Le BS crée la fiche dans la vue Bureau de Suivi (menu{' '}
            <i>Nouvelle directive</i>). Les modifications sont possibles à tout moment.
          </li>
          <li>
            <b>Soumis</b> &middot; Quand la fiche est complète, le BS clique sur{' '}
            <i>Soumettre</i> dans la fiche directive. La directive apparaît dans la file{' '}
            <i>Soumises au SG</i> du BS et dans le menu <i>Validation</i> du SG.
          </li>
          <li>
            <b>Validé</b> &middot; Le SG ouvre la page <i>Validation</i>, examine la fiche et
            clique sur <i>Valider</i>. La directive est officialisée (champ{' '}
            <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">validatedAt</code> +{' '}
            <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">validatedBy</code>{' '}
            renseignés).
          </li>
        </ol>
      </Section>

      <Section id="file-bs" title="7. La file de travail (BS)">
        <p className="mb-3">
          Le menu <i>File de travail</i> du Bureau de Suivi regroupe les directives en{' '}
          <b>6 onglets</b>&nbsp;:
        </p>
        <ul className="space-y-1.5 text-sm">
          <FileTab label="À traiter" desc="État = En cours" />
          <FileTab label="En attente" desc="État = En attente — actions qui n'ont pas démarré" />
          <FileTab label="En retard" desc="En cours + échéance dépassée" />
          <FileTab label="Soumises au SG" desc="statutValidation = soumis — en attente de la validation SG" />
          <FileTab label="Clôturées" desc="État = Réalisée" />
          <FileTab label="Inéligibles" desc="État = Inéligible — hors périmètre" />
        </ul>
        <Note>
          Chaque ligne du tableau permet de modifier <b>directement</b> l'état (menu déroulant) et
          l'échéance (date picker) sans ouvrir la fiche. La sauvegarde est automatique.
        </Note>
      </Section>

      <Section id="creer-directive" title="8. Créer / éditer une directive">
        <ol className="list-decimal pl-5 space-y-2">
          <li>
            Mode <b>Bureau de Suivi</b> → menu <i>Nouvelle recommandation</i> (icône{' '}
            <FilePlus className="inline w-3.5 h-3.5" />)
          </li>
          <li>Choisir ou créer la rencontre d'origine (Conseil interministériel, etc.)</li>
          <li>Remplir code, texte, ministères, échéance, état initial, direction responsable</li>
          <li>Cliquer <b>Créer</b> — la fiche est en état Brouillon</li>
          <li>Quand prête, cliquer <b>Soumettre</b> pour la passer au SG</li>
        </ol>
        <Note>
          Le bouton <b>Valider</b> n'apparaît que pour les profils <b>SG</b> et{' '}
          <b>Administrateur</b>, et uniquement quand la directive est en état{' '}
          <i>soumis</i>.
        </Note>
      </Section>

      <Section id="referentiels" title="9. Référentiels (admin uniquement)">
        <p>
          Le menu <Settings className="inline w-3.5 h-3.5" /> <i>Configuration</i> (visible
          admin uniquement) permet de gérer 12 listes éditables&nbsp;:
        </p>
        <ul className="list-disc pl-5 mt-2 grid sm:grid-cols-2 gap-x-4 gap-y-0.5 text-sm">
          <li>Sous-secteurs</li>
          <li>COPIL / Projets</li>
          <li>Types d'ouvrage</li>
          <li>États d'ouvrage</li>
          <li>Types de cause (retards)</li>
          <li>Lieux de réunion</li>
          <li>Régions du Sénégal</li>
          <li>Types de rencontre</li>
          <li>Types de matrice</li>
          <li>Types d'interpellation</li>
          <li>États d'interpellation</li>
          <li>Groupes parlementaires</li>
        </ul>
        <Note>
          Toutes les listes affichées dans l'application (menus déroulants, filtres) sont
          alimentées par ces référentiels — pas besoin de redéployer pour ajouter une valeur.
        </Note>
      </Section>

      <Section id="utilisateurs" title="10. Gestion des utilisateurs (admin uniquement)">
        <p>
          Menu <Users className="inline w-3.5 h-3.5" /> <i>Utilisateurs</i>. L'administrateur
          peut&nbsp;:
        </p>
        <ul className="list-disc pl-5 mt-2 space-y-0.5">
          <li>Créer un compte (username, nom complet, email, rôle, mot de passe initial)</li>
          <li>Modifier nom, email, rôle d'un compte existant</li>
          <li>Réinitialiser le mot de passe (le communiquer ensuite à l'utilisateur)</li>
          <li>Désactiver un compte (réversible)</li>
        </ul>
        <Note>
          Le <b>username</b> n'est jamais modifiable une fois créé. On ne peut pas désactiver son
          propre compte.
        </Note>
      </Section>

      <Section id="mon-mdp" title="11. Changer son propre mot de passe">
        <p>
          En haut à droite, à côté du bouton de déconnexion, cliquez sur l'icône{' '}
          <KeyRound className="inline w-3.5 h-3.5" /> <b>clé</b>. La modale demande le mot de
          passe actuel + le nouveau (8 caractères minimum) + confirmation.
        </p>
      </Section>

      <Section id="format-dates" title="12. Conventions">
        <ul className="space-y-1.5">
          <li>
            <b>Format des dates</b>&nbsp;: <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">YYYY-MM-DD</code>{' '}
            partout (ex. 2026-05-20). Affiché au format court{' '}
            <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">DD-MM-YYYY</code>.
          </li>
          <li>
            <b>Camel case</b>&nbsp;: les codes techniques (types, états) sont en camelCase
            (ex. <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">enCours</code>,{' '}
            <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">conseilInterMinisteriel</code>).
          </li>
          <li>
            <b>Codes directives</b>&nbsp;:{' '}
            <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">CI</code> (Conseil
            interministériel), <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">CM</code>{' '}
            (Conseil des ministres), <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">CSG</code>{' '}
            (Coordination SGG/SG), suivis de la date et d'un numéro d'ordre.
          </li>
        </ul>
      </Section>

      <Section id="raccourcis" title="13. Raccourcis utiles">
        <ul className="space-y-1.5">
          <li>
            <Inbox className="inline w-3.5 h-3.5" /> <b>File de travail</b> — point d'entrée
            quotidien du BS, liste les actions à mener.
          </li>
          <li>
            <ShieldCheck className="inline w-3.5 h-3.5" /> <b>Validation</b> — point d'entrée
            quotidien du SG, liste les directives à valider.
          </li>
          <li>
            <Building2 className="inline w-3.5 h-3.5" /> <b>Répartition par direction</b> —
            répartition des recommandations par direction technique du MHA.
          </li>
          <li>
            <CheckCircle2 className="inline w-3.5 h-3.5" /> <b>Sélection multiple</b> dans la
            File de travail&nbsp;: cocher plusieurs lignes puis "Marquer Réalisée" pour clore en
            lot.
          </li>
        </ul>
      </Section>

      <div className="text-center text-xs text-fg-muted mt-10 pb-4">
        Une question ? Contactez l'administrateur de l'application.
      </div>
    </div>
  );
}

// --- Composants internes ----------------------------------------------------

function Toc() {
  const items: { id: string; label: string }[] = [
    { id: 'introduction', label: '1. À quoi sert l\'application' },
    { id: 'roles', label: '2. Les profils utilisateur' },
    { id: 'vues', label: '3. Vue SG vs Bureau de Suivi' },
    { id: 'concepts', label: '4. Les concepts principaux' },
    { id: 'etats', label: "5. Les états d'une directive" },
    { id: 'workflow', label: '6. Workflow de validation' },
    { id: 'file-bs', label: '7. La file de travail (BS)' },
    { id: 'creer-directive', label: '8. Créer / éditer une directive' },
    { id: 'referentiels', label: '9. Référentiels (admin)' },
    { id: 'utilisateurs', label: '10. Utilisateurs (admin)' },
    { id: 'mon-mdp', label: '11. Changer son mot de passe' },
    { id: 'format-dates', label: '12. Conventions' },
    { id: 'raccourcis', label: '13. Raccourcis utiles' },
  ];
  return (
    <nav className="bg-surface border border-border rounded-lg p-4 mb-6">
      <div className="text-xs font-semibold uppercase tracking-wider text-fg-muted mb-2">Sommaire</div>
      <ol className="grid sm:grid-cols-2 gap-x-4 gap-y-1 text-sm">
        {items.map((it) => (
          <li key={it.id}>
            <a href={`#${it.id}`} className="text-primary hover:underline">
              {it.label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="bg-surface border border-border rounded-lg p-6 mb-4 scroll-mt-20">
      <h2 className="text-lg font-semibold text-fg mb-3">{title}</h2>
      <div className="text-sm text-fg-2 leading-relaxed">{children}</div>
    </section>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 bg-primary-50 border-l-4 border-primary px-3 py-2 text-sm text-fg-2 rounded-r">
      <b className="text-primary-700">À noter&nbsp;:</b> {children}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="border border-border rounded-lg p-3 bg-muted">{children}</div>;
}

function RoleCard({ color, name, desc }: { color: string; name: string; desc: string }) {
  return (
    <div className="border border-border rounded-lg p-3">
      <span className={cn('badge mb-2 inline-block', color)}>{name}</span>
      <p className="text-sm text-fg-2 leading-snug">{desc}</p>
    </div>
  );
}

function ConceptItem({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Landmark;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-l-2 border-primary-100 pl-3 py-2 mb-3 last:mb-0">
      <h4 className="font-semibold text-fg flex items-center gap-2 mb-1">
        <Icon className="w-4 h-4 text-primary" strokeWidth={1.8} /> {title}
      </h4>
      <div className="text-sm text-fg-2 leading-relaxed">{children}</div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="text-left px-3 py-2 text-[11.5px] font-semibold uppercase tracking-wider text-fg-muted border-b border-border">
      {children}
    </th>
  );
}

function EtatRow({
  badge,
  label,
  code,
  desc,
}: {
  badge: string;
  label: string;
  code: string;
  desc: string;
}) {
  return (
    <tr className="border-b border-border last:border-0">
      <td className="px-3 py-2.5">
        <span className={cn('badge', badge)}>{label}</span>
      </td>
      <td className="px-3 py-2.5 font-mono text-xs">{code}</td>
      <td className="px-3 py-2.5 text-fg-2">{desc}</td>
    </tr>
  );
}

function WorkflowStep({
  color,
  label,
  subtitle,
}: {
  color: string;
  label: string;
  subtitle: string;
}) {
  return (
    <div className="flex-1">
      <div className={cn('badge inline-block mb-1.5', color)}>{label}</div>
      <div className="text-[11.5px] text-fg-muted leading-snug">{subtitle}</div>
    </div>
  );
}

function Arrow() {
  return <div className="text-fg-muted text-xl select-none">→</div>;
}

function FileTab({ label, desc }: { label: string; desc: string }) {
  return (
    <li className="flex items-start gap-2">
      <span className="font-semibold text-fg min-w-[140px]">{label}</span>
      <span className="text-fg-2">{desc}</span>
    </li>
  );
}
