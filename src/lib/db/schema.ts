import { relations, sql } from "drizzle-orm";
import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  numeric,
  timestamp,
  date,
  jsonb,
  index,
  uniqueIndex,
  primaryKey,
  check,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

export * from "./auth-schema";

/* ---------- Enum ---------- */
export const memberRole = pgEnum("member_role", ["owner", "member"]);
export const settlementStatus = pgEnum("settlement_status", [
  "paid",
  "confirmed",
  "rejected",
]);
export const settlementMethod = pgEnum("settlement_method", [
  "manual",
  "gateway",
]);
export const paymentType = pgEnum("payment_type", [
  "gopay",
  "shopeepay",
  "dana",
  "ovo",
  "bank",
  "qris",
  "other",
]);

/* ---------- Helper ---------- */
const tz = (name: string) =>
  timestamp(name, { withTimezone: true, mode: "date" });

/* ---------- groups ---------- */
export const groups = pgTable("groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  createdBy: text("created_by")
    .notNull()
    .references(() => user.id, { onDelete: "restrict" }),
  createdAt: tz("created_at").notNull().defaultNow(),
  archivedAt: tz("archived_at"),
});

/* ---------- members ---------- */
export const members = pgTable(
  "members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    // null = anggota tanpa akun (belum diklaim)
    userId: text("user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    displayName: text("display_name").notNull(),
    role: memberRole("role").notNull().default("member"),
    joinedAt: tz("joined_at").notNull().defaultNow(),
    leftAt: tz("left_at"), // soft leave; riwayat tetap utuh
  },
  (t) => [
    // Postgres mengizinkan banyak NULL, jadi anggota tanpa akun tidak bentrok
    uniqueIndex("members_group_user_uq").on(t.groupId, t.userId),
    index("members_group_idx").on(t.groupId),
    index("members_user_idx").on(t.userId),
  ],
);

/* ---------- expenses ---------- */
export const expenses = pgTable(
  "expenses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    payerMemberId: uuid("payer_member_id")
      .notNull()
      .references(() => members.id, { onDelete: "restrict" }),
    title: text("title").notNull(),
    category: text("category").notNull().default("lainnya"),
    amount: integer("amount").notNull(), // rupiah bulat
    spentAt: date("spent_at", { mode: "string" }).notNull(),
    note: text("note"),
    createdByMemberId: uuid("created_by_member_id")
      .notNull()
      .references(() => members.id, { onDelete: "restrict" }),
    createdAt: tz("created_at").notNull().defaultNow(),
    updatedAt: tz("updated_at").notNull().defaultNow(),
    deletedAt: tz("deleted_at"), // soft delete
  },
  (t) => [
    check("expenses_amount_pos", sql`${t.amount} > 0`),
    index("expenses_group_date_idx").on(t.groupId, t.spentAt),
    index("expenses_payer_idx").on(t.payerMemberId),
  ],
);

/* ---------- expense_splits ---------- */
export const expenseSplits = pgTable(
  "expense_splits",
  {
    expenseId: uuid("expense_id")
      .notNull()
      .references(() => expenses.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "restrict" }),
    // drizzle mengembalikan numeric sebagai string; ubah ke number saat dibaca
    weight: numeric("weight", { precision: 6, scale: 2 }).notNull().default("1"),
    shareAmount: integer("share_amount").notNull(), // hasil alokasi largest remainder
  },
  (t) => [
    primaryKey({ columns: [t.expenseId, t.memberId] }),
    check("splits_weight_pos", sql`${t.weight} > 0`),
    check("splits_share_nonneg", sql`${t.shareAmount} >= 0`),
    index("splits_member_idx").on(t.memberId),
  ],
);

/* ---------- settlements ---------- */
export const settlements = pgTable(
  "settlements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    fromMemberId: uuid("from_member_id")
      .notNull()
      .references(() => members.id, { onDelete: "restrict" }),
    toMemberId: uuid("to_member_id")
      .notNull()
      .references(() => members.id, { onDelete: "restrict" }),
    amount: integer("amount").notNull(),
    status: settlementStatus("status").notNull().default("paid"),
    method: settlementMethod("method").notNull().default("manual"),
    externalRef: text("external_ref"), // untuk gateway di masa depan
    note: text("note"),
    paidAt: tz("paid_at"),
    confirmedAt: tz("confirmed_at"),
    confirmedByMemberId: uuid("confirmed_by_member_id").references(
      () => members.id,
      { onDelete: "set null" },
    ),
    createdAt: tz("created_at").notNull().defaultNow(),
  },
  (t) => [
    check("settlements_amount_pos", sql`${t.amount} > 0`),
    check("settlements_distinct", sql`${t.fromMemberId} <> ${t.toMemberId}`),
    index("settlements_group_status_idx").on(t.groupId, t.status),
  ],
);

/* ---------- payment_methods ---------- */
export const paymentMethods = pgTable(
  "payment_methods",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    type: paymentType("type").notNull(),
    label: text("label").notNull(), // mis. "BNI a.n. Daffa"
    value: text("value").notNull(), // nomor rekening, nomor e-wallet, atau key gambar QRIS
    isDefault: integer("is_default").notNull().default(0),
    createdAt: tz("created_at").notNull().defaultNow(),
  },
  (t) => [index("payment_methods_member_idx").on(t.memberId)],
);

/* ---------- invites ---------- */
export const invites = pgTable(
  "invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(), // sha256 hex dari token; token asli tidak disimpan
    role: memberRole("role").notNull().default("member"),
    // jika diisi, pemakai link mengklaim anggota tanpa akun ini
    claimMemberId: uuid("claim_member_id").references(() => members.id, {
      onDelete: "set null",
    }),
    expiresAt: tz("expires_at").notNull(),
    maxUses: integer("max_uses").notNull().default(5),
    usedCount: integer("used_count").notNull().default(0),
    revokedAt: tz("revoked_at"),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    createdAt: tz("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("invites_token_hash_uq").on(t.tokenHash),
    index("invites_group_idx").on(t.groupId),
    check(
      "invites_uses_ok",
      sql`${t.usedCount} >= 0 AND ${t.usedCount} <= ${t.maxUses}`,
    ),
  ],
);

/* ---------- audit_logs ---------- */
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    actorUserId: text("actor_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    action: text("action").notNull(), // mis. "expense.create", "settlement.confirm"
    entity: text("entity").notNull(),
    entityId: uuid("entity_id"),
    meta: jsonb("meta"),
    createdAt: tz("created_at").notNull().defaultNow(),
  },
  (t) => [index("audit_group_time_idx").on(t.groupId, t.createdAt)],
);

/* ---------- Relasi (untuk db.query.*) ---------- */
export const groupsRelations = relations(groups, ({ many }) => ({
  members: many(members),
  expenses: many(expenses),
  settlements: many(settlements),
  invites: many(invites),
}));

export const membersRelations = relations(members, ({ one, many }) => ({
  group: one(groups, { fields: [members.groupId], references: [groups.id] }),
  user: one(user, { fields: [members.userId], references: [user.id] }),
  paymentMethods: many(paymentMethods),
}));

export const expensesRelations = relations(expenses, ({ one, many }) => ({
  group: one(groups, { fields: [expenses.groupId], references: [groups.id] }),
  payer: one(members, {
    fields: [expenses.payerMemberId],
    references: [members.id],
  }),
  splits: many(expenseSplits),
}));

export const splitsRelations = relations(expenseSplits, ({ one }) => ({
  expense: one(expenses, {
    fields: [expenseSplits.expenseId],
    references: [expenses.id],
  }),
  member: one(members, {
    fields: [expenseSplits.memberId],
    references: [members.id],
  }),
}));

export const settlementsRelations = relations(settlements, ({ one }) => ({
  group: one(groups, {
    fields: [settlements.groupId],
    references: [groups.id],
  }),
  fromMember: one(members, {
    fields: [settlements.fromMemberId],
    references: [members.id],
    relationName: "settlement_from",
  }),
  toMember: one(members, {
    fields: [settlements.toMemberId],
    references: [members.id],
    relationName: "settlement_to",
  }),
  confirmedBy: one(members, {
    fields: [settlements.confirmedByMemberId],
    references: [members.id],
    relationName: "settlement_confirmedBy",
  }),
}));

export const paymentMethodsRelations = relations(
  paymentMethods,
  ({ one }) => ({
    member: one(members, {
      fields: [paymentMethods.memberId],
      references: [members.id],
    }),
  }),
);

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  group: one(groups, {
    fields: [auditLogs.groupId],
    references: [groups.id],
  }),
}));
