import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    client_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    employee_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    game: { type: String, default: "" },
    service_type: { type: String, default: "" },
    items: { type: Array, default: [] },
    total: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["pending", "confirmed", "in_progress", "completed", "cancelled"],
      default: "pending",
    },
    progress_note: { type: String, default: "" },
    urgency: {
      type: String,
      enum: ["normal", "urgent"],
      default: "normal",
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

const Order = mongoose.model("Order", orderSchema);

export default Order;
