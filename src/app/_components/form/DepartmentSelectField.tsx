import { PrismaDepartmentQueryService } from "@subdomains/department/infrastructure/queries/PrismaDepartmentQueryService";
import { SelectField, type SelectFieldProps } from "./SelectField";

type DepartmentSelectFieldProps = Omit<SelectFieldProps, "options"> & {
  /** 除外する部署IDの配列（自己参照防止用） */
  excludeIds?: string[];
};

/**
 * 部署選択用セレクトボックスコンポーネント（Server Component）
 *
 * DBから有効な部署を取得し、部署コード順でソートして表示する。
 * Container/Presentation パターンの Container 部分。
 */
export async function DepartmentSelectField({ excludeIds, ...props }: DepartmentSelectFieldProps) {
  const queryService = new PrismaDepartmentQueryService();
  const departments = await queryService.findActive({
    orderBy: { field: "departmentCd", direction: "asc" },
  });

  const options = departments
    .filter((dept) => !excludeIds?.includes(dept.id))
    .map((dept) => ({
      label: dept.name,
      value: dept.id,
    }));

  return (
    <SelectField
      {...props}
      options={options}
      placeholder={props.placeholder ?? "部署を選択してください"}
    />
  );
}
