const express = require("express");
const router = express.Router();

const {
    listSubmittedGrouped,
    combineGroup,
    listCombinedPapers,
    approveCombinedPaper,
    requestCorrection,
    downloadSourcePaper,
    downloadCombinedPaper,
    setDeadline,
    listDeadlines,
    deleteDeadline
} = require("../controllers/hodController");

const {
    protect,
    authorizeRoles
} = require("../middleware/authMiddleware");

// Every route below is for HODs only
router.use(protect, authorizeRoles("hod"));

router.get("/submitted-papers", listSubmittedGrouped);
router.post("/combine", combineGroup);

router.get("/combined-papers", listCombinedPapers);
router.patch("/combined-papers/:id/approve", approveCombinedPaper);
router.patch("/combined-papers/:id/correction", requestCorrection);
router.get("/combined-papers/:id/download", downloadCombinedPaper);

router.get("/source-papers/:paperId/download", downloadSourcePaper);

router.get("/deadlines", listDeadlines);
router.post("/deadlines", setDeadline);
router.delete("/deadlines/:id", deleteDeadline);

module.exports = router;
