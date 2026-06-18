"use client";

/**
 * SelectionModal 駆動の外部キー選択フィールド（純粋表示部品）。
 *
 * 「ラベル＋選択値（名称（コード）／未選択）＋選択ボタン＋エラー」という、見積ヘッダーで
 * 得意先・納品先・修理対象機器に共通して現れる塊を 1 箇所へ集約する。モーダルの開閉状態・
 * 検索アクション・選択ハンドラは親が持ち、本部品は表示と「選択」クリックの通知だけを担う
 * （dumb component）。編集（C2）と作成（C1）の双方で再利用する。
 */
type Props = {
  /** 見出しラベル（例: 「得意先」）。 */
  label: string;
  /** 選択済みの表示文字列（例: 「○○（C001）」）。未選択は null を渡す。 */
  selectedLabel: string | null;
  /** 「選択」ボタン押下の通知（親がモーダルを開く）。 */
  onSelect: () => void;
  disabled?: boolean;
  /** 「選択」ボタンの aria-label（例: 「得意先を選択」）。 */
  selectAriaLabel: string;
  /** 表示するフィールドエラー（先頭1件）。 */
  error?: string;
};

export function FkSelectionField({
  label,
  selectedLabel,
  onSelect,
  disabled,
  selectAriaLabel,
  error,
}: Props) {
  return (
    <div>
      <span className="block text-gray-700 text-sm font-bold mb-2">{label}</span>
      <div className="flex items-center gap-2">
        <span className="flex-1 text-gray-900">{selectedLabel ?? "未選択"}</span>
        <button
          type="button"
          onClick={onSelect}
          disabled={disabled}
          aria-label={selectAriaLabel}
          className="bg-gray-200 hover:bg-gray-300 text-gray-800 text-sm font-bold py-1 px-3 rounded disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
        >
          選択
        </button>
      </div>
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
}
