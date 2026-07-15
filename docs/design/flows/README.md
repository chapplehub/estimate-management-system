# ユースケース フロー図

各ユースケース（見積の C1〜C7 など）を実行したとき、**どのメソッドを、どの順に、どんな型を経由してたどるか**を mermaid シーケンス図で視覚化したもの。

## 目的

- 「何をしたとき、どういう経路で、どういうデータ変換が起こるのか」を目で追えるようにする（issue #604）
- 平坦なフォーム入力が、どこで入れ子のドメインオブジェクトに組み直され、どこで Prisma の行に落ちるのか、といった**型変換の山場**に注釈を付ける
- 実際の関数名・型名・ファイルパスまで踏み込み、コードと図を照合できる解像度を保つ

## 読み方

- participant はレイヤ（presentation / application / domain / infrastructure）と主要コンポーネントに対応する
- `Note` は**データがどの型になっているか**を示す。矢印のラベルは呼び出すメソッドとシグネチャ
- 図中の囲み英字（【A】【B】…）は本文「型変換の山場」の節に対応する（矢印上の黒丸数字は mermaid の自動採番で、これとは別物）

## 図の一覧

| ID | ユースケース | 図 | 骨格 |
|----|------------|----|------|
| C1 | 見積 新規作成 | [C1-create-estimate.md](./C1-create-estimate.md) | 集約を新規生成して `insert` |
| C3 | バリエーション追加 | [C3-add-variation.md](./C3-add-variation.md) | 既存集約に `appendVariation` して `update` |
| C4 | バリエーション内容更新 | [C4-update-variation-content.md](./C4-update-variation-content.md) | 既存内容を `replaceContent` で全置換して `update` |
| C6 | 見積 複製 | [C6-duplicate-estimate.md](./C6-duplicate-estimate.md) | 複製元を継承・再解決して `insertWithCopies` |

> C3/C4/C6 は C1 の共有部品（明細の zod・変換・価格決定・記述子変換・ファクトリ入口）を大量に使い回す。各図の末尾に「C1 との共有／固有差分」表を置き、**どこが同じでどこが違うか**を対比できるようにしている。
>
> 他のユースケース（C2 ヘッダ更新 / C5 削除 / C7 改訂 など）も同じテンプレで順次追加する。
