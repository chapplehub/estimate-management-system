"use server";

import { DeleteEmployeeCommand } from "@/subdomains/employee/commands/DeleteEmployeeCommand";
import { PrismaEmployeeRepository } from "@/subdomains/employee/infra/prisma/PrismaEmployeeRepository";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

// Server Action: 従業員削除
export async function deleteEmployee(id: string) {
  try {
    const repository = new PrismaEmployeeRepository();
    const command = new DeleteEmployeeCommand(repository);

    await command.execute({
      id,
    });

    revalidatePath("/employee");
  } catch (error) {
    console.error("Failed to delete employee:", error);
    throw error;
  }

  redirect("/employee");
}
