import express from "express";
import cors from "cors";
import authRouter from "./routes/auth.routes.js";

import organizationRoutes from "./routes/organization.routes.js"
import membershipRoutes from "./routes/memberShip.routes.js"
import  resourceRoutes from "./routes/resource.routes.js"
import  bookingRoutes from "./routes/booking.routes.js"


const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Spacio API is running ",
  });
});

app.use("/auth", authRouter);
export default app;
app.use(
  "/organizations",
  organizationRoutes
);

app.use(
  "/memberships",
  membershipRoutes
);

app.use(
  "/resources",
  resourceRoutes
);

app.use(
  "/bookings",
  bookingRoutes
);


