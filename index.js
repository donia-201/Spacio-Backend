import dotenv from "dotenv";
dotenv.config();

import app from "./app.js";
import connectDB from "./config/db.js";

const PORT = Number(process.env.PORT) || 3000;

const startServer = async () => {
  // Refuses to boot without a database — see config/db.js.
  await connectDB();

  const server = app.listen(PORT, "0.0.0.0",() => {
    console.log(`Spacio API listening on port ${PORT}`);
  });

  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      console.error(`Port ${PORT} is already in use.`);
    } else {
      console.error(error);
    }

    process.exit(1);
  });

  // Render/Railway/Fly restart the process with SIGTERM; drain connections
  // first so in-flight requests are not cut off.
  const shutdown = (signal) => () => {
    console.log(`${signal} received, closing server`);

    server.close(() => process.exit(0));
  };

  process.on("SIGTERM", shutdown("SIGTERM"));
  process.on("SIGINT", shutdown("SIGINT"));
};

startServer().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});