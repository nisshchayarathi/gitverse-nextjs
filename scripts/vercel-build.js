const cp = require("child_process");

function run(cmd) {
  cp.execSync(cmd, { stdio: "inherit" });
}

function main() {
  const vercelEnv = (process.env.VERCEL_ENV || "").toLowerCase();

  // Only apply migrations automatically on production deployments.
  // Preview deployments should not mutate the production database.
  if (vercelEnv === "production") {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is required for production deploys");
    }

    console.log("==> Running Prisma migrations (production)");
    run("npx prisma migrate deploy");
  } else {
    console.log("==> Skipping Prisma migrate deploy (VERCEL_ENV!=production)");
  }

  console.log("==> Generating Prisma Client");
  run("npx prisma generate");

  console.log("==> Building Next.js");
  run("npx next build");
}

main();
