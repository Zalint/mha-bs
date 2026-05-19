import { Toaster as SonnerToaster } from 'sonner';

/**
 * Provider sonner global. A poser une seule fois pres de la racine.
 *
 * Usage dans le code applicatif :
 *   import { toast } from 'sonner';
 *   toast.success('Recommandation enregistree');
 *   toast.error('Erreur reseau');
 */
export function Toaster() {
  return (
    <SonnerToaster
      position="top-right"
      richColors
      closeButton
      duration={4000}
      toastOptions={{
        className: 'font-sans text-sm',
      }}
    />
  );
}
