"use client";

import { useActionState } from "react";
import { activateDeliveryLocation, deactivateDeliveryLocation } from "./actions";

type Props = {
  deliveryLocationId: string;
  deliveryLocationCode: string;
  isActive: boolean;
  /** 楽観ロックトークン（ADR-0039）。状態変更時にフォームで往復させる。 */
  version: number;
};

export function DeliveryLocationStatusForms({
  deliveryLocationId,
  deliveryLocationCode,
  isActive,
  version,
}: Props) {
  const [activateState, activateAction, isActivating] = useActionState(activateDeliveryLocation, {
    success: true,
  });
  const [deactivateState, deactivateAction, isDeactivating] = useActionState(
    deactivateDeliveryLocation,
    {
      success: true,
    }
  );

  const errorState = !activateState.success ? activateState : deactivateState;

  return (
    <div>
      {!errorState.success && (
        <div
          className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4"
          role="alert"
        >
          <p className="font-bold">エラー</p>
          <p>{errorState.error}</p>
        </div>
      )}

      {isActive ? (
        <form noValidate action={deactivateAction}>
          <input type="hidden" name="id" value={deliveryLocationId} />
          <input type="hidden" name="code" value={deliveryLocationCode} />
          <input type="hidden" name="version" value={version} />
          <button
            type="submit"
            disabled={isDeactivating}
            className="bg-yellow-500 hover:bg-yellow-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isDeactivating ? "無効化中..." : "無効化"}
          </button>
        </form>
      ) : (
        <form noValidate action={activateAction}>
          <input type="hidden" name="id" value={deliveryLocationId} />
          <input type="hidden" name="code" value={deliveryLocationCode} />
          <input type="hidden" name="version" value={version} />
          <button
            type="submit"
            disabled={isActivating}
            className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isActivating ? "有効化中..." : "有効化"}
          </button>
        </form>
      )}
    </div>
  );
}
