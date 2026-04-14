import express from "express";
import {
  createContactSubmission,
  getContactSubmissions,
  updateContactSubmissionStatus,
  deleteContactSubmission,
} from "../controllers/contactController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/", createContactSubmission);
router.get("/", protect, authorize("admin", "super_admin"), getContactSubmissions);
router.patch("/:id/status", protect, authorize("admin", "super_admin"), updateContactSubmissionStatus);
router.delete("/:id", protect, authorize("admin", "super_admin"), deleteContactSubmission);

export default router;
