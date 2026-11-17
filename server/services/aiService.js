const fs = require("fs");
const path = require("path");

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";
const ANTHROPIC_MODEL =
    process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

// ======================================================
// TEXT EXTRACTION
// ======================================================
// Pulls plain text out of an uploaded .pdf / .docx file.
// Uses pdf-parse / mammoth if they're installed; falls back to a
// friendly placeholder instead of crashing if a file can't be parsed.

const extractTextFromFile = async (filePath, originalName) => {
    const extension = path.extname(originalName).toLowerCase();

    try {
        if (extension === ".txt") {
            return fs.readFileSync(filePath, "utf-8");
        }

        if (extension === ".pdf") {
            const pdfParse = require("pdf-parse");
            const buffer = fs.readFileSync(filePath);
            const result = await pdfParse(buffer);
            return result.text || "";
        }

        if (extension === ".docx") {
            const mammoth = require("mammoth");
            const result = await mammoth.extractRawText({
                path: filePath
            });
            return result.value || "";
        }

        return `[Could not automatically extract text from "${originalName}". ` +
            `Please re-upload as PDF or DOCX for best results.]`;
    } catch (error) {
        console.error("Text extraction failed:", error.message);
        return `[Text extraction failed for "${originalName}": ${error.message}]`;
    }
};

// ======================================================
// LOW-LEVEL ANTHROPIC CALL
// ======================================================

const callClaude = async (prompt, maxTokens = 3000) => {
    if (!ANTHROPIC_API_KEY) {
        return null; // signals "no AI configured" to callers
    }

    const response = await fetch(
        "https://api.anthropic.com/v1/messages",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01"
            },
            body: JSON.stringify({
                model: ANTHROPIC_MODEL,
                max_tokens: maxTokens,
                messages: [{ role: "user", content: prompt }]
            })
        }
    );

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
            `Anthropic API error (${response.status}): ${errorText}`
        );
    }

    const data = await response.json();

    return data.content
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("\n")
        .trim();
};

const truncate = (text, maxChars = 6000) => {
    if (!text) return "(none provided)";
    return text.length > maxChars
        ? text.slice(0, maxChars) + "\n...[truncated]"
        : text;
};

// ======================================================
// TWEAK PERCENTAGE
// ======================================================
// A single knob teachers and HODs can use to nudge difficulty away
// from the standard baseline. 1 = easiest, 50 = standard,
// 100 = hardest.

const clampTweak = (value) => {
    const n = Number(value);
    // 0 / missing (old data) -> standard (50)
    if (Number.isNaN(n) || n === 0) return 50;
    return Math.max(1, Math.min(100, Math.round(n)));
};

const describeTweak = (tweakPercent) => {
    const t = clampTweak(tweakPercent);

    if (t === 50) {
        return "Difficulty level: 50/100 (standard) — keep it at the standard baseline described above.";
    }

    if (t > 50) {
        return `Difficulty level: ${t}/100 (50 = standard, 100 = hardest). Make the paper noticeably more difficult than ` +
            `the standard baseline in proportion to this level (deeper conceptual reasoning, tougher application, harder ` +
            `brainstorming questions) — but keep the exact same section structure and marks distribution.`;
    }

    return `Difficulty level: ${t}/100 (50 = standard, 1 = easiest). Make the paper noticeably easier than ` +
        `the standard baseline in proportion to this level (more direct recall, simpler application) — but keep the exact ` +
        `same section structure and marks distribution.`;
};

// ======================================================
// PAPER PATTERN (Part A / Part B / Part C)
// ======================================================
// This is the fixed exam pattern every generated, combined, or
// corrected paper must follow, unless it's changed here.

const PAPER_PATTERNS = {
    mid: [
        { label: "Part A", count: 5, marks: 1, style: "short, direct recall or definition questions" },
        { label: "Part B", count: 5, marks: 3, style: "a mix of conceptual and short application questions" }
    ],
    end: [
        { label: "Part A", count: 5, marks: 2, style: "short, direct recall or definition questions" },
        { label: "Part B", count: 5, marks: 4, style: "conceptual and application-based questions" },
        { label: "Part C", count: 2, marks: 10, style: "brainstorming, indirect, or analytical/essay-type questions requiring deeper reasoning" }
    ]
};

// customSections (optional) = teacher-defined groups: [{ label, count, marks }]
const getPaperPattern = (examType, customSections) => {
    const sections =
        Array.isArray(customSections) && customSections.length
            ? customSections.map((c) => ({
                label: c.label,
                count: c.count,
                marks: c.marks,
                style: "questions suited to the marks allotted"
            }))
            : PAPER_PATTERNS[examType] || PAPER_PATTERNS.mid;
    const totalMarks = sections.reduce((sum, s) => sum + s.count * s.marks, 0);
    return { sections, totalMarks };
};

const describePattern = ({ sections, totalMarks }) => {
    const lines = sections.map(
        (s) =>
            `- ${s.label}: exactly ${s.count} questions, ${s.marks} mark${s.marks > 1 ? "s" : ""} each ` +
            `(${s.count * s.marks} marks total) — ${s.style}.`
    );
    return `${lines.join("\n")}\nTotal marks for the paper: ${totalMarks}.`;
};

// ======================================================
// SHARED DIFFICULTY / QUESTION-MIX GUIDANCE
// ======================================================

const STANDARD_PATTERN_GUIDANCE = `
Target difficulty: STANDARD overall — neither too easy nor too difficult.
Avoid trivial one-word-recall questions, and avoid questions that go beyond
what a diligent student could answer from the provided notes/syllabus.

Required mix of question types, blended naturally across the paper
(do not label each question with its type — just write the questions):
- Direct questions: straightforward recall of a definition, fact, or formula.
- Conceptual questions: test understanding of "why" or "how", relationships
  between ideas, or comparisons between concepts.
- Analytical / brainstorming (indirect) questions: apply a concept to a new
  situation, ask the student to evaluate or justify an approach, or require
  reasoning through a problem rather than recalling an answer directly.

Aim for roughly an even three-way split across the whole paper, weighted
naturally toward each section's stated style above.`;

// ======================================================
// QUESTION PAPER GENERATION
// ======================================================

const buildGenerationPrompt = ({ sections,
    subject,
    program,
    semester,
    examType,
    notesText,
    syllabusText,
    pyqText,
    feedbackNote,
    tweakPercent
}) => {
    const examLabel =
        examType === "mid" ? "Mid Semester Examination" : "End Semester Examination";
    const duration = examType === "mid" ? "1.5 hours" : "3 hours";
    const pattern = getPaperPattern(examType, sections);

    return `You are an experienced university examiner. Draft a well-structured ${examLabel} question paper.

Subject: ${subject}
Program: ${program}
Semester: ${semester}
Duration: ${duration}

The paper MUST follow this exact pattern (do not add, remove, resize, or reorder sections):
${describePattern(pattern)}
${STANDARD_PATTERN_GUIDANCE}

${describeTweak(tweakPercent)}

Course notes provided by the teacher:
"""
${truncate(notesText)}
"""

Syllabus provided:
"""
${truncate(syllabusText)}
"""

Previous year questions provided (for style/difficulty reference, do NOT copy verbatim):
"""
${truncate(pyqText)}
"""
${feedbackNote ? `\nImportant instruction from the teacher based on feedback on a previous draft: ${feedbackNote}\n` : ""}
Instructions:
- Base every question strictly on the notes and syllabus content above.
- Label each section clearly with its name, and number every question consecutively within it.
- Match the exact question count and marks per question specified above for each section.
- Do not fabricate topics that are not supported by the provided materials.
- Output ONLY the final question paper text, formatted plainly and ready to print. Do not include any preamble, explanation, or markdown code fences.`;
};

const fallbackGeneratedPaper = ({ sections, subject, program, semester, examType, tweakPercent }) => {
    const examLabel =
        examType === "mid" ? "MID SEMESTER EXAMINATION" : "END SEMESTER EXAMINATION";
    const duration = examType === "mid" ? "1.5 Hours" : "3 Hours";
    const pattern = getPaperPattern(examType, sections);
    const tweak = clampTweak(tweakPercent);

    let body = "";
    let questionNumber = 1;

    for (const section of pattern.sections) {
        body += `\n${section.label} (${section.count} x ${section.marks} = ${section.count * section.marks} marks) — ${section.style}\n`;
        for (let i = 0; i < section.count; i++) {
            body += `${questionNumber}. [Placeholder question on a topic from the uploaded syllabus/notes for ${subject}.]\n`;
            questionNumber++;
        }
    }

    return `${examLabel}
Subject: ${subject}
Program: ${program} | Semester: ${semester}
Total Marks: ${pattern.totalMarks} | Duration: ${duration}

[NOTE: ANTHROPIC_API_KEY is not configured on the server, so this is a
placeholder paper generated without AI, though it does follow your
configured section pattern. Add ANTHROPIC_API_KEY to server/.env to
enable real AI-generated questions from the uploaded materials.]
Difficulty level requested: ${tweak}/100 (50 = standard) — not applied in placeholder mode.
${body}`;
};

const generateQuestionPaper = async (options) => {
    try {
        const prompt = buildGenerationPrompt(options);
        const aiText = await callClaude(prompt, 3000);

        if (aiText) {
            return { content: aiText, aiUsed: true };
        }
    } catch (error) {
        console.error("AI generation failed, using fallback:", error.message);
    }

    return { content: fallbackGeneratedPaper(options), aiUsed: false };
};

// ======================================================
// COMBINING MULTIPLE TEACHERS' PAPERS (HOD step)
// ======================================================

const buildCombinationPrompt = ({ sections, subject, semester, examType, papers, tweakPercent }) => {
    const pattern = getPaperPattern(examType, sections);

    const papersBlock = papers
        .map(
            (p, i) =>
                `--- Paper ${i + 1} (submitted by ${p.teacherName}) ---\n${truncate(
                    p.text,
                    4000
                )}`
        )
        .join("\n\n");

    return `You are the Head of Department reviewing multiple teachers' draft question papers for the SAME subject and semester before finalizing one combined paper.

Subject: ${subject}
Semester: ${semester}
Exam type: ${examType === "mid" ? "Mid Semester" : "End Semester"}

Here are the individual drafts submitted by different teachers:

${papersBlock}

The final combined paper MUST follow this exact pattern (do not add, remove, resize, or reorder sections):
${describePattern(pattern)}
${STANDARD_PATTERN_GUIDANCE}

${describeTweak(tweakPercent)}

Task:
1. Identify questions that are common or overlapping across the drafts and merge them into single, well-worded questions (avoid duplication).
2. Where drafts differ, pick the clearer, fairer, and more appropriately-leveled version so the paper lands at standard difficulty rather than too easy or too hard.
3. Fill each section to exactly the required number of questions, drawing from the best material across all drafts — write a new question in the same spirit if there isn't enough source material for a slot.
4. After the final paper, add a short "Quality Analysis" section (a few bullet points) noting: overlap found between teachers' drafts, any gaps in syllabus coverage, and overall difficulty balance.

Output format (plain text, no markdown fences):
FINAL COMBINED QUESTION PAPER
<the combined paper, following the exact pattern above>

QUALITY ANALYSIS
<bullet points>`;
};

const fallbackCombinedPaper = ({ sections, subject, semester, examType, papers, tweakPercent }) => {
    const pattern = getPaperPattern(examType, sections);
    const tweak = clampTweak(tweakPercent);

    const merged = papers
        .map((p, i) => `From ${p.teacherName} (Paper ${i + 1}):\n${truncate(p.text, 1500)}`)
        .join("\n\n");

    return `FINAL COMBINED QUESTION PAPER
Subject: ${subject} | Semester: ${semester} | Exam: ${examType === "mid" ? "Mid Semester" : "End Semester"}

[NOTE: ANTHROPIC_API_KEY is not configured, so drafts were concatenated
without AI-based deduplication, pattern enforcement, or quality analysis.
Add ANTHROPIC_API_KEY to server/.env to enable true AI combination.]

Expected pattern for this exam type once AI combination is enabled:
${describePattern(pattern)}
Difficulty level requested: ${tweak}/100 (50 = standard) — not applied in placeholder mode.

${merged}

QUALITY ANALYSIS
- AI combination unavailable; papers shown above are the raw, unmerged drafts from ${papers.length} teacher(s).`;
};

const combinePapers = async (options) => {
    try {
        const prompt = buildCombinationPrompt(options);
        const aiText = await callClaude(prompt, 4000);

        if (aiText) {
            return { content: aiText, aiUsed: true };
        }
    } catch (error) {
        console.error("AI combination failed, using fallback:", error.message);
    }

    return { content: fallbackCombinedPaper(options), aiUsed: false };
};

// ======================================================
// AI QUESTION MODIFICATION (HOD requests a correction)
// ======================================================

const buildModificationPrompt = ({ sections, subject, semester, examType, currentContent, comment, tweakPercent }) => {
    const pattern = getPaperPattern(examType, sections);

    return `You previously produced a combined question paper. The Head of Department has requested a correction.

Subject: ${subject}
Semester: ${semester}
Exam type: ${examType === "mid" ? "Mid Semester" : "End Semester"}

Current combined paper:
"""
${truncate(currentContent, 5000)}
"""

HOD's correction request:
"""
${comment}
"""

${describeTweak(tweakPercent)}

Revise the paper to address the HOD's request, while still following this exact pattern (do not add, remove, resize, or reorder sections):
${describePattern(pattern)}

Output ONLY the corrected final paper text (same format as before, including a brief "QUALITY ANALYSIS" section at the end describing what was changed), with no preamble or markdown fences.`;
};

const modifyCombinedPaper = async (options) => {
    try {
        const prompt = buildModificationPrompt(options);
        const aiText = await callClaude(prompt, 4000);

        if (aiText) {
            return { content: aiText, aiUsed: true };
        }
    } catch (error) {
        console.error("AI modification failed, using fallback:", error.message);
    }

    return {
        content:
            `${options.currentContent}\n\n[HOD CORRECTION REQUESTED — AI modification unavailable ` +
            `because ANTHROPIC_API_KEY is not configured]\nHOD note: ${options.comment}`,
        aiUsed: false
    };
};

module.exports = {
    extractTextFromFile,
    generateQuestionPaper,
    combinePapers,
    modifyCombinedPaper,
    clampTweak,
    getPaperPattern,
    isAiConfigured: () => Boolean(ANTHROPIC_API_KEY)
};
