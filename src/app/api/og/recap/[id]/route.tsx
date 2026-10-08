import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { groups, members, expenses, settlements } from "@/lib/db/schema";
import { requireMember } from "@/lib/authz";
import { computeBalances, settle } from "@/lib/split";
import { formatRupiah } from "@/lib/money";
import { checkRateLimit, imageOgRateLimiter } from "@/lib/ratelimit";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // 1. Rate limit per IP (10 req/min)
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
  const rl = await checkRateLimit(imageOgRateLimiter, `og:${ip}`);
  if (!rl.success) {
    return new Response("Too Many Requests", { status: 429 });
  }

  // 2. Pemeriksaan keanggotaan grup (wajib anggota; jika bukan -> 404)
  try {
    await requireMember(id);
  } catch {
    return new Response("Not Found", { status: 404 });
  }

  // 3. Ambil data grup
  const group = await db.query.groups.findFirst({
    where: eq(groups.id, id),
  });
  if (!group) {
    return new Response("Not Found", { status: 404 });
  }

  const groupMembers = await db.query.members.findMany({
    where: and(eq(members.groupId, id), isNull(members.leftAt)),
  });

  const activeExpenses = await db.query.expenses.findMany({
    where: and(eq(expenses.groupId, id), isNull(expenses.deletedAt)),
    with: { splits: true },
  });

  const confirmedSettlements = await db.query.settlements.findMany({
    where: and(
      eq(settlements.groupId, id),
      eq(settlements.status, "confirmed"),
    ),
  });

  // 4. Kalkulasi finansial via pure engine
  const totalAmount = activeExpenses.reduce((sum, e) => sum + e.amount, 0);
  const memberIds = groupMembers.map((m) => m.id);
  const memberNameMap = Object.fromEntries(
    groupMembers.map((m) => [m.id, m.displayName]),
  );

  const expenseInputs = activeExpenses.map((e) => {
    const shares: Record<string, number> = {};
    for (const s of e.splits) {
      shares[s.memberId] = s.shareAmount;
    }
    return {
      payerId: e.payerMemberId,
      amount: e.amount,
      shares,
    };
  });

  const settlementInputs = confirmedSettlements.map((s) => ({
    fromId: s.fromMemberId,
    toId: s.toMemberId,
    amount: s.amount,
  }));

  const balances = computeBalances(memberIds, expenseInputs, settlementInputs);
  const transfers = settle(balances);

  // Urutkan saldo untuk tampilan kartu
  const sortedBalances = groupMembers
    .map((m) => ({
      name: m.displayName,
      balance: balances[m.id] ?? 0,
    }))
    .sort((a, b) => b.balance - a.balance);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#FFFDF5",
          padding: "36px 44px",
          fontFamily: "sans-serif",
          justifyContent: "space-between",
          border: "8px solid #111111",
        }}
      >
        {/* Header Bar */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderBottom: "4px solid #111111",
            paddingBottom: "18px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <div
              style={{
                backgroundColor: "#FFE600",
                border: "3px solid #111111",
                padding: "6px 14px",
                fontWeight: 900,
                fontSize: "20px",
                boxShadow: "3px 3px 0px #111111",
              }}
            >
              PATUNGAN
            </div>
            <div
              style={{
                fontSize: "28px",
                fontWeight: 900,
                color: "#111111",
                maxWidth: "600px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {group.name}
            </div>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
            }}
          >
            <div style={{ fontSize: "12px", color: "#666", fontWeight: 700 }}>
              TOTAL PENGELUARAN
            </div>
            <div
              style={{
                fontSize: "26px",
                fontWeight: 900,
                color: "#111111",
              }}
            >
              {formatRupiah(totalAmount)}
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div
          style={{
            display: "flex",
            gap: "28px",
            flex: 1,
            marginTop: "20px",
            marginBottom: "16px",
          }}
        >
          {/* Kolom Saldo Anggota */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              backgroundColor: "#FFFFFF",
              border: "3px solid #111111",
              boxShadow: "5px 5px 0px #111111",
              padding: "16px 20px",
            }}
          >
            <div
              style={{
                fontSize: "15px",
                fontWeight: 900,
                letterSpacing: "0.5px",
                color: "#111111",
                borderBottom: "2px solid #EEEEEE",
                paddingBottom: "8px",
                marginBottom: "10px",
              }}
            >
              SALDO ANGGOTA
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              {sortedBalances.slice(0, 5).map((m, idx) => {
                const isPlus = m.balance > 0;
                const isZero = m.balance === 0;
                return (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "6px 10px",
                      backgroundColor: isZero
                        ? "#F8F8F8"
                        : isPlus
                          ? "#ECFDF5"
                          : "#FEF2F2",
                      border: "2px solid #111111",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "14px",
                        fontWeight: 700,
                        color: "#111111",
                      }}
                    >
                      {m.name}
                    </span>
                    <span
                      style={{
                        fontSize: "14px",
                        fontWeight: 900,
                        color: isZero
                          ? "#666666"
                          : isPlus
                            ? "#059669"
                            : "#DC2626",
                      }}
                    >
                      {isPlus
                        ? `+${formatRupiah(m.balance)}`
                        : formatRupiah(m.balance)}
                    </span>
                  </div>
                );
              })}
              {sortedBalances.length > 5 && (
                <div
                  style={{
                    fontSize: "12px",
                    color: "#777777",
                    fontStyle: "italic",
                    marginTop: "2px",
                  }}
                >
                  +{sortedBalances.length - 5} anggota lainnya
                </div>
              )}
            </div>
          </div>

          {/* Kolom Transfer Pelunasan */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              backgroundColor: "#FFFFFF",
              border: "3px solid #111111",
              boxShadow: "5px 5px 0px #111111",
              padding: "16px 20px",
            }}
          >
            <div
              style={{
                fontSize: "15px",
                fontWeight: 900,
                letterSpacing: "0.5px",
                color: "#111111",
                borderBottom: "2px solid #EEEEEE",
                paddingBottom: "8px",
                marginBottom: "10px",
              }}
            >
              DAFTAR TRANSFER MINIMUM
            </div>
            {transfers.length === 0 ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flex: 1,
                  backgroundColor: "#F0FDF4",
                  border: "2px dashed #059669",
                  padding: "16px",
                  color: "#059669",
                  fontWeight: 800,
                  fontSize: "16px",
                }}
              >
                🎉 Semua sudah lunas!
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                }}
              >
                {transfers.slice(0, 4).map((t, idx) => {
                  const fromName = memberNameMap[t.from] || "Anggota";
                  const toName = memberNameMap[t.to] || "Anggota";
                  return (
                    <div
                      key={idx}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "6px 10px",
                        backgroundColor: "#FFFBEB",
                        border: "2px solid #111111",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          fontSize: "13px",
                          fontWeight: 700,
                        }}
                      >
                        <span>{fromName}</span>
                        <span style={{ color: "#FF5C00", fontWeight: 900 }}>
                          ➔
                        </span>
                        <span>{toName}</span>
                      </div>
                      <span
                        style={{
                          fontSize: "14px",
                          fontWeight: 900,
                          color: "#111111",
                        }}
                      >
                        {formatRupiah(t.amount)}
                      </span>
                    </div>
                  );
                })}
                {transfers.length > 4 && (
                  <div
                    style={{
                      fontSize: "12px",
                      color: "#777777",
                      fontStyle: "italic",
                      marginTop: "2px",
                    }}
                  >
                    +{transfers.length - 4} transfer lainnya
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            paddingTop: "12px",
            borderTop: "3px solid #111111",
            fontSize: "13px",
            fontWeight: 800,
            color: "#444444",
          }}
        >
          <span>patungin.com • Split bill Indonesia tanpa drama</span>
          <span style={{ backgroundColor: "#111111", color: "#FFFDF5", padding: "3px 8px" }}>
            REKAP RESMI
          </span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  );
}
