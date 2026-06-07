import "dotenv/config";
import { generateToken } from "../lib/auth";
import prisma from "../lib/prisma";
import axios from "axios";

async function main() {
  console.log("Running backend integration smoke tests...");

  // Find user
  const user = await prisma.user.findUnique({
    where: { email: "test@example.com" },
  });

  if (!user) {
    console.error("Test user not found!");
    process.exit(1);
  }

  // Generate token
  const token = generateToken({
    userId: user.id,
    email: user.email,
    tokenVersion: user.tokenVersion,
  });

  console.log(`Generated JWT token for user ${user.email} (ID: ${user.id})`);

  // Find repository (ID 20 or first repo)
  const repository = await prisma.repository.findFirst({
    where: { userId: user.id },
  });

  if (!repository) {
    console.error("No repositories found!");
    process.exit(1);
  }

  const url = `http://localhost:3000/api/repositories/${repository.id}/evolution`;
  console.log(`Testing GET ${url}...`);

  try {
    const getResponse = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    console.log("✅ GET Response Status:", getResponse.status);
    console.log("✅ Number of Snapshots:", getResponse.data.snapshots.length);
    console.log("✅ Coupling Top Pairs count:", getResponse.data.coupling?.topPairs?.length || 0);

    const postUrl = `${url}/analyze-ai`;
    console.log(`Testing POST ${postUrl}...`);

    const postResponse = await axios.post(postUrl, {}, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    console.log("✅ POST Response Status:", postResponse.status);
    console.log("✅ AI Insights Generated:", postResponse.data.aiInsights ? "YES" : "NO");
    if (postResponse.data.aiInsights) {
      console.log("Sample AI Content:", postResponse.data.aiInsights.substring(0, 150) + "...");
    }
  } catch (error: any) {
    console.error("❌ Test failed:", error.response?.data || error.message);
  }
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
