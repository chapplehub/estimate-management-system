// item-row.jsx — Single row of the items table (normal / set-parent / set-child).

const { useState: useS_IR, useRef: useR_IR } = React;

function ItemRow({
  it, idx, items, editing, isActive, isDragOver, dropOk, isDragging,
  isFolded, showRevisedCol, rowBg,
  onActivate, onUpdate, onDelete, onToggleFold, onPickProduct,
  onDragStart, onDragOver, onDragLeave, onDrop, onDragEnd,
  childrenOf,
}) {
  const isParent = it.kind === 'set-parent';
  const isChild  = it.kind === 'set-child';
  const isNormal = it.kind === 'normal';

  const isRevised = !!it.revisedDetail;
  const inactiveProduct = it.product && it.product.active === false;

  const amounts = window.DATA.calc.itemAmounts(it);
  const parentFinal = isParent ? window.DATA.calc.setParentFinal(it, items) : null;
  const setHasInvalid = isParent && window.DATA.setHasInvalidComponent(it, items);

  const handleNum = (key, raw) => {
    const v = raw === '' ? 0 : Number(raw);
    if (isNaN(v)) return;
    onUpdate({ [key]: v });
  };

  // Common cell classes
  const cellPad = 'px-2 py-1';
  const numCell = `${cellPad} text-right tabular-nums whitespace-nowrap`;

  // Show drop indicator above this row?
  const showDropAbove = isDragOver && dropOk && !isDragging;
  const showDropDeny  = isDragOver && !dropOk && !isDragging;

  // Container/border treatment
  const baseRow = 'border-b border-neutral-100 transition-colors relative';
  const activeBar = isActive ? 'shadow-[inset_3px_0_0_0_rgba(37,99,235,0.85)]' : '';
  const stripe = isChild ? '' : ''; // could stripe but kept neutral
  const dragHint = isDragging ? 'opacity-40' : '';
  const hover = !isActive ? 'hover:bg-neutral-50' : '';
  const cursorCls = showDropDeny ? 'cursor-not-allowed' : '';

  return (
    <tr
      onClick={onActivate}
      onDragOver={editing ? onDragOver : undefined}
      onDragLeave={editing ? onDragLeave : undefined}
      onDrop={editing ? onDrop : undefined}
      style={{
        // Row bg via CSS var so sticky cells can pick it up
        ['--row-bg']: rowBg,
        backgroundColor: rowBg,
        boxShadow: showDropAbove ? 'inset 0 2px 0 0 #2563eb' : undefined,
      }}
      className={`${baseRow} ${activeBar} ${stripe} ${dragHint} ${hover} ${cursorCls}`}
    >
      {/* ── Sticky 商品名 cell (contains marker + drag + # + product picker) ── */}
      <td className="sticky left-0 z-10 align-middle px-0 py-0 border-r border-neutral-200"
          style={{ background: rowBg, boxShadow: '4px 0 4px -4px rgba(0,0,0,0.07)' }}>
        <div className={`relative flex items-center gap-1 pl-2 pr-2 py-1 ${isChild ? 'pl-7' : ''}`}>
          {/* revised marker */}
          {isRevised && <span className="absolute left-0 top-1 bottom-1 w-[3px] bg-violet-500"></span>}
          {/* set-child indent line */}
          {isChild && <span className="absolute left-3 top-0 bottom-0 w-[1.5px] bg-amber-300/70"></span>}
          {isChild && <span className="absolute left-3 top-1/2 w-2 h-px bg-amber-300/70"></span>}

          {/* Set parent fold toggle */}
          {isParent ? (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onToggleFold(); }}
              className="w-5 h-5 inline-flex items-center justify-center rounded text-neutral-500 hover:bg-neutral-200"
              aria-label={isFolded ? 'セットを展開' : 'セットを折りたたみ'}
            >
              <Icon name={isFolded ? 'chevron-right' : 'chevron-down'} className="w-3.5 h-3.5"/>
            </button>
          ) : (
            <span className="w-5 h-5 inline-flex items-center justify-center">
              {isChild ? <span className="text-amber-500 text-xs">└</span> : null}
            </span>
          )}

          {/* drag handle */}
          {editing && (
            <div
              draggable
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onClick={(e) => e.stopPropagation()}
              className="w-4 h-5 flex items-center justify-center text-neutral-400 hover:text-neutral-700 cursor-grab active:cursor-grabbing shrink-0"
              title={isParent ? 'ドラッグでセットごと並び替え'
                    : isChild ? 'ドラッグで同じセット内で並び替え'
                    : 'ドラッグで並び替え'}
            >
              <Icon name="grip" className="w-3.5 h-3.5"/>
            </div>
          )}

          {/* # */}
          <span className="text-[10px] text-neutral-400 tabular-nums w-6 text-right shrink-0">{it.sortOrder}</span>

          {/* product cell */}
          <div className="flex-1 min-w-0">
            {editing ? (
              <div className="flex items-center gap-1.5">
                {isParent && <Badge tone="warn" size="xs" className="shrink-0">SET</Badge>}
                {inactiveProduct && <Badge tone="soft" size="xs" className="shrink-0">廃番</Badge>}
                <div className="flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
                  <ProductCombo
                    value={it.itemName}
                    onChange={(v) => onUpdate({ itemName: v })}
                    onSelect={onPickProduct}
                    allowSet={!isChild}
                  />
                  <div className="text-[10px] text-neutral-500 mt-0.5 pl-0.5 truncate">
                    コード: <span className="font-mono">{it.product.code || '—'}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 min-w-0">
                {isParent && <Badge tone="warn" size="xs" className="shrink-0">SET</Badge>}
                {inactiveProduct && <Badge tone="soft" size="xs" className="shrink-0">廃番</Badge>}
                <div className="flex-1 min-w-0">
                  <div className={`truncate ${isParent ? 'font-semibold text-neutral-900' : 'text-neutral-900'}`}>{it.itemName || <span className="text-neutral-400">（商品未選択）</span>}</div>
                  <div className="text-[10px] text-neutral-500 truncate">コード: <span className="font-mono">{it.product.code || '—'}</span></div>
                </div>
              </div>
            )}
          </div>

          {/* Set-parent extra info (right side of name cell): child count + invalid warning */}
          {isParent && (
            <div className="flex items-center gap-1 shrink-0 ml-1">
              <span className="text-[10px] text-neutral-500">{childrenOf(it.id).length}件</span>
              {setHasInvalid && (
                <span
                  title="無効な構成品が含まれています"
                  className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-semibold"
                >
                  <Icon name="alert" className="w-3 h-3"/> 警告
                </span>
              )}
            </div>
          )}
        </div>
      </td>

      {/* 数量 */}
      <td className={numCell}>
        {isParent ? (
          <span className="text-neutral-400">1</span>
        ) : editing ? (
          <input
            type="number"
            value={it.quantity}
            onChange={(e) => handleNum('quantity', e.target.value)}
            onClick={(e) => e.stopPropagation()}
            className="w-full h-7 px-1.5 text-xs text-right rounded border border-neutral-300 hover:border-neutral-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 focus:outline-none tabular-nums"
          />
        ) : (
          <span>{it.quantity}</span>
        )}
      </td>

      {/* 単位 */}
      <td className={`${cellPad} text-neutral-700 text-xs whitespace-nowrap`}>{it.unit}</td>

      {/* 単価 */}
      <td className={numCell}>
        {isParent ? (
          <span className="text-neutral-400">—</span>
        ) : editing ? (
          <input
            type="number"
            value={it.unitPrice}
            onChange={(e) => handleNum('unitPrice', e.target.value)}
            onClick={(e) => e.stopPropagation()}
            className="w-full h-7 px-1.5 text-xs text-right rounded border border-neutral-300 hover:border-neutral-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 focus:outline-none tabular-nums"
          />
        ) : (
          <span>{window.fmtYen(it.unitPrice)}</span>
        )}
      </td>

      {/* 掛率 */}
      <td className={numCell}>
        {isParent ? (
          <span className="text-neutral-400">—</span>
        ) : editing ? (
          <input
            type="number" step="0.01"
            value={it.discountRate}
            onChange={(e) => handleNum('discountRate', e.target.value)}
            onClick={(e) => e.stopPropagation()}
            className="w-full h-7 px-1.5 text-xs text-right rounded border border-neutral-300 hover:border-neutral-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 focus:outline-none tabular-nums"
          />
        ) : (
          <span className={Number(it.discountRate) < 1 ? 'text-blue-700' : ''}>{Number(it.discountRate).toFixed(2)}</span>
        )}
      </td>

      {/* 値引 */}
      <td className={numCell}>
        {isParent ? (
          <span className="text-neutral-400">—</span>
        ) : editing ? (
          <input
            type="number"
            value={it.itemDiscount}
            onChange={(e) => handleNum('itemDiscount', e.target.value)}
            onClick={(e) => e.stopPropagation()}
            className="w-full h-7 px-1.5 text-xs text-right rounded border border-neutral-300 hover:border-neutral-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 focus:outline-none tabular-nums"
          />
        ) : (
          <span className={it.itemDiscount > 0 ? 'text-red-600' : 'text-neutral-500'}>
            {it.itemDiscount > 0 ? '-' + window.fmtYen(it.itemDiscount) : '¥0'}
          </span>
        )}
      </td>

      {/* 基本金額 */}
      <td className={numCell}>
        {isParent ? <span className="text-neutral-400">—</span> : <span className="text-neutral-700">{window.fmtYen(amounts.baseAmount)}</span>}
      </td>

      {/* 掛率適用後 */}
      <td className={numCell}>
        {isParent ? <span className="text-neutral-400">—</span> : <span className="text-neutral-700">{window.fmtYen(amounts.discountedAmount)}</span>}
      </td>

      {/* 得意先メモ */}
      <td className={`${cellPad} align-middle`} onClick={(e) => e.stopPropagation()}>
        {isParent ? (
          <span className="text-neutral-400 text-xs italic px-1">セット親行</span>
        ) : (
          <MemoCell
            value={it.customerMemo}
            editing={editing}
            tone="customer"
            placeholder="得意先向けメモ"
            onChange={(v) => onUpdate({ customerMemo: v })}
          />
        )}
      </td>

      {/* 社内メモ */}
      <td className={`${cellPad} align-middle`} onClick={(e) => e.stopPropagation()}>
        {isParent ? (
          <span className="text-neutral-400 text-xs italic px-1">—</span>
        ) : (
          <MemoCell
            value={it.internalMemo}
            editing={editing}
            tone="internal"
            placeholder="社内向けメモ"
            onChange={(v) => onUpdate({ internalMemo: v })}
          />
        )}
      </td>

      {/* 納品先価格 (only in revision variation) */}
      {showRevisedCol && (
        <td className={`${numCell} text-violet-700`}>
          {isParent ? <span className="text-neutral-300">—</span>
            : it.revisedDetail
              ? <span className="font-medium">{window.fmtYen(it.revisedDetail.deliveryPrice)}</span>
              : <span className="text-neutral-300">—</span>
          }
        </td>
      )}

      {/* Sticky right: 最終金額 + 削除 */}
      <td
        className="sticky right-0 z-10 align-middle border-l border-neutral-200 px-2 py-1"
        style={{ background: rowBg, boxShadow: '-4px 0 4px -4px rgba(0,0,0,0.07)' }}
      >
        <div className="flex items-center justify-end gap-1.5">
          <div className="text-right">
            <div className={`tabular-nums font-semibold whitespace-nowrap ${isParent ? 'text-neutral-900' : 'text-neutral-900'}`}>
              {isParent ? window.fmtYen(parentFinal) : window.fmtYen(amounts.finalAmount)}
            </div>
          </div>
          {editing && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="w-6 h-6 inline-flex items-center justify-center rounded hover:bg-red-50 hover:text-red-600 text-neutral-400 shrink-0"
              title={isParent ? 'セット親（子行ごと削除）' : 'この行を削除'}
            >
              <Icon name="x" className="w-3.5 h-3.5"/>
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

window.ItemRow = ItemRow;
