const mongoose = require("mongoose");

const deadlineSchema = new mongoose.Schema(
    {
        targetSchool: {
            type: String,
            required: true,
            trim: true
        },

        targetDepartment: {
            type: String,
            trim: true,
            default: ""
        },

        program: {
            type: String,
            required: true,
            trim: true
        },

        subject: {
            type: String,
            required: true,
            trim: true
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

        deadline: {
            type: Date,
            required: true
        },

        hod: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        }
    },
    {
        timestamps: true
    }
);

// One deadline per subject/program/semester/exam-type group
deadlineSchema.index(
    {
        targetSchool: 1,
        targetDepartment: 1,
        program: 1,
        subject: 1,
        semester: 1,
        examType: 1
    },
    { unique: true }
);

module.exports = mongoose.model("Deadline", deadlineSchema);
