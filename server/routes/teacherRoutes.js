const express = require("express");
const router = express.Router();

const {
    getAssignments,
    addAssignment,
    editAssignment,
    deleteAssignment
} = require("../controllers/teacherController");

const {
    uploadQuestionPaper,
    listMyQuestionPapers,
    generateQuestionPaper,
    regenerateQuestionPaper,
    giveFeedback,
    submitToHOD,
    downloadOwnQuestionPaper,
    getDeadlineForAssignment
} = require("../controllers/questionPaperController");

const {
    protect,
    authorizeRoles
} = require("../middleware/authMiddleware");

const upload = require("../middleware/uploadMiddleware");

// Every route below is for teachers only
router.use(protect, authorizeRoles("teacher"));

// Turns a multer error into a friendly, specific message
const describeUploadError = (error) => {
    if (error.code === "LIMIT_FILE_SIZE") {
        return "File is too large. Maximum allowed size is 2 MB.";
    }
    return error.message || "File upload failed";
};

// ======================================================
// TEACHING ASSIGNMENTS
// ======================================================

router.get("/assignments", getAssignments);
router.post("/assignments", addAssignment);
router.patch("/assignments/:assignmentId", editAssignment);
router.delete("/assignments/:assignmentId", deleteAssignment);

// ======================================================
// SUBMISSION DEADLINE
// ======================================================

router.get("/deadline", getDeadlineForAssignment);

// ======================================================
// QUESTION PAPERS
// ======================================================

router.get("/question-papers", listMyQuestionPapers);

router.post(
    "/question-papers",
    (req, res, next) => {
        upload.single("questionPaper")(req, res, (error) => {
            if (error) {
                console.error("UPLOAD ERROR:", error);
                return res.status(400).json({ message: describeUploadError(error) });
            }
            next();
        });
    },
    uploadQuestionPaper
);

router.post(
    "/question-papers/generate",
    (req, res, next) => {
        upload.uploadMaterials(req, res, (error) => {
            if (error) {
                console.error("UPLOAD ERROR:", error);
                return res.status(400).json({ message: describeUploadError(error) });
            }
            next();
        });
    },
    generateQuestionPaper
);

router.post("/question-papers/:id/regenerate", regenerateQuestionPaper);
router.patch("/question-papers/:id/feedback", giveFeedback);
router.patch("/question-papers/:id/submit", submitToHOD);
router.get("/question-papers/:id/download", downloadOwnQuestionPaper);

module.exports = router;
