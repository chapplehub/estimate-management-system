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

**完成したドキュメント：** `docs/ddd-architecture-overview.md`

### 作成した図

以下の5つのMermaid図を作成し、DDDアーキテクチャ全体を可視化しました：

#### 1. レイヤードアーキテクチャ図
- 4層（Presentation / Application / Domain / Infrastructure）の依存関係
- データの詰め替えフロー（プリミティブ → VO → Entity → DTO → JSON）
- 各層の責務と依存の方向性を明示
- **改善点：** Application層からPresentation層へのDTO変換を明記

#### 2. ディレクトリ構造マップ
- `web/src/` 配下の各ディレクトリと層の対応関係
- 主要ファイルの配置場所と役割
- 実際のプロジェクト構造を反映

#### 3. データフロー図（Write操作）
- Employee登録を例にしたシーケンス図
- 各ステップでのデータ変換を詳細に図示
  - プリミティブ → Command → VO → Entity → Prismaモデル → DB
  - DB → DTO → JSON（レスポンス）
- バリデーションポイントの明示

#### 4. データフロー図（Read操作 - CQRS）
- Query Serviceを使ったRead操作
- CQRSパターンの採用理由と利点を説明
- Write操作との違い（VOやEntityを経由しない）

#### 5. 具体的なクラス構成図
- 実際のクラス名を使ったクラス図
- `Employee`, `MailAddress`, `EmployeeCd`, `IEmployeeRepository`, `PrismaEmployeeRepository`, `EmployeeMapper`等
- クラス間の関係性（依存、実装、生成）

### 採用した技術

- **Mermaid記法** - GitHubで直接レンダリング可能
- フローチャート、シーケンス図、クラス図を活用
- カラーコーディングで層を視覚的に区別

### ドキュメントの構成

1. 目次
2. 各図の説明とMermaidコード
3. 重要ポイントの表形式まとめ
4. ファイルパスとの対応表
5. まとめセクション（設計原則の再確認）

### 期待される効果

- 新規参加者のオンボーディング時間の短縮
- DDDの層構造とデータフローの理解促進
- 暗黙的な変換処理（Mapper等）の可視化
- プロジェクト全体の設計方針の共有

## 関連issue

- #4
