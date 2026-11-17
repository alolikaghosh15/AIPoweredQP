const fs = require("fs");
const path = require("path");
const CombinedPaper = require("../models/CombinedPaper");
const User = require("../models/User");

// ======================================================
// LIST FINAL QUESTION PAPERS (sent by HOD, scoped to this
// exam cell account's own school/department)
// ======================================================

const listFinalPapers = async (req, res) => {
    try {
        const examCellUser = await User.findById(req.user.id);
        if (!examCellUser) {
            return res.status(404).json({ message: "Exam Cell account not found" });
        }

        const finalPapers = await CombinedPaper.find({
            sentToExamCell: true,
            targetSchool: examCellUser.school || "",
            targetDepartment: examCellUser.department || ""
        })
            .populate("hod", "name email")
            .populate("sourcePapers")
            .sort({ updatedAt: -1 });

        res.status(200).json({ finalPapers });
    } catch (error) {
        console.error("List final papers error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

// ======================================================
// DOWNLOAD A FINAL QUESTION PAPER
// ======================================================

const downloadFinalPaper = async (req, res) => {
    try {
        const { id } = req.params;

        const examCellUser = await User.findById(req.user.id);
        if (!examCellUser) {
            return res.status(404).json({ message: "Exam Cell account not found" });
        }

        const finalPaper = await CombinedPaper.findOne({
            _id: id,
            sentToExamCell: true,
            targetSchool: examCellUser.school || "",
            targetDepartment: examCellUser.department || ""
        });

        if (!finalPaper) {
            return res.status(404).json({ message: "Final question paper not found" });
        }

        if (!fs.existsSync(finalPaper.filePath)) {
            return res.status(404).json({ message: "File not found on server" });
        }

        res.download(path.resolve(finalPaper.filePath), finalPaper.fileName);
    } catch (error) {
        console.error("Download final paper error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

module.exports = {
    listFinalPapers,
    downloadFinalPaper
};
