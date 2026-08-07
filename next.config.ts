import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  // プロダクション Docker イメージ用（Issue #758）。
  // Vercel は本設定を無視するため現行デプロイに影響しない
  output: "standalone",
};

export default nextConfig;
