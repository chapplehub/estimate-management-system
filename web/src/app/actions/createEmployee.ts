import { CreateEmployeeCommand } from "@/subdomains/employee/commands/CreateEmployeeCommand";
import { PrismaEmployeeRepository } from "@/subdomains/employee/infra/prisma/PrismaEmployeeRepository";
import { EmployeeCdDuplicationCheckDomainService } from "@/subdomains/employee/services/EmployeeCdDuplicationCheckDomainService";
import { hash } from "bcrypt";
import { revalidatePath } from "next/cache";

// Server Action: 従業員作成
export async function createEmployee(formData: FormData) {
  "use server";

  const email = formData.get("email") as string;
  const name = formData.get("name") as string;
  const employeeCd = formData.get("employeeCd") as string;
  const password = formData.get("password") as string;
  const role = formData.get("role") as "ADMIN" | "USER";

  try {
    const repository = new PrismaEmployeeRepository();
    const employeeCdDuplicationCheck =
      new EmployeeCdDuplicationCheckDomainService(repository);

    const command = new CreateEmployeeCommand(
      repository,
      employeeCdDuplicationCheck
    );

    // パスワードをハッシュ化
    const passwordHash = await hash(password, 10);

    await command.execute({
      name,
      email,
      employeeCd,
      passwordHash,
      role,
    });

    revalidatePath("/employee");
  } catch (error) {
    console.error("Failed to create employee:", error);
    throw error;
  }
}
