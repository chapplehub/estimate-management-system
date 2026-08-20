// row-cells.jsx — Smaller cell components for the items table:
//   • MemoCell      — compact memo display with hover preview + click popover (editable)
//   • ProductCombo  — simple combobox to pick a product from master
// Exported to window.

const { useState: useS_RC, useEffect: useE_RC, useRef: useR_RC, useLayoutEffect: useLE_RC } = React;

/* ────────────────────────────────────────────────────────────────────────
 * MemoCell
 *  - 1-line preview (truncate). Hover → small tooltip (full text).
 *  - Click → popover with full content; editable in edit mode.
 * ──────────────────────────────────────────────────────────────────────── */
function MemoCell({ value, editing, onChange, placeholder = '（なし）', tone = 'customer' }) {
  const [hover, setHover] = useS_RC(false);
  const [open, setOpen]   = useS_RC(false);
  const btnRef = useR_RC(null);
  const popRef = useR_RC(null);
  const [popStyle, setPopStyle] = useS_RC(null);

  // Click outside / Escape to close popover
  useE_RC(() => {
    if (!open) return;
    const onDown = (e) => {
      if (popRef.current && popRef.current.contains(e.target)) return;
      if (btnRef.current && btnRef.current.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Position popover relative to the button
  useLE_RC(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const popW = 340;
    const margin = 8;
    let left = r.left;
    if (left + popW > window.innerWidth - margin) left = window.innerWidth - popW - margin;
    const top = r.bottom + 6;
    setPopStyle({ left, top, width: popW });
  }, [open]);

  const empty = !value;
  const toneCls = tone === 'customer' ? 'border-l-2 border-blue-200' : 'border-l-2 border-neutral-300';

  return (
    <div className="relative w-full">
      <button
        ref={btnRef}
        type="button"
        onClick={(e) => { setOpen(o => !o); }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        className={`text-left w-full pl-2 pr-1 py-1 text-xs ${toneCls} rounded ${
          open ? 'bg-blue-100/60 ring-1 ring-blue-300' : 'hover:bg-neutral-100'
        }`}
        title=""
      >
        <span className={`block truncate ${empty ? 'text-neutral-400 italic' : 'text-neutral-700'}`}>
          {empty ? placeholder : (value.split('\n')[0] || value)}
        </span>
      </button>

      {/* Hover tooltip — full text */}
      {hover && !open && value && (
        <div className="absolute z-30 left-0 top-full mt-1 max-w-[340px] min-w-[200px]
                        bg-neutral-900 text-white text-xs leading-relaxed rounded-md shadow-xl
                        px-3 py-2 whitespace-pre-wrap pointer-events-none">
          {value}
        </div>
      )}

      {/* Click popover — editable */}
      {open && popStyle && ReactDOM.createPortal(
        <div
          ref={popRef}
          style={{ position: 'fixed', left: popStyle.left, top: popStyle.top, width: popStyle.width, zIndex: 50 }}
          className="bg-white rounded-lg shadow-xl border border-neutral-200"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-2 border-b border-neutral-200 flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-700">
              {tone === 'customer' ? '得意先向けメモ' : '社内向けメモ'}
            </span>
            <span className="text-[10px] text-neutral-500">{(value || '').length}/2000</span>
          </div>
          {editing ? (
            <textarea
              autoFocus
              rows={6}
              maxLength={2000}
              value={value || ''}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
              className="w-full px-3 py-2 text-sm rounded-b-lg border-0 focus:outline-none resize-none"
            />
          ) : (
            <div className="px-3 py-2 text-sm text-neutral-700 whitespace-pre-wrap min-h-[6rem] max-h-[16rem] overflow-auto">
              {value || <span className="text-neutral-400 italic">{placeholder}</span>}
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────
 * ProductCombo
 *  - small text input + dropdown of products
 *  - onSelect(productObj)
 *  - filterCategory: optional whitelist of categories
 * ──────────────────────────────────────────────────────────────────────── */
function ProductCombo({ value, onChange, onSelect, disabled, allowSet = true, placeholder = '商品名で検索…' }) {
  const [open, setOpen] = useS_RC(false);
  const [q, setQ] = useS_RC('');
  const wrapRef = useR_RC(null);
  const inputRef = useR_RC(null);
  const popRef = useR_RC(null);
  const [popStyle, setPopStyle] = useS_RC(null);

  useE_RC(() => {
    if (!open) return;
    const onDown = (e) => {
      if (wrapRef.current?.contains(e.target)) return;
      if (popRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Position the portal popover relative to the input.
  useLE_RC(() => {
    if (!open || !inputRef.current) return;
    const r = inputRef.current.getBoundingClientRect();
    const popW = Math.max(r.width, 320);
    const margin = 8;
    let left = r.left;
    if (left + popW > window.innerWidth - margin) left = window.innerWidth - popW - margin;
    let top = r.bottom + 4;
    // If too close to viewport bottom, flip above
    if (top + 300 > window.innerHeight - margin) {
      top = Math.max(margin, r.top - 300 - 4);
    }
    setPopStyle({ left, top, width: popW });
  }, [open]);

  const all = Object.values(window.DATA.products)
    .filter(p => (allowSet ? true : p.category !== 'SET'));

  const filtered = q.trim()
    ? all.filter(p => `${p.code} ${p.name}`.toLowerCase().includes(q.toLowerCase()))
    : all;

  return (
    <div ref={wrapRef} className="relative w-full">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={value}
          disabled={disabled}
          onChange={(e) => { onChange(e.target.value); setQ(e.target.value); }}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          placeholder={placeholder}
          className={`w-full h-7 pl-2 pr-7 text-xs rounded border bg-white
                      ${disabled
                        ? 'border-neutral-200 bg-neutral-100 text-neutral-500 cursor-not-allowed'
                        : 'border-neutral-300 hover:border-neutral-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 focus:outline-none'}`}
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen(o => !o)}
          className="absolute right-0 top-0 h-7 w-7 inline-flex items-center justify-center text-neutral-500 hover:text-neutral-900"
          tabIndex={-1}
        >
          <Icon name="chevron-down" className="w-3.5 h-3.5"/>
        </button>
      </div>
      {open && !disabled && popStyle && ReactDOM.createPortal(
        <div
          ref={popRef}
          style={{ position: 'fixed', left: popStyle.left, top: popStyle.top, width: popStyle.width, zIndex: 60, maxHeight: 300 }}
          className="bg-white rounded-md border border-neutral-200 shadow-xl overflow-y-auto text-xs"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="px-2 py-1.5 border-b border-neutral-100 sticky top-0 bg-white/95 backdrop-blur z-10">
            <input
              autoFocus
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="検索…"
              className="w-full h-7 px-2 text-xs rounded border border-neutral-200 focus:outline-none focus:border-blue-500"
            />
          </div>
          {filtered.length === 0 && (
            <div className="px-3 py-4 text-center text-neutral-400">該当する商品がありません</div>
          )}
          {filtered.map(p => {
            const isSet = p.category === 'SET';
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => { onSelect(p); setOpen(false); setQ(''); }}
                className={`w-full text-left px-2.5 py-1.5 flex items-center gap-2 hover:bg-blue-50
                            ${!p.active ? 'opacity-60' : ''}`}
              >
                <span className={`inline-flex items-center justify-center w-5 h-5 rounded text-[9px] font-bold
                                  ${isSet ? 'bg-amber-100 text-amber-800' : 'bg-neutral-100 text-neutral-600'}`}>
                  {isSet ? 'SET' : p.category === 'PERIPHERAL' ? '周' : '商'}
                </span>
                <span className="font-mono text-[10px] text-neutral-500 w-14 shrink-0">{p.code}</span>
                <span className="text-neutral-900 flex-1 truncate">{p.name}</span>
                {!p.active && <Badge tone="soft" size="xs">廃番</Badge>}
                <span className="tabular-nums text-neutral-500 ml-1">{isSet ? '—' : window.fmtYen(p.unitPrice)}</span>
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
}

Object.assign(window, { MemoCell, ProductCombo });
