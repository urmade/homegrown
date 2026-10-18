import { migrate } from "../src/migrate";

const url = process.env.MIGRATE_DATABASE_URL;
if (!url) {
  process.stderr.write("MIGRATE_DATABASE_URL is required (owner role; never given to the app)\n");
  process.exit(1);
}
await migrate({
  url,
  appRole: process.env.APP_DB_ROLE ?? "homegrown_app",
  appPassword: process.env.APP_DB_PASSWORD,
  log: (m) => process.stdout.write(`${m}\n`),
});
process.stdout.write("migrations up to date\n");
