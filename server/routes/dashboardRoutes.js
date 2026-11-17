const express = require("express");
const {
    protect,
    authorizeRoles
} = require("../middleware/authMiddleware");
const router = express.Router();
// Teacher Dashboard
router.get(
    "/teacher",
    protect,
    authorizeRoles("teacher"),
    (req, res) => {
        res.json({
            message: "Welcome to Teacher Dashboard",
            user: req.user
        });
    }
);
// HOD Dashboard
router.get(
    "/hod",
    protect,
    authorizeRoles("hod"),
    (req, res) => {
        res.json({
            message: "Welcome to HOD Dashboard",
            user: req.user
        });
    }
);
// Exam Cell Dashboard
router.get(
    "/exam-cell",
    protect,
    authorizeRoles("exam_cell"),
    (req, res) => {
        res.json({
            message: "Welcome to Exam Cell Dashboard",
            user: req.user
        });
    }
);
module.exports = router;