const mongoose = require("mongoose");

/**
 * @typedef {Object} Notification
 * @description Rappresenta una notifica destinata a un utente.
 * @property {mongoose.Types.ObjectId} userId Destinatario della notifica.
 * @property {string} type Tipo di notifica.
 * @property {mongoose.Types.ObjectId|null} announcementId Annuncio collegato, se presente.
 * @property {mongoose.Types.ObjectId|null} shelterId Rifugio collegato, se presente.
 * @property {mongoose.Types.ObjectId|null} animalId Animale collegato, se presente.
 * @property {mongoose.Types.ObjectId|null} reportId Report collegato, se presente.
 * @property {mongoose.Types.ObjectId|null} targetUserId Utente target collegato, se presente.
 * @property {mongoose.Types.ObjectId|null} commentId Commento collegato, se presente.
 * @property {mongoose.Types.ObjectId|null} contactRequestId Richiesta di contatto collegata, se presente.
 * @property {string} message Testo della notifica.
 * @property {boolean} isRead Indica se la notifica è stata letta.
 */
const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: [
        "comment",
        "report",
        "rifugio_request",
        "admin_warning",
        "SMART_MATCH",
        "contact_request",
        "shelter_announcement",
      ],
      required: true,
    },
    announcementId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Announcement",
      required: false,
      default: null,
    },
    shelterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
      default: null,
    },
    animalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Animal",
      required: false,
      default: null,
    },
    reportId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Report",
      required: false,
      default: null,
    },
    targetUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
      default: null,
    },
    commentId: {
      type: mongoose.Schema.Types.ObjectId,
      required: false,
      default: null,
    },
    contactRequestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ContactRequest",
      required: false,
      default: null,
    },
    message: { type: String, required: true },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true },
);

notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.model("Notification", notificationSchema);
