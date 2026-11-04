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
    verifiedAge: { type: Number, min: 0, default: null },
    ageVerifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    staffActivationHash: { type: String, select: false }, staffActivationExpires: Date,
    statusHistory: { type: [{ before: String, after: String, actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, at: Date }], select: false, default: [] },
    redemptionEntries: { type: [{ booking: mongoose.Schema.Types.ObjectId, delta: Number, at: Date }], select: false, default: [] },
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
    pointAdjustments: {
      type: [{
        requestId: { type: String, required: true },
        delta: { type: Number, required: true },
        before: { type: Number, required: true },
        after: { type: Number, required: true },
        reason: { type: String, required: true },
        admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        createdAt: { type: Date, default: Date.now }
      }],
      default: [],
      select: false
    },
    status: {
      type: String,
      enum: [
        "Active",
        "Pending Verification",
        "Pending Activation",
        "Inactive",
        "Deactivated",
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
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    statusUpdatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
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
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
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
    this.password = candidatePassword;
    this.markModified('password');
    await this.save();
    console.log(
      `[AUTH AUDIT] Migrated legacy plaintext password for ${this.email} to bcrypt hash.`,
    );
    return true;
  }
  return false;
};

export default mongoose.model("User", userSchema);
