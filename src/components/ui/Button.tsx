import { forwardRef } from 'react';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'hero' | 'heroOutline' | 'default' | 'outline' | 'ghost';
  size?: 'sm' | 'default' | 'lg' | 'xl';
  isLoading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', isLoading, children, disabled, ...props }, ref) => {
    const baseStyles = 'inline-flex items-center justify-center rounded-xl font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed';

    const variants = {
      hero: 'bg-gradient-primary text-white shadow-glow hover:opacity-90 hover:shadow-lg',
      heroOutline: 'bg-transparent border-2 border-primary/50 text-foreground hover:border-primary hover:bg-primary/10',
      default: 'bg-primary text-primary-foreground hover:opacity-90',
      outline: 'bg-transparent border border-border hover:bg-secondary',
      ghost: 'bg-transparent hover:bg-secondary',
    };

    const sizes = {
      sm: 'h-9 px-3 text-xs',
      default: 'h-10 px-4 text-sm',
      lg: 'h-12 px-8 text-base',
      xl: 'h-14 px-10 text-lg',
    };

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? 'Loading...' : children}
      </button>
    );
  }
);

Button.displayName = 'Button';
