// variation-section.jsx — Variation tabs, content (operation row + items + memos), sticky summary

const { useState: useSt, useMemo: useMm, useEffect: useEf, useRef: useRf } = React;

// ─── Variation tabs ────────────────────────────────────────────────────
function VariationTabs({ variations, activeId, onChange, onAdd, editing, showInactive, onToggleInactive }) {
  const list = variations.filter(v => showInactive || v.status === 'ACTIVE');
  const hasInactive = variations.some(v => v.status === 'INACTIVE');
  return (
    <div className="flex items-end justify-between gap-2 border-b border-neutral-200 px-4">
      <div className="flex items-center gap-1 overflow-x-auto -mb-px">
        {list.map(v => {
          const active = v.id === activeId;
          const inactive = v.status === 'INACTIVE';
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => onChange(v.id)}
              className={
                'group relative flex items-center gap-2 px-3 h-10 text-sm whitespace-nowrap border-b-2 transition ' +
                (active
                  ? 'border-blue-600 text-neutral-900 font-semibold bg-blue-50/30'
                  : 'border-transparent text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50') +
                (inactive ? ' line-through opacity-60' : '')
              }
            >
              <span>バリエーション {v.variationNumber}</span>
              {inactive && <Badge tone="soft" size="xs" className="!font-normal">無効</Badge>}
              {v.revisionTarget && <Badge tone="violet" size="xs" className="!font-normal">改訂</Badge>}
              {v.copyTarget && <Badge tone="info" size="xs" className="!font-normal">複製</Badge>}
            </button>
          );
        })}
        {editing && (
          <button
            type="button"
            onClick={onAdd}
            className="ml-1 h-10 px-2.5 text-sm text-blue-600 hover:bg-blue-50 inline-flex items-center gap-1 rounded-t-md"
            title="新しいバリエーションを追加"
          >
            <Icon name="plus" className="w-4 h-4"/> 新規追加
          </button>
        )}
      </div>
      {hasInactive && (
        <label className="text-xs text-neutral-500 inline-flex items-center gap-1.5 mb-2 cursor-pointer select-none">
          <input type="checkbox" checked={showInactive} onChange={(e) => onToggleInactive(e.target.checked)} className="accent-blue-600"/>
          無効を表示
        </label>
      )}
    </div>
  );
}

// ─── Variation content (operation row, items, memo) ────────────────────
function VariationPanel({
  variation, editing, onUpdate,
  onDuplicate, onRevise, onDelete,
  onRequestDeleteSet,
}) {
  const inactive = variation.status === 'INACTIVE';
  const [activeItemId, setActiveItemId] = useSt(null);
  const [foldedSets, setFoldedSets] = useSt({});
  const [memoTab, setMemoTab] = useSt('customer');

  // Reset per-variation transient state when the variation switches.
  useEf(() => {
    setActiveItemId(null);
    setFoldedSets({});
  }, [variation.id]);

  const updateItems = (items) => onUpdate({ ...variation, items });
  const toggleFold = (parentId) => setFoldedSets(s => ({ ...s, [parentId]: !s[parentId] }));

  // ── Add item logic: insert based on active row's kind/position ──────
  const addItem = () => {
    const items = variation.items;
    const active = items.find(it => it.id === activeItemId);

    let kind = 'normal';
    let parentItemId = null;
    let insertIdx = items.length; // default: end

    if (active) {
      if (active.kind === 'normal') {
        insertIdx = items.findIndex(it => it.id === active.id) + 1;
      } else if (active.kind === 'set-parent') {
        // Insert AFTER the parent + all its children
        const childCount = items.filter(it => it.parentItemId === active.id).length;
        insertIdx = items.findIndex(it => it.id === active.id) + 1 + childCount;
      } else if (active.kind === 'set-child') {
        // Insert as a sibling child within the same set, right after the active child.
        kind = 'set-child';
        parentItemId = active.parentItemId;
        insertIdx = items.findIndex(it => it.id === active.id) + 1;
      }
    }

    const newItem = {
      id: window.DATA.factories.uid('new'),
      sortOrder: 0, // will be re-numbered
      kind, parentItemId,
      product: { id: '', code: '', name: '', category: 'NORMAL' },
      itemName: '', quantity: 1, unit: '式', unitPrice: 0,
      discountRate: 1.0, itemDiscount: 0,
      customerMemo: '', internalMemo: '',
    };

    const next = [...items];
    next.splice(insertIdx, 0, newItem);
    const renumbered = next.map((it, i) => ({ ...it, sortOrder: i + 1 }));

    onUpdate({ ...variation, items: renumbered });
    setActiveItemId(newItem.id);
  };

  const lineage = variation.copyTarget
    ? `バリエーション ${variation.copyTarget.variationNumber} から複製`
    : variation.revisionTarget
      ? `バリエーション ${variation.revisionTarget.variationNumber} から改訂`
      : null;

  const isRevisionVariation = !!variation.revisionTarget
    || variation.items.some(it => !!it.revisedDetail);

  return (
    <div className={inactive ? 'opacity-70' : ''}>
      {/* Operation row */}
      <div className="px-5 py-3 flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 bg-neutral-50/50">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" disabled={!editing || inactive} onClick={onDuplicate}>
            <Icon name="copy" className="w-3.5 h-3.5"/> 複製
          </Button>
          <Button size="sm" variant="secondary" disabled={!editing || inactive} onClick={onRevise}>
            <Icon name="revise" className="w-3.5 h-3.5"/> 改訂
          </Button>
          <Button size="sm" variant="destructive" disabled={!editing || inactive} onClick={onDelete}>
            <Icon name="trash" className="w-3.5 h-3.5"/> 削除（無効化）
          </Button>
        </div>
        <div className="flex items-center gap-3 text-xs text-neutral-600">
          {lineage && (
            <span className="inline-flex items-center gap-1">
              <Icon name="arrow-left" className="w-3 h-3"/> {lineage}
            </span>
          )}
          <span className="inline-flex items-center gap-1.5">
            {inactive
              ? <React.Fragment><span className="w-2 h-2 rounded-full bg-neutral-400"></span><span className="text-neutral-600">無効</span></React.Fragment>
              : <React.Fragment><span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.18)]"></span><span className="text-emerald-700 font-medium">有効</span></React.Fragment>
            }
          </span>
        </div>
      </div>

      {inactive && (
        <div className="px-5 py-2.5 bg-amber-50 border-b border-amber-200 text-amber-800 text-xs flex items-center gap-2">
          <Icon name="alert" className="w-3.5 h-3.5"/>
          このバリエーションは無効化されています。閲覧のみ可能です。
        </div>
      )}

      {/* Items table */}
      <div className="px-5 py-4">
        <ItemsTable
          items={variation.items}
          editing={editing && !inactive}
          onChange={updateItems}
          activeItemId={activeItemId}
          onActivateRow={setActiveItemId}
          foldedSets={foldedSets}
          onToggleSet={toggleFold}
          isRevisionVariation={isRevisionVariation}
          onConfirmDeleteSet={(parentItem) => onRequestDeleteSet && onRequestDeleteSet({
            variationId: variation.id,
            parentItem,
            childCount: variation.items.filter(c => c.parentItemId === parentItem.id).length,
          })}
        />

        {editing && !inactive && (
          <div className="mt-3 flex items-center gap-3">
            <Button variant="secondary" size="sm" onClick={addItem}>
              <Icon name="plus" className="w-3.5 h-3.5"/> 明細追加
            </Button>
            <span className="text-xs text-neutral-500">
              {activeItemId
                ? (() => {
                    const a = variation.items.find(it => it.id === activeItemId);
                    if (!a) return '';
                    if (a.kind === 'set-child') return `└ アクティブなセット子行の下に追加`;
                    if (a.kind === 'set-parent') return `アクティブなセットの下に追加`;
                    return `アクティブ行 #${a.sortOrder} の直下に追加`;
                  })()
                : 'テーブル末尾に追加（行をクリックして挿入位置を指定できます）'}
            </span>
          </div>
        )}

        {/* Overall discount */}
        <div className="mt-5 flex items-center justify-end gap-3 border-t border-dashed border-neutral-300 pt-4">
          <label className="text-sm font-semibold text-neutral-700">全体値引</label>
          <div className="relative w-40">
            <Input
              type="number"
              value={variation.overallDiscount}
              onChange={(e) => onUpdate({ ...variation, overallDiscount: Number(e.target.value) || 0 })}
              readOnly={!editing || inactive}
              align="right"
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 text-sm pointer-events-none">¥</span>
          </div>
        </div>

        {/* Memo area */}
        <div className="mt-6">
          <div className="flex items-center gap-1 mb-2">
            <button
              type="button"
              onClick={() => setMemoTab('customer')}
              className={'h-8 px-3 text-sm rounded-md transition ' + (memoTab === 'customer'
                ? 'bg-neutral-900 text-white font-medium'
                : 'bg-white border border-neutral-300 text-neutral-700 hover:bg-neutral-50')}
            >得意先向け</button>
            <button
              type="button"
              onClick={() => setMemoTab('internal')}
              className={'h-8 px-3 text-sm rounded-md transition ' + (memoTab === 'internal'
                ? 'bg-neutral-900 text-white font-medium'
                : 'bg-white border border-neutral-300 text-neutral-700 hover:bg-neutral-50')}
            >社内向け</button>
            <span className="text-xs text-neutral-500 ml-auto">
              最大2000文字 ({(memoTab === 'customer' ? variation.customerMemo : variation.internalMemo).length}/2000)
            </span>
          </div>
          <Textarea
            rows={5}
            value={memoTab === 'customer' ? variation.customerMemo : variation.internalMemo}
            onChange={(e) => onUpdate({
              ...variation,
              [memoTab === 'customer' ? 'customerMemo' : 'internalMemo']: e.target.value
            })}
            readOnly={!editing || inactive}
            maxLength={2000}
            placeholder={memoTab === 'customer' ? '得意先に共有するメモを入力' : '社内共有用のメモを入力（得意先には表示されません）'}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Sticky summary footer ────────────────────────────────────────────
function SummaryFooter({ totals, layout, variation, editing }) {
  const items = [
    { k: 'subtotal',         label: '明細小計', val: totals.subtotal },
    { k: 'discountSubtotal', label: '値引小計', val: totals.discountSubtotal, color: 'text-red-600', prefix: '-' },
    { k: 'finalSubtotal',    label: '最終小計', val: totals.finalSubtotal },
    { k: 'taxAmount',        label: '消費税',  val: totals.taxAmount },
  ];

  if (layout === 'twoline') {
    return (
      <div className="border-t border-neutral-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85 shadow-[0_-2px_10px_rgba(0,0,0,0.04)]">
        <div className="px-6 py-3 flex items-center justify-between">
          <div className="text-xs text-neutral-500 flex items-center gap-2">
            <Icon name="info" className="w-3.5 h-3.5"/>
            アクティブタブ: <span className="text-neutral-700 font-semibold">バリエーション {variation.variationNumber}</span>
            {editing && <Badge tone="info" size="xs">編集中</Badge>}
          </div>
          <div className="flex items-center gap-5 text-sm text-neutral-600">
            {items.map(it => (
              <div key={it.k} className="flex items-baseline gap-1.5">
                <span className="text-xs">{it.label}</span>
                <span className={`tabular-nums ${it.color || 'text-neutral-800'}`}>
                  {it.prefix || ''}{window.fmtYen(it.val)}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="px-6 py-3 border-t border-neutral-100 flex items-center justify-end gap-3 bg-neutral-50/50">
          <span className="text-sm text-neutral-600 font-medium">最終合計</span>
          <span className="text-2xl font-extrabold tabular-nums text-neutral-900 tracking-tight">{window.fmtYen(totals.finalTotal)}</span>
        </div>
      </div>
    );
  }

  // one-line layout
  return (
    <div className="border-t border-neutral-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85 shadow-[0_-2px_10px_rgba(0,0,0,0.04)]">
      <div className="px-6 py-3.5 flex items-center justify-between gap-6">
        <div className="text-xs text-neutral-500 flex items-center gap-2 shrink-0">
          <Icon name="info" className="w-3.5 h-3.5"/>
          <span>バリエーション {variation.variationNumber}</span>
          {editing && <Badge tone="info" size="xs">編集中</Badge>}
        </div>
        <div className="flex items-center gap-6 text-sm">
          {items.map(it => (
            <div key={it.k} className="flex flex-col items-end">
              <span className="text-[10px] uppercase tracking-wider text-neutral-500">{it.label}</span>
              <span className={`tabular-nums font-medium ${it.color || 'text-neutral-800'}`}>
                {it.prefix || ''}{window.fmtYen(it.val)}
              </span>
            </div>
          ))}
          <div className="h-10 w-px bg-neutral-200"></div>
          <div className="flex items-baseline gap-2">
            <span className="text-xs uppercase tracking-wider text-neutral-500">最終合計</span>
            <span className="text-2xl font-extrabold tabular-nums text-neutral-900 tracking-tight">{window.fmtYen(totals.finalTotal)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

window.VariationTabs = VariationTabs;
window.VariationPanel = VariationPanel;
window.SummaryFooter = SummaryFooter;
