import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Petit helper pour combiner les classes Tailwind sans conflit.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
