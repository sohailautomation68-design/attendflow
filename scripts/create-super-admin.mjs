// Creates the platform owner (SUPER_ADMIN) account. Run once, locally:
//   node scripts/create-super-admin.mjs owner@example.com "Your Name" "a-strong-password"
// The password is read from the command line only for this one-time setup; it is stored as a bcrypt hash.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const [email, name, password] = process.argv.slice(2);
if (!email || !name || !password || password.length < 12) {
  console.error('Usage: node scripts/create-super-admin.mjs <email> "<name>" "<password of 12+ characters>"');
  process.exit(1);
}

const db = new PrismaClient();
try {
  const existing = await db.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) {
    console.error("An account with this email already exists.");
    process.exit(1);
  }
  // The platform owner belongs to a special academy used only for internal staff.
  let platform = await db.academy.findFirst({ where: { name: "AttendFlow Platform" } });
  if (!platform) platform = await db.academy.create({ data: { name: "AttendFlow Platform", active: true, subscriptionStatus: "ACTIVE" } });
  await db.user.create({
    data: {
      academyId: platform.id,
      email: email.toLowerCase(),
      name,
      passwordHash: await bcrypt.hash(password, 12),
      role: "SUPER_ADMIN",
    },
  });
  console.log(`Platform owner created: ${email}`);
} finally {
  await db.$disconnect();
}
