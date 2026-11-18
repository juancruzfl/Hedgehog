import { describe, expect, it } from "vitest";
import { isScopeError, READ_CHAIN_IDS, requestEvmAccount, walletErrorMessage, type EvmWallet } from "./evm-connect";

const wallet = (handler: (method: string, params?: unknown[]) => unknown): EvmWallet => ({
  id: "t",
  name: "MetaMask",
  provider: { request: async ({ method, params }) => handler(method, params) },
});
const TRON = "Invalid approved permissions request: endowment:caip25 error: Received scopeString value(s): tron:728126428 for caveat of type \"authorizedScopes\" that are not supported by the wallet.";

describe("walletErrorMessage", () => {
  it.each([
    [{ code: 4001 }, "declined"],
    [{ code: -32002 }, "already has a connection request waiting"],
    [{ code: 4100 }, "locked"],
    [{ message: "Something odd" }, "couldn't connect: Something odd"],
    [undefined, "check it's unlocked"],
  ])("%j", (err, text) => expect(walletErrorMessage(err, "MetaMask")).toContain(text));
});

describe("requestEvmAccount", () => {
  it("uses an already-approved account without a popup", async () => {
    const asked: string[] = [];
    const addr = await requestEvmAccount(wallet((m) => (asked.push(m), m === "eth_accounts" ? ["0xabc"] : [])));
    expect(addr).toBe("0xabc");
    expect(asked).toEqual(["eth_accounts"]);
  });
  it("asks only for Ethereum and Base, then reads the approved account", async () => {
    let approved = false;
    let asked: unknown;
    const addr = await requestEvmAccount(
      wallet((m, params) => {
        if (m === "eth_accounts") return approved ? ["0xdef"] : [];
        if (m === "wallet_requestPermissions") return ((asked = params), (approved = true), [{}]);
        throw new Error("should not call " + m);
      }),
    );
    expect(addr).toBe("0xdef");
    expect(JSON.stringify(asked)).toContain(JSON.stringify(READ_CHAIN_IDS));
  });
  it("falls back to eth_requestAccounts when scoped requests aren't supported", async () => {
    const addr = await requestEvmAccount(
      wallet((m) => {
        if (m === "eth_accounts") return [];
        if (m === "wallet_requestPermissions") throw { code: -32601, message: "Method not supported" };
        return ["0x123"];
      }),
    );
    expect(addr).toBe("0x123");
  });
  it("doesn't fall back after a decline", async () => {
    let fellBack = false;
    await expect(
      requestEvmAccount(
        wallet((m) => {
          if (m === "eth_accounts") return [];
          if (m === "wallet_requestPermissions") throw { code: 4001, message: "User rejected" };
          fellBack = true;
          return ["0x1"];
        }),
      ),
    ).rejects.toMatchObject({ code: 4001 });
    expect(fellBack).toBe(false);
  });
  it("passes the wallet's error through", async () => {
    await expect(
      requestEvmAccount(
        wallet((m) => {
          if (m === "eth_accounts") return [];
          throw { code: -32002, message: "Request already pending" };
        }),
      ),
    ).rejects.toMatchObject({ code: -32002 });
  });
});

describe("isScopeError", () => {
  it("recognizes MetaMask's multichain permission error", () => {
    expect(isScopeError({ code: -32602, message: TRON })).toBe(true);
    expect(walletErrorMessage({ code: -32602, message: TRON }, "MetaMask")).toContain("known MetaMask issue");
  });
  it("treats a plain decline as a decline", () => {
    expect(isScopeError({ code: 4001, message: "User rejected authorizedScopes" })).toBe(false);
  });
});
