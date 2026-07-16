import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: true,
      trim: true,
    },

    lastName: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
      minlength: 8,
      select: false,
    },

    phone: String,

    profileImage: {
      secure_url: String,
      public_id: String,
    },

    role: {
  type: String,
  enum: [
    "user",
    "technician",
    "admin",
    "super_admin",
  ],
  default: "user",
},

    isVerified: {
      type: Boolean,
      default: false,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    lastLogin: Date,
  },
  {
    timestamps: true,
  },
  
);

// Hash password before saving user
userSchema.pre("save", async function () {
  if (!this.isModified("password")) return ;
  const salt  = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);

});

// Compare entered password with hashed password
userSchema.methods.comparePassword = function (password) {
  return bcrypt.compare(password, this.password);
};

const User = mongoose.models.User || mongoose.model("User", userSchema);

export default User;