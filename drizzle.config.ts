import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/database/schemas/productSchema.ts", // Caminho onde está o seu schema
  out: "./drizzle", // Pasta onde ele vai cuspir o arquivo .sql
  dialect: "sqlite", // O dialeto do banco de dados
});
