// estimate-app.jsx — Main app

const { useState: useS, useMemo: useM, useEffect: useE } = React;

// ─── Page chrome ────────────────────────────────────────────────────────
function PageHeader() {
  return (
    <header className="h-14 px-6 border-b border-neutral-200 bg-white flex items-center justify-between">
      <div className="flex items-baseline gap-2">
        <span className="text-lg font-extrabold tracking-tight text-neutral-900">ESM</span>
        <span className="text-xs text-neutral-500">見積管理システム</span>
      </div>
      <div className="absolute left-1/2 -translate-x-1/2 text-sm text-neutral-700">管理 ユーザ</div>
      <button
        type="button"
        className="h-9 px-4 rounded-md bg-red-600 hover:bg-red-700 text-white text-sm font-semibold shadow-sm"
      >サインアウト</button>
    </header>
  );
}

// ─── Title row ──────────────────────────────────────────────────────────
function TitleRow({ estimate, mode, dirty, onEdit, onSave, onCancelEdit, onDuplicate }) {
  const typeBadge = {
    NEW:          { label: '新規',    tone: 'info' },
    REPAIR:       { label: '修理',    tone: 'warn' },
    AFTER_REPAIR: { label: '事後修理', tone: 'danger' },
  }[estimate.estimateType];
  return (
    <div className="px-6 pt-6 pb-4">
      <a href="#" onClick={(e) => e.preventDefault()} className="text-sm text-blue-600 hover:underline inline-flex items-center gap-1 mb-3">
        <Icon name="arrow-left" className="w-3.5 h-3.5"/> 見積一覧に戻る
      </a>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-extrabold text-neutral-900 tracking-tight">見積詳細</h1>
          <Badge tone={typeBadge.tone}>{typeBadge.label}</Badge>
          <Badge tone="soft" className="font-normal">承認状態: <span className="ml-1 text-neutral-500">未実装</span></Badge>
          <span className="text-sm text-neutral-500">|</span>
          <div className="text-sm text-neutral-700">
            見積番号: <span className="font-mono font-semibold text-neutral-900">{estimate.estimateNumber}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {mode === 'view' ? (
            <React.Fragment>
              <Button variant="secondary" onClick={onDuplicate}>
                <Icon name="copy" className="w-3.5 h-3.5"/> 複製
              </Button>
              <Button variant="primary" onClick={onEdit}>
                <Icon name="pencil" className="w-3.5 h-3.5"/> 編集
              </Button>
            </React.Fragment>
          ) : (
            <React.Fragment>
              <Button variant="secondary" onClick={onCancelEdit}>キャンセル</Button>
              <Button variant="primary" onClick={onSave}>
                <Icon name="check" className="w-3.5 h-3.5"/> 保存{dirty && <span className="w-1.5 h-1.5 rounded-full bg-white/80 ml-1"></span>}
              </Button>
            </React.Fragment>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Estimate header card (basic + repair) ─────────────────────────────
function EstimateHeaderCard({ estimate, editing, onChange }) {
  const [repairOpen, setRepairOpen] = useS(false);
  const editable = editing;
  const upd = (key, val) => onChange({ ...estimate, [key]: val });

  return (
    <Card className="mx-6">
      <div className="px-5 pt-4 pb-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-neutral-500 uppercase tracking-wider">基本情報</h2>
          <span className="text-xs text-neutral-400">Estimate ID: {estimate.id}</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
          <Field label="見積番号" hint="自動採番のため変更できません">
            <Input value={estimate.estimateNumber} readOnly />
          </Field>
          <Field label="見積区分" hint="作成時に確定。変更できません">
            <Input value={{NEW:'新規',REPAIR:'修理',AFTER_REPAIR:'事後修理'}[estimate.estimateType]} readOnly />
          </Field>

          <Field label="提出区分" required>
            <Select
              value={estimate.submissionType}
              onChange={(e) => upd('submissionType', e.target.value)}
              readOnly={!editable}
            >
              <option value="CUSTOMER">得意先向け</option>
              <option value="DELIVERY_LOCATION">納品先向け</option>
            </Select>
          </Field>
          <Field label="作成者">
            <Input value={estimate.creator.name} readOnly />
          </Field>

          <Field label="見積年月日" required>
            <Input type="date" value={estimate.estimateDate} onChange={(e) => upd('estimateDate', e.target.value)} readOnly={!editable}/>
          </Field>
          <Field label="締切年月日">
            <Input type="date" value={estimate.deadline} onChange={(e) => upd('deadline', e.target.value)} readOnly={!editable}/>
          </Field>

          <Field label="得意先" required hint="コードまたは名前で検索（例: C001 / 山田）">
            <div className="relative">
              <Input
                value={`${estimate.customer.code}  ${estimate.customer.name}`}
                readOnly={!editable}
                onChange={(e) => upd('customer', { ...estimate.customer, name: e.target.value })}
              />
              {editable && <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none"><Icon name="search" className="w-4 h-4"/></span>}
            </div>
          </Field>
          <Field label="納品先" hint="得意先選択後に絞り込まれます">
            <div className="relative">
              <Input
                value={`${estimate.deliveryLocation.code}  ${estimate.deliveryLocation.name}`}
                readOnly={!editable}
                onChange={(e) => upd('deliveryLocation', { ...estimate.deliveryLocation, name: e.target.value })}
              />
              {editable && <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none"><Icon name="search" className="w-4 h-4"/></span>}
            </div>
          </Field>

          <Field label="部署">
            <Select
              value={estimate.department.name}
              onChange={(e) => upd('department', { name: e.target.value })}
              readOnly={!editable}
            >
              <option>営業1部</option>
              <option>営業2部</option>
              <option>技術部</option>
              <option>サービス部</option>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="消費税率" hint="0〜100%">
              <div className="relative">
                <Input
                  type="number" min="0" max="100"
                  value={estimate.taxRate}
                  onChange={(e) => upd('taxRate', Number(e.target.value))}
                  readOnly={!editable}
                  align="right"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 text-sm pointer-events-none">%</span>
              </div>
            </Field>
            <Field label="端数処理">
              <Select
                value={estimate.taxRoundingType}
                onChange={(e) => upd('taxRoundingType', e.target.value)}
                readOnly={!editable}
              >
                <option value="ROUND_DOWN">切捨</option>
                <option value="ROUND_UP">切上</option>
                <option value="ROUND">四捨五入</option>
              </Select>
            </Field>
          </div>
        </div>

        {/* Repair info collapsible */}
        {estimate.estimateType === 'REPAIR' && (
          <div className="mt-6 border-t border-neutral-200 pt-4">
            <button
              type="button"
              onClick={() => setRepairOpen(o => !o)}
              className="w-full flex items-center justify-between gap-3 group"
            >
              <div className="flex items-center gap-2">
                <Icon name={repairOpen ? 'chevron-down' : 'chevron-right'} className="w-4 h-4 text-neutral-500"/>
                <h2 className="text-sm font-bold text-neutral-500 uppercase tracking-wider">修理情報</h2>
                <Badge tone="warn" size="xs">REPAIR</Badge>
              </div>
              <div className="text-xs text-neutral-500 truncate flex items-center gap-3">
                <span className="truncate">対象: {estimate.repairDetail.targetProduct}</span>
                <span>修理予定日: {estimate.repairDetail.scheduledRepairDate}</span>
              </div>
            </button>

            {repairOpen && (
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                <Field label="修理対象機器" required>
                  <Input
                    value={estimate.repairDetail.targetProduct}
                    onChange={(e) => upd('repairDetail', { ...estimate.repairDetail, targetProduct: e.target.value })}
                    readOnly={!editable}
                  />
                </Field>
                <Field label="修理予定日" required>
                  <Input
                    type="date"
                    value={estimate.repairDetail.scheduledRepairDate}
                    onChange={(e) => upd('repairDetail', { ...estimate.repairDetail, scheduledRepairDate: e.target.value })}
                    readOnly={!editable}
                  />
                </Field>
                <Field label="故障内容" required hint="最大2000文字" className="md:col-span-2">
                  <Textarea
                    rows={4}
                    value={estimate.repairDetail.faultDescription}
                    onChange={(e) => upd('repairDetail', { ...estimate.repairDetail, faultDescription: e.target.value })}
                    readOnly={!editable}
                    maxLength={2000}
                  />
                </Field>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

window.PageHeader = PageHeader;
window.TitleRow = TitleRow;
window.EstimateHeaderCard = EstimateHeaderCard;
