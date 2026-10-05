import dotenv from "dotenv";
dotenv.config();

import connectDB from "../config/db.js";
import User from "../models/user.js";

// Creates the staff accounts the dashboards are built around.
//
//   SEED_ADMIN_PASSWORD=... SEED_TECH_PASSWORD=... npm run seed:staff
//
// Signup always produces a "user", so the only way to get an admin or a
// technician is to promote an existing account — this script does that
// idempotently.
//
// The passwords have no defaults: this script is expected to run against a
// real database, and a checked-in default password is a checked-in breach.
const STAFF = [
  {
    email: process.env.SEED_ADMIN_EMAIL ?? "admin@spacio.com",
    password: process.env.SEED_ADMIN_PASSWORD,
    firstName: "Spacio",
    lastName: "Admin",
    role: "admin",
  },
  {
    email: process.env.SEED_TECH_EMAIL ?? "tech@spacio.com",
    password: process.env.SEED_TECH_PASSWORD,
    firstName: "Spacio",
    lastName: "Technician",
    role: "technician",
  },
];

const run = async () => {
  const withoutPassword = STAFF.filter((account) => !account.password);

  if (withoutPassword.length > 0) {
    console.error(
      "Refusing to seed. Set these environment variables first:\n" +
        withoutPassword
          .map((account) => `  SEED_${account.role === "admin" ? "ADMIN" : "TECH"}_PASSWORD`)
          .join("\n"),
    );
    process.exit(1);
  }

  await connectDB();

  for (const account of STAFF) {
    const existing = await User.findOne({ email: account.email });

    if (existing) {
      // Promote in place; leave the password alone.
      if (existing.role !== account.role) {
        existing.role = account.role;
        await existing.save();
        console.log(`^ ${account.email} promoted to ${account.role}`);
      } else {
        console.log(`= ${account.email} already ${account.role}`);
      }
      continue;
    }

    await User.create(account);
    console.log(`+ ${account.email} created as ${account.role}`);
  }

  console.log("\nStaff accounts ready:");
  STAFF.forEach(({ email, role }) => console.log(`  ${role.padEnd(10)} ${email}`));

  process.exit(0);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});