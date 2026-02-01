import React from 'react';

export function Button({
  children,
  variant = 'primary',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' }) {
  const styles = {
    primary: 'bg-accent-500 hover:bg-accent-600 text-slate-950',
    ghost: 'border border-panel-700 text-slate-200 hover:border-panel-500',
    danger: 'bg-danger-500 text-slate-950 hover:bg-danger-500/80'
  };
  return (
    <button
      {...props}
      className={`rounded-md px-3 py-2 text-sm font-medium transition ${styles[variant]} ${props.className ?? ''}`}
    >
      {children}
    </button>
  );
}

export function TextButton({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...props} className={`text-xs text-slate-300 hover:text-white ${props.className ?? ''}`}>
      {children}
    </button>
  );
}
