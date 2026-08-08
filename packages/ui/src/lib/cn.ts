import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * The standard shadcn/ui className helper — merges conditional class names
 * (clsx) and resolves conflicting Tailwind utility classes (tailwind-merge).
 * Every shared and app-level component uses this instead of hand-rolled
 * string concatenation. See docs/02-architecture/technology-stack.md.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
