import type { AuthSession } from "@server/shared/auth";
import { REDIRECT_REASON } from "@shared/constants/redirect-reasons";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { verifyAdmin, verifyOwnerOrAdmin, verifySession } from "../verifyAuthentication";

/**
 * 実行境界の認証・認可ヘルパー（#153）の振る舞い契約テスト。
 *
 * 認可失敗時の遷移先を任意指定できるようにする変更（`verifyAdmin(redirectTo?)`）にあたり、
 * 「既定値は据え置き・指定時のみ差し替わる」ことを固定する。本イシューを振る舞い不変の移設として
 * 着地させるための安全網であり、既定値の退化はここで検知される。
 *
 * better-auth 実体（`@server/shared/auth` バレル）は import 時に認証インスタンスを組み立てるため
 * まるごとモックするが、`isAdmin` / `isOwner` の判定ロジックだけは実物を使う。
 * 判定そのものを偽装するとヘルパーの分岐を検証したことにならないため。
 */

const getCurrentSession = vi.fn();
vi.mock("@server/shared/auth", async () => {
  const { isAdmin, isOwner } = await import("@server/shared/auth/verify/authorization");
  return { getCurrentSession: () => getCurrentSession(), isAdmin, isOwner };
});

const redirectSpy = vi.fn();
vi.mock("next/navigation", () => ({
  // 実物の redirect は例外を投げて以降の処理を打ち切る。ここでも投げないと
  // 「リダイレクトしたのに session を返す」という現実に無い経路をテストしてしまう。
  redirect: (url: string) => {
    redirectSpy(url);
    throw new Error(`NEXT_REDIRECT: ${url}`);
  },
}));

function sessionOf({
  role,
  employeeId,
}: {
  role: "admin" | "user";
  employeeId: string | null;
}): AuthSession {
  const now = new Date("2026-07-27T00:00:00.000Z");
  return {
    session: {
      id: "session-001",
      userId: "user-001",
      expiresAt: new Date("2026-08-27T00:00:00.000Z"),
      createdAt: now,
      updatedAt: now,
    },
    user: {
      id: "user-001",
      email: "test@example.com",
      name: "テスト太郎",
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
      employeeId,
      role,
    },
  };
}

const FORBIDDEN_URL = `/signin?reason=${REDIRECT_REASON.FORBIDDEN}`;
const SESSION_EXPIRED_URL = `/signin?reason=${REDIRECT_REASON.SESSION_EXPIRED}`;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("verifySession", () => {
  it("セッションがあればそのまま返す", async () => {
    const session = sessionOf({ role: "user", employeeId: "emp-001" });
    getCurrentSession.mockResolvedValue(session);

    await expect(verifySession()).resolves.toEqual(session);
    expect(redirectSpy).not.toHaveBeenCalled();
  });

  it("セッションが無ければ SESSION_EXPIRED でサインインへ送る", async () => {
    getCurrentSession.mockResolvedValue(null);

    await expect(verifySession()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirectSpy).toHaveBeenCalledWith(SESSION_EXPIRED_URL);
  });
});

describe("verifyAdmin", () => {
  it("管理者ならリダイレクトせずセッションを返す", async () => {
    const session = sessionOf({ role: "admin", employeeId: "emp-001" });
    getCurrentSession.mockResolvedValue(session);

    await expect(verifyAdmin()).resolves.toEqual(session);
    expect(redirectSpy).not.toHaveBeenCalled();
  });

  it("管理者でなく遷移先の指定が無ければ FORBIDDEN でサインインへ送る（既定値の据え置き）", async () => {
    getCurrentSession.mockResolvedValue(sessionOf({ role: "user", employeeId: "emp-001" }));

    await expect(verifyAdmin()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirectSpy).toHaveBeenCalledWith(FORBIDDEN_URL);
  });

  it("管理者でなく遷移先を指定していればその画面へ送る", async () => {
    getCurrentSession.mockResolvedValue(sessionOf({ role: "user", employeeId: "emp-001" }));

    await expect(verifyAdmin("/products/P-001")).rejects.toThrow("NEXT_REDIRECT");
    expect(redirectSpy).toHaveBeenCalledWith("/products/P-001");
  });
});

describe("verifyOwnerOrAdmin", () => {
  it("本人ならリダイレクトせずセッションを返す", async () => {
    const session = sessionOf({ role: "user", employeeId: "emp-001" });
    getCurrentSession.mockResolvedValue(session);

    await expect(verifyOwnerOrAdmin("emp-001")).resolves.toEqual(session);
    expect(redirectSpy).not.toHaveBeenCalled();
  });

  it("本人でなくとも管理者ならリダイレクトせずセッションを返す", async () => {
    const session = sessionOf({ role: "admin", employeeId: "emp-999" });
    getCurrentSession.mockResolvedValue(session);

    await expect(verifyOwnerOrAdmin("emp-001")).resolves.toEqual(session);
    expect(redirectSpy).not.toHaveBeenCalled();
  });

  it("本人でも管理者でもなく遷移先の指定が無ければ FORBIDDEN でサインインへ送る（既定値の据え置き）", async () => {
    getCurrentSession.mockResolvedValue(sessionOf({ role: "user", employeeId: "emp-999" }));

    await expect(verifyOwnerOrAdmin("emp-001")).rejects.toThrow("NEXT_REDIRECT");
    expect(redirectSpy).toHaveBeenCalledWith(FORBIDDEN_URL);
  });

  it("本人でも管理者でもなく遷移先を指定していればその画面へ送る", async () => {
    getCurrentSession.mockResolvedValue(sessionOf({ role: "user", employeeId: "emp-999" }));

    await expect(verifyOwnerOrAdmin("emp-001", "/employees/emp-001")).rejects.toThrow(
      "NEXT_REDIRECT"
    );
    expect(redirectSpy).toHaveBeenCalledWith("/employees/emp-001");
  });
});
