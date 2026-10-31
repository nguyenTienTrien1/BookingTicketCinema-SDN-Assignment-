import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true, minlength: 6 },
    phone: { type: String, default: "" },
    age: { type: Number, min: 0 },
    gender: {
      type: String,
      enum: ["Male", "Female", "Other"],
      default: "Other",
    },
    role: {
      type: String,
      enum: ["member", "employee", "admin"],
      default: "member",
    },
    isVIP: { type: Boolean, default: false },
    memberPoints: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: [
        "Active",
        "Pending Verification",
        "Inactive",
        "Banned",
        "active",
        "inactive",
        "blocked",
      ],
      default: function () {
        // Per BR-8, Member accounts default to 'Pending Verification'
        return this.role === "member" ? "Pending Verification" : "Active";
      },
    },
    failedLoginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date, default: null },
    lastLogin: { type: Date, default: null },
    tokenVersion: { type: Number, default: 0 },
    // Verification fields for BR-8 (Single-use token expiring after 24h)
    verificationToken: { type: String, default: null },
    verificationExpires: { type: Date, default: null },
  },
  { timestamps: true },
);

// Pre-save hook: Hash password with bcrypt before saving (BR-1)
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  try {
    // Only hash if not already a valid bcrypt hash
    if (
      !this.password.startsWith("$2a$") &&
      !this.password.startsWith("$2b$")
    ) {
      const salt = await bcrypt.genSalt(10);
      this.password = await bcrypt.hash(this.password, salt);
    }
    next();
  } catch (error) {
    next(error);
  }
});

// Helper method to compare passwords (BR-1)
userSchema.methods.comparePassword = async function (candidatePassword) {
  // If stored password is a bcrypt hash
  if (this.password.startsWith("$2a$") || this.password.startsWith("$2b$")) {
    return bcrypt.compare(candidatePassword, this.password);
  }
  // Safe migration fallback for legacy plaintext passwords
  if (this.password === candidatePassword) {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(candidatePassword, salt);
    await this.save();
    console.log(
      `[AUTH AUDIT] Migrated legacy plaintext password for ${this.email} to bcrypt hash.`,
    );
    return true;
  }
  return false;
};

export default mongoose.model("User", userSchema);
