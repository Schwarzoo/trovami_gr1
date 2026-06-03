const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

/**
 * @typedef {Object} User
 * @description Rappresenta un utente nel database.
 * @property {string} username Nome utente univoco.
 * @property {string} email Email univoca.
 * @property {string} passwordHash Hash della password.
 * @property {string} role Ruolo / discriminatore dell'utente.
 * @property {string|null} phoneNumber Numero di telefono opzionale.
 * @property {boolean} isActive Indica se l'account è attivo.
 * @property {boolean} isEmailVerified Indica se l'email è verificata.
 * @property {Array<{ shelterId: mongoose.Types.ObjectId, emailEnabled: boolean, createdAt: Date }>} followedShelters Rifugi seguiti.
 */
const userBaseSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    role: { type: String, default: "user" },
    phoneNumber: { type: String, default: null },
    isActive: { type: Boolean, default: true },
    isEmailVerified: { type: Boolean, default: false },
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
  },
  { timestamps: true, discriminatorKey: "role" },
);

userBaseSchema.index({ _id: 1, "followedShelters.shelterId": 1 });

/**
 * Normalizza il ruolo prima della validazione.
 * @this {mongoose.Document}
 * @param {Function} next Callback di completamento del middleware.
 * @returns {void}
 */
userBaseSchema.pre("validate", function normalizeRole() {
  if (typeof this.role === "string") {
    this.role = this.role.toLowerCase();
  }

  if (this.role === "shelter" && this.rifugioStatus == null) {
    this.rifugioStatus = "pending";
  }
});

/**
 * @typedef {Object} ShelterUserData
 * @description Dati specifici di un account rifugio.
 * @property {string} rifugioStatus Stato della richiesta rifugio.
 * @property {{ rifugioName?: string, address?: string, city?: string, description?: string, totalSlots?: number, availableSlots?: number, location?: { type?: string, coordinates?: number[] } }} rifugioData Dati anagrafici del rifugio.
 */
const shelterUserSchema = new mongoose.Schema({
  rifugioStatus: {
    type: String,
    enum: ["none", "pending", "approved", "rejected"],
    default: "pending",
  },

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

});

const User = mongoose.model("User", userBaseSchema);
const ShelterUser = User.discriminator("shelter", shelterUserSchema);

const StandardUser = User.discriminator('user', new mongoose.Schema({}, { _id: false }));
const AdminUser = User.discriminator('admin', new mongoose.Schema({}, { _id: false }));

module.exports = User;
module.exports.User = User;
module.exports.userBaseSchema = userBaseSchema;
module.exports.ShelterUser = ShelterUser;
module.exports.StandardUser = StandardUser;
module.exports.AdminUser = AdminUser;
