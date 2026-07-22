import Link from "next/link";
import { Button } from "@/app/_components/shadcnui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/app/_components/shadcnui/card";

/**
 * (features) セグメントの 404 境界。
 *
 * 配下で `notFound()` が呼ばれた（＝意図的に「無い」と判断した）ときに描画される。
 * これは想定外例外を捕捉する error.tsx とは直交する経路であり、error.tsx はこの 404 を捕捉しない。
 * `notFound()` 由来のため props は受け取らず、client 化も不要な静的コンポーネント。
 * Header は (features)/layout.tsx 側に残る。
 */
export default function FeaturesNotFound() {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>ページが見つかりませんでした</CardTitle>
          <CardDescription>
            お探しのページは存在しないか、移動または削除された可能性があります。
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Button asChild>
            <Link href="/dashboard">トップへ戻る</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
