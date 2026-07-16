import mongoose from "mongoose";


const connectDB = async () => {
  try {
    console.log("Before connect");

    await mongoose.connect(process.env.DB_URL );

    console.log(
      "Database Connected ✅"
    );
  } catch (error) {
    console.log(
      "Database Error:",
      error
    );
  }
};

export default connectDB;

