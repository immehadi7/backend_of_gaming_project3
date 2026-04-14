import express from "express";
import {
  register,
  login,
  getMe,
  employeeRegister,
  employeeLogin,
  sendEmployeeVerificationCode,
  superAdminLogin,
} from "../controllers/authController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// ── Client Auth ─────────────────────────────────────────────────────────────
router.post("/register", register);
router.post("/login", login);
router.get("/me", protect, getMe);

// ── Employee Auth ────────────────────────────────────────────────────────────
router.post("/employee/send-code", sendEmployeeVerificationCode);
router.post("/employee/register", employeeRegister);
router.post("/employee/login", employeeLogin);

// ── Super Admin Auth ─────────────────────────────────────────────────────────
router.post("/superadmin/login", superAdminLogin);

export default router;
