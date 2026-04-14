import express from "express";
import {
  getAvailableOrders,
  getMyEmployeeOrders,
  acceptOrder,
  updateOrderStatus,
  getEmployeeStats,
  toggleOnlineStatus,
  createServicePost,
  getMyServicePosts,
  updateServicePost,
  deleteServicePost,
  getAllActiveServicePosts,
} from "../controllers/employeeController.js";
import { protect } from "../middleware/authMiddleware.js";
import { authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

// ── Public: service posts for homepage ──────────────────────────────────────
router.get("/service-posts/public", getAllActiveServicePosts);

// ── Protected: employee only ─────────────────────────────────────────────────
router.get("/orders", protect, authorize("employee"), getAvailableOrders);
router.get("/my-orders", protect, authorize("employee"), getMyEmployeeOrders);
router.patch("/orders/:id/accept", protect, authorize("employee"), acceptOrder);
router.patch("/orders/:id/status", protect, authorize("employee"), updateOrderStatus);
router.get("/stats", protect, authorize("employee"), getEmployeeStats);
router.patch("/toggle-online", protect, authorize("employee"), toggleOnlineStatus);

// ── Service Posts (employee creates, public reads) ───────────────────────────
router.post("/service-posts", protect, authorize("employee"), createServicePost);
router.get("/service-posts/mine", protect, authorize("employee"), getMyServicePosts);
router.patch("/service-posts/:id", protect, authorize("employee"), updateServicePost);
router.delete("/service-posts/:id", protect, authorize("employee"), deleteServicePost);

export default router;
