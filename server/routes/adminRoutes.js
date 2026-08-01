const express = require("express");
const router = express.Router();
const { listAdmins, createAdmin, disableAdmin } = require("../controllers/adminController");
const { protect, superAdminOnly, requirePasswordChange } = require("../middleware/auth");

router.use(protect, requirePasswordChange, superAdminOnly);

router.get("/", listAdmins);
router.post("/", createAdmin);
router.put("/:id/disable", disableAdmin);

module.exports = router;
