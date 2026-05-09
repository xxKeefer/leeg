import { describe, expect, it } from "vitest";
import { parseProtocol, type ParseResult } from "./protocol.js";

describe("parseProtocol", () => {
  it("extracts winner from |win| line", () => {
    const protocol = [
      "|player|p1|Alice|",
      "|player|p2|Bob|",
      "|win|Alice",
    ].join("\n");

    const result = parseProtocol(protocol);
    expect(result.winner).toBe("p1");
    expect(result.p1Kos).toBe(0);
    expect(result.p2Kos).toBe(0);
  });

  it("counts KOs from |faint| lines", () => {
    const protocol = [
      "|player|p1|Alice|",
      "|player|p2|Bob|",
      "|faint|p2a: Pikachu",
      "|faint|p2a: Charizard",
      "|faint|p1a: Blastoise",
      "|faint|p2a: Venusaur",
      "|win|Alice",
    ].join("\n");

    const result = parseProtocol(protocol);
    expect(result.winner).toBe("p1");
    expect(result.p1Kos).toBe(3);
    expect(result.p2Kos).toBe(1);
  });

  it("handles p2 winning", () => {
    const protocol = [
      "|player|p1|Alice|",
      "|player|p2|Bob|",
      "|faint|p1a: Pikachu",
      "|faint|p1a: Charizard",
      "|win|Bob",
    ].join("\n");

    const result = parseProtocol(protocol);
    expect(result.winner).toBe("p2");
    expect(result.p1Kos).toBe(0);
    expect(result.p2Kos).toBe(2);
  });

  it("handles |tie| line as draw", () => {
    const protocol = [
      "|player|p1|Alice|",
      "|player|p2|Bob|",
      "|faint|p1a: Pikachu",
      "|faint|p2a: Charizard",
      "|tie",
    ].join("\n");

    const result = parseProtocol(protocol);
    expect(result.winner).toBe("draw");
    expect(result.p1Kos).toBe(1);
    expect(result.p2Kos).toBe(1);
  });

  it("handles forfeit (no faint lines, just win)", () => {
    const protocol = [
      "|player|p1|Alice|",
      "|player|p2|Bob|",
      "|win|Alice",
    ].join("\n");

    const result = parseProtocol(protocol);
    expect(result.winner).toBe("p1");
    expect(result.p1Kos).toBe(0);
    expect(result.p2Kos).toBe(0);
  });

  it("handles disconnect as draw when no winner", () => {
    const protocol = [
      "|player|p1|Alice|",
      "|player|p2|Bob|",
      "|faint|p1a: Pikachu",
    ].join("\n");

    const result = parseProtocol(protocol);
    expect(result.winner).toBe("draw");
    expect(result.p1Kos).toBe(0);
    expect(result.p2Kos).toBe(1);
  });

  it("handles empty protocol as draw with 0 KOs", () => {
    const result = parseProtocol("");
    expect(result.winner).toBe("draw");
    expect(result.p1Kos).toBe(0);
    expect(result.p2Kos).toBe(0);
  });

  it("handles p1b/p2b faint lines (doubles format)", () => {
    const protocol = [
      "|player|p1|Alice|",
      "|player|p2|Bob|",
      "|faint|p1a: Pikachu",
      "|faint|p1b: Raichu",
      "|faint|p2a: Charizard",
      "|faint|p2b: Blastoise",
      "|faint|p2a: Venusaur",
      "|win|Alice",
    ].join("\n");

    const result = parseProtocol(protocol);
    expect(result.winner).toBe("p1");
    expect(result.p1Kos).toBe(3);
    expect(result.p2Kos).toBe(2);
  });

  it("handles player names with spaces", () => {
    const protocol = [
      "|player|p1|Ash Ketchum|",
      "|player|p2|Gary Oak|",
      "|faint|p2a: Pikachu",
      "|win|Ash Ketchum",
    ].join("\n");

    const result = parseProtocol(protocol);
    expect(result.winner).toBe("p1");
    expect(result.p1Kos).toBe(1);
    expect(result.p2Kos).toBe(0);
  });

  it("handles player names with special characters", () => {
    const protocol = [
      "|player|p1|xX_Pro_Xx|",
      "|player|p2|[TAG]Player|",
      "|win|[TAG]Player",
    ].join("\n");

    const result = parseProtocol(protocol);
    expect(result.winner).toBe("p2");
  });
});
