import { describe, it, expect } from "vitest";
import { formatWhatsAppReminder } from "./message";
import { COOLDOWN_HOURS, COOLDOWN_MS } from "./cooldown";

describe("Reminders & Cooldown Logic", () => {
  it("enforces 24-hour cooldown constant strictly", () => {
    expect(COOLDOWN_HOURS).toBe(24);
    expect(COOLDOWN_MS).toBe(24 * 60 * 60 * 1000);
  });

  it("formats polite WhatsApp reminder text with all parameters", () => {
    const res = formatWhatsAppReminder({
      borrowerName: "Kiki",
      creditorName: "Daffa",
      groupName: "Makan Malam",
      amount: 45000,
      paymentMethodText: "BCA 123456789 a.n. Daffa",
      appUrl: "https://patungin.my.id/groups/g1/settle",
    });

    expect(res.message).toContain("Halo Kiki!");
    expect(res.message).toContain("Makan Malam");
    expect(res.message).toContain("Rp 45.000");
    expect(res.message).toContain("BCA 123456789 a.n. Daffa");
    expect(res.message).toContain("https://patungin.my.id/groups/g1/settle");
    expect(res.waUrl).toMatch(/^https:\/\/wa\.me\/\?text=/);
    expect(res.waUrl).toContain(encodeURIComponent("Rp 45.000"));
  });

  it("handles reminder without explicit payment text gracefully", () => {
    const res = formatWhatsAppReminder({
      borrowerName: "Rakya",
      creditorName: "Budi",
      groupName: "Sewa Lapangan",
      amount: 50000,
    });

    expect(res.message).toContain("rekening Budi");
    expect(res.message).toContain("Rp 50.000");
  });
});
