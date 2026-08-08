import { type InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '../lib/cn';

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      'border-border bg-background placeholder:text-muted-foreground focus-visible:ring-foreground flex h-9 w-full rounded-md border px-3 py-1 text-sm outline-none focus-visible:ring-1 disabled:cursor-not-allowed disabled:opacity-50',
      className,
    )}
    {...props}
  />
));
Input.displayName = 'Input';
