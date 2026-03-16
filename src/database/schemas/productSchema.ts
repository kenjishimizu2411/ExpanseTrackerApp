import { sqliteTable, integer, text, real } from "drizzle-orm/sqlite-core";

export const category = sqliteTable("categories", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
  color: text("color").notNull(),
  isIncome: integer("is_income", { mode: "boolean" }).notNull().default(false),
});

export const entry = sqliteTable("entries", {
  id: integer("id").primaryKey(),
  description: text("description").notNull(),
  categoryId: integer("category_id").references(() => category.id),
  date: text("date").notNull(),
  value: real("value").notNull(),
});

export const wallet = sqliteTable("wallets", {
  id: integer("id").primaryKey(),
  value: real("value").notNull(),
});
