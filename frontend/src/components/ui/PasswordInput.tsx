import { Eye, EyeOff } from 'lucide-react';
import { forwardRef, useState } from 'react';

import { cn } from '../../lib/cn.js';

interface PasswordInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** Affiche le mot de passe en clair par defaut. Utile pour les ecrans admin
   *  qui doivent communiquer le mot de passe a l'utilisateur. */
  defaultVisible?: boolean;
}

/**
 * Champ mot de passe avec un toggle oeil (Eye / EyeOff).
 *
 * - aria-label dynamique selon l'etat (a11y)
 * - tabIndex={-1} sur le bouton pour ne pas casser le flux tab du formulaire
 * - touch target 32px (le bouton + le padding du champ atteignent les 44pt)
 * - focus ring visible sur le bouton
 *
 * S'utilise comme un <input> classique. react-hook-form via {...register('xxx')} OK.
 */
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput({ className, defaultVisible = false, ...rest }, ref) {
    const [visible, setVisible] = useState(defaultVisible);
    return (
      <div className="relative">
        <input
          {...rest}
          ref={ref}
          type={visible ? 'text' : 'password'}
          className={cn('input pr-10 font-mono', className)}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
          tabIndex={-1}
          className={cn(
            'absolute right-1.5 top-1/2 -translate-y-1/2',
            'p-1.5 rounded text-fg-muted hover:text-fg-2 hover:bg-muted',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
            'transition-colors',
          )}
        >
          {visible ? (
            <EyeOff className="w-4 h-4" strokeWidth={1.8} />
          ) : (
            <Eye className="w-4 h-4" strokeWidth={1.8} />
          )}
        </button>
      </div>
    );
  },
);
