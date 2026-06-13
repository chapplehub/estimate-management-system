// data.js — sample estimate data + product master + calculation helpers
// All amounts in 円. Items are flat with parentItemId to express set-parent/child.

window.DATA = (() => {
  const today = '2026-05-15';

  // ── Product master ────────────────────────────────────────────────────
  const products = {
    'P-1001': { id: 'P-1001', code: 'P-1001', name: 'NC旋盤 TL-2000',         category: 'NORMAL', unit: '台',   unitPrice: 4500000, active: true  },
    'P-2031': { id: 'P-2031', code: 'P-2031', name: '高速主軸モータ HSM-150', category: 'NORMAL', unit: '個',   unitPrice: 380000,  active: true  },
    'P-2032': { id: 'P-2032', code: 'P-2032', name: '高速主軸モータ HSM-200', category: 'NORMAL', unit: '個',   unitPrice: 480000,  active: true  },
    'P-3120': { id: 'P-3120', code: 'P-3120', name: '防振パッド SP-200',      category: 'NORMAL', unit: '枚',   unitPrice: 12000,   active: true  },
    'S-0001': { id: 'S-0001', code: 'S-0001', name: '制御盤組み立て',         category: 'NORMAL', unit: '式',   unitPrice: 250000,  active: true  },
    'S-0010': { id: 'S-0010', code: 'S-0010', name: '据付調整作業',           category: 'NORMAL', unit: '時間', unitPrice: 8500,    active: true  },
    'S-0020': { id: 'S-0020', code: 'S-0020', name: '試運転・教育',           category: 'NORMAL', unit: '式',   unitPrice: 120000,  active: true  },
    'C-0001': { id: 'C-0001', code: 'C-0001', name: 'ベアリング交換工賃',     category: 'NORMAL', unit: '式',   unitPrice: 45000,   active: true  },
    'C-0002': { id: 'C-0002', code: 'C-0002', name: '主軸オイル交換',         category: 'NORMAL', unit: '式',   unitPrice: 18000,   active: true  },
    'C-0003': { id: 'C-0003', code: 'C-0003', name: '振動測定レポート',       category: 'NORMAL', unit: '式',   unitPrice: 32000,   active: true  },
    'C-0040': { id: 'C-0040', code: 'C-0040', name: '出張費',                 category: 'NORMAL', unit: '回',   unitPrice: 15000,   active: true  },
    'C-0099': { id: 'C-0099', code: 'C-0099', name: '保守契約（1年）',        category: 'NORMAL', unit: '年',   unitPrice: 280000,  active: false }, // 廃番

    'SET-001': {
      id: 'SET-001', code: 'SET-001', name: '主軸メンテナンスパッケージ',
      category: 'SET', unit: 'セット', unitPrice: 0, active: true,
      setComponents: [
        { productId: 'C-0001', quantity: 1 },
        { productId: 'C-0002', quantity: 1 },
        { productId: 'C-0003', quantity: 1 },
      ],
    },
    'SET-002': {
      id: 'SET-002', code: 'SET-002', name: '据付フルサポート',
      category: 'SET', unit: 'セット', unitPrice: 0, active: true,
      setComponents: [
        { productId: 'S-0010', quantity: 16 },
        { productId: 'S-0020', quantity: 1  },
        { productId: 'C-0040', quantity: 2  },
        { productId: 'C-0099', quantity: 1  }, // 廃番（無効構成品）
      ],
    },
  };

  // ── Item factories ────────────────────────────────────────────────────
  let _uid = 0;
  const uid = (prefix = 'it') => `${prefix}-${++_uid}-${Date.now().toString(36)}`;

  function makeNormalItem(productId, overrides = {}) {
    const p = products[productId];
    return {
      id: uid('n'),
      sortOrder: 0,
      kind: 'normal',
      parentItemId: null,
      product: { id: p.id, code: p.code, name: p.name, category: p.category },
      itemName: p.name,
      quantity: overrides.quantity ?? 1,
      unit: p.unit,
      unitPrice: overrides.unitPrice ?? p.unitPrice,
      discountRate: overrides.discountRate ?? 1.0,
      itemDiscount: overrides.itemDiscount ?? 0,
      customerMemo: overrides.customerMemo ?? '',
      internalMemo: overrides.internalMemo ?? '',
    };
  }

  function makeSetParentItem(productId) {
    const p = products[productId];
    return {
      id: uid('sp'),
      sortOrder: 0,
      kind: 'set-parent',
      parentItemId: null,
      product: { id: p.id, code: p.code, name: p.name, category: 'SET' },
      itemName: p.name,
      quantity: 1, unit: 'セット', unitPrice: 0,
      discountRate: 1.0, itemDiscount: 0,
      customerMemo: '', internalMemo: '',
    };
  }

  function makeSetChildItem(productId, parentId, overrides = {}) {
    const p = products[productId];
    return {
      id: uid('sc'),
      sortOrder: 0,
      kind: 'set-child',
      parentItemId: parentId,
      product: { id: p.id, code: p.code, name: p.name, category: p.category, active: p.active },
      itemName: p.name,
      quantity: overrides.quantity ?? 1,
      unit: p.unit,
      unitPrice: overrides.unitPrice ?? p.unitPrice,
      discountRate: overrides.discountRate ?? 1.0,
      itemDiscount: overrides.itemDiscount ?? 0,
      customerMemo: overrides.customerMemo ?? '',
      internalMemo: overrides.internalMemo ?? '',
    };
  }

  // Build a set group (parent + its components as children) from product master.
  function makeSetGroup(setProductId) {
    const def = products[setProductId];
    const parent = makeSetParentItem(setProductId);
    const children = def.setComponents.map(c =>
      makeSetChildItem(c.productId, parent.id, { quantity: c.quantity })
    );
    return [parent, ...children];
  }

  // Sample items for a variation. Includes:
  //  • 2 normal rows
  //  • SET-001 (3 components, all active)
  //  • SET-002 (4 components, 1 invalid → warning)
  //  • 2 normal rows
  function baseItems({ note } = {}) {
    const items = [
      makeNormalItem('P-1001'),
      makeNormalItem('P-2031', { quantity: 2 }),
      ...makeSetGroup('SET-001'),
      ...makeSetGroup('SET-002'),
      makeNormalItem('P-3120', { quantity: 8, itemDiscount: 5000,
        customerMemo: 'まとめ買いサービスで¥5,000値引き' }),
      makeNormalItem('S-0001'),
    ];
    items[0].discountRate = 0.95;
    items[0].customerMemo = '主軸交換オプション込み。設置場所への搬入経路を要確認。';
    items[0].internalMemo = '在庫1台あり。納期2週間。';
    if (note) items.forEach(it => { if (note[it.product.id]) Object.assign(it, note[it.product.id]); });
    return items.map((it, idx) => ({ ...it, sortOrder: idx + 1 }));
  }

  // V4 — revision variant: same structure, items get a deliveryPrice.
  function revisedItems() {
    return baseItems().map(it => ({
      ...it,
      revisedDetail: it.kind === 'set-parent'
        ? null
        : { deliveryPrice: Math.floor(it.unitPrice * 0.93) },
    }));
  }

  return {
    products,
    estimate: {
      id: 'e1',
      estimateNumber: 'N2500001',
      estimateType: 'NEW',
      estimateDate: today,
      deadline: '2026-06-15',
      submissionType: 'CUSTOMER',
      customer: { code: 'C001', name: '株式会社山田製作所' },
      deliveryLocation: { code: 'D003', name: '山田製作所 名古屋工場' },
      department: { name: '営業1部' },
      creator: { name: '管理 ユーザ' },
      taxRate: 10,
      taxRoundingType: 'ROUND_DOWN',
      repairDetail: {
        targetProduct: 'NC旋盤 TL-1800（シリアル: ML18-2398）',
        faultDescription: '主軸の異音および振動が発生。X軸送りに引っ掛かりあり。\n2026/05/10 の定期点検時に検出。',
        scheduledRepairDate: '2026-06-02',
      },
      variations: [
        {
          id: 'v1', variationNumber: 1, status: 'ACTIVE',
          customerMemo: '納期は受注後4週間程度を予定しております。\n搬入・据付当日は工場内の停電対応をお願いいたします。',
          internalMemo: '値引き率はマージン15%確保で算出。',
          overallDiscount: 50000,
          copyTarget: null, revisionTarget: null,
          items: baseItems(),
        },
        {
          id: 'v2', variationNumber: 2, status: 'ACTIVE',
          customerMemo: '高速主軸モータをHSM-200にグレードアップした構成です。',
          internalMemo: 'V1から複製してモータを差し替え。',
          overallDiscount: 30000,
          copyTarget: { variationNumber: 1 }, revisionTarget: null,
          items: baseItems().map(it => it.product.id === 'P-2031'
            ? { ...it,
                product: { ...it.product, id: 'P-2032', code: 'P-2032', name: '高速主軸モータ HSM-200' },
                itemName: '高速主軸モータ HSM-200', unitPrice: 480000 }
            : it),
        },
        {
          id: 'v3', variationNumber: 3, status: 'INACTIVE',
          customerMemo: '',
          internalMemo: '価格交渉が決裂したため無効化。2026/05/12',
          overallDiscount: 0,
          copyTarget: null, revisionTarget: null,
          items: baseItems().map(it => ({ ...it, discountRate: 1.0 })),
        },
        {
          id: 'v4', variationNumber: 4, status: 'ACTIVE',
          customerMemo: '得意先改訂版。納品先（名古屋工場）への直送価格を反映。',
          internalMemo: '改訂起票: 2026/05/14',
          overallDiscount: 0,
          copyTarget: null, revisionTarget: { variationNumber: 2 },
          items: revisedItems(),
        },
      ],
    },

    // ── calculation helpers ─────────────────────────────────────────────
    calc: {
      itemAmounts(it) {
        if (it.kind === 'set-parent') return { baseAmount: 0, discountedAmount: 0, finalAmount: 0 };
        const base = Math.floor((it.quantity || 0) * (it.unitPrice || 0));
        const discounted = Math.floor(base * (it.discountRate ?? 1));
        const final = Math.max(0, discounted - (it.itemDiscount || 0));
        return { baseAmount: base, discountedAmount: discounted, finalAmount: final };
      },
      setParentFinal(parent, items) {
        return items
          .filter(it => it.parentItemId === parent.id)
          .reduce((s, c) => s + this.itemAmounts(c).finalAmount, 0);
      },
      variation(v, taxRate, roundType) {
        let subtotal = 0;
        let discountSubtotal = 0;
        for (const it of v.items) {
          if (it.kind === 'set-parent') continue;
          const { baseAmount, finalAmount } = this.itemAmounts(it);
          subtotal += baseAmount;
          discountSubtotal += (baseAmount - finalAmount);
        }
        const beforeOverall = subtotal - discountSubtotal;
        const finalSubtotal = Math.max(0, beforeOverall - (v.overallDiscount || 0));
        const taxRaw = finalSubtotal * (taxRate / 100);
        const round = roundType === 'ROUND_UP' ? Math.ceil
                    : roundType === 'ROUND'    ? Math.round
                    : Math.floor;
        const taxAmount = round(taxRaw);
        const finalTotal = finalSubtotal + taxAmount;
        return { subtotal, discountSubtotal: discountSubtotal + (v.overallDiscount || 0),
                 finalSubtotal, taxAmount, finalTotal };
      },
    },

    // ── factories exposed for runtime use (商品選択時の差し替えなど) ────
    factories: { makeNormalItem, makeSetParentItem, makeSetChildItem, makeSetGroup, uid },

    // Helper: detect invalid components within a set parent
    setHasInvalidComponent(parent, items) {
      return items
        .filter(it => it.parentItemId === parent.id)
        .some(c => c.product && c.product.active === false);
    },
  };
})();

window.fmtYen = (n) => {
  if (n == null || isNaN(n)) return '¥0';
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(Math.floor(n));
  return sign + '¥' + abs.toLocaleString('en-US');
};
