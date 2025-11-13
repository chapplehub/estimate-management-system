"use server";

import { UpdateEmployeeCommand } from "@/subdomains/employee/commands/UpdateEmployeeCommand";
import { PrismaEmployeeRepository } from "@/subdomains/employee/infra/prisma/PrismaEmployeeRepository";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

// Server Action: 従業員変更
export async function updateEmployee(id: string, formData: FormData) {
  const email = formData.get("email") as string;
  const name = formData.get("name") as string;
  const employeeCd = formData.get("employeeCd") as string;
  // const password = formData.get("password") as string;
  const role = formData.get("role") as "ADMIN" | "USER";

  try {
    const repository = new PrismaEmployeeRepository();

    const command = new UpdateEmployeeCommand(repository);

    // パスワードをハッシュ化
    // const passwordHash = await hash(password, 10);

    await command.execute({
      id,
      name,
      email,
      employeeCd,
      role,
    });

    revalidatePath("/employee");
  } catch (error) {
    console.error("Failed to update employee:", error);
    throw error;
  }

  redirect("/employee");
}
