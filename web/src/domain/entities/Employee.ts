import { EmployeeCd } from "@/domain/valueObjects/EmployeeCd";
import { MailAddress } from "@/domain/valueObjects/MailAddress";
import { Password } from "@/domain/valueObjects/Password";

export class Employee {
  private constructor(
    private readonly _id: string, // 識別子は変更不可のためreadonlyにする
    private _employeeCd: EmployeeCd,
    private _password: Password,
    private _mailAddress: MailAddress
  ) {}

  // 新規エンティティの生成
  static create(
    id: string,
    employeeCd: EmployeeCd,
    password: Password,
    mailAddress: MailAddress
  ) {
    return new Employee(id, employeeCd, password, mailAddress);
  }

  public delete() {
    // 削除時のロジックがあれば書く
  }

  public changeMailAddress(newMailAddress: MailAddress) {
    this._mailAddress = newMailAddress;
  }

  // エンティティの再構築
  static reconstruct(
    id: string,
    employeeCd: EmployeeCd,
    password: Password,
    mailAddress: MailAddress
  ) {
    return new Employee(id, employeeCd, password, mailAddress);
  }

  get id(): string {
    return this._id;
  }

  get employeeCd(): EmployeeCd {
    return this._employeeCd;
  }
  get password(): Password {
    return this._password;
  }
  get mailAddress(): MailAddress {
    return this._mailAddress;
  }
}
