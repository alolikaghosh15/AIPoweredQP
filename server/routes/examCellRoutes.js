const express = require("express");
const router = express.Router();

const {
    listFinalPapers,
    downloadFinalPaper
} = require("../controllers/examCellController");

const {
    protect,
    authorizeRoles
} = require("../middleware/authMiddleware");

// Every route below is for Exam Cell staff only
router.use(protect, authorizeRoles("exam_cell"));

router.get("/final-papers", listFinalPapers);
router.get("/final-papers/:id/download", downloadFinalPaper);

module.exports = router;
