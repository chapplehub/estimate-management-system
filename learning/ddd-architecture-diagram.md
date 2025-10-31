# DDDアーキテクチャ全体図の作成

## 疑問・問題

DDDの層構造、各層の役割、データ変換の流れを可視化したい。特に：

- Infrastructure / Domain / Application / Presentation 各層の役割
- 各層が持つディレクトリ構造
- 層間のデータ変換（例：EmployeeMapperがPrismaモデル→Domainエンティティに変換）
- パッと見では理解しづらい暗黙的な構造の明示化

## 背景・コンテキスト

現在、`EmployeeApplicationService`のリファクタリング中に、以下のような理解が深まった：

1. **EmployeeMapperの役割**
   - Repository（Infrastructure層）がDBからデータを取得した際、`EmployeeMapper.toDomain()`が自動的に`Employee.reconstruct()`を呼ぶ
   - Application層は、すでにDomainエンティティに変換されたデータを受け取る
   - この変換処理は、コードを追わないと理解しづらい

2. **層間の責務分離**
   - Command（DTO）は生のプリミティブ型を受け取る
   - Application ServiceでValue Objectに変換
   - Repositoryを通じてInfrastructure層とやり取り
   - MapperがPrismaモデル⇔Domainエンティティを変換

3. **ディレクトリ構造と層の対応**
   ```
   src/
   ├── app/              # Presentation層
   ├── application/      # Application層
   ├── domain/           # Domain層
   ├── infrastructure/   # Infrastructure層
   └── shared/           # 共通ユーティリティ
   ```

このような構造を、新規参加者や未来の自分が理解しやすいように図示したい。

## 求めるもの

**Mermaid図（またはPlantUML等）で以下を表現：**

### 1. レイヤードアーキテクチャ図
- 4層の依存関係（Presentation → Application → Domain ← Infrastructure）
- 各層の責務
- 依存の方向性（Domain層は他に依存しない、など）

### 2. ディレクトリ構造マップ
- 各層に対応するディレクトリ
- 主要なファイルの役割（Entity, ValueObject, Repository, Mapper, etc.）

### 3. データフロー図
- ユーザーリクエスト（Presentation）から永続化（Infrastructure）までの流れ
- 各ポイントでのデータ形式：
  - `生のプリミティブ` → `Command（DTO）` → `Value Object` → `Entity` → `Prismaモデル`
- 逆方向（DB → Domain）の変換フロー：
  - `Prismaモデル` → `Mapper.toDomain()` → `Entity` → `レスポンスDTO`

### 4. 具体例：Employee登録フロー
- API Route → Application Service → Domain Service → Repository → Mapper → Prisma
- 各ステップでどのオブジェクトが作られるか
- どこでバリデーションが発生するか

## 期待される成果物

- `docs/architecture-diagram.md`（または専用のドキュメント）
- Mermaid図を含む、プロジェクト全体の構造理解を助けるドキュメント
- 新規参加者のオンボーディング資料として使える品質

## 参考

- 現在のプロジェクト構造：`web/src/`
- 関連ファイル：
  - `/web/src/application/EmployeeApplicationService.ts`
  - `/web/src/infrastructure/repositories/PrismaEmployeeRepository.ts`（予定）
  - `/web/src/infrastructure/mappers/EmployeeMapper.ts`（予定）
  - `/web/src/domain/entities/Employee.ts`

## 解決策

（後で実装時に追記）

## 関連issue

- #4
