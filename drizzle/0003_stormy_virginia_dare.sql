CREATE TYPE "public"."adjustment_allocation" AS ENUM('proportional', 'equal');--> statement-breakpoint
CREATE TYPE "public"."adjustment_kind" AS ENUM('tax', 'service', 'tip', 'discount');--> statement-breakpoint
CREATE TABLE "expense_adjustments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"expense_id" uuid NOT NULL,
	"kind" "adjustment_kind" NOT NULL,
	"amount" integer NOT NULL,
	"allocation" "adjustment_allocation" DEFAULT 'proportional' NOT NULL,
	CONSTRAINT "expense_adjustments_amount_pos" CHECK ("expense_adjustments"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "expense_item_shares" (
	"item_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"input_value" numeric(12, 2) DEFAULT '1' NOT NULL,
	"share_amount" integer NOT NULL,
	CONSTRAINT "expense_item_shares_item_id_member_id_pk" PRIMARY KEY("item_id","member_id"),
	CONSTRAINT "item_shares_val_pos" CHECK ("expense_item_shares"."input_value" > 0),
	CONSTRAINT "item_shares_amount_nonneg" CHECK ("expense_item_shares"."share_amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "expense_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"expense_id" uuid NOT NULL,
	"name" text NOT NULL,
	"amount" integer NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "expense_items_amount_pos" CHECK ("expense_items"."amount" > 0)
);
--> statement-breakpoint
ALTER TABLE "expense_adjustments" ADD CONSTRAINT "expense_adjustments_expense_id_expenses_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."expenses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_item_shares" ADD CONSTRAINT "expense_item_shares_item_id_expense_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."expense_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_item_shares" ADD CONSTRAINT "expense_item_shares_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_items" ADD CONSTRAINT "expense_items_expense_id_expenses_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."expenses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "expense_adjustments_expense_idx" ON "expense_adjustments" USING btree ("expense_id");--> statement-breakpoint
CREATE INDEX "item_shares_member_idx" ON "expense_item_shares" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "expense_items_expense_idx" ON "expense_items" USING btree ("expense_id");