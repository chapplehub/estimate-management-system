import { PrismaDepartmentQueryService } from "@subdomains/department/infrastructure/queries/PrismaDepartmentQueryService";
import { SelectField, type SelectFieldProps } from "./SelectField";

type DepartmentSelectFieldProps = Omit<SelectFieldProps, "options">;

/**
 * 部署選択用セレクトボックスコンポーネント（Server Component）
 *
 * DBから有効な部署を取得し、表示順でソートして表示する。
 * Container/Presentation パターンの Container 部分。
 */
export async function DepartmentSelectField(props: DepartmentSelectFieldProps) {
  const queryService = new PrismaDepartmentQueryService();
  const departments = await queryService.findActive({
    orderBy: { field: "displayOrder", direction: "asc" },
  });

  const options = departments.map((dept) => ({
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
