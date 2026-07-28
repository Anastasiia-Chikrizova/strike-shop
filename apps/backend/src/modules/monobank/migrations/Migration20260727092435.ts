import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260727092435 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "monobank_invoice" drop constraint if exists "monobank_invoice_invoice_id_unique";`);
    this.addSql(`create table if not exists "monobank_invoice" ("id" text not null, "invoice_id" text null, "request_id" text null, "reference" text null, "flow" text check ("flow" in ('invoice', 'monopay')) not null default 'invoice', "amount" integer not null, "ccy" integer not null default 980, "final_amount" integer null, "status" text check ("status" in ('created', 'processing', 'hold', 'success', 'failure', 'reversed', 'expired')) not null default 'created', "outcome" text check ("outcome" in ('pending', 'paid', 'hold', 'failed', 'canceled')) not null default 'pending', "modified_date" timestamptz null, "failure_reason" text null, "err_code" text null, "page_url" text null, "cart_id" text null, "order_id" text null, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "monobank_invoice_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_monobank_invoice_deleted_at" ON "monobank_invoice" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_monobank_invoice_invoice_id_unique" ON "monobank_invoice" ("invoice_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_monobank_invoice_reference" ON "monobank_invoice" ("reference") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_monobank_invoice_request_id" ON "monobank_invoice" ("request_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_monobank_invoice_cart_id" ON "monobank_invoice" ("cart_id") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "monobank_webhook_log" ("id" text not null, "invoice_id" text null, "reference" text null, "status" text null, "signature_valid" boolean not null default false, "http_status" integer not null default 200, "raw_body" text null, "payload" jsonb null, "error" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "monobank_webhook_log_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_monobank_webhook_log_deleted_at" ON "monobank_webhook_log" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_monobank_webhook_log_invoice_id" ON "monobank_webhook_log" ("invoice_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_monobank_webhook_log_signature_valid" ON "monobank_webhook_log" ("signature_valid") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "monobank_invoice" cascade;`);

    this.addSql(`drop table if exists "monobank_webhook_log" cascade;`);
  }

}
