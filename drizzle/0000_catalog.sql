CREATE SCHEMA "stravapi";
--> statement-breakpoint
REVOKE ALL ON SCHEMA "stravapi" FROM PUBLIC;
--> statement-breakpoint
CREATE TABLE "stravapi"."categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(80) NOT NULL,
	"description" varchar(500) NOT NULL,
	CONSTRAINT "categories_name_unique" UNIQUE("name"),
	CONSTRAINT "categories_slug_unique" UNIQUE("slug"),
	CONSTRAINT "category_slug_format" CHECK ("stravapi"."categories"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);
--> statement-breakpoint
CREATE TABLE "stravapi"."inventory_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"type" varchar(3) NOT NULL,
	"quantity" integer NOT NULL,
	"reference" varchar(200) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "movement_quantity_range" CHECK ("stravapi"."inventory_movements"."quantity" BETWEEN 1 AND 1000000000),
	CONSTRAINT "movement_type_valid" CHECK ("stravapi"."inventory_movements"."type" IN ('in', 'out'))
);
--> statement-breakpoint
CREATE TABLE "stravapi"."products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(160) NOT NULL,
	"description" varchar(1500) NOT NULL,
	"price" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'CLP' NOT NULL,
	"category_id" uuid NOT NULL,
	"stock" integer DEFAULT 0 NOT NULL,
	"sku" varchar(48) NOT NULL,
	"image_url" varchar(2048),
	"status" varchar(8) DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_sku_unique" UNIQUE("sku"),
	CONSTRAINT "product_price_range" CHECK ("stravapi"."products"."price" BETWEEN 0 AND 1000000000),
	CONSTRAINT "product_stock_range" CHECK ("stravapi"."products"."stock" BETWEEN 0 AND 1000000000),
	CONSTRAINT "product_currency_clp" CHECK ("stravapi"."products"."currency" = 'CLP'),
	CONSTRAINT "product_status_valid" CHECK ("stravapi"."products"."status" IN ('active', 'inactive'))
);
--> statement-breakpoint
CREATE TABLE "stravapi"."rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"window" timestamp with time zone NOT NULL,
	"hits" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "stravapi"."inventory_movements" ADD CONSTRAINT "inventory_movements_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "stravapi"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stravapi"."products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "stravapi"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "movement_product_date_idx" ON "stravapi"."inventory_movements" USING btree ("product_id","created_at");--> statement-breakpoint
CREATE INDEX "products_category_idx" ON "stravapi"."products" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "products_active_price_idx" ON "stravapi"."products" USING btree ("price","id") WHERE "stravapi"."products"."status" = 'active';--> statement-breakpoint
CREATE INDEX "products_active_date_idx" ON "stravapi"."products" USING btree ("created_at","id") WHERE "stravapi"."products"."status" = 'active';--> statement-breakpoint
CREATE INDEX "products_active_stock_idx" ON "stravapi"."products" USING btree ("stock","id") WHERE "stravapi"."products"."status" = 'active';--> statement-breakpoint
CREATE INDEX "rate_limits_window_idx" ON "stravapi"."rate_limits" USING btree ("window");
