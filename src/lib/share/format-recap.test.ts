import { describe, it, expect } from "vitest";
import { formatRecap, FormatRecapInput } from "./format-recap";

describe("formatRecap", () => {
  it("formats normal trip recap with receiving, paying, and transfers", () => {
    const input: FormatRecapInput = {
      groupName: "Trip Jogja",
      totalExpenses: 300000,
      members: [
        { id: "m1", name: "Daffa" },
        { id: "m2", name: "Kiki" },
        { id: "m3", name: "Rakya" },
      ],
      balances: {
        m1: 100000,
        m2: -40000,
        m3: -60000,
      },
      transfers: [
        { fromId: "m3", toId: "m1", amount: 60000 },
        { fromId: "m2", toId: "m1", amount: 40000 },
      ],
    };

    const text = formatRecap(input);

    expect(text).toContain("💰 *REKAP PATUNGAN: Trip Jogja*");
    expect(text).toContain("Total Pengeluaran: Rp 300.000");
    expect(text).toContain("🟢 *Daffa*: Menerima Rp 100.000");
    expect(text).toContain("🔴 *Kiki*: Membayar Rp 40.000");
    expect(text).toContain("🔴 *Rakya*: Membayar Rp 60.000");
    expect(text).toContain("1. *Kiki* ➔ *Daffa*: Rp 40.000");
    expect(text).toContain("2. *Rakya* ➔ *Daffa*: Rp 60.000");
    expect(text).not.toContain("undefined");
    expect(text).not.toContain("NaN");
  });

  it("handles all-settled group cleanly", () => {
    const input: FormatRecapInput = {
      groupName: "Makan Siang",
      totalExpenses: 150000,
      members: [
        { id: "m1", name: "Budi" },
        { id: "m2", name: "Siti" },
      ],
      balances: {
        m1: 0,
        m2: 0,
      },
      transfers: [],
    };

    const text = formatRecap(input);

    expect(text).toContain("⚪ *Budi*: Rp 0 (Pas)");
    expect(text).toContain("⚪ *Siti*: Rp 0 (Pas)");
    expect(text).toContain("✅ Semua sudah lunas! Tidak ada transfer yang diperlukan.");
    expect(text).not.toContain("undefined");
    expect(text).not.toContain("NaN");
  });

  it("produces deterministic output regardless of member array order", () => {
    const input1: FormatRecapInput = {
      groupName: "Test Group",
      totalExpenses: 100000,
      members: [
        { id: "m3", name: "Cici" },
        { id: "m1", name: "Andi" },
        { id: "m2", name: "Budi" },
      ],
      balances: { m1: 50000, m2: -20000, m3: -30000 },
      transfers: [
        { fromId: "m3", toId: "m1", amount: 30000 },
        { fromId: "m2", toId: "m1", amount: 20000 },
      ],
    };

    const input2: FormatRecapInput = {
      ...input1,
      members: [
        { id: "m1", name: "Andi" },
        { id: "m3", name: "Cici" },
        { id: "m2", name: "Budi" },
      ],
      transfers: [
        { fromId: "m2", toId: "m1", amount: 20000 },
        { fromId: "m3", toId: "m1", amount: 30000 },
      ],
    };

    expect(formatRecap(input1)).toBe(formatRecap(input2));
  });

  it("handles members with empty names or members without accounts gracefully", () => {
    const input: FormatRecapInput = {
      groupName: "No Names",
      totalExpenses: 50000,
      members: [
        { id: "m1", name: "" },
        { id: "m2", name: "Teman Baru" },
      ],
      balances: {
        m1: -25000,
        m2: 25000,
      },
      transfers: [{ fromId: "m1", toId: "m2", amount: 25000 }],
    };

    const text = formatRecap(input);
    expect(text).not.toContain("undefined");
    expect(text).not.toContain("NaN");
    expect(text).toContain("Tanpa Nama");
    expect(text).toContain("Teman Baru");
  });
});
