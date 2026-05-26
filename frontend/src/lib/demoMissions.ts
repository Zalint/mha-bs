import type { MissionTerrain } from '@mha-bs/shared';

/**
 * Sites pré-saisis dans les maquettes pour combler quand la table missionsTerrain est vide.
 * À supprimer dès que la table contient de vraies données.
 */
export const DEMO_MISSIONS: MissionTerrain[] = [
  {
    id: 'demo-1',
    dateMission: '2026-05-11',
    localite: 'Keur Massar',
    region: 'Dakar',
    latitude: 14.7799,
    longitude: -17.3344,
    projetRattache: 'PROGEP II',
    constats: 'Suivi des bassins versants de Mbao. Avancement satisfaisant.',
    recommandations: 'Curage à finaliser avant juin.',
    createdBy: null,
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 'demo-2',
    dateMission: '2026-05-11',
    localite: 'Tivaouane Peulh',
    region: 'Dakar',
    latitude: 14.8167,
    longitude: -17.2667,
    projetRattache: 'PISEA / SFI',
    constats: "Station d'épuration eaux usées (PPP).",
    recommandations: 'Études techniques en cours.',
    createdBy: null,
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 'demo-3',
    dateMission: '2026-05-11',
    localite: 'Thiaroye Sur Mer',
    region: 'Dakar',
    latitude: 14.7461,
    longitude: -17.3192,
    projetRattache: 'ONAS',
    constats: "Réseau d'assainissement.",
    recommandations: "Travaux à 68% d'avancement.",
    createdBy: null,
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 'demo-4',
    dateMission: '2026-05-11',
    localite: 'APIX Mbao',
    region: 'Dakar',
    latitude: 14.7333,
    longitude: -17.3667,
    projetRattache: 'DPGI',
    constats: 'Ouvrages anti-inondations.',
    recommandations: 'Maintenance avant hivernage.',
    createdBy: null,
    createdAt: '',
    updatedAt: '',
  },
];

/**
 * Filtre les missions démo par année (en se basant sur dateMission).
 * Si `annee === null`, renvoie tout.
 */
export function filterDemoMissionsByYear(annee: number | null): MissionTerrain[] {
  if (annee === null) return DEMO_MISSIONS;
  return DEMO_MISSIONS.filter((m) => {
    if (!m.dateMission) return false;
    return new Date(m.dateMission).getUTCFullYear() === annee;
  });
}
