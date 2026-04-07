import { Role } from "@subdomains/role/domain/entities/Role";
import { RoleRepository } from "@subdomains/role/domain/repositories/RoleRepository";
import { RoleCd } from "@subdomains/role/domain/values/RoleCd";
import { RoleId } from "@subdomains/role/domain/values/RoleId";
import { RoleMapper } from "@subdomains/role/infrastructure/mappers/RoleMapper";
import prisma from "@server/prisma";

export class PrismaRoleRepository implements RoleRepository {
  async save(role: Role): Promise<Role> {
    const prismaRole = await prisma.role.upsert({
      where: { id: role.id.value },
      create: RoleMapper.toPrismaCreate(role),
      update: RoleMapper.toPrismaUpdate(role),
    });

    return RoleMapper.toDomain(prismaRole);
  }

  async delete(id: RoleId): Promise<void> {
    await prisma.role.delete({
      where: { id: id.value },
    });
  }

  async findById(id: RoleId): Promise<Role | null> {
    const prismaRole = await prisma.role.findUnique({
      where: { id: id.value },
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

  async findSubordinates(superiorRoleId: RoleId): Promise<Role[]> {
    const prismaRoles = await prisma.role.findMany({
      where: { superiorRoleId: superiorRoleId.value },
      orderBy: { roleCd: "asc" },
    });

    return prismaRoles.map(RoleMapper.toDomain);
  }

  async isInUse(roleId: RoleId): Promise<boolean> {
    const [employeeRoleCount, employeeSuperiorCount] = await Promise.all([
      prisma.employeeRole.count({ where: { roleId: roleId.value } }),
      prisma.employee.count({ where: { superiorRoleId: roleId.value } }),
    ]);

    return employeeRoleCount > 0 || employeeSuperiorCount > 0;
  }
}
