import { describe, expect, it } from "vitest";
import { isBitcoinAddress, satsHeld } from "./bitcoin";
import { detectNetwork } from "./detect";
import { balanceOfData, fromUnits, isEvmAddress, mergeByAsset } from "./evm";

describe("detectNetwork", () => {
  it.each([
    ["0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", "evm"],
    ["bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq", "bitcoin"],
    ["1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa", "bitcoin"], // legacy; also valid base58, must not read as Solana
    ["3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy", "bitcoin"],
    ["9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM", "solana"],
    ["  0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045  ", "evm"],
    ["hello", null],
    ["0x1234", null],
  ])("%s → %s", (addr, net) => expect(detectNetwork(addr)).toBe(net));
});

describe("evm helpers", () => {
  it("validates 0x addresses", () => {
    expect(isEvmAddress("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045")).toBe(true);
    expect(isEvmAddress("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA9604")).toBe(false);
  });
  it("converts token units without losing precision", () => {
    expect(fromUnits("0x0de0b6b3a7640000", 18)).toBe(1); // 1e18 wei
    expect(fromUnits("0x02faf080", 8)).toBe(0.5); // 50,000,000 sats of WBTC
    expect(fromUnits("0x", 18)).toBe(0);
    expect(fromUnits(undefined, 8)).toBe(0);
  });
  it("encodes balanceOf calls", () => {
    expect(balanceOfData("0xAbC0000000000000000000000000000000000001")).toBe("0x70a08231" + "0".repeat(24) + "abc0000000000000000000000000000000000001");
  });
});

describe("bitcoin helpers", () => {
  it("validates addresses", () => {
    expect(isBitcoinAddress("bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq")).toBe(true);
    expect(isBitcoinAddress("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045")).toBe(false);
  });
  it("counts confirmed and pending funds", () => {
    expect(satsHeld({ chain_stats: { funded_txo_sum: 300, spent_txo_sum: 100 }, mempool_stats: { funded_txo_sum: 50, spent_txo_sum: 0 } })).toBe(250);
  });
});

describe("mergeByAsset", () => {
  it("gives one row per coin, lists the parts, and drops dust", () => {
    const parts = [
      { asset: "ETH", quantity: 5, source: "evm" as const, detail: "ETH on Ethereum" },
      { asset: "ETH", quantity: 1, source: "evm" as const, detail: "WETH on Ethereum" },
      { asset: "ETH", quantity: 0.000001, source: "evm" as const, detail: "stETH on Ethereum" },
      { asset: "ETH", quantity: 3, source: "evm" as const, detail: "ETH on Base" },
      { asset: "BTC", quantity: 0.000003, source: "evm" as const, detail: "cbBTC on Base" },
    ];
    const out = mergeByAsset(parts);
    expect(out).toHaveLength(1);
    expect(out[0].asset).toBe("ETH");
    expect(out[0].quantity).toBeCloseTo(9, 4);
    expect(out[0].detail).toBe("ETH + WETH on Ethereum, ETH on Base");
  });
});
