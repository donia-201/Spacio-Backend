import mongoose from "mongoose";

/**
 * Connects using DB_URL and fails loudly when it cannot.
 *
 * The server must NOT keep listening without a database: every request would
 * hang until the driver timeout, which looks like a hung deploy.
 */
const connectDB = async () => {
  const url = process.env.DB_URL;

  if (!url) {
    throw new Error("DB_URL is not set. Copy .env.example to .env and fill it in.");
  }

  mongoose.set("strictQuery", true);

  try {
    await mongoose.connect(url, {
      serverSelectionTimeoutMS: 10000,
    });

    console.log("Database connected");

    return mongoose.connection;
  } catch (error) {
    throw new Error(`Database connection failed: ${error.message}`);
  }
};

export default connectDB;