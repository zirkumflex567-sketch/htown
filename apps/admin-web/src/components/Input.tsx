import React from 'react';

export function Input({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  return (
    <label className="flex flex-col gap-1 text-xs uppercase tracking-wide text-slate-400">
      {label}
      <input
        {...props}
        className={`rounded-md border border-panel-700 bg-panel-800 px-3 py-2 text-sm text-slate-100 focus:border-accent-500 focus:outline-none ${
          props.className ?? ''
        }`}
      />
    </label>
  );
}

export function Select({ label, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  return (
    <label className="flex flex-col gap-1 text-xs uppercase tracking-wide text-slate-400">
      {label}
      <select
        {...props}
        className={`rounded-md border border-panel-700 bg-panel-800 px-3 py-2 text-sm text-slate-100 focus:border-accent-500 focus:outline-none ${
          props.className ?? ''
        }`}
      >
        {children}
      </select>
    </label>
  );
}

export function TextArea({ label, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }) {
  return (
    <label className="flex flex-col gap-1 text-xs uppercase tracking-wide text-slate-400">
      {label}
      <textarea
        {...props}
        className={`min-h-[120px] rounded-md border border-panel-700 bg-panel-800 px-3 py-2 text-sm text-slate-100 focus:border-accent-500 focus:outline-none ${
          props.className ?? ''
        }`}
      />
    </label>
  );
}
