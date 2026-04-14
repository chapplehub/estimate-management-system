"use client";

import { useActionState } from "react";
import { activateCustomer, deactivateCustomer } from "./actions";

type Props = {
  customerId: string;
  customerCode: string;
  isActive: boolean;
};

export function CustomerStatusForms({ customerId, customerCode, isActive }: Props) {
  const [activateState, activateAction, isActivating] = useActionState(activateCustomer, {
    success: true,
  });
  const [deactivateState, deactivateAction, isDeactivating] = useActionState(deactivateCustomer, {
    success: true,
  });

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
          <input type="hidden" name="id" value={customerId} />
          <input type="hidden" name="code" value={customerCode} />
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
          <input type="hidden" name="id" value={customerId} />
          <input type="hidden" name="code" value={customerCode} />
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
