// app-main.jsx — Top-level App, state management, Tweaks, dialogs

const { useState: useState_App, useMemo: useMemo_App, useEffect: useEffect_App } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "estimateType": "NEW",
  "summaryLayout": "oneline"
}/*EDITMODE-END*/;

function deepClone(x) { return JSON.parse(JSON.stringify(x)); }

// Clone items while regenerating IDs and preserving parent-child relationships.
function cloneItemsWithFreshIds(items) {
  const idMap = new Map();
  // First pass — allocate new ids
  items.forEach(it => idMap.set(it.id, window.DATA.factories.uid(it.kind === 'set-parent' ? 'sp' : it.kind === 'set-child' ? 'sc' : 'n')));
  return items.map(it => ({
    ...deepClone(it),
    id: idMap.get(it.id),
    parentItemId: it.parentItemId ? (idMap.get(it.parentItemId) || null) : null,
  }));
}

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  // Snapshot of pristine estimate so cancel can restore.
  const initial = useMemo_App(() => {
    const e = deepClone(window.DATA.estimate);
    // Reflect tweak: estimateType (NEW | REPAIR)
    e.estimateType = t.estimateType === 'REPAIR' ? 'REPAIR' : 'NEW';
    return e;
  }, [t.estimateType]);

  const [estimate, setEstimate] = useState_App(initial);
  const [pristine, setPristine] = useState_App(initial);
  const [mode, setMode] = useState_App('edit'); // 編集モード初期表示
  const [activeId, setActiveId] = useState_App(estimate.variations[0].id);
  const [showInactive, setShowInactive] = useState_App(true);

  // Dialog state — keyed object
  const [dlg, setDlg] = useState_App(null); // { type, payload }

  // Reset state when tweaks change the estimate type.
  useEffect_App(() => {
    setEstimate(initial);
    setPristine(initial);
    setActiveId(initial.variations[0].id);
  }, [initial]);

  const editing = mode === 'edit';
  const dirty = JSON.stringify(estimate) !== JSON.stringify(pristine);

  // ── Estimate-level updates ────────────────────────────────────────────
  const updateEstimate = (next) => setEstimate(next);
  const updateVariation = (vid, next) => {
    setEstimate(e => ({
      ...e,
      variations: e.variations.map(v => v.id === vid ? next : v),
    }));
  };

  // ── Variation actions ────────────────────────────────────────────────
  const duplicateVariation = (vid) => {
    const src = estimate.variations.find(v => v.id === vid);
    if (!src) return;
    const nextNumber = Math.max(...estimate.variations.map(v => v.variationNumber)) + 1;
    const clone = {
      ...deepClone(src),
      id: 'v' + Date.now(),
      variationNumber: nextNumber,
      status: 'ACTIVE',
      copyTarget: { variationNumber: src.variationNumber },
      revisionTarget: null,
      items: cloneItemsWithFreshIds(src.items),
    };
    setEstimate(e => ({ ...e, variations: [...e.variations, clone] }));
    setActiveId(clone.id);
  };

  const reviseVariation = (vid) => {
    const src = estimate.variations.find(v => v.id === vid);
    if (!src) return;
    const nextNumber = Math.max(...estimate.variations.map(v => v.variationNumber)) + 1;
    const cloned = cloneItemsWithFreshIds(src.items);
    const withRevised = cloned.map(it => it.kind === 'set-parent'
      ? it
      : { ...it, revisedDetail: { deliveryPrice: Math.floor((it.unitPrice || 0) * 0.93) } }
    );
    const clone = {
      ...deepClone(src),
      id: 'v' + Date.now(),
      variationNumber: nextNumber,
      status: 'ACTIVE',
      copyTarget: null,
      revisionTarget: { variationNumber: src.variationNumber },
      items: withRevised,
    };
    setEstimate(e => ({ ...e, variations: [...e.variations, clone] }));
    setActiveId(clone.id);
  };

  const deactivateVariation = (vid) => {
    setEstimate(e => ({
      ...e,
      variations: e.variations.map(v => v.id === vid ? { ...v, status: 'INACTIVE' } : v),
    }));
  };

  const addBlankVariation = () => {
    const nextNumber = Math.max(...estimate.variations.map(v => v.variationNumber)) + 1;
    const v = {
      id: 'v' + Date.now(),
      variationNumber: nextNumber,
      status: 'ACTIVE',
      customerMemo: '', internalMemo: '',
      overallDiscount: 0,
      copyTarget: null, revisionTarget: null,
      items: [],
    };
    setEstimate(e => ({ ...e, variations: [...e.variations, v] }));
    setActiveId(v.id);
  };

  // Confirm delete of a set-parent (cascades to children)
  const confirmDeleteSet = () => {
    const { variationId, parentItem } = dlg.payload;
    setEstimate(e => ({
      ...e,
      variations: e.variations.map(v => {
        if (v.id !== variationId) return v;
        const remaining = v.items.filter(it => it.id !== parentItem.id && it.parentItemId !== parentItem.id);
        return { ...v, items: remaining.map((it, i) => ({ ...it, sortOrder: i + 1 })) };
      }),
    }));
    setDlg(null);
  };

  // ── Mode actions ─────────────────────────────────────────────────────
  const onEdit = () => setMode('edit');
  const onSave = () => {
    setPristine(deepClone(estimate));
    setMode('view');
  };
  const onCancelEdit = () => {
    if (dirty) {
      setDlg({ type: 'cancel' });
    } else {
      setMode('view');
    }
  };
  const confirmCancel = () => {
    setEstimate(deepClone(pristine));
    setMode('view');
    setDlg(null);
  };
  const onDuplicateEstimate = () => alert('見積全体を複製しました（モック）');

  // ── Active variation + totals ────────────────────────────────────────
  const activeVariation = estimate.variations.find(v => v.id === activeId) || estimate.variations[0];
  const totals = useMemo_App(
    () => window.DATA.calc.variation(activeVariation, estimate.taxRate, estimate.taxRoundingType),
    [activeVariation, estimate.taxRate, estimate.taxRoundingType]
  );

  const allInactive = estimate.variations.every(v => v.status === 'INACTIVE');

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 flex flex-col">
      <div className="relative">
        <PageHeader/>
      </div>

      <TitleRow
        estimate={estimate}
        mode={mode}
        dirty={dirty}
        onEdit={onEdit}
        onSave={onSave}
        onCancelEdit={onCancelEdit}
        onDuplicate={onDuplicateEstimate}
      />

      <main className="flex-1 pb-32">
        <EstimateHeaderCard estimate={estimate} editing={editing} onChange={updateEstimate}/>

        <div className="mx-6 mt-6">
          <Card>
            <VariationTabs
              variations={estimate.variations}
              activeId={activeId}
              onChange={setActiveId}
              onAdd={addBlankVariation}
              editing={editing}
              showInactive={showInactive}
              onToggleInactive={setShowInactive}
            />
            {allInactive && (
              <div className="px-5 py-3 bg-amber-50 border-b border-amber-200 text-amber-800 text-sm flex items-center gap-2">
                <Icon name="alert" className="w-4 h-4"/>
                すべてのバリエーションが無効化されています。
              </div>
            )}
            <VariationPanel
              key={activeVariation.id}
              variation={activeVariation}
              editing={editing}
              onUpdate={(v) => updateVariation(activeVariation.id, v)}
              onDuplicate={() => duplicateVariation(activeVariation.id)}
              onRevise={() => setDlg({ type: 'revise', payload: activeVariation.id })}
              onDelete={() => setDlg({ type: 'delete', payload: activeVariation.id })}
              onRequestDeleteSet={(payload) => setDlg({ type: 'deleteSet', payload })}
            />
          </Card>
        </div>
      </main>

      {/* Sticky footer */}
      <div className="sticky bottom-0 z-30">
        <SummaryFooter totals={totals} layout={t.summaryLayout} variation={activeVariation} editing={editing}/>
      </div>

      {/* Dialogs */}
      <Dialog
        open={dlg?.type === 'cancel'}
        title="変更を破棄しますか？"
        onClose={() => setDlg(null)}
        footer={
          <React.Fragment>
            <Button variant="secondary" onClick={() => setDlg(null)}>戻る</Button>
            <Button variant="destructive" onClick={confirmCancel}>変更を破棄</Button>
          </React.Fragment>
        }
      >
        編集内容は失われます。本当に破棄してもよろしいですか？
      </Dialog>

      <Dialog
        open={dlg?.type === 'delete'}
        title="バリエーションを無効化します"
        onClose={() => setDlg(null)}
        footer={
          <React.Fragment>
            <Button variant="secondary" onClick={() => setDlg(null)}>キャンセル</Button>
            <Button variant="destructive" onClick={() => { deactivateVariation(dlg.payload); setDlg(null); }}>無効化する</Button>
          </React.Fragment>
        }
      >
        <p className="mb-2">このバリエーションを無効化（削除フラグ）します。データ自体は削除されず、後で参照可能です。</p>
        <p className="text-neutral-500 text-xs">無効化後はタブがグレーアウトされ、編集ができなくなります。</p>
      </Dialog>

      <Dialog
        open={dlg?.type === 'revise'}
        title="得意先改訂を起票しますか？"
        onClose={() => setDlg(null)}
        footer={
          <React.Fragment>
            <Button variant="secondary" onClick={() => setDlg(null)}>キャンセル</Button>
            <Button variant="primary" onClick={() => { reviseVariation(dlg.payload); setDlg(null); }}>改訂を起票</Button>
          </React.Fragment>
        }
      >
        <p className="mb-2">現在のバリエーションを元に、新しいバリエーション（改訂版）が追加されます。</p>
        <p className="text-neutral-500 text-xs">改訂版の各明細には、納品先価格を保持するフィールドが追加されます。</p>
      </Dialog>

      <Dialog
        open={dlg?.type === 'deleteSet'}
        title="セット明細を削除します"
        onClose={() => setDlg(null)}
        footer={
          <React.Fragment>
            <Button variant="secondary" onClick={() => setDlg(null)}>キャンセル</Button>
            <Button variant="destructive" onClick={confirmDeleteSet}>子行ごと削除</Button>
          </React.Fragment>
        }
      >
        {dlg?.type === 'deleteSet' && (
          <div className="space-y-2">
            <p>
              <span className="font-semibold">{dlg.payload.parentItem.itemName}</span>
              {' '}と、配下の構成商品 <span className="font-semibold">{dlg.payload.childCount}件</span> をまとめて削除します。
            </p>
            <p className="text-neutral-500 text-xs">この操作は取り消せません（編集モードのキャンセル時には元に戻ります）。</p>
          </div>
        )}
      </Dialog>

      {/* Tweaks */}
      <TweaksPanel>
        <TweakSection label="見積データ"/>
        <TweakRadio
          label="見積区分"
          value={t.estimateType}
          options={['NEW', 'REPAIR']}
          onChange={(v) => setTweak('estimateType', v)}
        />

        <TweakSection label="レイアウト"/>
        <TweakRadio
          label="金額サマリー"
          value={t.summaryLayout}
          options={['oneline', 'twoline']}
          onChange={(v) => setTweak('summaryLayout', v)}
        />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
