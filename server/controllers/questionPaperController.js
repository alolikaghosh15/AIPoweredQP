const fs = require("fs");
const path = require("path");
const User = require("../models/User");
const QuestionPaper = require("../models/QuestionPaper");
const aiService = require("../services/aiService");
const deadlineService = require("../services/deadlineService");

// ======================================================
// SHARED HELPER
// ======================================================

// Looks up the assignment's deadline (if any) and returns it,
// after first sweeping any other expired deadlines so the whole
// system's statuses stay consistent.
const getGroupDeadline = async (assignment, examType) => {
    await deadlineService.autoSubmitExpiredDrafts();

    return deadlineService.findDeadline({
        targetSchool: assignment.targetSchool,
        targetDepartment: assignment.targetDepartment || "",
        program: assignment.program,
        subject: assignment.subject,
        semester: assignment.semester,
        examType
    });
};

// ======================================================
// GET DEADLINE FOR AN ASSIGNMENT + EXAM TYPE
// ======================================================

const getDeadlineForAssignment = async (req, res) => {
    try {
        const { assignmentId, examType } = req.query;

        if (!assignmentId || !examType) {
            return res.status(400).json({
                message: "assignmentId and examType are required"
            });
        }

        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: "Teacher not found" });

        const assignment = user.teachingAssignments.id(assignmentId);
        if (!assignment) {
            return res.status(404).json({ message: "Teaching assignment not found" });
        }

        const deadline = await deadlineService.findDeadline({
            targetSchool: assignment.targetSchool,
            targetDepartment: assignment.targetDepartment || "",
            program: assignment.program,
            subject: assignment.subject,
            semester: assignment.semester,
            examType
        });

        res.status(200).json({
            deadline: deadline
                ? { deadline: deadline.deadline, isPast: deadlineService.isPast(deadline) }
                : null
        });
    } catch (error) {
        console.error("Get deadline error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

// ======================================================
// UPLOAD MANUAL QUESTION PAPER
// ======================================================

const uploadQuestionPaper = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                message: "Please upload a question paper"
            });
        }

        const { assignmentId, examType } = req.body;

        if (!assignmentId || !examType) {
            return res.status(400).json({
                message: "Assignment and examination type are required"
            });
        }

        if (!["mid", "end"].includes(examType)) {
            return res.status(400).json({
                message: "Invalid examination type"
            });
        }

        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({
                message: "Teacher not found"
            });
        }

        const assignment = user.teachingAssignments.id(assignmentId);

        if (!assignment) {
            return res.status(404).json({
                message: "Teaching assignment not found"
            });
        }

        const deadline = await getGroupDeadline(assignment, examType);

        if (deadlineService.isPast(deadline)) {
            return res.status(403).json({
                message:
                    "The submission deadline for this exam has passed. You can no longer create a question paper for it."
            });
        }

        const questionPaper = await QuestionPaper.create({
            teacher: user._id,
            assignment: assignment._id,
            subject: assignment.subject,
            targetSchool: assignment.targetSchool,
            targetDepartment: assignment.targetDepartment || "",
            program: assignment.program,
            semester: assignment.semester,
            examType,
            source: "manual",
            fileName: req.file.originalname,
            filePath: req.file.path,
            status: "draft",
            feedback: ""
        });

        res.status(201).json({
            message: "Question paper uploaded successfully",
            questionPaper
        });
    } catch (error) {
        console.error("Upload question paper error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

// ======================================================
// LIST MY QUESTION PAPERS (for the logged-in teacher)
// ======================================================

const listMyQuestionPapers = async (req, res) => {
    try {
        await deadlineService.autoSubmitExpiredDrafts();

        const papers = await QuestionPaper.find({
            teacher: req.user.id
        }).sort({ createdAt: -1 });

        res.status(200).json({ questionPapers: papers });
    } catch (error) {
        console.error("List question papers error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

// ======================================================
// AI GENERATION
// ======================================================

// Validates teacher-defined groups. Returns { pattern } or { error }.
const parsePattern = (raw) => {
    if (!raw) return { pattern: [] };
    let arr = raw;
    try {
        if (typeof raw === "string") arr = JSON.parse(raw);
    } catch (e) {
        return { error: "Invalid group/marking scheme data" };
    }
    if (!Array.isArray(arr)) return { error: "Invalid group/marking scheme data" };
    if (arr.length > 10) return { error: "A maximum of 10 groups is allowed" };
    const pattern = [];
    for (let i = 0; i < arr.length; i++) {
        const count = Number(arr[i].count);
        const marks = Number(arr[i].marks);
        if (!Number.isInteger(count) || count < 1 || count > 50 ||
            !Number.isFinite(marks) || marks <= 0 || marks > 100) {
            return { error: `Group ${i + 1}: enter a valid number of questions and marks` };
        }
        pattern.push({
            label: String(arr[i].label || `Group ${String.fromCharCode(65 + i)}`).trim().slice(0, 30),
            count,
            marks
        });
    }
    return { pattern };
};

const generateQuestionPaper = async (req, res) => {
    try {
        const { assignmentId, examType, tweakPercent } = req.body;
        const parsed = parsePattern(req.body.pattern);
        if (parsed.error) {
            return res.status(400).json({ message: parsed.error });
        }

        if (!assignmentId || !examType) {
            return res.status(400).json({
                message: "Assignment and examination type are required"
            });
        }

        if (!["mid", "end"].includes(examType)) {
            return res.status(400).json({
                message: "Invalid examination type"
            });
        }

        const files = req.files || {};

        if (!files.notes && !files.syllabus && !files.pyq) {
            return res.status(400).json({
                message:
                    "Please upload at least one of: notes, syllabus, previous year questions"
            });
        }

        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({ message: "Teacher not found" });
        }

        const assignment = user.teachingAssignments.id(assignmentId);

        if (!assignment) {
            return res.status(404).json({
                message: "Teaching assignment not found"
            });
        }

        const deadline = await getGroupDeadline(assignment, examType);

        if (deadlineService.isPast(deadline)) {
            return res.status(403).json({
                message:
                    "The submission deadline for this exam has passed. You can no longer create a question paper for it."
            });
        }

        const extractIfPresent = async (field) => {
            const file = files[field]?.[0];
            if (!file) return "";
            return aiService.extractTextFromFile(file.path, file.originalname);
        };

        const [notesText, syllabusText, pyqText] = await Promise.all([
            extractIfPresent("notes"),
            extractIfPresent("syllabus"),
            extractIfPresent("pyq")
        ]);

        const { content, aiUsed } = await aiService.generateQuestionPaper({
            subject: assignment.subject,
            program: assignment.program,
            semester: assignment.semester,
            examType,
            notesText,
            syllabusText,
            pyqText,
            sections: parsed.pattern,
            tweakPercent: aiService.clampTweak(tweakPercent)
        });

        // Save generated content to a file so it behaves like any
        // other question paper (downloadable, viewable, etc.)
        const fileName = `ai-generated-${Date.now()}.txt`;
        const filePath = path.join("uploads", "generated", fileName);
        fs.writeFileSync(filePath, content, "utf-8");

        const questionPaper = await QuestionPaper.create({
            teacher: user._id,
            assignment: assignment._id,
            subject: assignment.subject,
            targetSchool: assignment.targetSchool,
            targetDepartment: assignment.targetDepartment || "",
            program: assignment.program,
            semester: assignment.semester,
            examType,
            source: "ai",
            fileName,
            filePath,
            content,
            sourceMaterials: { notesText, syllabusText, pyqText },
            version: 1,
            status: "draft",
            feedback: "",
            pattern: parsed.pattern,
            tweakPercent: aiService.clampTweak(tweakPercent)
        });

        res.status(201).json({
            message: aiUsed
                ? "Question paper generated successfully using AI"
                : "Question paper generated using placeholder logic (ANTHROPIC_API_KEY not configured on server)",
            aiUsed,
            questionPaper
        });
    } catch (error) {
        console.error("Generate question paper error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

// ======================================================
// REGENERATE (AI TWEAKING) BASED ON FEEDBACK
// ======================================================

const regenerateQuestionPaper = async (req, res) => {
    try {
        const { id } = req.params;
        const { feedbackNote, tweakPercent } = req.body;

        await deadlineService.autoSubmitExpiredDrafts();

        const paper = await QuestionPaper.findOne({
            _id: id,
            teacher: req.user.id
        });

        if (!paper) {
            return res.status(404).json({ message: "Question paper not found" });
        }

        if (paper.source !== "ai") {
            return res.status(400).json({
                message: "Only AI-generated papers can be regenerated"
            });
        }

        if (paper.autoSubmitted) {
            return res.status(403).json({
                message:
                    "The submission deadline has passed; this paper was automatically submitted to the HOD and can no longer be edited."
            });
        }

        if (paper.status !== "draft") {
            return res.status(400).json({
                message: "Only draft papers can be regenerated"
            });
        }

        const note =
            feedbackNote ||
            (paper.feedback
                ? `Teachers marked the previous draft as "${paper.feedback}". Adjust the difficulty accordingly.`
                : "");

        // Keep the paper's existing tweak unless a new one is explicitly sent
        const effectiveTweak = aiService.clampTweak(
            tweakPercent !== undefined ? tweakPercent : paper.tweakPercent
        );

        const { content, aiUsed } = await aiService.generateQuestionPaper({
            subject: paper.subject,
            program: paper.program,
            semester: paper.semester,
            examType: paper.examType,
            notesText: paper.sourceMaterials?.notesText || "",
            syllabusText: paper.sourceMaterials?.syllabusText || "",
            pyqText: paper.sourceMaterials?.pyqText || "",
            feedbackNote: note,
            sections: paper.pattern,
            tweakPercent: effectiveTweak
        });

        const fileName = `ai-generated-${Date.now()}.txt`;
        const filePath = path.join("uploads", "generated", fileName);
        fs.writeFileSync(filePath, content, "utf-8");

        // Remove the previous generated file to avoid clutter
        try {
            if (fs.existsSync(paper.filePath)) {
                fs.unlinkSync(paper.filePath);
            }
        } catch (cleanupError) {
            console.warn("Could not remove old generated file:", cleanupError.message);
        }

        paper.fileName = fileName;
        paper.filePath = filePath;
        paper.content = content;
        paper.version += 1;
        paper.tweakPercent = effectiveTweak;

        await paper.save();

        res.status(200).json({
            message: aiUsed
                ? "Question paper regenerated using AI"
                : "Question paper regenerated using placeholder logic (ANTHROPIC_API_KEY not configured)",
            aiUsed,
            questionPaper: paper
        });
    } catch (error) {
        console.error("Regenerate question paper error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

// ======================================================
// FEEDBACK (Easy / Moderate / Difficult)
// ======================================================

const giveFeedback = async (req, res) => {
    try {
        const { id } = req.params;
        const { feedback } = req.body;

        if (!["easy", "moderate", "difficult"].includes(feedback)) {
            return res.status(400).json({ message: "Invalid feedback value" });
        }

        await deadlineService.autoSubmitExpiredDrafts();

        const paper = await QuestionPaper.findOne({
            _id: id,
            teacher: req.user.id
        });

        if (!paper) {
            return res.status(404).json({ message: "Question paper not found" });
        }

        if (paper.autoSubmitted) {
            return res.status(403).json({
                message:
                    "The submission deadline has passed; this paper was automatically submitted to the HOD and can no longer be edited."
            });
        }

        if (paper.status !== "draft") {
            return res.status(400).json({
                message: "This question paper has already been submitted and can no longer be edited"
            });
        }

        paper.feedback = feedback;
        paper.feedbackHistory.push({ value: feedback });

        await paper.save();

        res.status(200).json({
            message: "Feedback recorded",
            questionPaper: paper
        });
    } catch (error) {
        console.error("Feedback error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

// ======================================================
// SUBMIT TO HOD
// ======================================================

const submitToHOD = async (req, res) => {
    try {
        const { id } = req.params;

        await deadlineService.autoSubmitExpiredDrafts();

        const paper = await QuestionPaper.findOne({
            _id: id,
            teacher: req.user.id
        });

        if (!paper) {
            return res.status(404).json({ message: "Question paper not found" });
        }

        if (paper.autoSubmitted) {
            return res.status(200).json({
                message:
                    "The submission deadline already passed, so this paper was automatically submitted to the HOD.",
                questionPaper: paper
            });
        }

        if (paper.status !== "draft") {
            return res.status(400).json({
                message: "Only draft papers can be submitted to HOD"
            });
        }

        paper.status = "submitted";
        await paper.save();

        res.status(200).json({
            message: "Question paper submitted to HOD",
            questionPaper: paper
        });
    } catch (error) {
        console.error("Submit to HOD error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

// ======================================================
// DOWNLOAD / VIEW A QUESTION PAPER FILE
// (teacher owner, or HOD/exam cell via their own routes)
// ======================================================

const downloadOwnQuestionPaper = async (req, res) => {
    try {
        const { id } = req.params;

        const paper = await QuestionPaper.findOne({
            _id: id,
            teacher: req.user.id
        });

        if (!paper) {
            return res.status(404).json({ message: "Question paper not found" });
        }

        if (!fs.existsSync(paper.filePath)) {
            return res.status(404).json({ message: "File not found on server" });
        }

        res.download(path.resolve(paper.filePath), paper.fileName);
    } catch (error) {
        console.error("Download question paper error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

module.exports = {
    uploadQuestionPaper,
    listMyQuestionPapers,
    generateQuestionPaper,
    regenerateQuestionPaper,
    giveFeedback,
    submitToHOD,
    downloadOwnQuestionPaper,
    getDeadlineForAssignment
};
