import { describe, expect, it } from "vitest";
import gameEvent from "@/fixtures/gemini/game-event.json";
import { toMarkets, type GeminiEvent } from "@/lib/venues/gemini/normalize";
import { findTeam, parseCommodity, parseExposure } from "./fallback";

describe("parseExposure", () => {
  it("multiplies a count by a per-unit discount", () => {
    expect(parseExposure("We usually sell about 500 orders and the discount is $6 each.")).toBe(3000);
    expect(parseExposure("That's about 300 deliveries at $5 each.")).toBe(1500);
  });
  it("falls back to the largest dollar amount", () => {
    expect(parseExposure("Our market loses about $4,000 in sales when it's cold.")).toBe(4000);
  });
  it("returns null with no numbers", () => {
    expect(parseExposure("If it rains we lose money")).toBeNull();
  });
});

describe("parseCommodity", () => {
  it("converts gallons of fuel to barrels of oil", () => {
    expect(parseCommodity("We burn about 2,520 gallons of diesel a month.")).toEqual({ ref: "Brent", units: 60 });
  });
  it("reads ounces of gold", () => {
    expect(parseCommodity("I need to buy about 20 oz of gold.")).toEqual({ ref: "Gold", units: 20 });
  });
  it("prefers natural gas over generic gas", () => {
    expect(parseCommodity("Our natural gas bill, about 500 MMBtu")).toEqual({ ref: "Natural Gas", units: 500 });
  });
  it("needs a commodity word", () => {
    expect(parseCommodity("Half-price wings if we win")).toBeNull();
  });
});

describe("findTeam", () => {
  const [game] = toMarkets(gameEvent as GeminiEvent); // Mississippi State vs UCF
  it("finds a team named in the text", () => {
    expect(findTeam("Free fries if UCF wins tonight", [{ m: game }])).toMatchObject({ team: "UCF" });
  });
  it("picks the team that wins when both are named", () => {
    const [a, b] = game.contracts.map((c) => c.label);
    expect(findTeam(`Free fries if ${b} beats ${a} tonight`, [{ m: game }])).toMatchObject({ team: b });
    expect(findTeam(`Free fries if ${a} beats ${b} tonight`, [{ m: game }])).toMatchObject({ team: a });
    expect(findTeam(`${b} vs ${a}: free fries if ${a} wins`, [{ m: game }])).toMatchObject({ team: a });
  });

  it("ignores partial words", () => {
    expect(findTeam("Free fries if the bucks win", [{ m: game }])).toBeNull();
  });
});
