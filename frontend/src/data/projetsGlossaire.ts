/**
 * Glossaire des projets du Ministère de l'Hydraulique et de l'Assainissement.
 *
 * Données saisies à la main à partir des fiches projet, communiqués ministériels
 * et articles de presse cités en sources. Pas d'appel réseau — tout est bundlé.
 *
 * Quand un nouveau projet apparaît (ex. après lancement officiel), l'ajouter ici
 * suivant la même structure. Plus tard ces données pourront être migrées en base
 * via une table `projets` éditable par l'admin.
 */

export interface ProjetGlossaireSource {
  /** Libellé court de la source (ex. "Fonsis", "Adm", "Eau-assainissement"). */
  label: string;
  /** Optionnel : URL si disponible. */
  url?: string;
}

export interface ProjetGlossaire {
  /** Code court utilisé partout dans l'app (PROGEP II, PISEA, …). */
  code: string;
  /** Nom complet officiel. */
  fullName: string;
  /** Résumé d'une ou deux phrases pour la carte. */
  shortDescription: string;
  /** Texte riche pour la vue détaillée (paragraphes séparés par \n\n). */
  longDescription: string;
  /** Domaines / thématiques métier (sert au filtre). */
  domaines: string[];
  /** Régions du Sénégal couvertes. */
  regions: string[];
  /** Villes / communes clés ciblées. */
  villes?: string[];
  /** Partenaires financiers et techniques. */
  partenaires?: string[];
  /** Budget ou enveloppe principale (texte libre). */
  budget?: string;
  /** Période d'exécution (texte libre). */
  periode?: string;
  /** État d'avancement (texte libre, peut contenir des % ou jalons). */
  statut?: string;
  /** Catégorie haut niveau pour grouper (ex. "Eaux pluviales", "AEP rurale"). */
  categorie:
    | 'Eaux pluviales / Inondations'
    | 'AEP & Assainissement'
    | 'Dépollution & Environnement'
    | 'Mobilisation ressources'
    | 'Transfert d eau';
  /** Références presse / institutionnelles. */
  sources?: ProjetGlossaireSource[];
}

/* -------------------------------------------------------------------------- */
/* DONNEES                                                                    */
/* -------------------------------------------------------------------------- */

export const PROJETS_GLOSSAIRE: ProjetGlossaire[] = [
  {
    code: 'PROGEP II',
    fullName:
      "Projet de Gestion des Eaux Pluviales et d'adaptation au changement climatique (phase 2)",
    categorie: 'Eaux pluviales / Inondations',
    shortDescription:
      "Deuxième phase du PROGEP (lancé en 2012) — réduire les risques d'inondation dans la périphérie de Dakar et préparer la résilience climatique des villes durables.",
    longDescription:
      "Deuxième phase d'un projet lancé en 2012, porté par le Gouvernement du Sénégal avec la Banque mondiale et exécuté par l'Agence de Développement Municipal (ADM). Son objectif est de réduire les risques d'inondation dans les zones périurbaines de Dakar et d'améliorer la capacité de planification et de mise en œuvre de pratiques de gestion de « ville durable », notamment la résilience aux changements climatiques.\n\n" +
      "Le projet fait suite aux inondations de 2020 et 2022 et étend l'approche du PROGEP à de nouveaux sites périurbains de Dakar, avec une planification progressive vers d'autres régions comme Saint-Louis, Mbour et Thiès.\n\n" +
      "Le financement repose sur l'IDA (155 M USD) et le Fonds nordique de Développement (7 M EUR), pour un montant total mobilisé d'environ 318 M USD, soit plus de 175 milliards de FCFA.\n\n" +
      "Le cœur des réalisations se trouve à Keur Massar, avec des stations de pompage et des bassins de rétention. Plus de 9,9 millions de m³ d'eaux pluviales ont été évacués en 2023.",
    domaines: ['Eaux pluviales', 'Inondations', 'Résilience climatique', 'Ville durable'],
    regions: ['Dakar', 'Saint-Louis', 'Thiès'],
    villes: ['Keur Massar', 'Mbour'],
    partenaires: ['Gouvernement du Sénégal', 'Banque mondiale (IDA)', 'Fonds nordique de Développement', 'ADM (exécution)'],
    budget: '~318 M USD · ~175 Mds FCFA (IDA 155 M USD + FNDC 7 M EUR)',
    periode: 'Phase 2 démarrée après les inondations de 2020 et 2022 (PROGEP initial en 2012)',
    statut: '9,9 M m³ d\'eaux pluviales évacuées en 2023 — Keur Massar opérationnel',
    sources: [{ label: 'ADM' }, { label: 'Banque mondiale' }],
  },

  {
    code: 'PISEA',
    fullName: "Projet Intégré pour la Sécurité de l'Eau et de l'Assainissement (2025-2034)",
    categorie: 'AEP & Assainissement',
    shortDescription:
      "Projet décennal pour la sécurité de l'eau et de l'assainissement dans une logique d'économie circulaire. Phare : 100 000 latrines sur 10 ans dans 5 régions du nord et de l'est.",
    longDescription:
      "Projet décennal qui vise à améliorer les services d'eau et d'assainissement dans le cadre d'une économie circulaire. Sa composante phare est la réalisation de 100 000 latrines dans les régions de Saint-Louis, Matam, Louga, Kaffrine et Sédhiou, sur dix ans à partir de 2025.\n\n" +
      "Projet financé avec l'appui de la Banque Africaine de Développement, d'un montant de 30,236 milliards de FCFA pour une durée de 4 ans. Il a été lancé officiellement le 15 novembre 2025 à Kanel, dans la région de Matam, par le ministre Cheikh Tidiane Dièye.\n\n" +
      "Il cible sept départements répartis sur trois régions — Matam, Tambacounda et Kédougou (Matam, Kanel, Goudiry, Bakel, Tambacounda, Koumpentoum, Kédougou) — avec cinq Unités de Potabilisation et de Traitement de l'eau de surface (UPT) et des travaux d'amélioration de la production et de la qualité de l'eau pour 126 sites.\n\n" +
      "Le projet prévoit aussi plus de 15 000 branchements sociaux et l'extension des réseaux sur plus de 300 km. Il comprend la construction de stations de traitement des boues de vidange (STBV) à Goudiry, Koumpentoum et Ranérou.\n\n" +
      "Vingt cadres de concertation sont prévus pour une gestion participative des ressources en eau, incluant au moins 30 % de femmes, le tout inscrit dans la Vision Sénégal 2050 et l'ODD 6.\n\n" +
      "Plusieurs articles de presse élargissent la cible à six régions en ajoutant Louga, Kaffrine et Thiès, mais le communiqué officiel du ministère retient les trois régions ci-dessus.",
    domaines: ['Eau potable', 'Assainissement', 'Latrines', 'Boues de vidange', 'Branchements sociaux'],
    regions: ['Saint-Louis', 'Matam', 'Louga', 'Kaffrine', 'Sédhiou', 'Tambacounda', 'Kédougou', 'Thiès'],
    villes: ['Matam', 'Kanel', 'Goudiry', 'Bakel', 'Tambacounda', 'Koumpentoum', 'Kédougou', 'Ranérou'],
    partenaires: ['Banque Africaine de Développement (BAD)', 'Ministère de l\'Hydraulique et de l\'Assainissement'],
    budget: '30,236 Mds FCFA sur 4 ans (composante latrines : 10 ans 2025-2034)',
    periode: 'Lancement 15 nov. 2025 à Kanel (Matam) · Durée 4 ans (10 ans pour les 100 000 latrines)',
    statut: 'Lancement officiel · 100 000 latrines, 5 UPT, 126 sites, 15 000 branchements, 300 km réseaux, STBV',
    sources: [{ label: 'Communiqué ministériel' }, { label: 'Presse Eau & Assainissement' }],
  },

  {
    code: 'PDBH',
    fullName: 'Projet de Dépollution de la Baie de Hann',
    categorie: 'Dépollution & Environnement',
    shortDescription:
      "Plus grande opération de dépollution industrielle d'Afrique de l'Ouest. Mobilise 184,5 M EUR pour 300 000 bénéficiaires dans 9 communes de Dakar.",
    longDescription:
      "Présenté comme la plus grande opération de dépollution industrielle en Afrique de l'Ouest. Il mobilise 184,5 M EUR avec l'appui de partenaires internationaux (AFD, UE, CDB, entre autres) et vise 300 000 bénéficiaires directs dans 9 communes de la région de Dakar.\n\n" +
      "Le projet a connu des retards critiques liés à des litiges juridiques et des blocages financiers.\n\n" +
      "État d'avancement technique présenté à la presse :\n" +
      " · 97 % pour la conduite de refoulement\n" +
      " · 78 % pour la station d'épuration\n" +
      " · 57 % pour l'intercepteur\n" +
      " · 20 % pour les raccordements industriels",
    domaines: ['Dépollution industrielle', 'Assainissement urbain', 'Station d\'épuration'],
    regions: ['Dakar'],
    villes: ['Baie de Hann (9 communes)'],
    partenaires: ['AFD', 'Union Européenne', 'Caisse de Dépôts (CDB)'],
    budget: '184,5 M EUR',
    periode: 'En cours · retards liés à litiges juridiques et blocages financiers',
    statut: 'Conduite refoulement 97 % · Station épuration 78 % · Intercepteur 57 % · Raccordements industriels 20 %',
    sources: [{ label: 'Conférences de presse MHA' }],
  },

  {
    code: 'PROMOREN',
    fullName: "Projet de Mobilisation des Ressources en Eau du Nianija Bolong",
    categorie: 'Mobilisation ressources',
    shortDescription:
      "Mobiliser 46,6 M m³ d'eau douce et arrêter l'intrusion d'eaux salées dans le département de Koungheul, pour mettre en valeur 12 000 ha et créer 30 000 emplois par an.",
    longDescription:
      "Projet situé dans la région de Kaffrine, département de Koungheul. Il a pour objectif d'améliorer la disponibilité des ressources en eau de surface afin de développer des activités agro-sylvo-pastorales.\n\n" +
      "Objectifs concrets :\n" +
      " · mobiliser 46,6 millions de m³ d'eau douce\n" +
      " · arrêter l'intrusion des eaux salées en provenance du fleuve Gambie\n" +
      " · mettre en valeur 12 000 hectares\n" +
      " · créer au moins 30 000 emplois directs et indirects chaque année\n\n" +
      "Mise en œuvre : Office des Lacs et Cours d'Eau (OLAC), avec Kelimane Entreprise SA comme entreprise de travaux.",
    domaines: ['Mobilisation eau de surface', 'Lutte contre intrusion salée', 'Agriculture', 'Élevage'],
    regions: ['Kaffrine'],
    villes: ['Koungheul'],
    partenaires: ['OLAC (Office des Lacs et Cours d\'Eau)', 'Kelimane Entreprise SA (travaux)'],
    budget: 'Non public à ce jour',
    periode: 'En cours',
    statut: 'Cible : 46,6 M m³, 12 000 ha mis en valeur, 30 000 emplois/an',
  },

  {
    code: 'GTE',
    fullName: "Grand Transfert d'Eau — phase 1 de l'« Autoroute de l'Eau »",
    categorie: 'Transfert d eau',
    shortDescription:
      "Phase 1 prioritaire de l'« Autoroute de l'Eau » : acheminer l'eau du lac de Guiers vers le triangle Dakar-Mbour-Thiès et Touba. Cible 5 M personnes (11 M en 2050) + irrigation des Niayes.",
    longDescription:
      "Le GTE est la première « Autoroute de l'Eau » du Sénégal et la phase 1 prioritaire de cette initiative portée par le Ministère de l'Hydraulique et de l'Assainissement. Il consiste à mobiliser l'eau depuis le lac de Guiers, une zone favorable, pour l'acheminer vers le triangle Dakar-Mbour-Thiès, déficitaire. Le projet est érigé dans le sillage du Canal du Cayor et dessert aussi Touba ainsi que l'irrigation de la zone des Niayes.\n\n" +
      "Lancement officiel le 31 octobre 2024 à Dakar, sous la forme d'un partenariat entre le FONSIS (Fonds Souverain d'Investissements Stratégiques) et SINOHYDRO, filiale du groupe Power-China, retenue au terme d'une consultation parmi cinq entreprises internationales. SINOHYDRO et le FONSIS se sont d'abord engagés sur les coûts des études de faisabilité, sur la base d'un protocole d'accord entre deux entités de droit privé (non d'un marché public).\n\n" +
      "Impact attendu : eau potable pour près de 5 millions de personnes dès la mise en service, 11 millions d'usagers à l'horizon 2050. Irrigation de près de 12 000 hectares dans la zone des Niayes. Pour le volet Touba, le mandat d'exécution du Projet d'AEP durable a été signé fin décembre 2024 — la SONES assure le renouvellement total du réseau de distribution et la construction d'une usine de traitement de l'eau brute du lac de Guiers, équipée d'une centrale photovoltaïque pour l'autonomie énergétique avec un système de stockage de grande capacité.\n\n" +
      "Financement : ensemble des projets de transfert d'eau chiffré à 4 758 milliards FCFA par le ministre Cheikh Tidiane Dièye (contre 530 Mds FCFA pour la valorisation des eaux de surface). Financement recherché dans le cadre d'un PPP — démarrage des travaux annoncé pour la fin 2026.",
    domaines: ['Transfert d\'eau', 'Eau potable', 'Irrigation', 'PPP'],
    regions: ['Dakar', 'Thiès', 'Diourbel', 'Saint-Louis'],
    villes: ['Dakar', 'Mbour', 'Thiès', 'Touba', 'Niayes', 'Lac de Guiers'],
    partenaires: ['FONSIS', 'SINOHYDRO (Power-China)', 'SONES (volet Touba)'],
    budget: 'Enveloppe globale transferts d\'eau : 4 758 Mds FCFA (vs 530 Mds pour valorisation eaux de surface)',
    periode: 'Lancement 31 oct. 2024 (Dakar) · Démarrage travaux annoncé fin 2026',
    statut: 'Études de faisabilité engagées · Mandat Touba (SONES) signé fin déc. 2024',
    sources: [{ label: 'FONSIS' }, { label: 'RTS' }, { label: 'EnQuête+' }, { label: 'Le Soleil' }],
  },
];

/** Liste des catégories utilisées comme filtres (déduit des données). */
export const PROJETS_CATEGORIES = Array.from(
  new Set(PROJETS_GLOSSAIRE.map((p) => p.categorie)),
) as ProjetGlossaire['categorie'][];

/** Liste des régions distinctes apparaissant dans le glossaire. */
export const PROJETS_REGIONS = Array.from(
  new Set(PROJETS_GLOSSAIRE.flatMap((p) => p.regions)),
).sort();
