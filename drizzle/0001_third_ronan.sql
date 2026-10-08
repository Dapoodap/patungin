CREATE TYPE "public"."audit_source" AS ENUM('user', 'ai', 'system');--> statement-breakpoint
CREATE TYPE "public"."split_mode" AS ENUM('weight', 'percent', 'exact', 'items');--> statement-breakpoint
ALTER TABLE "expense_splits" RENAME COLUMN "weight" TO "input_value";--> statement-breakpoint
ALTER TABLE "expense_splits" ALTER COLUMN "input_value" SET DATA TYPE numeric(12, 2);--> statement-breakpoint
ALTER TABLE "expense_splits" DROP CONSTRAINT "splits_weight_pos";--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "source" "audit_source" DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "split_mode" "split_mode" DEFAULT 'weight' NOT NULL;--> statement-breakpoint
ALTER TABLE "expense_splits" ADD CONSTRAINT "splits_input_val_pos" CHECK ("expense_splits"."input_value" >= 0);