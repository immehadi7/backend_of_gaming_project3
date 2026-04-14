import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, "Username is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: 6,
      select: false, // never returned by default in queries
    },
    role: {
      type: String,
      enum: ["client", "employee", "admin", "super_admin"],
      default: "client",
    },
    phone_number: {
      type: String,
      default: "",
    },
    phone_verified: {
      type: Boolean,
      default: false,
    },
    // For employee phone verification (dev mode)
    phone_verification_code: {
      type: String,
      select: false,
    },
    phone_verification_expires: {
      type: Date,
      select: false,
    },
    is_active: {
      type: Boolean,
      default: true,
    },
    // Employee specific
    is_online: {
      type: Boolean,
      default: false,
    },
    avatar: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

// Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password method
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Return clean user object (no password)
userSchema.methods.toSafeObject = function () {
  return {
    id: this._id.toString(),
    username: this.username,
    email: this.email,
    role: this.role,
    phone_number: this.phone_number,
    phone_verified: this.phone_verified,
    is_online: this.is_online,
    avatar: this.avatar,
    created_at: this.created_at,
  };
};

const User = mongoose.model("User", userSchema);

export default User;
