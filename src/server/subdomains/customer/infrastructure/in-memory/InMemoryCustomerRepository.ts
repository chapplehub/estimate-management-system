import { CompanyCode } from "@server/shared/domain/values/CompanyCode";
import { Customer } from "@subdomains/customer/domain/entities/Customer";
import { CustomerRepository } from "@subdomains/customer/domain/repositories/CustomerRepository";

export class InMemoryCustomerRepository implements CustomerRepository {
  public DB: { [id: string]: Customer } = {};

  async save(customer: Customer): Promise<Customer> {
    this.DB[customer.id] = customer;
    return customer;
  }

  async delete(id: string): Promise<void> {
    delete this.DB[id];
  }

  async findById(id: string): Promise<Customer | null> {
    return this.DB[id] || null;
  }

  async findByCode(code: CompanyCode): Promise<Customer | null> {
    const customer = Object.values(this.DB).find((c) => c.code.equals(code));
    return customer || null;
  }
}
