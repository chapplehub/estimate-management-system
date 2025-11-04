# DDDアーキテクチャ全体図

このドキュメントは、本プロジェクトのDDD（Domain-Driven Design）アーキテクチャ全体を可視化したものです。

## 目次

1. [レイヤードアーキテクチャ](#1-レイヤードアーキテクチャ)
2. [ディレクトリ構造マップ](#2-ディレクトリ構造マップ)
3. [データフロー図（Write操作）](#3-データフロー図write操作)
4. [データフロー図（Read操作 - CQRS）](#4-データフロー図read操作---cqrs)
5. [具体的なクラス構成](#5-具体的なクラス構成)

---

## 1. レイヤードアーキテクチャ

本プロジェクトは、4層のレイヤードアーキテクチャを採用しています。

```mermaid
graph TB
    subgraph Presentation["🎨 Presentation Layer"]
        API[API Routes/Server Actions]
        ResponseDTO[Response DTO<br/>JSON形式]
    end

    subgraph Application["🔧 Application Layer"]
        AppService[EmployeeApplicationService]
        InputDTO[Input Command/DTO<br/>プリミティブ型]
        OutputDTO[Output DTO<br/>プリミティブ型]
    end

    subgraph Domain["💎 Domain Layer (Pure)"]
        Entity[Employee Entity]
        VO[Value Objects<br/>MailAddress, EmployeeCd]
        DomainService[Domain Services<br/>重複チェック]
        IRepo[IEmployeeRepository<br/>Interface]
        IQuery[IEmployeeQueryService<br/>Interface]
    end

    subgraph Infrastructure["🗄️ Infrastructure Layer"]
        Repo[PrismaEmployeeRepository]
        QueryService[PrismaEmployeeQueryService]
        Mapper[EmployeeMapper]
        Prisma[(Prisma Client)]
    end

    API -->|"1. リクエスト<br/>(生データ)"| InputDTO
    InputDTO -->|"2. Command"| AppService
    AppService -->|"3. VO作成"| VO
    AppService -->|"4. Entity操作"| Entity
    AppService -->|"5. ドメインロジック"| DomainService
    AppService -->|"6. 永続化/取得"| IRepo
    AppService -->|"7. クエリ"| IQuery
    AppService -->|"8. DTOに変換"| OutputDTO
    OutputDTO -->|"9. レスポンス"| ResponseDTO
    ResponseDTO -->|"10. JSON"| API

    Repo -.implements.-> IRepo
    QueryService -.implements.-> IQuery
    Repo --> Mapper
    QueryService --> Prisma
    Mapper --> Prisma

    style Domain fill:#fff4e6,stroke:#ff9800,stroke-width:3px
    style Presentation fill:#e3f2fd,stroke:#2196f3
    style Application fill:#f3e5f5,stroke:#9c27b0
    style Infrastructure fill:#e8f5e9,stroke:#4caf50
```

### 各層の責務

| 層 | 責務 | 依存方向 |
|---|---|---|
| **Presentation** | ユーザーインターフェース、API、Server Actions | Application層に依存 |
| **Application** | ユースケース実行、トランザクション制御、DTOの変換 | Domain層に依存 |
| **Domain** | ビジネスロジック、ドメインモデル（Entity、VO、Domain Service） | **他の層に依存しない** |
| **Infrastructure** | データ永続化、外部サービス連携、Domainインターフェースの実装 | Domain層のインターフェースを実装 |

**重要な原則：**
- Domain層は他の層に依存しない（依存性逆転の原則）
- Infrastructure層はDomain層のインターフェース（`IEmployeeRepository`など）を実装
- Application層は具象クラスではなく、インターフェースに依存

---

## 2. ディレクトリ構造マップ

```mermaid
graph LR
    subgraph src["web/src/"]
        direction TB

        subgraph app["app/ (Presentation)"]
            routes["(routes)/<br/>pages, layouts"]
            api["api/<br/>API Routes"]
            actions["actions/<br/>Server Actions"]
        end

        subgraph application["application/ (Application)"]
            appService["EmployeeApplicationService.ts<br/>Commands/DTOs"]
        end

        subgraph domain["domain/ (Domain)"]
            entities["entities/<br/>Employee.ts"]
            valueObjects["valueObjects/<br/>MailAddress.ts<br/>EmployeeCd.ts"]
            services["services/<br/>DomainServices"]
            repositories["repositories/<br/>IEmployeeRepository.ts"]
            queries["queries/<br/>IEmployeeQueryService.ts<br/>dto/EmployeeDTO.ts"]
        end

        subgraph infrastructure["infrastructure/ (Infrastructure)"]
            prismaRepo["Prisma/<br/>PrismaEmployeeRepository.ts"]
            inMemoryRepo["InMemory/<br/>InMemoryEmployeeRepository.ts"]
            mappers["mappers/<br/>EmployeeMapper.ts"]
            queryImpl["queries/<br/>PrismaEmployeeQueryService.ts"]
        end

        subgraph shared["shared/"]
            errors["errors/<br/>DomainError.ts"]
            utils["ValueObject.ts<br/>StringValueObject.ts"]
        end
    end

    app --> application
    application --> domain
    infrastructure -.implements.-> domain

    style domain fill:#fff4e6,stroke:#ff9800,stroke-width:2px
    style app fill:#e3f2fd,stroke:#2196f3
    style application fill:#f3e5f5,stroke:#9c27b0
    style infrastructure fill:#e8f5e9,stroke:#4caf50
    style shared fill:#fafafa,stroke:#757575
```

### 主要ファイルの役割

| ファイルパス | 役割 |
|---|---|
| `domain/entities/Employee.ts` | Employeeエンティティ（ビジネスロジックの中核） |
| `domain/valueObjects/MailAddress.ts` | メールアドレスのValue Object（バリデーション含む） |
| `domain/repositories/IEmployeeRepository.ts` | Repositoryインターフェース（Domain層で定義） |
| `domain/queries/IEmployeeQueryService.ts` | Query Serviceインターフェース（CQRS） |
| `application/EmployeeApplicationService.ts` | ユースケース実行（VO変換、トランザクション制御） |
| `infrastructure/Prisma/PrismaEmployeeRepository.ts` | Prismaを使ったRepository実装 |
| `infrastructure/mappers/EmployeeMapper.ts` | Prismaモデル ↔ Domainエンティティの変換 |
| `infrastructure/queries/PrismaEmployeeQueryService.ts` | Prismaを使ったQuery Service実装 |

---

## 3. データフロー図（Write操作）

Employee登録を例に、データがどのように変換されながら各層を流れるかを示します。

```mermaid
sequenceDiagram
    participant User as 👤 User
    participant API as API Route
    participant App as ApplicationService
    participant VO as Value Objects
    participant Domain as Domain Layer
    participant Repo as Repository
    participant Mapper as Mapper
    participant DB as Database

    User->>API: POST /api/employees<br/>{email: "test@example.com", name: "山田太郎", ...}
    Note over API: 生のプリミティブ型データ

    API->>App: registerEmployee(command)
    Note over App: Command = {email: string, name: string, ...}

    App->>VO: new MailAddress(command.email)
    VO-->>App: mailAddress: MailAddress

    App->>VO: new EmployeeCd(command.employeeCd)
    VO-->>App: employeeCd: EmployeeCd

    Note over App: Value Objectに変換完了

    App->>Domain: DuplicationCheckService.check(mailAddress)
    Domain->>Repo: existsByMailAddress(mailAddress)
    Repo->>DB: SELECT * FROM employees WHERE email = ?
    DB-->>Repo: []
    Repo-->>Domain: false
    Domain-->>App: OK

    Note over App: 重複チェック完了

    App->>Domain: Employee.create({<br/>  name,<br/>  mailAddress,<br/>  employeeCd,<br/>  ...<br/>})
    Note over Domain: ドメインロジック実行<br/>（バリデーション等）
    Domain-->>App: employee: Employee

    App->>Repo: save(employee)
    Note over Repo: Entityをpersistable形式に変換
    Repo->>Mapper: toPrisma(employee)
    Note over Mapper: EmployeeMapper.toPrisma()<br/>Domain Entity → Prisma型
    Mapper-->>Repo: {<br/>  id: string,<br/>  email: string,<br/>  employeeCd: string,<br/>  ...<br/>}

    Repo->>DB: INSERT INTO employees VALUES (...)
    DB-->>Repo: success
    Repo-->>App: void

    Note over App: DTOに変換
    App->>App: toDTO(employee)
    Note over App: {<br/>  id: employee.id,<br/>  email: employee.mailAddress.value,<br/>  ...<br/>}

    App-->>API: EmployeeDTO
    API-->>User: 201 Created<br/>{id, email, name, ...}
```

### データ変換の流れ

1. **API → Application**: プリミティブ型 → Command/DTO
2. **Application → Domain**: プリミティブ型 → Value Object（`MailAddress`, `EmployeeCd`）
3. **Application → Domain**: Value Object → Entity（`Employee.create()`）
4. **Domain → Infrastructure**: Entity → Prismaモデル（`EmployeeMapper.toPrisma()`）
5. **Infrastructure → DB**: Prismaモデル → DBレコード
6. **Application → Presentation**: Entity → DTO（プリミティブ型に戻す）
7. **Presentation → User**: DTO → JSON

---

## 4. データフロー図（Read操作 - CQRS）

本プロジェクトでは、**CQRS（Command Query Responsibility Segregation）**パターンを採用しています。

- **Write（Command）**: Repository経由でEntity操作
- **Read（Query）**: Query Service経由でDTOを直接取得

```mermaid
sequenceDiagram
    participant User as 👤 User
    participant API as API Route
    participant App as ApplicationService
    participant Query as IEmployeeQueryService
    participant QueryImpl as PrismaEmployeeQueryService
    participant DB as Database

    User->>API: GET /api/employees?name=山田

    API->>App: searchEmployees(criteria)
    Note over App: SearchCriteria = {<br/>  name?: string,<br/>  mailAddress?: string,<br/>  ...<br/>}

    App->>Query: search(criteria)
    Note over Query: インターフェース（Domain層）

    Query->>QueryImpl: search(criteria)
    Note over QueryImpl: Prisma実装（Infrastructure層）

    QueryImpl->>DB: SELECT * FROM employees<br/>WHERE name LIKE '%山田%'
    DB-->>QueryImpl: [{ id, email, employeeCd, ... }]

    Note over QueryImpl: Prisma結果を直接DTOに変換<br/>（Value Objectを経由しない）
    QueryImpl->>QueryImpl: map to EmployeeDTO[]

    QueryImpl-->>Query: EmployeeDTO[]
    Query-->>App: EmployeeDTO[]

    App-->>API: EmployeeDTO[]
    API-->>User: 200 OK<br/>[{id, email, name, ...}]
```

### CQRSの利点

| 操作 | 経路 | 利点 |
|---|---|---|
| **Write** | Repository → Mapper → Entity | ドメインロジックを確実に通す、整合性保証 |
| **Read** | Query Service → DTO直接 | パフォーマンス向上、不要なオブジェクト生成を回避 |

**重要：** Query操作ではValue ObjectやEntityを経由せず、直接DTOを返すことでパフォーマンスを最適化しています。

---

## 5. 具体的なクラス構成

実際のプロジェクトで使用しているクラスとその関係を図示します。

```mermaid
classDiagram
    %% Domain Layer
    class Employee {
        -id: string
        -employeeCd: EmployeeCd
        -mailAddress: MailAddress
        -name: string
        -role: Role
        -failedLoginAttempts: number
        -isLocked: boolean
        +create(props) Employee$
        +reconstruct(props) Employee$
        +updateName(name) void
        +incrementFailedAttempts() void
        +resetFailedAttempts() void
        +lock() void
        +unlock() void
    }

    class MailAddress {
        -_value: string
        +constructor(value: string)
        +value: string
        +equals(other: MailAddress) boolean
    }

    class EmployeeCd {
        -_value: string
        +constructor(value: string)
        +value: string
        +equals(other: EmployeeCd) boolean
    }

    class IEmployeeRepository {
        <<interface>>
        +findById(id: string) Promise~Employee~
        +findByMailAddress(email: MailAddress) Promise~Employee~
        +existsByMailAddress(email: MailAddress) Promise~boolean~
        +save(employee: Employee) Promise~void~
        +delete(id: string) Promise~void~
    }

    class IEmployeeQueryService {
        <<interface>>
        +search(criteria: EmployeeSearchCriteria) Promise~EmployeeDTO[]~
        +findById(id: string) Promise~EmployeeDTO~
    }

    %% Application Layer
    class EmployeeApplicationService {
        -employeeRepository: IEmployeeRepository
        -employeeQueryService: IEmployeeQueryService
        -mailAddressDuplicationCheck: MailAddressDuplicationCheckDomainService
        -employeeCdDuplicationCheck: EmployeeCdDuplicationCheckDomainService
        +registerEmployee(command) Promise~EmployeeDTO~
        +updateEmployee(command) Promise~EmployeeDTO~
        +deleteEmployee(id) Promise~void~
        +searchEmployees(criteria) Promise~EmployeeDTO[]~
    }

    %% Infrastructure Layer
    class PrismaEmployeeRepository {
        -prisma: PrismaClient
        +findById(id: string) Promise~Employee~
        +findByMailAddress(email: MailAddress) Promise~Employee~
        +existsByMailAddress(email: MailAddress) Promise~boolean~
        +save(employee: Employee) Promise~void~
        +delete(id: string) Promise~void~
    }

    class EmployeeMapper {
        +toDomain(prismaEmployee) Employee$
        +toPrisma(employee) PrismaEmployeeCreateInput$
    }

    class PrismaEmployeeQueryService {
        -prisma: PrismaClient
        +search(criteria) Promise~EmployeeDTO[]~
        +findById(id) Promise~EmployeeDTO~
    }

    %% Relationships
    Employee --> MailAddress : has
    Employee --> EmployeeCd : has

    EmployeeApplicationService --> IEmployeeRepository : uses
    EmployeeApplicationService --> IEmployeeQueryService : uses
    EmployeeApplicationService ..> Employee : creates/updates
    EmployeeApplicationService ..> MailAddress : creates
    EmployeeApplicationService ..> EmployeeCd : creates

    PrismaEmployeeRepository ..|> IEmployeeRepository : implements
    PrismaEmployeeRepository --> EmployeeMapper : uses
    EmployeeMapper ..> Employee : converts to/from

    PrismaEmployeeQueryService ..|> IEmployeeQueryService : implements

    note for Employee "Domain層の中核\n不変条件を保護\nファクトリメソッドで生成"
    note for IEmployeeRepository "Domain層で定義\nInfrastructure層で実装\n(依存性逆転)"
    note for EmployeeMapper "Prisma ↔ Domain Entity\nの相互変換を担当"
    note for PrismaEmployeeQueryService "CQRSのRead側\nDTOを直接返す"
```

### クラスの対応表

| クラス | 層 | ファイルパス |
|---|---|---|
| `Employee` | Domain | `src/domain/entities/Employee.ts` |
| `MailAddress` | Domain | `src/domain/valueObjects/MailAddress.ts` |
| `EmployeeCd` | Domain | `src/domain/valueObjects/EmployeeCd.ts` |
| `IEmployeeRepository` | Domain | `src/domain/repositories/IEmployeeRepository.ts` |
| `IEmployeeQueryService` | Domain | `src/domain/queries/IEmployeeQueryService.ts` |
| `EmployeeApplicationService` | Application | `src/application/EmployeeApplicationService.ts` |
| `PrismaEmployeeRepository` | Infrastructure | `src/infrastructure/Prisma/Employee/PrismaEmployeeRepository.ts` |
| `EmployeeMapper` | Infrastructure | `src/infrastructure/mappers/EmployeeMapper.ts` |
| `PrismaEmployeeQueryService` | Infrastructure | `src/infrastructure/queries/PrismaEmployeeQueryService.ts` |

---

## まとめ

### 重要なポイント

1. **依存性逆転の原則**
   - Domain層は他の層に依存しない
   - Infrastructure層がDomain層のインターフェースを実装

2. **データ変換の多段階性**
   - Write: プリミティブ → VO → Entity → Prismaモデル → DB
   - Read: DB → DTO（VOやEntityを経由しない - CQRS）

3. **CQRS採用**
   - Command（Write）: Repository経由
   - Query（Read）: Query Service経由

4. **Mapperの役割**
   - PrismaモデルとDomain Entityの相互変換
   - Infrastructure層に配置

5. **Value Objectの重要性**
   - プリミティブ型をラップしてバリデーション
   - ドメインルールの保護

### 参考リンク

- プロジェクトルートの設計ドキュメント: `docs/system-design-doc.md`
- 開発ガイドライン: `docs/dev-guidelines.md`
- CLAUDE.md: プロジェクトの全体方針
