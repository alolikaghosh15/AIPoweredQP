const fs = require("fs");
const path = require("path");
const QuestionPaper = require("../models/QuestionPaper");
const CombinedPaper = require("../models/CombinedPaper");
const Deadline = require("../models/Deadline");
const User = require("../models/User");
const aiService = require("../services/aiService");
const deadlineService = require("../services/deadlineService");

// ======================================================
// SHARED HELPER: this HOD's school/department scope
// ======================================================

const getHodScope = async (req) => {
    const hod = await User.findById(req.user.id);
    if (!hod) return null;
    return { school: hod.school || "", department: hod.department || "" };
};

// ======================================================
// LIST SUBMITTED PAPERS, GROUPED BY SUBJECT + SEMESTER + EXAM TYPE
// (scoped to this HOD's school/department)
// ======================================================

const listSubmittedGrouped = async (req, res) => {
    try {
        await deadlineService.autoSubmitExpiredDrafts();

        const scope = await getHodScope(req);
        if (!scope) return res.status(404).json({ message: "HOD account not found" });

        const papers = await QuestionPaper.find({
            status: "submitted",
            targetSchool: scope.school,
            targetDepartment: scope.department
        })
            .populate("teacher", "name email")
            .sort({ createdAt: -1 });

        const groupsMap = new Map();

        for (const paper of papers) {
            const key = [
                paper.subject,
                paper.program,
                paper.semester,
                paper.examType,
                paper.targetSchool,
                paper.targetDepartment
            ].join("::");

            if (!groupsMap.has(key)) {
                groupsMap.set(key, {
                    key,
                    subject: paper.subject,
                    program: paper.program,
                    semester: paper.semester,
                    examType: paper.examType,
                    targetSchool: paper.targetSchool,
                    targetDepartment: paper.targetDepartment,
                    papers: []
                });
            }

            groupsMap.get(key).papers.push(paper);
        }

        res.status(200).json({ groups: Array.from(groupsMap.values()) });
    } catch (error) {
        console.error("List submitted papers error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

// ======================================================
// AI COMBINATION
// ======================================================

const combineGroup = async (req, res) => {
    try {
        const { paperIds, tweakPercent } = req.body;

        if (!Array.isArray(paperIds) || paperIds.length === 0) {
            return res.status(400).json({
                message: "Please provide at least one question paper id to combine"
            });
        }

        const scope = await getHodScope(req);
        if (!scope) return res.status(404).json({ message: "HOD account not found" });

        const papers = await QuestionPaper.find({
            _id: { $in: paperIds },
            status: "submitted",
            targetSchool: scope.school,
            targetDepartment: scope.department
        }).populate("teacher", "name email");

        if (papers.length === 0) {
            return res.status(404).json({
                message: "No matching submitted question papers found in your department"
            });
        }

        const first = papers[0];
        const sameGroup = papers.every(
            (p) =>
                p.subject === first.subject &&
                p.program === first.program &&
                p.semester === first.semester &&
                p.examType === first.examType
        );

        if (!sameGroup) {
            return res.status(400).json({
                message:
                    "All selected papers must share the same subject, program, semester and exam type"
            });
        }

        // Gather text for each paper (use stored content for AI papers,
        // extract from file for manual uploads)
        const papersWithText = await Promise.all(
            papers.map(async (p) => {
                let text = p.content;
                if (!text) {
                    text = await aiService.extractTextFromFile(
                        p.filePath,
                        p.fileName
                    );
                }
                return { teacherName: p.teacher?.name || "Unknown teacher", text };
            })
        );

        const { content, aiUsed } = await aiService.combinePapers({
            subject: first.subject,
            semester: first.semester,
            examType: first.examType,
            papers: papersWithText,
            sections: first.pattern,
            tweakPercent: aiService.clampTweak(tweakPercent)
        });

        const fileName = `combined-${Date.now()}.txt`;
        const filePath = path.join("uploads", "combined", fileName);
        fs.writeFileSync(filePath, content, "utf-8");

        const combinedPaper = await CombinedPaper.create({
            subject: first.subject,
            targetSchool: first.targetSchool,
            targetDepartment: first.targetDepartment,
            program: first.program,
            semester: first.semester,
            examType: first.examType,
            sourcePapers: papers.map((p) => p._id),
            hod: req.user.id,
            generatedContent: content,
            fileName,
            filePath,
            status: "pending_review",
            pattern: first.pattern,
            tweakPercent: aiService.clampTweak(tweakPercent)
        });

        await QuestionPaper.updateMany(
            { _id: { $in: papers.map((p) => p._id) } },
            { $set: { status: "in_combination" } }
        );

        res.status(201).json({
            message: aiUsed
                ? "Papers combined successfully using AI"
                : "Papers combined using placeholder logic (ANTHROPIC_API_KEY not configured)",
            aiUsed,
            combinedPaper
        });
    } catch (error) {
        console.error("Combine papers error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

// ======================================================
// LIST COMBINED PAPERS (scoped to this HOD's department)
// ======================================================

const listCombinedPapers = async (req, res) => {
    try {
        const scope = await getHodScope(req);
        if (!scope) return res.status(404).json({ message: "HOD account not found" });

        const combinedPapers = await CombinedPaper.find({
            targetSchool: scope.school,
            targetDepartment: scope.department
        })
            .populate("sourcePapers")
            .sort({ createdAt: -1 });

        res.status(200).json({ combinedPapers });
    } catch (error) {
        console.error("List combined papers error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

// ======================================================
// APPROVE COMBINED PAPER -> sends to Exam Cell
// ======================================================

const approveCombinedPaper = async (req, res) => {
    try {
        const { id } = req.params;

        const scope = await getHodScope(req);
        if (!scope) return res.status(404).json({ message: "HOD account not found" });

        const combinedPaper = await CombinedPaper.findOne({
            _id: id,
            targetSchool: scope.school,
            targetDepartment: scope.department
        });

        if (!combinedPaper) {
            return res.status(404).json({ message: "Combined paper not found" });
        }

        if (combinedPaper.status !== "pending_review") {
            return res.status(400).json({
                message: "This combined paper has already been finalized"
            });
        }

        combinedPaper.status = "finalized";
        combinedPaper.sentToExamCell = true;
        await combinedPaper.save();

        res.status(200).json({
            message: "Combined paper approved and sent to Exam Cell",
            combinedPaper
        });
    } catch (error) {
        console.error("Approve combined paper error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

// ======================================================
// REQUEST CORRECTION -> AI retweaks the content, then goes
// back to "pending review" so the HOD can check it again
// before approving it on to the Exam Cell
// ======================================================

const requestCorrection = async (req, res) => {
    try {
        const { id } = req.params;
        const { comment, tweakPercent } = req.body;

        if (!comment || !comment.trim()) {
            return res.status(400).json({
                message: "Please describe what needs to be corrected"
            });
        }

        const scope = await getHodScope(req);
        if (!scope) return res.status(404).json({ message: "HOD account not found" });

        const combinedPaper = await CombinedPaper.findOne({
            _id: id,
            targetSchool: scope.school,
            targetDepartment: scope.department
        });

        if (!combinedPaper) {
            return res.status(404).json({ message: "Combined paper not found" });
        }

        if (combinedPaper.status !== "pending_review") {
            return res.status(400).json({
                message: "This combined paper has already been finalized"
            });
        }

        const { content, aiUsed } = await aiService.modifyCombinedPaper({
            subject: combinedPaper.subject,
            semester: combinedPaper.semester,
            examType: combinedPaper.examType,
            currentContent: combinedPaper.generatedContent,
            comment,
            sections: combinedPaper.pattern,
            tweakPercent: aiService.clampTweak(
                tweakPercent !== undefined ? tweakPercent : combinedPaper.tweakPercent
            )
        });

        // Overwrite the saved file with the corrected content
        fs.writeFileSync(path.resolve(combinedPaper.filePath), content, "utf-8");

        combinedPaper.generatedContent = content;
        combinedPaper.hodComment = comment;
        combinedPaper.wasCorrected = true;
        combinedPaper.tweakPercent = aiService.clampTweak(
            tweakPercent !== undefined ? tweakPercent : combinedPaper.tweakPercent
        );
        // Stays pending review — the HOD checks the retweaked version
        // before approving it on to the Exam Cell.
        combinedPaper.status = "pending_review";

        await combinedPaper.save();

        res.status(200).json({
            message: aiUsed
                ? "AI applied the requested correction. Please review the updated paper before approving it."
                : "Correction note saved (ANTHROPIC_API_KEY not configured, so AI could not auto-apply the change). Please review before approving.",
            aiUsed,
            combinedPaper
        });
    } catch (error) {
        console.error("Request correction error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

// ======================================================
// DOWNLOAD AN ORIGINAL TEACHER PAPER (HOD view)
// ======================================================

const downloadSourcePaper = async (req, res) => {
    try {
        const { paperId } = req.params;

        const scope = await getHodScope(req);
        if (!scope) return res.status(404).json({ message: "HOD account not found" });

        const paper = await QuestionPaper.findOne({
            _id: paperId,
            targetSchool: scope.school,
            targetDepartment: scope.department
        });

        if (!paper) {
            return res.status(404).json({ message: "Question paper not found" });
        }

        if (!fs.existsSync(paper.filePath)) {
            return res.status(404).json({ message: "File not found on server" });
        }

        res.download(path.resolve(paper.filePath), paper.fileName);
    } catch (error) {
        console.error("Download source paper error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

// ======================================================
// DOWNLOAD A COMBINED PAPER
// ======================================================

const downloadCombinedPaper = async (req, res) => {
    try {
        const { id } = req.params;

        const scope = await getHodScope(req);
        if (!scope) return res.status(404).json({ message: "HOD account not found" });

        const combinedPaper = await CombinedPaper.findOne({
            _id: id,
            targetSchool: scope.school,
            targetDepartment: scope.department
        });

        if (!combinedPaper) {
            return res.status(404).json({ message: "Combined paper not found" });
        }

        if (!fs.existsSync(combinedPaper.filePath)) {
            return res.status(404).json({ message: "File not found on server" });
        }

        res.download(path.resolve(combinedPaper.filePath), combinedPaper.fileName);
    } catch (error) {
        console.error("Download combined paper error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

// ======================================================
// DEADLINES
// ======================================================

// Sets (or updates) the submission deadline for a subject/program/
// semester/exam-type group. Automatically scoped to this HOD's
// own school/department.
const setDeadline = async (req, res) => {
    try {
        const { program, subject, semester, examType, deadline } = req.body;

        if (!program || !subject || !semester || !examType || !deadline) {
            return res.status(400).json({
                message: "Program, subject, semester, exam type and deadline are required"
            });
        }

        if (!["mid", "end"].includes(examType)) {
            return res.status(400).json({ message: "Invalid examination type" });
        }

        const parsedDeadline = new Date(deadline);
        if (Number.isNaN(parsedDeadline.getTime())) {
            return res.status(400).json({ message: "Invalid deadline date/time" });
        }

        const scope = await getHodScope(req);
        if (!scope) return res.status(404).json({ message: "HOD account not found" });

        const deadlineDoc = await Deadline.findOneAndUpdate(
            {
                targetSchool: scope.school,
                targetDepartment: scope.department,
                program,
                subject,
                semester: Number(semester),
                examType
            },
            {
                targetSchool: scope.school,
                targetDepartment: scope.department,
                program,
                subject,
                semester: Number(semester),
                examType,
                deadline: parsedDeadline,
                hod: req.user.id
            },
            { upsert: true, new: true }
        );

        res.status(200).json({
            message: "Submission deadline saved",
            deadline: deadlineDoc
        });
    } catch (error) {
        console.error("Set deadline error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

// Lists all deadlines set within this HOD's school/department
const listDeadlines = async (req, res) => {
    try {
        const scope = await getHodScope(req);
        if (!scope) return res.status(404).json({ message: "HOD account not found" });

        const deadlines = await Deadline.find({
            targetSchool: scope.school,
            targetDepartment: scope.department
        }).sort({ deadline: 1 });

        res.status(200).json({ deadlines });
    } catch (error) {
        console.error("List deadlines error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

const deleteDeadline = async (req, res) => {
    try {
        const { id } = req.params;

        const scope = await getHodScope(req);
        if (!scope) return res.status(404).json({ message: "HOD account not found" });

        const deadlineDoc = await Deadline.findOneAndDelete({
            _id: id,
            targetSchool: scope.school,
            targetDepartment: scope.department
        });

        if (!deadlineDoc) {
            return res.status(404).json({ message: "Deadline not found" });
        }

        res.status(200).json({ message: "Deadline removed" });
    } catch (error) {
        console.error("Delete deadline error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

module.exports = {
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
};
