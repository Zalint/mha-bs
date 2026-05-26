-- =============================================================================
-- MHA · Bureau de Suivi — Schéma PostgreSQL
-- Convention : camelCase strict (tables ET colonnes), identifiants quotés
-- Dates : type DATE pour les dates métier (format YYYY-MM-DD)
--         TIMESTAMPTZ pour les timestamps techniques (createdAt, updatedAt)
-- Cible : Render PostgreSQL 15+, idempotent (CREATE IF NOT EXISTS)
-- Usage : psql "$DATABASE_URL" -f database/schema.sql
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Extensions
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- gen_random_uuid()


-- -----------------------------------------------------------------------------
-- Function trigger : mise à jour automatique de "updatedAt"
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "setUpdatedAt"()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- =============================================================================
-- TABLE : users
-- =============================================================================
CREATE TABLE IF NOT EXISTS "users" (
  "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "username"       VARCHAR(50)  NOT NULL UNIQUE,
  "email"          VARCHAR(255) NOT NULL UNIQUE,
  "passwordHash"   VARCHAR(255) NOT NULL,
  "fullName"       VARCHAR(150) NOT NULL,
  "role"           VARCHAR(20)  NOT NULL DEFAULT 'bs'
                   CHECK ("role" IN ('admin', 'bs', 'reader')),
  "isActive"       BOOLEAN      NOT NULL DEFAULT TRUE,
  "lastLoginAt"    TIMESTAMPTZ,
  "createdAt"      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "updatedAt"      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idxUsersRole"     ON "users" ("role");
CREATE INDEX IF NOT EXISTS "idxUsersActive"   ON "users" ("isActive");

DROP TRIGGER IF EXISTS "trgUsersUpdatedAt" ON "users";
CREATE TRIGGER "trgUsersUpdatedAt"
  BEFORE UPDATE ON "users"
  FOR EACH ROW EXECUTE FUNCTION "setUpdatedAt"();


-- =============================================================================
-- TABLE : refreshTokens (JWT refresh rotation)
-- =============================================================================
CREATE TABLE IF NOT EXISTS "refreshTokens" (
  "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId"      UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "tokenHash"   VARCHAR(255) NOT NULL UNIQUE,
  "expiresAt"   TIMESTAMPTZ NOT NULL,
  "revokedAt"   TIMESTAMPTZ,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "ipAddress"   VARCHAR(45),
  "userAgent"   TEXT
);

CREATE INDEX IF NOT EXISTS "idxRefreshTokensUser" ON "refreshTokens" ("userId");
CREATE INDEX IF NOT EXISTS "idxRefreshTokensHash" ON "refreshTokens" ("tokenHash");


-- =============================================================================
-- TABLE : apiKeys (auth externe x-api-key)
-- =============================================================================
CREATE TABLE IF NOT EXISTS "apiKeys" (
  "id"               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "nomIntegration"   VARCHAR(100) NOT NULL,
  "keyHash"          VARCHAR(255) NOT NULL UNIQUE,
  "keyPrefix"        VARCHAR(12)  NOT NULL,  -- 8 premiers caractères en clair pour identification
  "scopes"           TEXT[]       NOT NULL DEFAULT '{}',
  "isActive"         BOOLEAN      NOT NULL DEFAULT TRUE,
  "lastUsedAt"       TIMESTAMPTZ,
  "expiresAt"        TIMESTAMPTZ,
  "createdBy"        UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "createdAt"        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "updatedAt"        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idxApiKeysActive" ON "apiKeys" ("isActive");
CREATE INDEX IF NOT EXISTS "idxApiKeysPrefix" ON "apiKeys" ("keyPrefix");

DROP TRIGGER IF EXISTS "trgApiKeysUpdatedAt" ON "apiKeys";
CREATE TRIGGER "trgApiKeysUpdatedAt"
  BEFORE UPDATE ON "apiKeys"
  FOR EACH ROW EXECUTE FUNCTION "setUpdatedAt"();


-- =============================================================================
-- TABLE : directions (référentiel ONAS, DPGI, DGPRE, OFOR, etc.)
-- =============================================================================
CREATE TABLE IF NOT EXISTS "directions" (
  "id"          SERIAL PRIMARY KEY,
  "code"        VARCHAR(20)  NOT NULL UNIQUE,
  "fullName"    VARCHAR(200) NOT NULL,
  "typeEntite"  VARCHAR(30)  NOT NULL DEFAULT 'direction'
                CHECK ("typeEntite" IN ('direction', 'office', 'agence', 'societe', 'autre')),
  "color"       VARCHAR(10)  DEFAULT '#0284C7',
  "ordreAffichage" INT       NOT NULL DEFAULT 100,
  "isActive"    BOOLEAN      NOT NULL DEFAULT TRUE,
  "createdAt"   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "updatedAt"   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS "trgDirectionsUpdatedAt" ON "directions";
CREATE TRIGGER "trgDirectionsUpdatedAt"
  BEFORE UPDATE ON "directions"
  FOR EACH ROW EXECUTE FUNCTION "setUpdatedAt"();


-- =============================================================================
-- TABLE : rencontres (CM, CI, SGG/SG, COPIL, CNGI, Commission AN, Réunion technique)
-- =============================================================================
CREATE TABLE IF NOT EXISTS "rencontres" (
  "id"               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "typeRencontre"    VARCHAR(30) NOT NULL
                     CHECK ("typeRencontre" IN (
                       'conseilMinistres',
                       'conseilInterMinisteriel',
                       'coordinationSggSg',
                       'copil',
                       'cngi',
                       'reunionTechnique',
                       'commissionAn'
                     )),
  "codeRencontre"    VARCHAR(50) NOT NULL UNIQUE,
  "intitule"         TEXT        NOT NULL,
  "dateRencontre"    DATE        NOT NULL,
  "annee"            INT         NOT NULL,
  "copilName"        VARCHAR(50),  -- 'PROGEP II', 'PISEA', etc. — null si pas COPIL
  "createdBy"        UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "createdAt"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idxRencontresType"   ON "rencontres" ("typeRencontre");
CREATE INDEX IF NOT EXISTS "idxRencontresAnnee"  ON "rencontres" ("annee");
CREATE INDEX IF NOT EXISTS "idxRencontresDate"   ON "rencontres" ("dateRencontre");
CREATE INDEX IF NOT EXISTS "idxRencontresCopil"  ON "rencontres" ("copilName") WHERE "copilName" IS NOT NULL;

DROP TRIGGER IF EXISTS "trgRencontresUpdatedAt" ON "rencontres";
CREATE TRIGGER "trgRencontresUpdatedAt"
  BEFORE UPDATE ON "rencontres"
  FOR EACH ROW EXECUTE FUNCTION "setUpdatedAt"();


-- =============================================================================
-- TABLE : directives (cœur métier — directives présidentielles CM/CI/SGG-SG)
-- =============================================================================
CREATE TABLE IF NOT EXISTS "directives" (
  "id"                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "rencontreId"              UUID NOT NULL REFERENCES "rencontres"("id") ON DELETE CASCADE,
  "codeDirective"            VARCHAR(50) NOT NULL UNIQUE,
  "texteDirective"           TEXT        NOT NULL,
  "responsableId"            INT REFERENCES "directions"("id") ON DELETE SET NULL,
  "ministeresAssocies"       TEXT[]      NOT NULL DEFAULT '{}',
  "echeance"                 DATE,
  "debutExecution"           DATE,
  "finExecution"             DATE,
  "etat"                     VARCHAR(20) NOT NULL DEFAULT 'attente'
                             CHECK ("etat" IN ('attente', 'enCours', 'realisee', 'ineligible')),
  "typeCause"                VARCHAR(50),
  "joursPrevu"               INT,
  "joursReel"                INT,
  "joursRetardDemarrage"     INT,
  "derniereDateTraitement"   DATE,
  "commentaires"             TEXT,
  "statutValidation"         VARCHAR(20) NOT NULL DEFAULT 'brouillon'
                             CHECK ("statutValidation" IN ('brouillon', 'soumis', 'valide')),
  "validatedAt"              TIMESTAMPTZ,
  "validatedBy"              UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "createdBy"                UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "updatedBy"                UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "createdAt"                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idxDirectivesRencontre"    ON "directives" ("rencontreId");
CREATE INDEX IF NOT EXISTS "idxDirectivesEtat"         ON "directives" ("etat");
CREATE INDEX IF NOT EXISTS "idxDirectivesEcheance"     ON "directives" ("echeance");
CREATE INDEX IF NOT EXISTS "idxDirectivesResponsable"  ON "directives" ("responsableId");
CREATE INDEX IF NOT EXISTS "idxDirectivesStatut"       ON "directives" ("statutValidation");

DROP TRIGGER IF EXISTS "trgDirectivesUpdatedAt" ON "directives";
CREATE TRIGGER "trgDirectivesUpdatedAt"
  BEFORE UPDATE ON "directives"
  FOR EACH ROW EXECUTE FUNCTION "setUpdatedAt"();


-- =============================================================================
-- TABLE : recommandationsMatrice (COPIL, Réformes, CNGI — structure unifiée)
-- =============================================================================
CREATE TABLE IF NOT EXISTS "recommandationsMatrice" (
  "id"                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "typeMatrice"           VARCHAR(40) NOT NULL
                          CHECK ("typeMatrice" IN (
                            'copilProgepIi',
                            'copilPisea',
                            'copilPaseaRd',
                            'copilPdbh',
                            'copilPromoren',
                            'reformeAssainissement',
                            'reformeInstitutionnelle',
                            'cngi'
                          )),
  "numOrdre"              INT         NOT NULL,
  "texteRecommandation"   TEXT        NOT NULL,
  "etat"                  VARCHAR(20) NOT NULL DEFAULT 'attente'
                          CHECK ("etat" IN ('attente', 'enCours', 'realisee', 'ineligible')),
  "observations"          TEXT,
  "echeanceTrimestre"     VARCHAR(5)  CHECK ("echeanceTrimestre" IN ('T1', 'T2', 'T3', 'T4')),
  "priorite"              VARCHAR(20) CHECK ("priorite" IN ('urgent', 'prioritaire', 'obligatoire', 'standard')),
  "responsableId"         INT REFERENCES "directions"("id") ON DELETE SET NULL,
  "createdBy"             UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "updatedBy"             UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "createdAt"             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("typeMatrice", "numOrdre")
);

CREATE INDEX IF NOT EXISTS "idxMatriceType"   ON "recommandationsMatrice" ("typeMatrice");
CREATE INDEX IF NOT EXISTS "idxMatriceEtat"   ON "recommandationsMatrice" ("etat");

DROP TRIGGER IF EXISTS "trgMatriceUpdatedAt" ON "recommandationsMatrice";
CREATE TRIGGER "trgMatriceUpdatedAt"
  BEFORE UPDATE ON "recommandationsMatrice"
  FOR EACH ROW EXECUTE FUNCTION "setUpdatedAt"();


-- =============================================================================
-- TABLE : reunionsTechniques
-- =============================================================================
CREATE TABLE IF NOT EXISTS "reunionsTechniques" (
  "id"                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "dateReunion"          DATE        NOT NULL,
  "heureDebut"           TIME,
  "dureeEstimee"         VARCHAR(20),
  "theme"                TEXT        NOT NULL,
  "lieu"                 VARCHAR(200),
  "sousSecteur"          VARCHAR(40)
                         CHECK ("sousSecteur" IN ('eau', 'gire', 'assainissement', 'inondations', 'transversal', 'reformeInstitutionnelle')),
  "copilLie"             VARCHAR(50),
  "ordreDuJour"          TEXT,
  "decisions"            TEXT,
  "participants"         JSONB       NOT NULL DEFAULT '[]',
  "visibleSg"            BOOLEAN     NOT NULL DEFAULT TRUE,
  "inclusRapportHebdo"   BOOLEAN     NOT NULL DEFAULT FALSE,
  "createdBy"            UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "createdAt"            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idxReunionsDate"        ON "reunionsTechniques" ("dateReunion");
CREATE INDEX IF NOT EXISTS "idxReunionsSousSecteur" ON "reunionsTechniques" ("sousSecteur");

DROP TRIGGER IF EXISTS "trgReunionsUpdatedAt" ON "reunionsTechniques";
CREATE TRIGGER "trgReunionsUpdatedAt"
  BEFORE UPDATE ON "reunionsTechniques"
  FOR EACH ROW EXECUTE FUNCTION "setUpdatedAt"();


-- =============================================================================
-- TABLE : missionsTerrain + ouvragesVisites
-- =============================================================================
CREATE TABLE IF NOT EXISTS "missionsTerrain" (
  "id"                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "dateMission"         DATE        NOT NULL,
  "localite"            VARCHAR(200) NOT NULL,
  "region"              VARCHAR(50),
  "latitude"            DECIMAL(9,6),
  "longitude"           DECIMAL(9,6),
  "projetRattache"      VARCHAR(100),
  "constats"            TEXT,
  "recommandations"     TEXT,
  "createdBy"           UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "createdAt"           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idxMissionsDate"   ON "missionsTerrain" ("dateMission");
CREATE INDEX IF NOT EXISTS "idxMissionsRegion" ON "missionsTerrain" ("region");

DROP TRIGGER IF EXISTS "trgMissionsUpdatedAt" ON "missionsTerrain";
CREATE TRIGGER "trgMissionsUpdatedAt"
  BEFORE UPDATE ON "missionsTerrain"
  FOR EACH ROW EXECUTE FUNCTION "setUpdatedAt"();


CREATE TABLE IF NOT EXISTS "ouvragesVisites" (
  "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "missionId"      UUID NOT NULL REFERENCES "missionsTerrain"("id") ON DELETE CASCADE,
  "nomOuvrage"     VARCHAR(200) NOT NULL,
  "typeOuvrage"    VARCHAR(50),
  "etatOuvrage"    VARCHAR(30) DEFAULT 'fonctionnel'
                   CHECK ("etatOuvrage" IN ('fonctionnel', 'maintenance', 'horsService', 'enConstruction')),
  "observations"   TEXT,
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idxOuvragesMission" ON "ouvragesVisites" ("missionId");


-- =============================================================================
-- TABLE : deputes (référentiel)
-- =============================================================================
CREATE TABLE IF NOT EXISTS "deputes" (
  "id"                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "nomComplet"            VARCHAR(150) NOT NULL,
  "sexe"                  CHAR(1) CHECK ("sexe" IN ('M', 'F')),
  "groupeParlementaire"   VARCHAR(50) NOT NULL,
  "region"                VARCHAR(50),
  "isActive"              BOOLEAN     NOT NULL DEFAULT TRUE,
  "createdAt"             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idxDeputesGroupe" ON "deputes" ("groupeParlementaire");

DROP TRIGGER IF EXISTS "trgDeputesUpdatedAt" ON "deputes";
CREATE TRIGGER "trgDeputesUpdatedAt"
  BEFORE UPDATE ON "deputes"
  FOR EACH ROW EXECUTE FUNCTION "setUpdatedAt"();


-- =============================================================================
-- TABLE : sessionsParlementaires (référentiel)
-- =============================================================================
CREATE TABLE IF NOT EXISTS "sessionsParlementaires" (
  "id"           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "intitule"     VARCHAR(150) NOT NULL,
  "typeSession"  VARCHAR(30)  NOT NULL
                 CHECK ("typeSession" IN ('ordinaire', 'budgetaire', 'extraordinaire')),
  "dateDebut"    DATE         NOT NULL,
  "dateFin"      DATE,
  "isActive"     BOOLEAN      NOT NULL DEFAULT TRUE,
  "createdAt"    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "updatedAt"    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idxSessionsDebut" ON "sessionsParlementaires" ("dateDebut");

DROP TRIGGER IF EXISTS "trgSessionsUpdatedAt" ON "sessionsParlementaires";
CREATE TRIGGER "trgSessionsUpdatedAt"
  BEFORE UPDATE ON "sessionsParlementaires"
  FOR EACH ROW EXECUTE FUNCTION "setUpdatedAt"();


-- =============================================================================
-- TABLE : interpellations
-- =============================================================================
CREATE TABLE IF NOT EXISTS "interpellations" (
  "id"                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "reference"            VARCHAR(30)  NOT NULL UNIQUE,
  "deputeId"             UUID         NOT NULL REFERENCES "deputes"("id") ON DELETE RESTRICT,
  "sessionId"            UUID         REFERENCES "sessionsParlementaires"("id") ON DELETE SET NULL,
  "titre"                TEXT         NOT NULL,
  "description"          TEXT,
  "typeInterpellation"   VARCHAR(20)  NOT NULL
                         CHECK ("typeInterpellation" IN ('orale', 'ecrite', 'commission')),
  "dateReception"        DATE         NOT NULL,
  "echeanceReponse"      DATE,
  "dateReponse"          DATE,
  "etat"                 VARCHAR(20)  NOT NULL DEFAULT 'recue'
                         CHECK ("etat" IN ('recue', 'enPreparation', 'aValider', 'repondue')),
  "texteReponse"         TEXT,
  "createdBy"            UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "updatedBy"            UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "createdAt"            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "updatedAt"            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idxInterpellationsEtat"     ON "interpellations" ("etat");
CREATE INDEX IF NOT EXISTS "idxInterpellationsDate"     ON "interpellations" ("dateReception");
CREATE INDEX IF NOT EXISTS "idxInterpellationsDepute"   ON "interpellations" ("deputeId");
CREATE INDEX IF NOT EXISTS "idxInterpellationsSession"  ON "interpellations" ("sessionId");

DROP TRIGGER IF EXISTS "trgInterpellationsUpdatedAt" ON "interpellations";
CREATE TRIGGER "trgInterpellationsUpdatedAt"
  BEFORE UPDATE ON "interpellations"
  FOR EACH ROW EXECUTE FUNCTION "setUpdatedAt"();


-- =============================================================================
-- TABLE : piecesJointes (polymorphique)
-- =============================================================================
CREATE TABLE IF NOT EXISTS "piecesJointes" (
  "id"               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "entiteType"       VARCHAR(30) NOT NULL
                     CHECK ("entiteType" IN ('directive', 'recommandation', 'reunion', 'mission', 'interpellation')),
  "entiteId"         UUID         NOT NULL,
  "nomFichier"       VARCHAR(255) NOT NULL,
  "cheminStorage"    VARCHAR(500) NOT NULL,
  "typeMime"         VARCHAR(100),
  "tailleBytes"      BIGINT,
  "uploadedBy"       UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "uploadedAt"       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idxPiecesEntite" ON "piecesJointes" ("entiteType", "entiteId");


-- =============================================================================
-- TABLE : commentaires (threads sur entités métier)
-- =============================================================================
CREATE TABLE IF NOT EXISTS "commentaires" (
  "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "entiteType"  VARCHAR(30) NOT NULL,
  "entiteId"    UUID         NOT NULL,
  "texte"       TEXT         NOT NULL,
  "auteurId"    UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "createdAt"   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idxCommentairesEntite" ON "commentaires" ("entiteType", "entiteId");


-- =============================================================================
-- TABLE : auditLog (audit transverse)
-- =============================================================================
CREATE TABLE IF NOT EXISTS "auditLog" (
  "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId"      UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "action"      VARCHAR(50) NOT NULL,
  "entiteType"  VARCHAR(30) NOT NULL,
  "entiteId"    UUID,
  "avant"       JSONB,
  "apres"       JSONB,
  "ipAddress"   VARCHAR(45),
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idxAuditUser"   ON "auditLog" ("userId");
CREATE INDEX IF NOT EXISTS "idxAuditEntite" ON "auditLog" ("entiteType", "entiteId");
CREATE INDEX IF NOT EXISTS "idxAuditDate"   ON "auditLog" ("createdAt");


-- =============================================================================
-- TABLE : alertes
-- =============================================================================
CREATE TABLE IF NOT EXISTS "alertes" (
  "id"                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId"              UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "categorie"           VARCHAR(20) NOT NULL
                        CHECK ("categorie" IN ('critique', 'warning', 'info')),
  "titre"               VARCHAR(255) NOT NULL,
  "description"         TEXT,
  "sourceEntiteType"    VARCHAR(30),
  "sourceEntiteId"      UUID,
  "lue"                 BOOLEAN     NOT NULL DEFAULT FALSE,
  "createdAt"           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idxAlertesUser"   ON "alertes" ("userId", "lue");
CREATE INDEX IF NOT EXISTS "idxAlertesDate"   ON "alertes" ("createdAt");


-- =============================================================================
-- TABLE : alertesRegles (paramétrage des règles utilisateur)
-- =============================================================================
CREATE TABLE IF NOT EXISTS "alertesRegles" (
  "id"           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId"       UUID REFERENCES "users"("id") ON DELETE CASCADE,
  "codeRegle"    VARCHAR(50)  NOT NULL,
  "isActive"     BOOLEAN      NOT NULL DEFAULT TRUE,
  "parametres"   JSONB        DEFAULT '{}',
  "createdAt"    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "updatedAt"    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE ("userId", "codeRegle")
);

DROP TRIGGER IF EXISTS "trgAlertesReglesUpdatedAt" ON "alertesRegles";
CREATE TRIGGER "trgAlertesReglesUpdatedAt"
  BEFORE UPDATE ON "alertesRegles"
  FOR EACH ROW EXECUTE FUNCTION "setUpdatedAt"();


-- =============================================================================
-- TABLE : exports (historique des rapports générés)
-- =============================================================================
CREATE TABLE IF NOT EXISTS "exports" (
  "id"              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "templateCode"    VARCHAR(50)  NOT NULL,
  "format"          VARCHAR(10)  NOT NULL
                    CHECK ("format" IN ('pdf', 'docx', 'xlsx', 'pptx', 'csv')),
  "periodeDebut"    DATE,
  "periodeFin"      DATE,
  "destinataires"   TEXT[]       DEFAULT '{}',
  "cheminFichier"   VARCHAR(500),
  "tailleBytes"     BIGINT,
  "statut"          VARCHAR(20)  NOT NULL DEFAULT 'genere'
                    CHECK ("statut" IN ('enCours', 'genere', 'envoye', 'echec')),
  "createdBy"       UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "createdAt"       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idxExportsTemplate" ON "exports" ("templateCode");
CREATE INDEX IF NOT EXISTS "idxExportsDate"     ON "exports" ("createdAt");


-- =============================================================================
-- TABLE : exportsSchedules (programmations cron des rapports)
-- =============================================================================
CREATE TABLE IF NOT EXISTS "exportsSchedules" (
  "id"               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "templateCode"     VARCHAR(50)  NOT NULL,
  "label"            VARCHAR(100) NOT NULL,
  "cronExpression"   VARCHAR(50)  NOT NULL,
  "destinataires"    TEXT[]       NOT NULL DEFAULT '{}',
  "isActive"         BOOLEAN      NOT NULL DEFAULT TRUE,
  "lastRunAt"        TIMESTAMPTZ,
  "nextRunAt"        TIMESTAMPTZ,
  "createdBy"        UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "createdAt"        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "updatedAt"        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS "trgSchedulesUpdatedAt" ON "exportsSchedules";
CREATE TRIGGER "trgSchedulesUpdatedAt"
  BEFORE UPDATE ON "exportsSchedules"
  FOR EACH ROW EXECUTE FUNCTION "setUpdatedAt"();


-- =============================================================================
-- TABLE : referentiels (listes editables : sous-secteurs, COPIL/projets, types d'ouvrage, etc.)
-- =============================================================================
CREATE TABLE IF NOT EXISTS "referentiels" (
  "id"              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "codeType"        VARCHAR(50)  NOT NULL,
  "code"            VARCHAR(100) NOT NULL,
  "label"           VARCHAR(255) NOT NULL,
  "description"     TEXT,
  "ordreAffichage"  INT          NOT NULL DEFAULT 100,
  "isActive"        BOOLEAN      NOT NULL DEFAULT TRUE,
  "createdBy"       UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "createdAt"       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "updatedAt"       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE ("codeType", "code")
);

CREATE INDEX IF NOT EXISTS "idxReferentielsType" ON "referentiels" ("codeType");

DROP TRIGGER IF EXISTS "trgReferentielsUpdatedAt" ON "referentiels";
CREATE TRIGGER "trgReferentielsUpdatedAt"
  BEFORE UPDATE ON "referentiels"
  FOR EACH ROW EXECUTE FUNCTION "setUpdatedAt"();

-- Seeds initiaux
INSERT INTO "referentiels" ("codeType", "code", "label", "ordreAffichage") VALUES
  -- Sous-secteurs
  ('sousSecteur', 'eau',                     'Sous-secteur Eau (acces)',         10),
  ('sousSecteur', 'gire',                    'GIRE (ressources en eau)',         20),
  ('sousSecteur', 'assainissement',          'Assainissement (eaux usees)',      30),
  ('sousSecteur', 'inondations',             'Eaux pluviales / Inondations',     40),
  ('sousSecteur', 'transversal',             'Projets transversaux',             50),
  ('sousSecteur', 'reformeInstitutionnelle', 'Reforme institutionnelle',         60),
  -- COPIL / projets
  ('copilProjet', 'progepIi',                'PROGEP II',                        10),
  ('copilProjet', 'pisea',                   'PISEA',                            20),
  ('copilProjet', 'paseaRd',                 'PASEA-RD',                         30),
  ('copilProjet', 'pdbh',                    'PDBH',                             40),
  ('copilProjet', 'promoren',                'PROMOREN',                         50),
  -- Types d'ouvrage
  ('typeOuvrage', 'bassinRetention',         'Bassin de retention',              10),
  ('typeOuvrage', 'stationPompage',          'Station de pompage',               20),
  ('typeOuvrage', 'reseauAssainissement',    'Reseau d''assainissement',         30),
  ('typeOuvrage', 'stationEpuration',        'Station d''epuration',             40),
  ('typeOuvrage', 'forage',                  'Forage',                           50),
  ('typeOuvrage', 'reseauAep',               'Reseau AEP (eau potable)',         60),
  ('typeOuvrage', 'autre',                   'Autre ouvrage',                    90),
  -- Etats d'ouvrage
  ('etatOuvrage', 'fonctionnel',             'Fonctionnel',                      10),
  ('etatOuvrage', 'maintenance',             'En maintenance',                   20),
  ('etatOuvrage', 'horsService',             'Hors service',                     30),
  ('etatOuvrage', 'enConstruction',          'En construction',                  40),
  -- Types de cause (retards de directives)
  ('typeCause',   'coordinationInterministerielle', 'Coordination interministerielle', 10),
  ('typeCause',   'mobilisationFinancements',       'Mobilisation des financements',  20),
  ('typeCause',   'procedurePassationMarches',      'Procedure passation des marches', 30),
  ('typeCause',   'etudeTechnique',                 'Etude technique',                 40),
  ('typeCause',   'autre',                          'Autre cause',                     90),
  -- Lieux de reunion frequents
  ('lieuReunion', 'sgMhaPleniere',           'SG MHA - Salle Pleniere',          10),
  ('lieuReunion', 'sgMhaCabinet',            'SG MHA - Salle Cabinet',           20),
  ('lieuReunion', 'onasSiege',               'ONAS - Siege',                     30),
  ('lieuReunion', 'dpgiDirection',           'DPGI - Bureau Direction',          40),
  ('lieuReunion', 'visio',                   'En visioconference',               50),
  -- Regions administratives du Senegal (14)
  ('regionSenegal', 'dakar',         'Dakar',         10),
  ('regionSenegal', 'thies',         'Thies',         20),
  ('regionSenegal', 'diourbel',      'Diourbel',      30),
  ('regionSenegal', 'saintLouis',    'Saint-Louis',   40),
  ('regionSenegal', 'louga',         'Louga',         50),
  ('regionSenegal', 'fatick',        'Fatick',        60),
  ('regionSenegal', 'kaolack',       'Kaolack',       70),
  ('regionSenegal', 'kaffrine',      'Kaffrine',      80),
  ('regionSenegal', 'tambacounda',   'Tambacounda',  90),
  ('regionSenegal', 'kedougou',      'Kedougou',     100),
  ('regionSenegal', 'kolda',         'Kolda',        110),
  ('regionSenegal', 'sedhiou',       'Sedhiou',      120),
  ('regionSenegal', 'ziguinchor',    'Ziguinchor',   130),
  ('regionSenegal', 'matam',         'Matam',        140),
  -- Types de rencontre (miroir de l'enum DB, labels editables)
  ('typeRencontre', 'conseilMinistres',         'Conseil des ministres',                  10),
  ('typeRencontre', 'conseilInterMinisteriel',  'Conseil inter-ministeriel',              20),
  ('typeRencontre', 'coordinationSggSg',        'Coordination SGG/SG',                    30),
  ('typeRencontre', 'copil',                    'COPIL',                                  40),
  ('typeRencontre', 'cngi',                     'CNGI',                                   50),
  ('typeRencontre', 'reunionTechnique',         'Reunion technique',                      60),
  ('typeRencontre', 'commissionAn',             'Commission Assemblee Nationale',         70),
  -- Types de matrice (8 matrices : 5 COPIL + 2 reformes + CNGI)
  ('typeMatrice',   'copilProgepIi',            'COPIL PROGEP II',                        10),
  ('typeMatrice',   'copilPisea',               'COPIL PISEA',                            20),
  ('typeMatrice',   'copilPaseaRd',             'COPIL PASEA-RD',                         30),
  ('typeMatrice',   'copilPdbh',                'COPIL PDBH',                             40),
  ('typeMatrice',   'copilPromoren',            'COPIL PROMOREN',                         50),
  ('typeMatrice',   'reformeAssainissement',    'Reforme Assainissement',                 60),
  ('typeMatrice',   'reformeInstitutionnelle',  'Reforme Institutionnelle',               70),
  ('typeMatrice',   'cngi',                     'CNGI',                                   80),
  -- Types d'interpellation parlementaire
  ('typeInterpellation', 'orale',               'Question orale',                         10),
  ('typeInterpellation', 'ecrite',              'Question ecrite',                        20),
  ('typeInterpellation', 'commission',          'Interpellation en commission',           30),
  -- Etats d'interpellation
  ('etatInterpellation', 'recue',               'Recue',                                  10),
  ('etatInterpellation', 'enPreparation',       'En preparation',                         20),
  ('etatInterpellation', 'aValider',            'A valider SG',                           30),
  ('etatInterpellation', 'repondue',            'Repondue',                               40),
  -- Groupes parlementaires
  ('groupeParlementaire', 'Pastef',             'Pastef-Les Patriotes',                   10),
  ('groupeParlementaire', 'BBY',                'BBY (Benno Bokk Yakaar)',                20),
  ('groupeParlementaire', 'Yewwi',              'Yewwi Askan Wi',                         30),
  ('groupeParlementaire', 'Wallu',              'Wallu Senegal',                          40),
  ('groupeParlementaire', 'NI',                 'Non-inscrit',                            50)
ON CONFLICT ("codeType", "code") DO NOTHING;


-- =============================================================================
-- Relachement des CHECK constraints sur les enums devenus extensibles via Config
-- (typeRencontre, typeMatrice, typeInterpellation, etatInterpellation)
-- Les valeurs autorisees sont desormais portees par la table "referentiels".
-- =============================================================================
ALTER TABLE "rencontres"             DROP CONSTRAINT IF EXISTS "rencontres_typeRencontre_check";
ALTER TABLE "recommandationsMatrice" DROP CONSTRAINT IF EXISTS "recommandationsMatrice_typeMatrice_check";
ALTER TABLE "interpellations"        DROP CONSTRAINT IF EXISTS "interpellations_typeInterpellation_check";
ALTER TABLE "interpellations"        DROP CONSTRAINT IF EXISTS "interpellations_etat_check";


-- =============================================================================
-- Hierarchie referentiel : parentCode permet de rattacher une entree a une
-- autre entree du meme codeType (ou d'un codeType "categorie" dedie).
-- Utilise pour : mapping typeMatrice -> matriceCategorie (COPIL/Reformes/CNGI/Autres).
-- =============================================================================
ALTER TABLE "referentiels" ADD COLUMN IF NOT EXISTS "parentCode" VARCHAR(100);

-- Seed des categories de matrice
INSERT INTO "referentiels" ("codeType", "code", "label", "ordreAffichage") VALUES
  ('matriceCategorie', 'copil',    'COPIL',    10),
  ('matriceCategorie', 'reformes', 'Reformes', 20),
  ('matriceCategorie', 'cngi',     'CNGI',     30),
  ('matriceCategorie', 'autres',   'Autres',   99),
  -- Types de reunion (pour BsReunionMissionView : COPIL vs technique)
  ('typeReunion', 'copil',     'COPIL',     10),
  ('typeReunion', 'technique', 'Technique', 20)
ON CONFLICT ("codeType", "code") DO NOTHING;

-- Backfill : rattachement des 8 matrices existantes a leur categorie
UPDATE "referentiels" SET "parentCode" = 'copil'    WHERE "codeType" = 'typeMatrice' AND "code" LIKE 'copil%'   AND "parentCode" IS NULL;
UPDATE "referentiels" SET "parentCode" = 'reformes' WHERE "codeType" = 'typeMatrice' AND "code" LIKE 'reforme%' AND "parentCode" IS NULL;
UPDATE "referentiels" SET "parentCode" = 'cngi'     WHERE "codeType" = 'typeMatrice' AND "code" = 'cngi'        AND "parentCode" IS NULL;

-- Colonne typeReunion sur reunionsTechniques (copil/technique/...)
ALTER TABLE "reunionsTechniques" ADD COLUMN IF NOT EXISTS "typeReunion" VARCHAR(50);


-- =============================================================================
-- VUES : agrégations dashboard
-- =============================================================================

-- Vue : taux d'exécution par direction
CREATE OR REPLACE VIEW "vDirectiveStatsByDirection" AS
SELECT
  d."id"          AS "directionId",
  d."code"        AS "directionCode",
  d."fullName"    AS "directionName",
  COUNT(dir."id") AS "totalDirectives",
  COUNT(*) FILTER (WHERE dir."etat" = 'realisee')   AS "nbRealisees",
  COUNT(*) FILTER (WHERE dir."etat" = 'enCours')    AS "nbEnCours",
  COUNT(*) FILTER (WHERE dir."etat" = 'attente')    AS "nbAttente",
  COUNT(*) FILTER (WHERE dir."etat" = 'ineligible') AS "nbIneligibles",
  COUNT(*) FILTER (
    WHERE dir."etat" IN ('enCours', 'attente')
    AND dir."echeance" IS NOT NULL
    AND dir."echeance" < CURRENT_DATE
  ) AS "nbRetards"
FROM "directions" d
LEFT JOIN "directives" dir ON dir."responsableId" = d."id"
GROUP BY d."id", d."code", d."fullName";


-- Vue : KPIs globaux dashboard
CREATE OR REPLACE VIEW "vDashboardKpis" AS
SELECT
  COUNT(*) AS "totalDirectives",
  COUNT(*) FILTER (WHERE "etat" = 'realisee')                          AS "nbRealisees",
  COUNT(*) FILTER (WHERE "etat" = 'enCours')                           AS "nbEnCours",
  COUNT(*) FILTER (WHERE "etat" = 'attente')                           AS "nbAttente",
  COUNT(*) FILTER (WHERE "etat" = 'ineligible')                        AS "nbIneligibles",
  COUNT(*) FILTER (
    WHERE "etat" IN ('enCours', 'attente')
    AND "echeance" IS NOT NULL
    AND "echeance" < CURRENT_DATE
  ) AS "nbRetards",
  ROUND(
    COUNT(*) FILTER (WHERE "etat" = 'realisee')::DECIMAL / NULLIF(COUNT(*), 0) * 100,
    1
  ) AS "tauxExecution"
FROM "directives";


-- =============================================================================
-- SEEDS : référentiels obligatoires
-- =============================================================================

-- Directions / Entités sous tutelle du MHA
INSERT INTO "directions" ("code", "fullName", "typeEntite", "color", "ordreAffichage")
VALUES
  ('ONAS',  'Office National d''Assainissement du Sénégal',                  'office',    '#0284C7', 10),
  ('DPGI',  'Direction Prévention & Gestion des Inondations',                'direction', '#06B6D4', 20),
  ('DGPRE', 'Direction Gestion & Planification des Ressources en Eau',       'direction', '#0891B2', 30),
  ('OFOR',  'Office des Forages Ruraux',                                     'office',    '#0EA5E9', 40),
  ('CPCSP', 'Cellule de Préparation, Coordination & Suivi des Projets',      'direction', '#0369A1', 50),
  ('DA',    'Direction de l''Assainissement',                                'direction', '#22D3EE', 60),
  ('OLAC',  'Office des Lacs & Cours d''Eau',                                'office',    '#0E7490', 70),
  ('DH',    'Direction de l''Hydraulique',                                   'direction', '#155E75', 80),
  ('SONES', 'Société Nationale des Eaux du Sénégal',                         'societe',   '#67E8F9', 90),
  ('DGUA',  'Direction Générale de l''Architecture et de l''Urbanisme',      'direction', '#0F766E', 100),
  ('ADM',   'Agence de Développement Municipal',                             'agence',    '#164E63', 110),
  ('APIX',  'Agence pour la Promotion des Investissements',                  'agence',    '#22D3EE', 120)
ON CONFLICT ("code") DO NOTHING;


-- Sessions parlementaires (exemple 2025-2026)
INSERT INTO "sessionsParlementaires" ("intitule", "typeSession", "dateDebut", "dateFin")
VALUES
  ('Session ordinaire 2024-2025',          'ordinaire',     '2024-10-01', '2025-06-30'),
  ('Session budgétaire 2026',              'budgetaire',    '2025-12-01', '2026-01-31'),
  ('Session ordinaire 2025-2026',          'ordinaire',     '2026-04-01', '2026-07-31'),
  ('Session extraordinaire mars 2026',     'extraordinaire','2026-03-01', '2026-03-31')
ON CONFLICT DO NOTHING;


-- Députés (exemples)
INSERT INTO "deputes" ("nomComplet", "sexe", "groupeParlementaire", "region")
VALUES
  ('Mariama Sall',       'F', 'BBY',    'Dakar'),
  ('Cheikh Diop',        'M', 'Pastef', 'Diourbel'),
  ('Fatou Ndiaye',       'F', 'Yewwi',  'Thiès'),
  ('Ibrahima Bâ',        'M', 'BBY',    'Saint-Louis'),
  ('Aïssatou Sow',       'F', 'Pastef', 'Kaffrine'),
  ('Moussa Camara',      'M', 'BBY',    'Diourbel'),
  ('Khadidiatou Sy',     'F', 'Pastef', 'Dakar'),
  ('Amadou Diallo',      'M', 'Yewwi',  'Saint-Louis'),
  ('Ndèye Fatou Diouf',  'F', 'BBY',    'Fatick'),
  ('Saliou Ndiaye',      'M', 'Pastef', 'Dakar'),
  ('Ousmane Sané',       'M', 'Wallu',  'Kolda'),
  ('Aïda Bâ',            'F', 'Pastef', 'Dakar')
ON CONFLICT DO NOTHING;


-- =============================================================================
-- FIN DU SCHÉMA
-- =============================================================================
-- Étapes suivantes (côté backend, hors SQL) :
--   1. Créer l'utilisateur admin initial via un script Node sécurisé
--      (mot de passe hashé bcrypt, jamais en clair dans le SQL).
--   2. Importer les 198 directives du POC depuis l'Excel.
--   3. Générer une première apiKey externe pour les tests d'intégration.
-- =============================================================================
