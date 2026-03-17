import { sqliteTable, integer, text, real } from "drizzle-orm/sqlite-core";

export const category = sqliteTable("categories", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
  color: text("color").notNull(),
  // Booleano armazenado como 0/1 no SQLite (padrão do Drizzle com mode:"boolean")
  isIncome: integer("is_income", { mode: "boolean" }).notNull().default(false),
  // Nome do ícone Material Design Community (ex: "silverware-fork-knife").
  // Armazenar o nome como texto é suficiente — o componente <Icon> do Paper
  // já sabe renderizar qualquer ícone a partir do nome em string.
  icon: text("icon").notNull().default("dots-horizontal"),
  // ISO 8601 — usada para ordenar categorias por data de criação na ManageScreen.
  // SQLite não tem tipo DATE nativo, então armazenamos como TEXT.
  createdAt: text("created_at").notNull().default(""),
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
