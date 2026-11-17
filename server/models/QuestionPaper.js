const mongoose = require("mongoose");

// A single feedback entry (a paper can be marked multiple times,
// e.g. before and after an AI regeneration)
const feedbackEntrySchema = new mongoose.Schema(
    {
        value: {
            type: String,
            enum: ["easy", "moderate", "difficult"],
            required: true
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    },
    { _id: false }
);

const questionPaperSchema = new mongoose.Schema(
    {
        teacher: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        assignment: {
            type: mongoose.Schema.Types.ObjectId,
            required: true
        },

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

        // How this paper was created
        source: {
            type: String,
            enum: ["manual", "ai"],
            default: "manual"
        },

        // For manual uploads: the uploaded file.
        // For AI-generated papers: a .txt file holding the generated content
        // is also saved here so it behaves the same as a manual upload
        // (downloadable, viewable by HOD/Exam Cell, etc).
        fileName: {
            type: String,
            required: true
        },

        filePath: {
            type: String,
            required: true
        },

        // Plain-text content of the paper. Populated for AI-generated
        // papers so it can be displayed inline and reused for AI
        // combination/regeneration without re-reading files from disk.
        content: {
            type: String,
            default: ""
        },

        // Extracted text from the materials used for AI generation,
        // kept so the teacher can "tweak"/regenerate without
        // re-uploading notes/syllabus/PYQs every time.
        sourceMaterials: {
            notesText: { type: String, default: "" },
            syllabusText: { type: String, default: "" },
            pyqText: { type: String, default: "" }
        },

        // How many times this AI paper has been generated/regenerated
        version: {
            type: Number,
            default: 1
        },

        // draft            -> teacher is still working on it
        // submitted        -> sent to HOD for review
        // in_combination   -> HOD has grouped/combined it with others
        status: {
            type: String,
            enum: ["draft", "submitted", "in_combination"],
            default: "draft"
        },

        // Most recent feedback value (kept for quick display/filtering)
        feedback: {
            type: String,
            enum: ["easy", "moderate", "difficult", ""],
            default: ""
        },

        feedbackHistory: {
            type: [feedbackEntrySchema],
            default: []
        },

        // True if this paper was force-submitted because its
        // submission deadline passed while it was still a draft.
        autoSubmitted: {
            type: Boolean,
            default: false
        },

        // Difficulty adjustment requested when generating/regenerating
        // this paper: 1 (easiest) to 100 (hardest), 50 = standard.
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
    "QuestionPaper",
    questionPaperSchema
);
