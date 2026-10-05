import express from "express";
import cors from "cors";

import authRoutes from "./routes/auth.routes.js";
import organizationRoutes from "./routes/organization.routes.js";
import membershipRoutes from "./routes/membership.routes.js";
import resourceRoutes from "./routes/resource.routes.js";
import bookingRoutes from "./routes/booking.routes.js";
import notificationRoutes from "./routes/notification.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";

import {
  notFoundHandler,
  errorHandler,
} from "./middleware/error.middleware.js";

const app = express();

// Locked down to CLIENT_ORIGIN once that variable is set (deployed). Left open
// locally so the dev server on :4200 can talk to the API on :3000.
const allowedOrigins = (process.env.CLIENT_ORIGIN ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : true,
    credentials: true,
  })
);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Spacio API is running ",
  });
});

app.use("/auth", authRoutes);
app.use("/organizations", organizationRoutes);
app.use("/memberships", membershipRoutes);
app.use("/resources", resourceRoutes);
app.use("/bookings", bookingRoutes);
app.use("/notifications", notificationRoutes);
app.use("/dashboard", dashboardRoutes);

// Anything that reached this point matched no route. Answering with JSON
// here is what lets the Angular client rely on the response envelope.
app.use(notFoundHandler);

app.use(errorHandler);

export default app;
