// scripts/seed.ts — Seeds "Trip Jogja" with 3 members and 18 golden expenses
// Matches TECHNICAL_DESIGN.md section 5.1 & 13.
import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { and, eq } from "drizzle-orm";
import * as schema from "../src/lib/db/schema";
import { alloc } from "../src/lib/split/alloc";
import { computeBalances } from "../src/lib/split/balances";
import { settle } from "../src/lib/split/settle";

export interface GoldenExpenseItem {
  title: string;
  category: string;
  amount: number;
  payerName: string;
  spentAt: string;
  participants: Record<string, number>;
}

export const GOLDEN_TRIP_JOGJA: GoldenExpenseItem[] = [
  { title: "Grab ke Jombor", category: "transport", amount: 23500, payerName: "daffa", spentAt: "2026-05-01", participants: { daffa: 1, kiki: 1, rakya: 1 } },
  { title: "Grab ke sewa motor", category: "transport", amount: 131000, payerName: "daffa", spentAt: "2026-05-01", participants: { daffa: 1, kiki: 1, rakya: 1 } },
  { title: "Ice lychee tea", category: "makanan", amount: 35000, payerName: "daffa", spentAt: "2026-05-01", participants: { kiki: 1 } },
  { title: "Ice choco", category: "makanan", amount: 45000, payerName: "daffa", spentAt: "2026-05-01", participants: { rakya: 1 } },
  { title: "Sewa motor", category: "transport", amount: 560000, payerName: "rakya", spentAt: "2026-05-01", participants: { daffa: 1, kiki: 1, rakya: 1 } },
  { title: "KFC", category: "makanan", amount: 48500, payerName: "kiki", spentAt: "2026-05-01", participants: { daffa: 1, kiki: 1, rakya: 1 } },
  { title: "Whiterock", category: "makanan", amount: 36000, payerName: "kiki", spentAt: "2026-05-01", participants: { daffa: 1, kiki: 1, rakya: 1 } },
  { title: "Bensin motor", category: "transport", amount: 25000, payerName: "rakya", spentAt: "2026-05-01", participants: { daffa: 1 } },
  { title: "Sate day 1", category: "makanan", amount: 35000, payerName: "kiki", spentAt: "2026-05-01", participants: { daffa: 1, kiki: 1, rakya: 1 } },
  { title: "Bahan pokok day 1", category: "makanan", amount: 45000, payerName: "kiki", spentAt: "2026-05-01", participants: { daffa: 1, kiki: 1, rakya: 1 } },
  { title: "Indomaret day 2", category: "makanan", amount: 181800, payerName: "daffa", spentAt: "2026-05-02", participants: { daffa: 1, kiki: 1, rakya: 1 } },
  { title: "Indomaret day 3", category: "makanan", amount: 63000, payerName: "daffa", spentAt: "2026-05-03", participants: { daffa: 1, kiki: 1, rakya: 1 } },
  { title: "Indomaret day 1", category: "makanan", amount: 116400, payerName: "daffa", spentAt: "2026-05-01", participants: { daffa: 1, kiki: 1, rakya: 1 } },
  { title: "Sate day 2", category: "makanan", amount: 50000, payerName: "rakya", spentAt: "2026-05-02", participants: { daffa: 1, kiki: 1, rakya: 1 } },
  { title: "Oleh-oleh", category: "belanja", amount: 175000, payerName: "daffa", spentAt: "2026-05-03", participants: { daffa: 1, kiki: 1, rakya: 1 } },
  { title: "Sendal", category: "belanja", amount: 20000, payerName: "kiki", spentAt: "2026-05-02", participants: { rakya: 1 } },
  { title: "Grepe", category: "makanan", amount: 112000, payerName: "daffa", spentAt: "2026-05-02", participants: { daffa: 1, kiki: 1, rakya: 1 } },
  { title: "Grepe", category: "makanan", amount: 21000, payerName: "kiki", spentAt: "2026-05-02", participants: { rakya: 1 } },
];

async function main() {
  const connStr = process.env.DATABASE_URL_POOLED || process.env.DATABASE_URL;
  if (!connStr) {
    throw new Error("DATABASE_URL belum disetel di environment.");
  }

  const pool = new Pool({ connectionString: connStr });
  const db = drizzle(pool, { schema });

  console.log("🚀 Memulai seeding Trip Jogja...");

  // 1. Create or find dummy seed user
  let seedUser = await db.query.user.findFirst({
    where: eq(schema.user.email, "demo@patungin.id"),
  });

  if (!seedUser) {
    const [u] = await db
      .insert(schema.user)
      .values({
        id: "usr_seed_demo_id",
        name: "Daffa (Owner)",
        email: "demo@patungin.id",
        emailVerified: true,
      })
      .returning();
    seedUser = u;
    console.log("✓ User demo dibuat:", seedUser.id);
  }

  // 2. Create Group Trip Jogja
  const [tripGroup] = await db
    .insert(schema.groups)
    .values({
      name: "Trip Jogja",
      description: "Liburan seru 3 hari 2 malam ke Jogja (Golden Dataset 18 pengeluaran)",
      createdBy: seedUser.id,
    })
    .returning();
  console.log("✓ Grup Trip Jogja dibuat:", tripGroup.id);

  // 3. Create 3 Members: daffa (owner), kiki (member), rakya (member)
  // Use deterministic sorted UUIDs matching daffa < kiki < rakya order
  const DAFFA_ID = "00000000-0000-0000-0000-000000000001";
  const KIKI_ID = "00000000-0000-0000-0000-000000000002";
  const RAKYA_ID = "00000000-0000-0000-0000-000000000003";

  const [mDaffa] = await db
    .insert(schema.members)
    .values({
      id: DAFFA_ID,
      groupId: tripGroup.id,
      userId: seedUser.id,
      displayName: "daffa",
      role: "owner",
    })
    .returning();

  const [mKiki] = await db
    .insert(schema.members)
    .values({
      id: KIKI_ID,
      groupId: tripGroup.id,
      userId: null, // placeholder
      displayName: "kiki",
      role: "member",
    })
    .returning();

  const [mRakya] = await db
    .insert(schema.members)
    .values({
      id: RAKYA_ID,
      groupId: tripGroup.id,
      userId: null, // placeholder
      displayName: "rakya",
      role: "member",
    })
    .returning();

  const memberMap: Record<string, string> = {
    daffa: mDaffa.id,
    kiki: mKiki.id,
    rakya: mRakya.id,
  };

  console.log("✓ 3 Anggota dibuat:", Object.keys(memberMap).join(", "));

  // 4. Insert all 18 expenses using alloc() to guarantee exact share_amount
  for (const item of GOLDEN_TRIP_JOGJA) {
    const payerId = memberMap[item.payerName];

    // Build weights using member UUIDs
    const weights: Record<string, number> = {};
    for (const [name, w] of Object.entries(item.participants)) {
      weights[memberMap[name]] = w;
    }

    const shares = alloc(item.amount, weights);

    const [exp] = await db
      .insert(schema.expenses)
      .values({
        groupId: tripGroup.id,
        payerMemberId: payerId,
        title: item.title,
        category: item.category,
        amount: item.amount,
        spentAt: item.spentAt,
        createdByMemberId: mDaffa.id,
      })
      .returning();

    const splitsToInsert = Object.entries(shares).map(([mId, amt]) => ({
      expenseId: exp.id,
      memberId: mId,
      inputValue: (weights[mId] || 1).toFixed(2),
      shareAmount: amt,
    }));

    await db.insert(schema.expenseSplits).values(splitsToInsert);
  }

  console.log("✓ 18 Pengeluaran Trip Jogja berhasil dicatat!");

  // 5. Verification against Golden Numbers
  const memberIds = [mDaffa.id, mKiki.id, mRakya.id];

  const allExpenses = await db.query.expenses.findMany({
    where: and(
      eq(schema.expenses.groupId, tripGroup.id),
      schema.expenses.deletedAt ? undefined : undefined,
    ),
    with: { splits: true },
  });

  const expenseInputs = allExpenses.map((e) => {
    const shares: Record<string, number> = {};
    for (const s of e.splits) shares[s.memberId] = s.shareAmount;
    return { payerId: e.payerMemberId, amount: e.amount, shares };
  });

  const balances = computeBalances(memberIds, expenseInputs, []);
  const transfers = settle(balances);

  console.log("\n================ HASIL VERIFIKASI SEED ================");
  console.log(`Total Pengeluaran: Rp ${GOLDEN_TRIP_JOGJA.reduce((s, e) => s + e.amount, 0).toLocaleString("id-ID")}`);
  console.log(`Saldo Daffa : Rp ${balances[mDaffa.id].toLocaleString("id-ID")} (Expected: +331.963)`);
  console.log(`Saldo Kiki  : Rp ${balances[mKiki.id].toLocaleString("id-ID")} (Expected: -355.234)`);
  console.log(`Saldo Rakya : Rp ${balances[mRakya.id].toLocaleString("id-ID")} (Expected: +23.271)`);
  console.log(`Daftar Transfer:`);
  for (const t of transfers) {
    const fromName = t.from === mKiki.id ? "kiki" : t.from === mDaffa.id ? "daffa" : "rakya";
    const toName = t.to === mKiki.id ? "kiki" : t.to === mDaffa.id ? "daffa" : "rakya";
    console.log(`  ➔ ${fromName} -> ${toName}: Rp ${t.amount.toLocaleString("id-ID")}`);
  }
  console.log("=======================================================\n");

  await pool.end();
}

if (require.main === module) {
  main().catch(console.error);
}
