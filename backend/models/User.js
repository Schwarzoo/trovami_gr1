const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

/**
 * @typedef {Object} User
 * @description Rappresenta un utente nel database.
 * @property {string} username Nome utente univoco.
 * @property {string} email Email univoca.
 * @property {string} passwordHash Hash della password.
 * @property {string|null} phoneNumber Numero di telefono opzionale.
 * @property {boolean} isActive Indica se l'account è attivo.
 * @property {boolean} isEmailVerified Indica se l'email è verificata.
 * @property {string} role Ruolo dell'utente.
 * @property {string} rifugioStatus Stato della richiesta rifugio.
 * @property {string|null} sessionToken Token di sessione corrente.
 */
const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    phoneNumber: { type: String, default: null },
    isActive: { type: Boolean, default: true },
    isEmailVerified: { type: Boolean, default: false },
    role: { type: String, enum: ["user", "shelter", "admin"], default: "user" },
    rifugioStatus: {
      type: String,
      enum: ["none", "pending", "approved", "rejected"],
      default: "none",
    },
    sessionToken: { type: String, default: null },

    contactVisibility: {
      showEmail: { type: Boolean, default: true },
      showPhone: { type: Boolean, default: true },
    },

    notificationPrefs: {
      emailOnComment: { type: Boolean, default: false },
    },

    followedShelters: [
      {
        shelterId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        emailEnabled: { type: Boolean, default: false },
        createdAt: { type: Date, default: Date.now },
      },
    ],

    conductWarnings: [
      {
        adminId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        reason: { type: String, default: "Ammonimento sulla condotta account" },
        createdAt: { type: Date, default: Date.now },
      },
    ],

    readmissionRequest: {
      status: {
        type: String,
        enum: ["none", "pending", "approved", "rejected"],
        default: "none",
      },
      message: { type: String, default: "" },
      requestedAt: { type: Date, default: null },
      reviewedAt: { type: Date, default: null },
      reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
    },

    resetPasswordToken: { type: String, default: null },
    resetPasswordExpires: { type: Date, default: null },
    emailVerificationToken: { type: String, default: null },
    emailVerificationExpires: { type: Date, default: null },

    rifugioData: {
      rifugioName: { type: String },
      address: { type: String },
      city: { type: String },
      description: { type: String },
      totalSlots: { type: Number },
      availableSlots: { type: Number },
      location: {
        type: { type: String, enum: ["Point"] },
        coordinates: { type: [Number], default: undefined },
      },
    },

    shelterData: {
      shelterName: { type: String },
      totalSlots: { type: Number },
      availableSlots: { type: Number },
      location: {
        type: { type: String, enum: ["Point"] },
        coordinates: { type: [Number], default: undefined },
      },
    },
  },
  { timestamps: true },
);

userSchema.index({ _id: 1, "followedShelters.shelterId": 1 });

/**
 * Normalizza il ruolo e il relativo stato del rifugio prima della validazione.
 * @this {mongoose.Document}
 * @param {Function} next Callback di completamento del middleware.
 * @returns {void}
 */
userSchema.pre("validate", function normalizeRole(next) {
  if (typeof this.role === "string") {
    this.role = this.role.toLowerCase();
  }
  if (
    this.role === "shelter" &&
    (!this.rifugioStatus || this.rifugioStatus === "none")
  ) {
    this.rifugioStatus = "pending";
  }
  if (
    this.role !== "shelter" &&
    (!this.rifugioStatus || this.rifugioStatus === "pending")
  ) {
    this.rifugioStatus = "none";
  }

  if (typeof next === "function") next();
});

module.exports = mongoose.model("User", userSchema);
