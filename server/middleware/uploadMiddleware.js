const multer = require("multer");
const path = require("path");

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB
const ALLOWED_EXTENSIONS = [".pdf", ".docx"];

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "uploads/question-papers/");
    },

    filename: (req, file, cb) => {
        const uniqueName =
            Date.now() +
            "-" +
            Math.round(Math.random() * 1E9) +
            path.extname(file.originalname);

        cb(null, uniqueName);
    }
});

const fileFilter = (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();

    if (ALLOWED_EXTENSIONS.includes(extension)) {
        cb(null, true);
    } else {
        cb(new Error("Only PDF and DOCX files are allowed"));
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: MAX_FILE_SIZE
    }
});

// ======================================================
// UPLOAD FOR AI GENERATION MATERIALS
// (notes / syllabus / previous year questions)
// ======================================================

const materialsStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "uploads/question-papers/");
    },
    filename: (req, file, cb) => {
        const uniqueName =
            Date.now() +
            "-" +
            Math.round(Math.random() * 1E9) +
            path.extname(file.originalname);
        cb(null, uniqueName);
    }
});

const materialsFileFilter = (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();

    if (ALLOWED_EXTENSIONS.includes(extension)) {
        cb(null, true);
    } else {
        cb(new Error("Only PDF and DOCX files are allowed"));
    }
};

const uploadMaterials = multer({
    storage: materialsStorage,
    fileFilter: materialsFileFilter,
    limits: {
        fileSize: MAX_FILE_SIZE
    }
}).fields([
    { name: "notes", maxCount: 1 },
    { name: "syllabus", maxCount: 1 },
    { name: "pyq", maxCount: 1 }
]);

module.exports = upload;
module.exports.uploadMaterials = uploadMaterials;
module.exports.MAX_FILE_SIZE = MAX_FILE_SIZE;
