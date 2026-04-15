import express from "express";
import {
  getDashboardStats,
  getAllUsers,
  banUser,
  unbanUser,
  deleteUser,
  changeUserRole,
  getAllEmployees,
  createEmployeeAccount,
  getAllAdmins,
  createAdminAccount,
  deleteAdminAccount,
  resetAdminPassword,
  adminGetAllOrders,
  adminUpdateOrderStatus,
  adminDeleteOrder,
  adminGetContactMessages,
  getRevenueReport,
  getUserGrowthReport,
} from "../controllers/superAdminController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

// All routes require auth + super_admin role
router.use(protect, authorize("super_admin", "admin"));

// ── Dashboard ────────────────────────────────────────────────────────────────
router.get("/stats", getDashboardStats);

// ── User Management ──────────────────────────────────────────────────────────
router.get("/users", getAllUsers);
router.patch("/users/:id/ban", banUser);
router.patch("/users/:id/unban", unbanUser);
router.delete("/users/:id", authorize("super_admin"), deleteUser);
router.patch("/users/:id/role", authorize("super_admin"), changeUserRole);

// ── Employee Management ───────────────────────────────────────────────────────
router.get("/employees", getAllEmployees);
router.post("/employees", authorize("super_admin"), createEmployeeAccount);

// ── Admin Account Management (super_admin only) ───────────────────────────────
router.get("/admins", authorize("super_admin"), getAllAdmins);
router.post("/admins", authorize("super_admin"), createAdminAccount);
router.delete("/admins/:id", authorize("super_admin"), deleteAdminAccount);
router.patch("/admins/:id/reset-password", authorize("super_admin"), resetAdminPassword);

// ── Order Management ─────────────────────────────────────────────────────────
router.get("/orders", adminGetAllOrders);
router.patch("/orders/:id", adminUpdateOrderStatus);
router.delete("/orders/:id", authorize("super_admin"), adminDeleteOrder);

// ── Contact Messages ─────────────────────────────────────────────────────────
router.get("/contact-messages", adminGetContactMessages);

// ── Reports ───────────────────────────────────────────────────────────────────
router.get("/reports/revenue", getRevenueReport);
router.get("/reports/user-growth", getUserGrowthReport);

export default router;
