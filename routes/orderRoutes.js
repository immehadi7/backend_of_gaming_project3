import express from "express";
import {
  createOrder,
  getMyOrders,
  getOrderById,
  getAllOrders,
} from "../controllers/orderController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/", protect, createOrder);
router.get("/my", protect, getMyOrders);
router.get("/all", protect, authorize("admin", "super_admin"), getAllOrders);
router.get("/:id", protect, getOrderById);

export default router;
