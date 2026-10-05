// Throwaway smoke test. Boots the API on an ephemeral port, exercises the
// endpoints the Angular client depends on, then exits.
//
//   node scripts/smoke.js
//
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
dotenv.config();

import app from "../app.js";
import connectDB from "../config/db.js";

// Written straight to disk: the shell wrapper here is not reliable enough to
// trust a piped stdout.
const LOG = path.resolve("smoke.progress.log");
fs.writeFileSync(LOG, "");

const log = (message) => {
  fs.appendFileSync(LOG, `${message}\n`);
  console.log(message);
};

setTimeout(() => {
  log("WATCHDOG: forced exit after 150s");
  process.exit(2);
}, 150000).unref();

const results = [];

const check = (name, ok, extra = "") => {
  results.push({ name, ok });
  log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? `  (${extra})` : ""}`);
};

const STAFF = [
  {
    role: "admin",
    email: process.env.SEED_ADMIN_EMAIL ?? "admin@spacio.com",
    password: process.env.SEED_ADMIN_PASSWORD,
  },
  {
    role: "technician",
    email: process.env.SEED_TECH_EMAIL ?? "tech@spacio.com",
    password: process.env.SEED_TECH_PASSWORD,
  },
];

const run = async () => {
  await connectDB();

  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;

  const call = async (method, path, { token, body } = {}) => {
    const res = await fetch(base + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    return { status: res.status, data };
  };

  // ---------- public ----------
  let r = await call("GET", "/");
  check("GET / is up", r.status === 200 && r.data?.success === true);

  r = await call("GET", "/organizations/meta/types");
  check(
    "GET /organizations/meta/types",
    r.status === 200 &&
      Array.isArray(r.data?.data) &&
      Array.isArray(r.data?.data?.[0]?.optionDetails),
    `count=${r.data?.data?.length}`,
  );

  r = await call("GET", "/organizations/categories");
  check(
    "GET /organizations/categories",
    r.status === 200 && Array.isArray(r.data?.data?.categories),
    `count=${r.data?.data?.categories?.length}`,
  );

  r = await call(
    "GET",
    "/organizations/nearby?lat=30.0444&lng=31.2357&distance=20000",
  );
  check(
    "GET /organizations/nearby (Cairo)",
    r.status === 200 && Array.isArray(r.data?.data),
    `count=${r.data?.data?.length}`,
  );

  r = await call("GET", "/organizations?sort=name&page=1&limit=5");
  check(
    "GET /organizations (paged)",
    r.status === 200 && typeof r.data?.totalItems === "number",
    `total=${r.data?.totalItems}`,
  );

  r = await call("GET", "/organizations/not-a-real-id");
  check("GET /organizations/:id 404 envelope", r.status === 404 && r.data?.success === false);

  r = await call("GET", "/definitely-not-a-route");
  check("unknown route returns JSON 404", r.status === 404 && r.data?.success === false);

  // ---------- unauthenticated access is refused ----------
  r = await call("GET", "/dashboard/summary");
  check("GET /dashboard/summary without token is 401", r.status === 401, `got ${r.status}`);

  // ---------- signup ----------
  const email = `smoke.${Date.now()}@example.com`;
  r = await call("POST", "/auth/signup", {
    body: {
      firstName: "Smoke",
      lastName: "Tester",
      email,
      password: "Smoke@12345",
    },
  });
  const userToken = r.data?.token;
  check(
    "POST /auth/signup",
    r.status === 201 && Boolean(userToken),
    `role=${r.data?.data?.role}`,
  );

  r = await call("POST", "/auth/signup", {
    body: { firstName: "x", lastName: "y", email: "bad", password: "1" },
  });
  check("POST /auth/signup rejects invalid payload", r.status === 400, `got ${r.status}`);

  // ---------- user session ----------
  r = await call("GET", "/auth/profile", { token: userToken });
  check(
    "GET /auth/profile",
    r.status === 200 && r.data?.data?.email === email,
  );

  r = await call("POST", "/auth/login", {
    body: { email, password: "Smoke@12345" },
  });
  check("POST /auth/login", r.status === 200 && Boolean(r.data?.token));

  r = await call("PATCH", "/auth/location", {
    token: userToken,
    body: {
      latitude: 30.0444,
      longitude: 31.2357,
      governorate: "القاهرة",
      city: "المعادي",
      permission: "granted",
    },
  });
  check(
    "PATCH /auth/location",
    r.status === 200 && r.data?.data?.locationPermission !== "pending",
    `permission=${r.data?.data?.locationPermission}`,
  );

  r = await call("GET", "/dashboard/summary", { token: userToken });
  check(
    "GET /dashboard/summary",
    r.status === 200 && typeof r.data?.data?.unreadNotifications === "number",
    `role=${r.data?.data?.role}`,
  );

  r = await call("GET", "/dashboard/admin", { token: userToken });
  check("GET /dashboard/admin is 403 for a user", r.status === 403, `got ${r.status}`);

  r = await call("GET", "/notifications", { token: userToken });
  check(
    "GET /notifications",
    r.status === 200 && Array.isArray(r.data?.data),
    `count=${r.data?.data?.length}`,
  );

  r = await call("GET", "/notifications/unread-count", { token: userToken });
  check(
    "GET /notifications/unread-count",
    r.status === 200 && typeof r.data?.data?.unreadCount === "number",
    `count=${r.data?.data?.unreadCount}`,
  );

  // ---------- booking lifecycle ----------
  // A real booking is what proves the dashboard aggregates line up with the
  // booking data: the technician dashboard once returned resources.byStatus
  // under bookings.byStatus, and a status-count assertion catches that class
  // of bug where a plain "endpoint returned 200" check does not.
  r = await call("GET", "/resources?limit=50", { token: userToken });
  check(
    "GET /resources",
    r.status === 200 && typeof r.data?.totalItems === "number",
    `total=${r.data?.totalItems}`,
  );

  const bookable = (r.data?.data ?? []).find(
    (x) => x?.isActive !== false && x?.status !== "maintenance" && x?.organization
  );

  let smokeBookingStatus = null;

  if (!bookable) {
    check("booking lifecycle", false, "no bookable resource in the database");
  } else {
    const start = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const end = new Date(start.getTime() + 60 * 60 * 1000);

    const created = await call("POST", "/bookings", {
      token: userToken,
      body: {
        resource: bookable._id,
        organization: bookable.organization,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        notes: "smoke booking",
      },
    });

    const booking = created.data?.data;
    const status = booking?.status;
    smokeBookingStatus = status;

    check(
      "POST /bookings",
      created.status === 201 && Boolean(booking?._id),
      `status=${status}`,
    );

    r = await call("GET", "/bookings/my-bookings", { token: userToken });
    check(
      "GET /bookings/my-bookings",
      r.status === 200 &&
        Array.isArray(r.data?.data) &&
        r.data.data.some((b) => String(b._id) === String(booking?._id)),
      `count=${r.data?.data?.length}`,
    );

    r = await call("GET", "/dashboard/user", { token: userToken });
    check(
      "GET /dashboard/user",
      r.status === 200 && Boolean(r.data?.data),
      `bookings=${r.data?.data?.bookings?.total}`,
    );

    check(
      "dashboard byStatus matches the new booking",
      r.data?.data?.bookings?.byStatus?.[status] === 1,
      `byStatus=${JSON.stringify(r.data?.data?.bookings?.byStatus)}`,
    );

    const cancelled = await call("PATCH", `/bookings/${booking._id}/cancel`, {
      token: userToken,
      body: { note: "smoke cleanup" },
    });

    check(
      "PATCH /bookings/:id/cancel",
      cancelled.status === 200 && cancelled.data?.data?.status === "cancelled",
      `status=${cancelled.data?.data?.status}`,
    );

    r = await call("GET", "/dashboard/user", { token: userToken });
    check(
      "dashboard byStatus after cancel",
      r.data?.data?.bookings?.byStatus?.cancelled === 1,
      `byStatus=${JSON.stringify(r.data?.data?.bookings?.byStatus)}`,
    );
  }

  // ---------- staff flows ----------
  for (const account of STAFF) {
    if (!account.password) {
      check(`${account.role} login`, false, "SEED_*_PASSWORD not set");
      continue;
    }

    const login = await call("POST", "/auth/login", {
      body: { email: account.email, password: account.password },
    });

    const token = login.data?.token;
    if (!token) {
      check(`${account.role} login`, false, `status ${login.status}`);
      continue;
    }

    check(
      `${account.role} login`,
      login.status === 200 && login.data?.data?.role === account.role,
    );

    const dash = await call("GET", `/dashboard/${account.role}`, { token });
    check(`${account.role} dashboard`, dash.status === 200 && Boolean(dash.data?.data));

    // The admin oversees every booking, so the queue must include the booking
    // the smoke run created above.
    if (account.role === "admin" && smokeBookingStatus) {
      check(
        "admin dashboard counts the smoke booking under bookings.byStatus",
        dash.data?.data?.bookings?.total >= 1 &&
          dash.data?.data?.bookings?.byStatus?.[smokeBookingStatus] >= 1,
        `byStatus=${JSON.stringify(dash.data?.data?.bookings?.byStatus)}`,
      );
    }

    const manageable = await call("GET", "/organizations/manageable", { token });
    check(
      `${account.role} GET /organizations/manageable`,
      manageable.status === 200 && Array.isArray(manageable.data?.data),
      `count=${manageable.data?.data?.length}`,
    );

    const resources = await call("GET", "/resources/manageable", { token });
    check(
      `${account.role} GET /resources/manageable`,
      resources.status === 200 && Array.isArray(resources.data?.data),
      `count=${resources.data?.data?.length}`,
    );

    const bookings = await call("GET", "/bookings/manageable", { token });
    check(
      `${account.role} GET /bookings/manageable`,
      bookings.status === 200 && Array.isArray(bookings.data?.data),
      `count=${bookings.data?.data?.length}`,
    );
  }

  server.close();

  const failed = results.filter((x) => !x.ok);
  log(`\n${results.length - failed.length}/${results.length} checks passed`);

  process.exit(failed.length === 0 ? 0 : 1);
};

run().catch((error) => {
  log(String(error?.stack ?? error));
  process.exit(1);
});
