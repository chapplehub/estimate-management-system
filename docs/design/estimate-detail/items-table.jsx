// items-table.jsx — One-row-per-item table with sticky 商品名/最終金額 cols, active row,
// set parent/child rows (with fold), DnD constrained to set rules, and (in revision
// variations) a 納品先価格 column.
//
// Exports: ItemsTable

const { useState: useS_IT, useRef: useR_IT, useMemo: useM_IT } = React;

/* ── DnD helpers ───────────────────────────────────────────────────────── */
function canDrop(from, to, items) {
  if (!from || !to || from.id === to.id) return false;
  if (from.kind === 'set-child') {
    // Only within the same parent and only against another set-child of the same parent.
    return to.kind === 'set-child' && to.parentItemId === from.parentItemId;
  }
  // normal / set-parent: cannot drop into the middle of a set (i.e. target is a child)
  if (to.kind === 'set-child') return false;
  return true;
}

// Move a row (or set group) before the target row. Returns a new items array.
function reorderItems(items, fromId, toId) {
  if (!fromId || !toId || fromId === toId) return items;
  const from = items.find(it => it.id === fromId);
  const to   = items.find(it => it.id === toId);
  if (!from || !to) return items;
  if (!canDrop(from, to, items)) return items;

  let arr = [...items];

  if (from.kind === 'set-parent') {
    // Pull out the parent + its children as a contiguous group.
    const parentIdx = arr.findIndex(it => it.id === from.id);
    const children = arr.filter(it => it.parentItemId === from.id);
    const group = [from, ...children];
    arr = arr.filter(it => it.id !== from.id && it.parentItemId !== from.id);
    let insertIdx = arr.findIndex(it => it.id === toId);
    if (insertIdx < 0) insertIdx = arr.length;
    arr.splice(insertIdx, 0, ...group);
  } else {
    arr = arr.filter(it => it.id !== from.id);
    let insertIdx = arr.findIndex(it => it.id === toId);
    if (insertIdx < 0) insertIdx = arr.length;
    arr.splice(insertIdx, 0, from);
  }

  return arr.map((it, idx) => ({ ...it, sortOrder: idx + 1 }));
}

/* ── Component ─────────────────────────────────────────────────────────── */
function ItemsTable({
  items, editing, onChange,
  activeItemId, onActivateRow,
  foldedSets, onToggleSet,
  isRevisionVariation = false,
  onConfirmDeleteSet,        // (parentItem) => void  — show dialog
}) {
  const dragId = useR_IT(null);
  const [overId, setOverId] = useS_IT(null);
  const [dropOk, setDropOk] = useS_IT(true);

  // Indexed accessor
  const byId = useM_IT(() => {
    const m = new Map();
    items.forEach(it => m.set(it.id, it));
    return m;
  }, [items]);

  // Children for a parent
  const childrenOf = (parentId) => items.filter(it => it.parentItemId === parentId);

  // Helpers
  const updateRow = (id, patch) => {
    onChange(items.map(it => it.id === id ? { ...it, ...patch } : it));
  };
  const removeRow = (id) => {
    const it = byId.get(id);
    if (!it) return;
    if (it.kind === 'set-parent') {
      // Defer to confirmation dialog handled by parent.
      onConfirmDeleteSet && onConfirmDeleteSet(it);
      return;
    }
    onChange(items.filter(x => x.id !== id).map((x, i) => ({ ...x, sortOrder: i + 1 })));
  };

  // Product selection: when a SET product is picked on an existing row, convert row to set-parent
  // and replace any prior children with the new set's children.
  const onPickProduct = (rowId, product) => {
    const row = byId.get(rowId);
    if (!row) return;
    let next = [...items];

    if (product.category === 'SET') {
      // Drop any existing children belonging to this row.
      next = next.filter(it => it.parentItemId !== rowId);
      // Convert row to set-parent
      const rowIdx = next.findIndex(it => it.id === rowId);
      next[rowIdx] = {
        ...row,
        kind: 'set-parent',
        parentItemId: null,
        product: { id: product.id, code: product.code, name: product.name, category: 'SET' },
        itemName: product.name,
        unit: 'セット', quantity: 1, unitPrice: 0,
        discountRate: 1.0, itemDiscount: 0,
      };
      // Insert new children directly after parent
      const newChildren = product.setComponents.map(c => {
        const childProduct = window.DATA.products[c.productId];
        return window.DATA.factories.makeSetChildItem(c.productId, rowId, { quantity: c.quantity });
      });
      next.splice(rowIdx + 1, 0, ...newChildren);
    } else {
      // Normal product replacement / set-child product replacement
      const rowIdx = next.findIndex(it => it.id === rowId);
      // If was a set-parent and now switching to normal → also remove children.
      if (row.kind === 'set-parent') {
        next = next.filter(it => it.parentItemId !== rowId);
      }
      const newKind = row.kind === 'set-parent' ? 'normal'
                                                : row.kind; // normal stays normal, set-child stays set-child
      const newRow = {
        ...row,
        kind: newKind,
        product: { id: product.id, code: product.code, name: product.name, category: product.category, active: product.active },
        itemName: product.name,
        unit: product.unit,
        unitPrice: product.unitPrice,
      };
      const idxNow = next.findIndex(it => it.id === rowId);
      next[idxNow] = newRow;
    }

    onChange(next.map((it, idx) => ({ ...it, sortOrder: idx + 1 })));
  };

  // DnD handlers
  const onDragStart = (e, id) => {
    dragId.current = id;
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', id); } catch (_) {}
  };
  const onDragOver = (e, id) => {
    const from = byId.get(dragId.current);
    const to   = byId.get(id);
    if (!from || !to) return;
    const ok = canDrop(from, to, items);
    setDropOk(ok);
    setOverId(id);
    if (ok) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    } else {
      e.dataTransfer.dropEffect = 'none';
    }
  };
  const onDragLeave = () => { /* leave overId until next over to avoid flicker */ };
  const onDrop = (e, id) => {
    e.preventDefault();
    const fromId = dragId.current;
    setOverId(null);
    if (!fromId) return;
    onChange(reorderItems(items, fromId, id));
    dragId.current = null;
  };
  const onDragEnd = () => {
    dragId.current = null;
    setOverId(null);
    setDropOk(true);
  };

  // Decide which rows are visible (hide children of folded sets)
  const visibleItems = items.filter(it => {
    if (it.kind !== 'set-child') return true;
    return !foldedSets[it.parentItemId];
  });

  // Conditional column flags
  const showRevisedCol = isRevisionVariation;

  // Active row CSS variable for sticky bg synchronization. All values MUST be opaque
  // so the scrolling middle columns don't bleed through the sticky 商品名/最終金額 cells.
  const rowBg = (it) => {
    if (activeItemId === it.id) return '#eff6ff';                  // blue-50 (opaque)
    if (it.kind === 'set-parent') return '#fffdf4';                // amber-50 (very faint, opaque)
    if (it.kind === 'set-child')  return '#fffefb';                // even fainter, opaque
    return '#ffffff';
  };

  return (
    <div className="border border-neutral-200 rounded-md bg-white overflow-hidden">
      <div className="overflow-x-auto">
        <table className="text-sm" style={{ width: 'max-content', minWidth: '100%', tableLayout: 'fixed', borderCollapse: 'separate', borderSpacing: 0 }}>
          <colgroup>
            <col style={{ width: 320 }}/>{/* 商品名 (sticky) */}
            <col style={{ width: 80 }}/>{/* 数量 */}
            <col style={{ width: 56 }}/>{/* 単位 */}
            <col style={{ width: 112 }}/>{/* 単価 */}
            <col style={{ width: 80 }}/>{/* 掛率 */}
            <col style={{ width: 112 }}/>{/* 値引 */}
            <col style={{ width: 120 }}/>{/* 基本金額 */}
            <col style={{ width: 120 }}/>{/* 掛率適用後 */}
            <col style={{ width: 200 }}/>{/* 得意先メモ */}
            <col style={{ width: 200 }}/>{/* 社内メモ */}
            {showRevisedCol && <col style={{ width: 130 }}/>}
            <col style={{ width: 160 }}/>{/* 最終金額 + 削除 (sticky right) */}
          </colgroup>
          <thead>
            <tr className="bg-neutral-50 text-neutral-700 text-xs">
              <th className="sticky left-0 z-20 bg-neutral-50 px-3 py-2 text-left font-semibold border-b border-r border-neutral-200"
                  style={{ boxShadow: '4px 0 4px -4px rgba(0,0,0,0.08)' }}>商品名</th>
              <th className="px-2 py-2 text-right font-semibold border-b border-neutral-200">数量</th>
              <th className="px-2 py-2 text-left font-semibold border-b border-neutral-200">単位</th>
              <th className="px-2 py-2 text-right font-semibold border-b border-neutral-200">単価</th>
              <th className="px-2 py-2 text-right font-semibold border-b border-neutral-200">掛率</th>
              <th className="px-2 py-2 text-right font-semibold border-b border-neutral-200">値引</th>
              <th className="px-2 py-2 text-right font-semibold border-b border-neutral-200">基本金額</th>
              <th className="px-2 py-2 text-right font-semibold border-b border-neutral-200">掛率適用後</th>
              <th className="px-2 py-2 text-left font-semibold border-b border-neutral-200">得意先向けメモ</th>
              <th className="px-2 py-2 text-left font-semibold border-b border-neutral-200">社内向けメモ</th>
              {showRevisedCol && <th className="px-2 py-2 text-right font-semibold border-b border-neutral-200 text-violet-700">納品先価格</th>}
              <th className="sticky right-0 z-20 bg-neutral-50 px-2 py-2 text-right font-semibold border-b border-l border-neutral-200"
                  style={{ boxShadow: '-4px 0 4px -4px rgba(0,0,0,0.08)' }}>最終金額</th>
            </tr>
          </thead>
          <tbody>
            {visibleItems.length === 0 && (
              <tr>
                <td colSpan={showRevisedCol ? 12 : 11} className="px-4 py-8 text-center text-neutral-500">
                  明細がありません。{editing && '「+ 明細追加」から追加してください。'}
                </td>
              </tr>
            )}
            {visibleItems.map((it, idx) => (
              <ItemRow
                key={it.id}
                it={it}
                idx={idx}
                items={items}
                editing={editing}
                isActive={activeItemId === it.id}
                isDragOver={overId === it.id}
                dropOk={dropOk}
                isDragging={dragId.current === it.id}
                isFolded={it.kind === 'set-parent' ? !!foldedSets[it.id] : false}
                showRevisedCol={showRevisedCol}
                rowBg={rowBg(it)}
                onActivate={() => onActivateRow(it.id)}
                onUpdate={(patch) => updateRow(it.id, patch)}
                onDelete={() => removeRow(it.id)}
                onToggleFold={() => onToggleSet(it.id)}
                onPickProduct={(p) => onPickProduct(it.id, p)}
                onDragStart={(e) => onDragStart(e, it.id)}
                onDragOver={(e) => onDragOver(e, it.id)}
                onDragLeave={onDragLeave}
                onDrop={(e) => onDrop(e, it.id)}
                onDragEnd={onDragEnd}
                childrenOf={childrenOf}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

window.ItemsTable = ItemsTable;
