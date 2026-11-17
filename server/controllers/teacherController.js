const User = require("../models/User");

// ======================================================
// GET TEACHING ASSIGNMENTS
// ======================================================

const getAssignments = async (req, res) => {

    try {

        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({
                message: "Teacher not found"
            });
        }

        res.status(200).json({
            assignments: user.teachingAssignments || []
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            message: "Server error"
        });
    }
};


// ======================================================
// ADD TEACHING ASSIGNMENT
// ======================================================

const addAssignment = async (req, res) => {

    try {

        const {
            targetSchool,
            targetDepartment,
            program,
            subject,
            semester
        } = req.body;


        // Basic validation
        if (
            !targetSchool ||
            !program ||
            !subject ||
            !semester
        ) {

            return res.status(400).json({
                message:
                    "Target school, program, subject and semester are required"
            });
        }


        const user = await User.findById(req.user.id);

        if (!user) {

            return res.status(404).json({
                message: "Teacher not found"
            });
        }


        // Check for duplicate assignment
        const alreadyExists =
            user.teachingAssignments.some(
                (assignment) =>
                    assignment.subject &&
                    assignment.subject.toLowerCase() ===
                    subject.toLowerCase() &&
                    assignment.program &&
                    assignment.program.toLowerCase() ===
                    program.toLowerCase() &&
                    Number(assignment.semester) ===
                    Number(semester) &&
                    assignment.targetSchool &&
                    assignment.targetSchool.toLowerCase() ===
                    targetSchool.toLowerCase()
            );


        if (alreadyExists) {

            return res.status(400).json({
                message:
                    "This teaching assignment already exists"
            });
        }


        // Add assignment
        user.teachingAssignments.push({

            targetSchool,

            targetDepartment:
                targetDepartment || "",

            program,

            subject,

            semester: Number(semester)

        });


        await user.save();


        res.status(201).json({

            message:
                "Teaching assignment added successfully",

            assignments:
                user.teachingAssignments

        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            message: "Server error"
        });
    }
};


// ======================================================
// EDIT TEACHING ASSIGNMENT
// ======================================================

const editAssignment = async (req, res) => {

    try {

        const { assignmentId } = req.params;

        const {
            targetSchool,
            targetDepartment,
            program,
            subject,
            semester
        } = req.body;

        if (
            !targetSchool ||
            !program ||
            !subject ||
            !semester
        ) {
            return res.status(400).json({
                message:
                    "Target school, program, subject and semester are required"
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

        // Check no OTHER assignment already matches these new values
        const duplicate = user.teachingAssignments.some(
            (existing) =>
                existing._id.toString() !== assignmentId &&
                existing.subject.toLowerCase() === subject.toLowerCase() &&
                existing.program.toLowerCase() === program.toLowerCase() &&
                Number(existing.semester) === Number(semester) &&
                existing.targetSchool.toLowerCase() === targetSchool.toLowerCase()
        );

        if (duplicate) {
            return res.status(400).json({
                message: "Another teaching assignment already has these details"
            });
        }

        assignment.targetSchool = targetSchool;
        assignment.targetDepartment = targetDepartment || "";
        assignment.program = program;
        assignment.subject = subject;
        assignment.semester = Number(semester);

        await user.save();

        res.status(200).json({
            message: "Teaching assignment updated successfully",
            assignments: user.teachingAssignments
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            message: "Server error"
        });
    }
};


// ======================================================
// DELETE TEACHING ASSIGNMENT
// ======================================================

const deleteAssignment = async (req, res) => {

    try {

        const { assignmentId } = req.params;


        const user = await User.findById(req.user.id);

        if (!user) {

            return res.status(404).json({
                message: "Teacher not found"
            });
        }


        // Find the assignment belonging to this teacher
        const assignment =
            user.teachingAssignments.id(
                assignmentId
            );


        if (!assignment) {

            return res.status(404).json({
                message:
                    "Teaching assignment not found"
            });
        }


        // Delete ONLY this assignment
        assignment.deleteOne();


        await user.save();


        res.status(200).json({

            message:
                "Teaching assignment deleted successfully",

            assignments:
                user.teachingAssignments

        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            message: "Server error"
        });
    }
};


// ======================================================
// EXPORT CONTROLLERS
// ======================================================

module.exports = {

    getAssignments,

    addAssignment,

    editAssignment,

    deleteAssignment

};