// En prod, frontend et backend partagent la meme origine (1 seul service Render).
// On utilise donc un chemin relatif "/api". En dev, Vite proxy "/api" → backend localhost:3001.
export const env = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? '/api',
} as const;
