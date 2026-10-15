import "dotenv/config";
import { defineConfig } from "prisma/config";
import { migrationUrl } from "../migration-url";

export default defineConfig({
  schema: "schema.prisma",
  migrations: {
    path: "migrations",
  },
  datasource: {
    // Conexión directa (sin pooler) para migraciones: ver migration-url.ts.
    url: migrationUrl("DATABASE_USER"),
  },
});
