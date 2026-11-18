import { describe, expect, it } from "vitest";
import { requestEvmAccount, walletErrorMessage, type EvmWallet } from "./evm-connect";

const wallet = (handler: (method: string) => unknown): EvmWallet => ({
  id: "t",
  name: "MetaMask",
  provider: { request: async ({ method }) => handler(method) },
});

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
  it("asks to connect when nothing is approved yet", async () => {
    const addr = await requestEvmAccount(wallet((m) => (m === "eth_accounts" ? [] : ["0xdef"])));
    expect(addr).toBe("0xdef");
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
