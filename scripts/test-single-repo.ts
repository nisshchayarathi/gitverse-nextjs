import "dotenv/config";
import { generateToken } from "../lib/auth";
import prisma from "../lib/prisma";
import axios from "axios";

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: "test@example.com" },
  });

  if (!user) {
    console.error("Test user not found!");
    process.exit(1);
  }

  const token = generateToken({
    userId: user.id,
    email: user.email,
    tokenVersion: user.tokenVersion,
  });

  const url = `http://localhost:3000/api/repositories/20`;
  console.log(`Fetching GET ${url}...`);

  try {
    const res = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    console.log("Status:", res.status);
    console.log("Data keys:", Object.keys(res.data));
    console.log("Data.latestJob:", res.data.latestJob);
    console.log("Data.status:", res.data.status);
    console.log("Data.name:", res.data.name);
  } catch (error: any) {
    console.error("Failed:", error.response?.data || error.message);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
