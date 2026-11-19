const mongoose = require("mongoose");


// ======================================================
// TEACHING ASSIGNMENT
// ======================================================

const teachingAssignmentSchema = new mongoose.Schema(
    {
        // Where the class/course belongs
        targetSchool: {
            type: String,
            required: true,
            trim: true
        },

        // Can be CSE, ECE, Common, etc.
        // Optional because some subjects may be common
        // across an entire program/school.
        targetDepartment: {
            type: String,
            trim: true,
            default: ""
        },

        // Example: B.Tech, MBA, M.Tech, BBA, B.Sc
        program: {
            type: String,
            required: true,
            trim: true
        },

        // Example: Mathematics, DBMS, Marketing
        subject: {
            type: String,
            required: true,
            trim: true
        },

        // Semester always starts from 1.
        // No artificial maximum.
        semester: {
            type: Number,
            required: true,
            min: 1
        }
    },
    {
        _id: true
    }
);


// ======================================================
// USER
// ======================================================

const userSchema = new mongoose.Schema(
    {
        // -------------------------
        // Personal Information
        // -------------------------

        name: {
            type: String,
            required: true,
            trim: true
        },

        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true
        },

        resetTokenHash: { type: String, default: "" },
        resetTokenExpires: { type: Date },

        password: {
            type: String,
            required: true
        },


        // -------------------------
        // System Role
        // -------------------------

        role: {
            type: String,
            enum: ["teacher", "hod", "exam_cell"],
            required: true
        },


        // -------------------------
        // Teacher's OWN Organization
        // -------------------------

        school: {
            type: String,
            trim: true,
            default: ""
        },

        department: {
            type: String,
            trim: true,
            default: ""
        },


        // -------------------------
        // What the teacher teaches
        // -------------------------

        teachingAssignments: {
            type: [teachingAssignmentSchema],
            default: []
        }
    },
    {
        timestamps: true
    }
);


module.exports = mongoose.model("User", userSchema);