const Deadline = require("../models/Deadline");
const QuestionPaper = require("../models/QuestionPaper");

// Finds the deadline (if any) set for a specific
// subject/program/semester/exam-type group.
const findDeadline = ({
    targetSchool,
    targetDepartment,
    program,
    subject,
    semester,
    examType
}) => {
    return Deadline.findOne({
        targetSchool,
        targetDepartment: targetDepartment || "",
        program,
        subject,
        semester,
        examType
    });
};

const isPast = (deadlineDoc) => {
    if (!deadlineDoc) return false;
    return new Date() >= new Date(deadlineDoc.deadline);
};

// Finds every deadline that has already passed and force-submits
// any question papers still sitting in "draft" under that group,
// exactly as-is, so teachers can no longer edit them.
const autoSubmitExpiredDrafts = async () => {
    const now = new Date();
    const expiredDeadlines = await Deadline.find({ deadline: { $lte: now } });

    for (const deadline of expiredDeadlines) {
        await QuestionPaper.updateMany(
            {
                status: "draft",
                targetSchool: deadline.targetSchool,
                targetDepartment: deadline.targetDepartment || "",
                program: deadline.program,
                subject: deadline.subject,
                semester: deadline.semester,
                examType: deadline.examType
            },
            {
                $set: { status: "submitted", autoSubmitted: true }
            }
        );
    }
};

module.exports = {
    findDeadline,
    isPast,
    autoSubmitExpiredDrafts
};
