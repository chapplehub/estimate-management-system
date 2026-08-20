"use client";

import { getFormProps, getInputProps, getSelectProps, getTextareaProps } from "@conform-to/react";
import { useServerForm } from "@/app/_hooks/useServerForm";
import { PREFECTURES } from "@server/shared/domain/values/Prefecture";
import Link from "next/link";
import { updateDeliveryLocation } from "./actions";
import { updateDeliveryLocationSchema } from "./schema";

type DeliveryLocation = {
  code: string;
  name: string;
  postalCode: string | null;
  prefecture: string | null;
  address: string | null;
  phoneNumber: string | null;
  faxNumber: string | null;
  contactPerson: string | null;
  deliveryNotes: string | null;
  customerName: string;
  customerCode: string;
  version: number;
};

type Props = {
  deliveryLocation: DeliveryLocation;
};

export function DeliveryLocationUpdateForm({ deliveryLocation }: Props) {
  const updateDeliveryLocationWithCode = updateDeliveryLocation.bind(null, deliveryLocation.code);

  const { form, fields, isPending } = useServerForm({
    action: updateDeliveryLocationWithCode,
    schema: updateDeliveryLocationSchema,
    defaultValue: {
      name: deliveryLocation.name,
      postalCode: deliveryLocation.postalCode ?? "",
      prefecture: deliveryLocation.prefecture ?? "",
      address: deliveryLocation.address ?? "",
      phoneNumber: deliveryLocation.phoneNumber ?? "",
      faxNumber: deliveryLocation.faxNumber ?? "",
      contactPerson: deliveryLocation.contactPerson ?? "",
      deliveryNotes: deliveryLocation.deliveryNotes ?? "",
      version: String(deliveryLocation.version),
    },
  });

  return (
    <>
      {form.errors && (
        <div
          className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4"
          role="alert"
        >
          <p className="font-bold">エラー</p>
          <p>{form.errors}</p>
        </div>
      )}

      <form {...getFormProps(form)} noValidate>
        {/* 楽観ロックトークン（ADR-0039）。編集画面表示時の version を往復させる。 */}
        <input {...getInputProps(fields.version, { type: "hidden" })} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="code-display" className="block text-gray-700 text-sm font-bold mb-2">
              取引先コード
            </label>
            <input
              type="text"
              id="code-display"
              value={deliveryLocation.code}
              disabled
              readOnly
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline bg-gray-100"
            />
            <p className="text-gray-600 text-xs mt-1">取引先コードは変更できません</p>
          </div>

          <div>
            <label htmlFor={fields.name.id} className="block text-gray-700 text-sm font-bold mb-2">
              名前
            </label>
            <input
              {...getInputProps(fields.name, { type: "text" })}
              disabled={isPending}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline disabled:bg-gray-100"
            />
            {fields.name.errors && (
              <p className="text-red-500 text-xs mt-1" id={fields.name.errorId}>
                {fields.name.errors[0]}
              </p>
            )}
          </div>

          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">親得意先</label>
            <div className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight bg-gray-100">
              <Link
                href={`/customers/${deliveryLocation.customerCode}`}
                className="text-blue-600 hover:text-blue-800 hover:underline"
              >
                {deliveryLocation.customerName}
              </Link>
            </div>
            <p className="text-gray-600 text-xs mt-1">親得意先は変更できません</p>
          </div>

          <div>
            <label
              htmlFor={fields.postalCode.id}
              className="block text-gray-700 text-sm font-bold mb-2"
            >
              郵便番号
            </label>
            <input
              {...getInputProps(fields.postalCode, { type: "text" })}
              disabled={isPending}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline disabled:bg-gray-100"
              placeholder="1234567"
            />
            {fields.postalCode.errors ? (
              <p className="text-red-500 text-xs mt-1" id={fields.postalCode.errorId}>
                {fields.postalCode.errors[0]}
              </p>
            ) : (
              <p className="text-gray-600 text-xs mt-1">7桁の数字（ハイフンなし）</p>
            )}
          </div>

          <div>
            <label
              htmlFor={fields.prefecture.id}
              className="block text-gray-700 text-sm font-bold mb-2"
            >
              都道府県
            </label>
            <select
              {...getSelectProps(fields.prefecture)}
              disabled={isPending}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline disabled:bg-gray-100"
            >
              <option value="">選択してください</option>
              {PREFECTURES.map((pref) => (
                <option key={pref} value={pref}>
                  {pref}
                </option>
              ))}
            </select>
            {fields.prefecture.errors && (
              <p className="text-red-500 text-xs mt-1" id={fields.prefecture.errorId}>
                {fields.prefecture.errors[0]}
              </p>
            )}
          </div>

          <div className="md:col-span-2">
            <label
              htmlFor={fields.address.id}
              className="block text-gray-700 text-sm font-bold mb-2"
            >
              住所
            </label>
            <input
              {...getInputProps(fields.address, { type: "text" })}
              disabled={isPending}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline disabled:bg-gray-100"
            />
            {fields.address.errors && (
              <p className="text-red-500 text-xs mt-1" id={fields.address.errorId}>
                {fields.address.errors[0]}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor={fields.phoneNumber.id}
              className="block text-gray-700 text-sm font-bold mb-2"
            >
              電話番号
            </label>
            <input
              {...getInputProps(fields.phoneNumber, { type: "text" })}
              disabled={isPending}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline disabled:bg-gray-100"
              placeholder="0312345678"
            />
            {fields.phoneNumber.errors ? (
              <p className="text-red-500 text-xs mt-1" id={fields.phoneNumber.errorId}>
                {fields.phoneNumber.errors[0]}
              </p>
            ) : (
              <p className="text-gray-600 text-xs mt-1">10〜11桁の数字</p>
            )}
          </div>

          <div>
            <label
              htmlFor={fields.faxNumber.id}
              className="block text-gray-700 text-sm font-bold mb-2"
            >
              FAX番号
            </label>
            <input
              {...getInputProps(fields.faxNumber, { type: "text" })}
              disabled={isPending}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline disabled:bg-gray-100"
              placeholder="0312345679"
            />
            {fields.faxNumber.errors ? (
              <p className="text-red-500 text-xs mt-1" id={fields.faxNumber.errorId}>
                {fields.faxNumber.errors[0]}
              </p>
            ) : (
              <p className="text-gray-600 text-xs mt-1">10〜11桁の数字</p>
            )}
          </div>

          <div>
            <label
              htmlFor={fields.contactPerson.id}
              className="block text-gray-700 text-sm font-bold mb-2"
            >
              担当者
            </label>
            <input
              {...getInputProps(fields.contactPerson, { type: "text" })}
              disabled={isPending}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline disabled:bg-gray-100"
            />
            {fields.contactPerson.errors && (
              <p className="text-red-500 text-xs mt-1" id={fields.contactPerson.errorId}>
                {fields.contactPerson.errors[0]}
              </p>
            )}
          </div>

          <div className="md:col-span-2">
            <label
              htmlFor={fields.deliveryNotes.id}
              className="block text-gray-700 text-sm font-bold mb-2"
            >
              配送時注意事項
            </label>
            <textarea
              {...getTextareaProps(fields.deliveryNotes)}
              disabled={isPending}
              rows={3}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline disabled:bg-gray-100"
            />
            {fields.deliveryNotes.errors ? (
              <p className="text-red-500 text-xs mt-1" id={fields.deliveryNotes.errorId}>
                {fields.deliveryNotes.errors[0]}
              </p>
            ) : (
              <p className="text-gray-600 text-xs mt-1">500文字以内</p>
            )}
          </div>
        </div>

        <div className="flex gap-4 mt-6">
          <button
            type="submit"
            disabled={isPending}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isPending ? "更新中..." : "更新"}
          </button>
        </div>
      </form>
    </>
  );
}
