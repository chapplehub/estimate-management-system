import { Role } from "@subdomains/role/domain/entities/Role";
import { RoleRepository } from "@subdomains/role/domain/repositories/RoleRepository";
import { RoleCd } from "@subdomains/role/domain/values/RoleCd";
import { RoleMapper } from "@subdomains/role/infrastructure/mappers/RoleMapper";
import prisma from "@server/prisma";

export class PrismaRoleRepository implements RoleRepository {
  async save(role: Role): Promise<Role> {
    const prismaRole = await prisma.role.upsert({
      where: { id: role.id },
      create: RoleMapper.toPrismaCreate(role),
      update: RoleMapper.toPrismaUpdate(role),
    });

    return RoleMapper.toDomain(prismaRole);
  }

  async delete(id: string): Promise<void> {
    await prisma.role.delete({
      where: { id },
    });
  }

  async findById(id: string): Promise<Role | null> {
    const prismaRole = await prisma.role.findUnique({
      where: { id },
    });

    return prismaRole ? RoleMapper.toDomain(prismaRole) : null;
  }

  async findByRoleCd(roleCd: RoleCd): Promise<Role | null> {
    const prismaRole = await prisma.role.findUnique({
      where: { roleCd: roleCd.value },
    });

    return prismaRole ? RoleMapper.toDomain(prismaRole) : null;
  }

  async findByName(name: string): Promise<Role | null> {
    const prismaRole = await prisma.role.findFirst({
      where: { name },
    });

    return prismaRole ? RoleMapper.toDomain(prismaRole) : null;
  }

  async findSubordinates(superiorRoleId: string): Promise<Role[]> {
    const prismaRoles = await prisma.role.findMany({
      where: { superiorRoleId },
      orderBy: { roleCd: "asc" },
    });

    return prismaRoles.map(RoleMapper.toDomain);
  }

  async isInUse(roleId: string): Promise<boolean> {
    const [employeeRoleCount, employeeSuperiorCount] = await Promise.all([
      prisma.employeeRole.count({ where: { roleId } }),
      prisma.employee.count({ where: { superiorRoleId: roleId } }),
    ]);

    return employeeRoleCount > 0 || employeeSuperiorCount > 0;
  }
}
