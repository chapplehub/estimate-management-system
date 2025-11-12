"use server";

import { deleteEmployeeCommand } from "@/subdomains/employee/commands/deleteEmployeeCommand";
import { PrismaEmployeeRepository } from "@/subdomains/employee/infra/prisma/PrismaEmployeeRepository";
import { revalidatePath } from "next/cache";

// Server Action: 従業員削除
export async function deleteEmployee(id: string) {
  try {
    const repository = new PrismaEmployeeRepository();
    const command = new deleteEmployeeCommand(repository);

    await command.execute({
      id,
    });

    revalidatePath("/employee/[employeeCd]");
  } catch (error) {
    console.error("Failed to delete employee:", error);
    throw error;
  }
}
