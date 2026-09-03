import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema.ts",
  out: "./migrations",
  dbCredentials: {
    url: process.env.OPENBOT_DATABASE_URL ?? "postgres://openbot:openbot@localhost:5432/openbot",
  },
});
