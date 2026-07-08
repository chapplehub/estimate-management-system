"use client";

import { getFormProps, getInputProps, getSelectProps } from "@conform-to/react";
import { useServerForm } from "@/app/_hooks/useServerForm";
import { createEmployee } from "./actions";
import { createEmployeeSchema } from "./schema";

type Props = {
  /** 部署選択フィールド（Server Component を slot として受け取る） */
  departmentSelectSlot: React.ReactNode;
  /** 担当役割の選択肢（page.tsx が findAll で取得し roleCd 昇順で供給） */
  roleOptions: { id: string; name: string }[];
  /** 課員の上位役割の選択肢（課長級のみ・page.tsx が葉ティア絞り込みで供給） */
  superiorRoleOptions: { id: string; name: string }[];
};

export function EmployeeCreateForm({
  departmentSelectSlot,
  roleOptions,
  superiorRoleOptions,
}: Props) {
  const { form, fields, isPending } = useServerForm({
    action: createEmployee,
    schema: createEmployeeSchema,
  });

  // 担当役割の有無で上位役割 UI を切り替える（課員＝担当役割なしのときだけ明示）。
  // 役割持ちの上位役割は担当役割から導出するため、選択済みなら上位役割セレクトは
  // アンマウントして FormData に載せない（CSS 非表示だと未選択値が送信され BE 正規化頼みになる）。
  const isKain = !fields.roleId.value;

  return (
    <div className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-8">
      {/* 全体エラーメッセージ表示 */}
      {form.errors && (
        <div
          className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4"
          role="alert"
        >
          <p className="font-bold">エラー</p>
          <p>{form.errors}</p>
        </div>
      )}

      <form {...getFormProps(form)} noValidate className="space-y-4">
        <div>
          <label htmlFor={fields.name.id} className="block text-gray-700 text-sm font-bold mb-2">
            名前
          </label>
          <input
            {...getInputProps(fields.name, { type: "text" })}
            disabled={isPending}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline disabled:bg-gray-100"
            placeholder="山田太郎"
          />
          {fields.name.errors && (
            <p className="text-red-500 text-xs mt-1" id={fields.name.errorId}>
              {fields.name.errors[0]}
            </p>
          )}
        </div>

        <div>
          <label htmlFor={fields.email.id} className="block text-gray-700 text-sm font-bold mb-2">
            メールアドレス
          </label>
          <input
            {...getInputProps(fields.email, { type: "email" })}
            disabled={isPending}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline disabled:bg-gray-100"
            placeholder="yamada@example.com"
          />
          {fields.email.errors && (
            <p className="text-red-500 text-xs mt-1" id={fields.email.errorId}>
              {fields.email.errors[0]}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor={fields.employeeCd.id}
            className="block text-gray-700 text-sm font-bold mb-2"
          >
            従業員コード
          </label>
          <input
            {...getInputProps(fields.employeeCd, { type: "text" })}
            disabled={isPending}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline disabled:bg-gray-100"
            placeholder="EMP000001"
          />
          {fields.employeeCd.errors ? (
            <p className="text-red-500 text-xs mt-1" id={fields.employeeCd.errorId}>
              {fields.employeeCd.errors[0]}
            </p>
          ) : (
            <p className="text-gray-600 text-xs mt-1">形式: EMP + 6桁の数字（例: EMP000001）</p>
          )}
        </div>

        <div>
          <label htmlFor="departmentId" className="block text-gray-700 text-sm font-bold mb-2">
            所属部署
          </label>
          {departmentSelectSlot}
          {fields.departmentId.errors && (
            <p className="text-red-500 text-xs mt-1" id={fields.departmentId.errorId}>
              {fields.departmentId.errors[0]}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor={fields.password.id}
            className="block text-gray-700 text-sm font-bold mb-2"
          >
            パスワード
          </label>
          <input
            {...getInputProps(fields.password, { type: "password" })}
            disabled={isPending}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline disabled:bg-gray-100"
            placeholder="8文字以上"
          />
          {fields.password.errors && (
            <p className="text-red-500 text-xs mt-1" id={fields.password.errorId}>
              {fields.password.errors[0]}
            </p>
          )}
        </div>

        <div>
          <label htmlFor={fields.role.id} className="block text-gray-700 text-sm font-bold mb-2">
            権限
          </label>
          <select
            {...getSelectProps(fields.role)}
            defaultValue="user"
            disabled={isPending}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline disabled:bg-gray-100"
          >
            <option value="user">一般ユーザー</option>
            <option value="admin">管理者</option>
          </select>
          {fields.role.errors && (
            <p className="text-red-500 text-xs mt-1" id={fields.role.errorId}>
              {fields.role.errors[0]}
            </p>
          )}
        </div>

        <div>
          <label htmlFor={fields.roleId.id} className="block text-gray-700 text-sm font-bold mb-2">
            担当役割
          </label>
          {/* 任意選択。空選択＝担当役割なし。承認者不在ワーニングの反応性のため
              権限セレクトと同じく conform 配線（getSelectProps）でフォームに値を所有させる。
              初期未選択は先頭の <option value=""> が担う。inline defaultValue は付けない
              （spread 後の defaultValue が conform のエラー再描画時の再投入を上書きし、
              選択済みの担当役割をサイレントに消すため。更新フォームと同じ流儀に統一）。 */}
          <select
            {...getSelectProps(fields.roleId)}
            disabled={isPending}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline disabled:bg-gray-100"
          >
            <option value="">（担当役割なし）</option>
            {roleOptions.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </select>
          {fields.roleId.errors && (
            <p className="text-red-500 text-xs mt-1" id={fields.roleId.errorId}>
              {fields.roleId.errors[0]}
            </p>
          )}
        </div>

        {/* 上位役割（承認起点・ADR-20260707-k4e）。担当役割の有無でアンマウント制御する。
            課員（担当役割なし）のときだけ課長級セレクトを描画。役割持ちは担当役割から導出する
            注記に切替え、セレクトは DOM から外して FormData に載せない。 */}
        {isKain ? (
          <div>
            <label
              htmlFor={fields.superiorRoleId.id}
              className="block text-gray-700 text-sm font-bold mb-2"
            >
              上位役割
            </label>
            <select
              {...getSelectProps(fields.superiorRoleId)}
              disabled={isPending}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline disabled:bg-gray-100"
            >
              <option value="">（上位役割なし）</option>
              {superiorRoleOptions.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
            {fields.superiorRoleId.errors && (
              <p className="text-red-500 text-xs mt-1" id={fields.superiorRoleId.errorId}>
                {fields.superiorRoleId.errors[0]}
              </p>
            )}
            {/* 上位役割未設定は登録できるが申請できない旨の非ブロッキング警告（role="status"） */}
            {!fields.superiorRoleId.value && (
              <div
                role="status"
                aria-live="polite"
                className="mt-2 rounded border border-yellow-400 bg-yellow-50 px-4 py-3 text-sm text-yellow-800"
              >
                ⚠️
                上位役割が未設定です。このまま登録できますが、上位役割を設定するまでこの従業員は見積を申請できません。
              </div>
            )}
          </div>
        ) : (
          <div>
            <p className="block text-gray-700 text-sm font-bold mb-2">上位役割</p>
            <p className="text-gray-600 text-sm" role="note">
              担当役割が設定されているため、上位役割は担当役割から自動的に導出されます。
            </p>
          </div>
        )}

        <div className="flex gap-4">
          <button
            type="submit"
            disabled={isPending}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isPending ? "登録中..." : "登録"}
          </button>
        </div>
      </form>
    </div>
  );
}
