const mongoose = require("mongoose");

const combinedPaperSchema = new mongoose.Schema(
    {
        subject: {
            type: String,
            required: true
        },

        targetSchool: {
            type: String,
            required: true
        },

        targetDepartment: {
            type: String,
            default: ""
        },

        program: {
            type: String,
            required: true
        },

        semester: {
            type: Number,
            required: true
        },

        examType: {
            type: String,
            enum: ["mid", "end"],
            required: true
        },

        // The individual teacher papers that were combined
        sourcePapers: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "QuestionPaper"
            }
        ],

        hod: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        // AI-produced combined paper text (common questions merged,
        // quality-analysis notes included)
        generatedContent: {
            type: String,
            required: true
        },

        // Saved to disk as a .txt so it can be downloaded the same
        // way as any other question paper
        fileName: {
            type: String,
            required: true
        },

        filePath: {
            type: String,
            required: true
        },

        // pending_review     -> waiting for HOD to approve/request correction
        // finalized          -> approved (with or without an AI correction
        //                       pass) and sent on to the Exam Cell
        status: {
            type: String,
            enum: ["pending_review", "finalized"],
            default: "pending_review"
        },

        wasCorrected: {
            type: Boolean,
            default: false
        },

        hodComment: {
            type: String,
            default: ""
        },

        sentToExamCell: {
            type: Boolean,
            default: false
        },

        // Difficulty adjustment applied on the most recent
        // combination/correction pass: 1 (easiest) to 100 (hardest), 50 = standard.
                // Teacher-defined groups/sections, e.g. Group A: 5 x 1 mark.
        // Empty = use the default pattern for the exam type.
        pattern: {
            type: [
                {
                    _id: false,
                    label: { type: String, trim: true },
                    count: { type: Number, min: 1 },
                    marks: { type: Number, min: 1 }
                }
            ],
            default: []
        },

        tweakPercent: {
            type: Number,
            default: 50,
            min: 1,
            max: 100
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model(
    "CombinedPaper",
    combinedPaperSchema
);
