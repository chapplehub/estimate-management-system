import { verifySession } from "@/app/_lib/verifyAuthentication";
import Link from "next/link";

const navigationItems = [
  {
    href: "/employees",
    title: "従業員管理",
    description: "従業員の一覧表示、登録、編集、削除を行います。",
  },
  {
    href: "/departments",
    title: "部署管理",
    description: "部署の一覧表示、登録、編集、削除を行います。",
  },
  {
    href: "/roles",
    title: "役割管理",
    description: "役割の一覧表示、登録、編集、削除を行います。",
  },
] as const;

export default async function DashboardPage() {
  await verifySession();

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center mb-2 px-4 pt-4">
        <h1 className="text-3xl font-bold">ダッシュボード</h1>
      </div>

      <div className="px-4 py-4">
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {navigationItems.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="block p-6 bg-white rounded shadow-md hover:shadow-lg transition-shadow"
              >
                <h2 className="text-xl font-semibold text-gray-800">{item.title}</h2>
                <p className="mt-2 text-gray-500">{item.description}</p>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
