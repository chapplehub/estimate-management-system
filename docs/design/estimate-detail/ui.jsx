// ui.jsx — shared primitives (shadcn-ish): Button, Field, Input, Badge, Card, Dialog, Collapsible
// Load AFTER React/Babel. Components are exported to window.

const { useState, useEffect, useRef, useCallback, useMemo } = React;

// ─── Button ────────────────────────────────────────────────────────────
function Button({ variant = 'primary', size = 'md', className = '', disabled, children, ...rest }) {
  const base = 'inline-flex items-center justify-center font-medium rounded-md transition select-none ' +
               'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 ' +
               'disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap';
  const sizes = {
    sm: 'h-7 px-2.5 text-xs gap-1',
    md: 'h-8 px-3 text-sm gap-1.5',
    lg: 'h-10 px-4 text-sm gap-1.5',
  };
  const variants = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white focus-visible:ring-blue-500 shadow-sm',
    secondary: 'bg-white hover:bg-neutral-50 text-neutral-800 border border-neutral-300 focus-visible:ring-neutral-400',
    destructive: 'bg-red-600 hover:bg-red-700 text-white focus-visible:ring-red-500 shadow-sm',
    ghost: 'bg-transparent hover:bg-neutral-100 text-neutral-700 focus-visible:ring-neutral-400',
    link: 'bg-transparent text-blue-600 hover:underline px-0 h-auto',
  };
  return (
    <button
      disabled={disabled}
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
      {...rest}
    >{children}</button>
  );
}

// ─── Badge ─────────────────────────────────────────────────────────────
function Badge({ tone = 'neutral', size = 'sm', className = '', children }) {
  const tones = {
    neutral: 'bg-neutral-900 text-white',
    soft:    'bg-neutral-200 text-neutral-700',
    success: 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200',
    danger:  'bg-red-100 text-red-700 ring-1 ring-red-200',
    info:    'bg-blue-100 text-blue-800 ring-1 ring-blue-200',
    warn:    'bg-amber-100 text-amber-800 ring-1 ring-amber-200',
    violet:  'bg-violet-100 text-violet-800 ring-1 ring-violet-200',
    outline: 'bg-white text-neutral-700 ring-1 ring-neutral-300',
  };
  const sizes = {
    xs: 'text-[10px] px-1.5 py-0.5',
    sm: 'text-xs px-2 py-0.5',
  };
  return (
    <span className={`inline-flex items-center font-medium rounded-full ${tones[tone]} ${sizes[size]} ${className}`}>{children}</span>
  );
}

// ─── Field wrapper ─────────────────────────────────────────────────────
function Field({ label, required, hint, error, children, className = '' }) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && (
        <label className="text-sm font-semibold text-neutral-800">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      {children}
      {hint && <p className="text-xs text-neutral-500">{hint}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

// ─── Input ─────────────────────────────────────────────────────────────
function Input({ readOnly, className = '', align, ...rest }) {
  const cls =
    'w-full h-9 px-3 text-sm rounded-md border bg-white text-neutral-900 ' +
    'placeholder:text-neutral-400 transition ' +
    (readOnly
      ? 'border-neutral-200 bg-neutral-100 text-neutral-700 cursor-default focus:outline-none'
      : 'border-neutral-300 hover:border-neutral-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 focus:outline-none') +
    (align === 'right' ? ' text-right tabular-nums' : '') +
    ' ' + className;
  return <input readOnly={readOnly} className={cls} {...rest} />;
}

function Textarea({ readOnly, className = '', rows = 3, ...rest }) {
  const cls =
    'w-full px-3 py-2 text-sm rounded-md border bg-white text-neutral-900 ' +
    'placeholder:text-neutral-400 transition resize-y ' +
    (readOnly
      ? 'border-neutral-200 bg-neutral-100 text-neutral-700 cursor-default focus:outline-none'
      : 'border-neutral-300 hover:border-neutral-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 focus:outline-none') +
    ' ' + className;
  return <textarea rows={rows} readOnly={readOnly} className={cls} {...rest} />;
}

function Select({ readOnly, className = '', children, ...rest }) {
  const cls =
    'w-full h-9 px-2.5 pr-8 text-sm rounded-md border bg-white text-neutral-900 ' +
    'appearance-none bg-no-repeat bg-[right_0.5rem_center] ' +
    'transition ' +
    (readOnly
      ? 'border-neutral-200 bg-neutral-100 text-neutral-700 cursor-default pointer-events-none'
      : 'border-neutral-300 hover:border-neutral-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 focus:outline-none') +
    ' ' + className;
  const chev = "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path fill='rgba(0,0,0,.5)' d='M0 0h10L5 6z'/></svg>\")";
  return <select className={cls} style={{ backgroundImage: chev }} {...rest}>{children}</select>;
}

// ─── Card ──────────────────────────────────────────────────────────────
function Card({ className = '', children }) {
  return (
    <div className={`bg-white rounded-lg border border-neutral-200 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ${className}`}>
      {children}
    </div>
  );
}

// ─── Modal Dialog ──────────────────────────────────────────────────────
function Dialog({ open, onClose, title, children, footer }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose && onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose}></div>
      <div className="relative bg-white rounded-lg shadow-xl border border-neutral-200 w-full max-w-md">
        <div className="px-5 pt-4 pb-3 border-b border-neutral-200">
          <h3 className="text-base font-semibold text-neutral-900">{title}</h3>
        </div>
        <div className="px-5 py-4 text-sm text-neutral-700">{children}</div>
        <div className="px-5 py-3 border-t border-neutral-200 bg-neutral-50 rounded-b-lg flex justify-end gap-2">
          {footer}
        </div>
      </div>
    </div>
  );
}

// ─── Icon: tiny inline SVGs ────────────────────────────────────────────
function Icon({ name, className = 'w-4 h-4' }) {
  const common = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none',
                   stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round',
                   strokeLinejoin: 'round', className };
  switch (name) {
    case 'arrow-left':   return <svg {...common}><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>;
    case 'pencil':       return <svg {...common}><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>;
    case 'copy':         return <svg {...common}><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>;
    case 'plus':         return <svg {...common}><path d="M12 5v14"/><path d="M5 12h14"/></svg>;
    case 'trash':        return <svg {...common}><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>;
    case 'x':            return <svg {...common}><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>;
    case 'check':        return <svg {...common}><polyline points="20 6 9 17 4 12"/></svg>;
    case 'chevron-down': return <svg {...common}><polyline points="6 9 12 15 18 9"/></svg>;
    case 'chevron-right':return <svg {...common}><polyline points="9 6 15 12 9 18"/></svg>;
    case 'chevron-up':   return <svg {...common}><polyline points="6 15 12 9 18 15"/></svg>;
    case 'grip':         return <svg {...common}><circle cx="9" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="18" r="1"/></svg>;
    case 'revise':       return <svg {...common}><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>;
    case 'search':       return <svg {...common}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/></svg>;
    case 'info':         return <svg {...common}><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>;
    case 'alert':        return <svg {...common}><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;
    case 'file':         return <svg {...common}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>;
    default: return null;
  }
}

Object.assign(window, { Button, Badge, Field, Input, Textarea, Select, Card, Dialog, Icon });
