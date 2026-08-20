import { CompanyCode } from "@server/shared/domain/values/CompanyCode";
import prisma from "@server/prisma";
import { ConflictError } from "@server/shared/errors/ApplicationError";
import { Customer } from "@subdomains/customer/domain/entities/Customer";
import { CustomerRepository } from "@subdomains/customer/domain/repositories/CustomerRepository";
import { CustomerId } from "@subdomains/customer/domain/values/CustomerId";
import { CustomerMapper } from "@subdomains/customer/infrastructure/mappers/CustomerMapper";

export class PrismaCustomerRepository implements CustomerRepository {
  /**
   * 得意先を新規作成（version は @default(1)）
   */
  async insert(customer: Customer): Promise<Customer> {
    const prismaCustomer = await prisma.customer.create({
      data: CustomerMapper.toPrismaCreate(customer),
    });

    return CustomerMapper.toDomain(prismaCustomer);
  }

  /**
   * 既存得意先を更新（楽観ロック / ADR-0039）
   *
   * WHERE id AND version の条件付き UPDATE で「比較→更新」を DB 上で原子化し、
   * 成功時に version を +1 する。count = 0 は「version 不一致（先行更新あり）」と
   * 「行の消失（削除済み）」の両方を含むが、UPDATE 文からは区別できないため
   * 両方を覆うメッセージで競合として扱う（ADR-0039 細目5/6）。
   *
   * @param expectedVersion 編集画面表示時のトークン（フォーム往復で持ち回った値）
   */
  async update(customer: Customer, expectedVersion: number): Promise<Customer> {
    const result = await prisma.customer.updateMany({
      where: { id: customer.id.value, version: expectedVersion },
      data: {
        ...CustomerMapper.toPrismaUpdate(customer),
        version: { increment: 1 },
      },
    });

    if (result.count === 0) {
      throw new ConflictError(
        "他のユーザーによって更新または削除されています。画面を再読み込みして最新の内容を確認してください。"
      );
    }

    // version を進めた最新行を読み直して返す
    const row = await prisma.customer.findUnique({ where: { id: customer.id.value } });
    if (!row) {
      throw new Error(`保存した得意先の再取得に失敗しました: ${customer.id.value}`);
    }

    return CustomerMapper.toDomain(row);
  }

  /**
   * 得意先を削除（楽観ロック / ADR-0039 細目3）
   *
   * WHERE id AND version の条件付き deleteMany で「比較→削除」を DB 上で原子化する。
   * count = 0 は「version 不一致（先行更新あり）」と「行の消失（削除済み）」の両方を含むが
   * 区別できないため、両方を覆うメッセージで競合として扱う（ADR-0039 細目5/6）。
   *
   * @param expectedVersion 削除画面表示時のトークン（フォーム往復で持ち回った値）
   */
  async delete(id: CustomerId, expectedVersion: number): Promise<void> {
    const result = await prisma.customer.deleteMany({
      where: { id: id.value, version: expectedVersion },
    });

    if (result.count === 0) {
      throw new ConflictError(
        "他のユーザーによって更新または削除されています。画面を再読み込みして最新の内容を確認してください。"
      );
    }
  }

  async findById(id: CustomerId): Promise<Customer | null> {
    const prismaCustomer = await prisma.customer.findUnique({
      where: { id: id.value },
    });

    return prismaCustomer ? CustomerMapper.toDomain(prismaCustomer) : null;
  }

  async findByCode(code: CompanyCode): Promise<Customer | null> {
    // 平坦化後（ADR-0043）は code が customers テーブルの一意列。型内一意なので
    // 旧 CTI のような company join / type 絞り込みは不要。
    const prismaCustomer = await prisma.customer.findUnique({
      where: { code: code.value },
    });

    return prismaCustomer ? CustomerMapper.toDomain(prismaCustomer) : null;
  }
}
