const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const registerUser = async (req, res) => {
    try {
        const {
            name,
            email,
            password,
            role,
            school,
            department
        } = req.body;
        // Check if all fields are provided
        if (!name || !email || !password || !role) {
            return res.status(400).json({
                message: "All fields are required"
            });
        }
        // HOD and Exam Cell accounts are scoped to a school/department,
        // so those fields are required for those two roles.
        if ((role === "hod" || role === "exam_cell") && !school) {
            return res.status(400).json({
                message: "School is required for this role"
            });
        }
        // Check whether user already exists
        const existingUser = await User.findOne({
            email
        });
        if (existingUser) {
            return res.status(400).json({
                message: "User already exists"
            });
        }
        // Hash password
        const hashedPassword =
            await bcrypt.hash(password, 10);
        // Create user
        const user = await User.create({
            name,
            email,
            password: hashedPassword,
            role,
            school: role === "teacher" ? "" : (school || ""),
            department: role === "teacher" ? "" : (department || "")
        });
        res.status(201).json({
            message: "User registered successfully",
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        res.status(500).json({
            message: "Server error",
            error: error.message
        });
    }
};
const loginUser = async (req, res) => {
    try {
        const {
            email,
            password
        } = req.body;
        // Find user
        const user = await User.findOne({
            email
        });
        if (!user) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }
        // Compare password
        const passwordCorrect =
            await bcrypt.compare(
                password,
                user.password
            );
        if (!passwordCorrect) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }
        // Create JWT token
        const token = jwt.sign(
            {
                id: user._id,
                role: user.role
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "1d"
            }
        );
        res.json({
            message: "Login successful",
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        res.status(500).json({
            message: "Server error",
            error: error.message

        });
    }
};

// ---------- Forgot / reset password ----------
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";

const sendResetEmail = async (to, link) => {
    // Sends via SMTP if configured; otherwise prints the link in the server console (dev mode).
    if (process.env.SMTP_HOST) {
        try {
            const nodemailer = require("nodemailer");
            const transporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST,
                port: Number(process.env.SMTP_PORT) || 587,
                auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
            });
            await transporter.sendMail({
                from: process.env.SMTP_FROM || process.env.SMTP_USER,
                to,
                subject: "Reset your password - Question Paper Office",
                text: `Use this link to reset your password (valid for 15 minutes):
${link}

If you did not request this, ignore this email.`
            });
            return;
        } catch (e) {
            console.error("Email send failed:", e.message);
        }
    }
    console.log(`
[DEV] Password reset link for ${to}:
${link}
`);
};

const forgotPassword = async (req, res) => {
    try {
        const email = String(req.body.email || "").toLowerCase().trim();
        const user = email ? await User.findOne({ email }) : null;
        if (user) {
            const token = crypto.randomBytes(32).toString("hex");
            user.resetTokenHash = crypto.createHash("sha256").update(token).digest("hex");
            user.resetTokenExpires = new Date(Date.now() + 15 * 60 * 1000);
            await user.save();
            const link = `${CLIENT_URL}/reset-password/${token}`;
            // Test mode (no SMTP configured, e.g. fake test emails): return the link directly.
            if (!process.env.SMTP_HOST) {
                return res.json({
                    message: "Reset link generated (test mode).",
                    resetLink: link
                });
            }
            await sendResetEmail(user.email, link);
        } else if (!process.env.SMTP_HOST) {
            return res.status(404).json({ message: "No account found with this email" });
        }
        // Same reply either way so emails can't be probed.
        res.json({ message: "If that email is registered, a reset link has been sent." });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

const resetPassword = async (req, res) => {
    try {
        const { token, password } = req.body;
        if (!token || !password || String(password).length < 6) {
            return res.status(400).json({ message: "Password must be at least 6 characters" });
        }
        const hash = crypto.createHash("sha256").update(String(token)).digest("hex");
        const user = await User.findOne({
            resetTokenHash: hash,
            resetTokenExpires: { $gt: new Date() }
        });
        if (!user) {
            return res.status(400).json({ message: "Reset link is invalid or has expired" });
        }
        user.password = await bcrypt.hash(password, 10);
        user.resetTokenHash = "";
        user.resetTokenExpires = undefined;
        await user.save();
        res.json({ message: "Password updated. You can log in now." });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

module.exports = {
    registerUser,
    loginUser,
    forgotPassword,
    resetPassword
};