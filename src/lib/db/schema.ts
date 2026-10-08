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
  boolean,
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

// Enum baru di v1.1
export const splitMode = pgEnum("split_mode", [
  "weight",
  "percent",
  "exact",
  "items",
]);
export const adjustmentKind = pgEnum("adjustment_kind", [
  "tax",
  "service",
  "tip",
  "discount",
]);
export const adjustmentAllocation = pgEnum("adjustment_allocation", [
  "proportional",
  "equal",
]);
export const reminderChannel = pgEnum("reminder_channel", [
  "whatsapp_link",
  "email",
  "push",
]);
export const reminderKind = pgEnum("reminder_kind", ["manual", "auto"]);
export const auditSource = pgEnum("audit_source", ["user", "ai", "system"]);

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
    splitMode: splitMode("split_mode").notNull().default("weight"),
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
    // input_value menggantikan weight di v1.1 (bobot, persen, atau rupiah pasti)
    inputValue: numeric("input_value", { precision: 12, scale: 2 })
      .notNull()
      .default("1"),
    shareAmount: integer("share_amount").notNull(), // hasil alokasi largest remainder
  },
  (t) => [
    primaryKey({ columns: [t.expenseId, t.memberId] }),
    check("splits_input_val_pos", sql`${t.inputValue} >= 0`),
    check("splits_share_nonneg", sql`${t.shareAmount} >= 0`),
    index("splits_member_idx").on(t.memberId),
  ],
);

/* ---------- expense_items (v1.1) ---------- */
export const expenseItems = pgTable(
  "expense_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    expenseId: uuid("expense_id")
      .notNull()
      .references(() => expenses.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    amount: integer("amount").notNull(),
    position: integer("position").notNull().default(0),
  },
  (t) => [
    check("expense_items_amount_pos", sql`${t.amount} > 0`),
    index("expense_items_expense_idx").on(t.expenseId),
  ],
);

/* ---------- expense_item_shares (v1.1) ---------- */
export const expenseItemShares = pgTable(
  "expense_item_shares",
  {
    itemId: uuid("item_id")
      .notNull()
      .references(() => expenseItems.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "restrict" }),
    inputValue: numeric("input_value", { precision: 12, scale: 2 })
      .notNull()
      .default("1"),
    shareAmount: integer("share_amount").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.itemId, t.memberId] }),
    check("item_shares_val_pos", sql`${t.inputValue} > 0`),
    check("item_shares_amount_nonneg", sql`${t.shareAmount} >= 0`),
    index("item_shares_member_idx").on(t.memberId),
  ],
);

/* ---------- expense_adjustments (v1.1) ---------- */
export const expenseAdjustments = pgTable(
  "expense_adjustments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    expenseId: uuid("expense_id")
      .notNull()
      .references(() => expenses.id, { onDelete: "cascade" }),
    kind: adjustmentKind("kind").notNull(),
    amount: integer("amount").notNull(),
    allocation: adjustmentAllocation("allocation")
      .notNull()
      .default("proportional"),
  },
  (t) => [
    check("expense_adjustments_amount_pos", sql`${t.amount} > 0`),
    index("expense_adjustments_expense_idx").on(t.expenseId),
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
    source: auditSource("source").notNull().default("user"),
    createdAt: tz("created_at").notNull().defaultNow(),
  },
  (t) => [index("audit_group_time_idx").on(t.groupId, t.createdAt)],
);

/* ---------- share_links (v1.1) ---------- */
export const shareLinks = pgTable(
  "share_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: tz("expires_at").notNull(),
    revokedAt: tz("revoked_at"),
    showDetails: boolean("show_details").notNull().default(false),
    viewCount: integer("view_count").notNull().default(0),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    createdAt: tz("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("share_links_token_hash_uq").on(t.tokenHash),
    index("share_links_group_idx").on(t.groupId),
  ],
);

/* ---------- reminders (v1.1) ---------- */
export const reminders = pgTable(
  "reminders",
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
    channel: reminderChannel("channel").notNull(),
    kind: reminderKind("kind").notNull(),
    createdAt: tz("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("reminders_group_idx").on(t.groupId),
    index("reminders_to_member_idx").on(t.toMemberId),
    index("reminders_cooldown_idx").on(t.groupId, t.toMemberId, t.createdAt),
  ],
);

/* ---------- notification_preferences (v1.1) ---------- */
export const notificationPreferences = pgTable(
  "notification_preferences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    emailEnabled: boolean("email_enabled").notNull().default(true),
    pushEnabled: boolean("push_enabled").notNull().default(false),
    updatedAt: tz("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("notification_pref_user_uq").on(t.userId)],
);

/* ---------- Relasi (untuk db.query.*) ---------- */
export const groupsRelations = relations(groups, ({ many }) => ({
  members: many(members),
  expenses: many(expenses),
  settlements: many(settlements),
  invites: many(invites),
  shareLinks: many(shareLinks),
  reminders: many(reminders),
}));

export const shareLinksRelations = relations(shareLinks, ({ one }) => ({
  group: one(groups, { fields: [shareLinks.groupId], references: [groups.id] }),
  creator: one(user, { fields: [shareLinks.createdBy], references: [user.id] }),
}));

export const remindersRelations = relations(reminders, ({ one }) => ({
  group: one(groups, { fields: [reminders.groupId], references: [groups.id] }),
  fromMember: one(members, {
    fields: [reminders.fromMemberId],
    references: [members.id],
    relationName: "reminder_from",
  }),
  toMember: one(members, {
    fields: [reminders.toMemberId],
    references: [members.id],
    relationName: "reminder_to",
  }),
}));

export const notificationPreferencesRelations = relations(
  notificationPreferences,
  ({ one }) => ({
    user: one(user, {
      fields: [notificationPreferences.userId],
      references: [user.id],
    }),
  }),
);

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
  items: many(expenseItems),
  adjustments: many(expenseAdjustments),
}));

export const expenseItemsRelations = relations(expenseItems, ({ one, many }) => ({
  expense: one(expenses, {
    fields: [expenseItems.expenseId],
    references: [expenses.id],
  }),
  shares: many(expenseItemShares),
}));

export const expenseItemSharesRelations = relations(
  expenseItemShares,
  ({ one }) => ({
    item: one(expenseItems, {
      fields: [expenseItemShares.itemId],
      references: [expenseItems.id],
    }),
    member: one(members, {
      fields: [expenseItemShares.memberId],
      references: [members.id],
    }),
  }),
);

export const expenseAdjustmentsRelations = relations(
  expenseAdjustments,
  ({ one }) => ({
    expense: one(expenses, {
      fields: [expenseAdjustments.expenseId],
      references: [expenses.id],
    }),
  }),
);

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
