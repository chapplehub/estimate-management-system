type Customer = {
  code: string;
  name: string;
  postalCode: string | null;
  prefecture: string | null;
  address: string | null;
  phoneNumber: string | null;
  faxNumber: string | null;
  contactPerson: string | null;
  marginRate: number | null;
};

type Props = {
  customer: Customer;
};

export function CustomerDetailView({ customer }: Props) {
  const formattedPostalCode = customer.postalCode
    ? `${customer.postalCode.slice(0, 3)}-${customer.postalCode.slice(3)}`
    : "-";

  return (
    <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <dt className="text-sm font-bold text-gray-700">コード</dt>
        <dd className="mt-1 text-gray-900">{customer.code}</dd>
      </div>
      <div>
        <dt className="text-sm font-bold text-gray-700">名前</dt>
        <dd className="mt-1 text-gray-900">{customer.name}</dd>
      </div>
      <div>
        <dt className="text-sm font-bold text-gray-700">郵便番号</dt>
        <dd className="mt-1 text-gray-900">{formattedPostalCode}</dd>
      </div>
      <div>
        <dt className="text-sm font-bold text-gray-700">都道府県</dt>
        <dd className="mt-1 text-gray-900">{customer.prefecture ?? "-"}</dd>
      </div>
      <div className="md:col-span-2">
        <dt className="text-sm font-bold text-gray-700">住所</dt>
        <dd className="mt-1 text-gray-900">{customer.address ?? "-"}</dd>
      </div>
      <div>
        <dt className="text-sm font-bold text-gray-700">電話番号</dt>
        <dd className="mt-1 text-gray-900">{customer.phoneNumber ?? "-"}</dd>
      </div>
      <div>
        <dt className="text-sm font-bold text-gray-700">FAX番号</dt>
        <dd className="mt-1 text-gray-900">{customer.faxNumber ?? "-"}</dd>
      </div>
      <div>
        <dt className="text-sm font-bold text-gray-700">担当者</dt>
        <dd className="mt-1 text-gray-900">{customer.contactPerson ?? "-"}</dd>
      </div>
      <div>
        <dt className="text-sm font-bold text-gray-700">マージン率</dt>
        <dd className="mt-1 text-gray-900">
          {customer.marginRate !== null ? `${customer.marginRate.toFixed(2)}%` : "未設定"}
        </dd>
      </div>
    </dl>
  );
}
