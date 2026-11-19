# What was added / changed

Your existing auth, teaching-assignment, and manual-upload code was kept as-is.
Everything below was missing compared to your workflow diagram and has been built:

## Backend

* **Register page** — was missing entirely on the frontend (backend already supported it).
* **`QuestionPaper` model** — added `source` (manual/ai), `content`, `sourceMaterials`,
`version`, `feedbackHistory`, and a real status flow: `draft → submitted → in\\\_combination`.
* **`CombinedPaper` model** (new) — represents the HOD-level combined paper per
subject/semester/exam-type group, with `pending\\\_review → finalized` status.
* **`server/services/aiService.js`** (new) — talks to the Anthropic API to:

  * generate a question paper from uploaded notes/syllabus/PYQ files
  * combine multiple teachers' papers into one, flagging common questions + a quality analysis
  * apply an HOD's requested correction to a combined paper
  * Also extracts text from `.pdf` / `.docx` / `.txt` uploads (`pdf-parse` / `mammoth`).
  * **Works without an API key too** — falls back to a clearly-labeled placeholder
generator so the whole flow is testable without paying for AI calls. Add
`ANTHROPIC\\\_API\\\_KEY` to `server/.env` to turn on real AI generation.
* **Teacher routes/controllers** — added: list my question papers, AI generation,
regenerate ("AI tweaking"), feedback (easy/moderate/difficult), submit-to-HOD,
and download.
* **HOD routes/controllers** (new) — list submitted papers grouped by
subject/program/semester/exam type, AI-combine selected papers, list combined
papers, approve, request AI-assisted correction, download originals and combined papers.
* **Exam Cell routes/controllers** (new) — list finalized papers sent by HOD, download.
* `server/config/db.js` now reads `MONGO\\\_URI` from `.env` (falls back to the old
hardcoded local URI if not set).

## Frontend

* **`client/src/pages/Register.jsx`** (new) + wired into `App.jsx`, linked from Login.
* **`client/src/api.js`** (new) — small fetch helper (auth headers, JSON/FormData
requests, authenticated file downloads) used by all three dashboards.
* **`TeacherDashboard.jsx`** — added a live "My Question Papers" list, wired the
AI-generation file inputs and button to the real backend, added feedback
buttons, a "Regenerate (AI Tweaking)" button, "Submit to HOD" button, and
download.
* **`HODDashboard.jsx`** — fully rebuilt: shows submitted papers grouped by
subject/semester, lets the HOD pick papers and combine them with AI, shows
combined papers pending review with Approve / Request Correction actions,
and a finalized list.
* **`ExamCellDashboard.jsx`** — fully rebuilt: lists and downloads final
approved papers sent by the HOD.

## Running it

1. `cd server \\\&\\\& npm install \\\&\\\& npm run dev` (make sure MongoDB is running locally,
or set `MONGO\\\_URI` in `server/.env` to a remote instance).
2. Optionally add your `ANTHROPIC\\\_API\\\_KEY` in `server/.env` to enable real AI
generation/combination — without it, the app still runs end-to-end using a
placeholder generator.
3. `cd client \\\&\\\& npm install \\\&\\\& npm run dev`.
4. Register a teacher, an HOD, and an exam-cell account from `/register`, then
walk through: teacher creates an assignment → uploads/generates a paper →
gives feedback → submits to HOD → HOD combines multiple teachers' papers →
approves or requests a correction → Exam Cell sees the final paper.

## Round 3 additions

* **Submission deadlines.** HOD sets a deadline per subject/program/semester/exam-type
(new `Deadline` model + `deadlineService.js`). Before the deadline, teachers can freely
create, edit, regenerate, and submit a question paper for that exam. Once the deadline
passes:

  * Teachers can no longer create a new paper or edit an existing draft for that exam
(enforced server-side, not just hidden in the UI).
  * Any paper still sitting in `draft` for that group is **automatically force-submitted**
to the HOD as-is (flagged `autoSubmitted: true`, shown in both dashboards).
  * This sweep runs lazily (no cron needed) — it's checked whenever a teacher loads their
papers or takes an action, and whenever the HOD loads submitted papers.
  * HOD dashboard has a new "Submission deadlines" panel to set/view/remove deadlines.
  * Teacher dashboard shows the relevant deadline in the question paper workspace and
disables the manual-upload/AI-generation forms once it's passed.
* **File restrictions tightened.** Manual uploads and AI-generation materials (notes/
syllabus/PYQ) are now PDF or DOCX only, capped at 2 MB (was 10 MB, PDF/DOC/DOCX/TXT).
Enforced in `uploadMiddleware.js`; a clear "File is too large" message is returned
instead of multer's generic one.
* **Department/school scoping.** Reused the `school`/`department` fields already on the
`User` model (previously unused). HOD and Exam Cell now provide these at registration,
and `hodController` / `examCellController` filter every query by the logged-in account's
own `school`/`department`, so different departments no longer see each other's papers.
**Caveat:** matching is an exact string match against what teachers type into their
teaching assignments — there's no shared dropdown/master list, so spelling and
capitalization need to line up (e.g. "Engineering" vs "engineering" won't match).
A small note was added on the Register page to flag this.
* **Edit assignment.** Teachers can now edit a teaching assignment in place (`PATCH /api/teacher/assignments/:assignmentId`) instead of deleting and re-adding it. The
Teacher dashboard has an inline "Edit" button per assignment.
* **HOD correction loop.** Requesting a correction on a combined paper no longer sends
it straight to Exam Cell — the AI retweaks it and it goes back into "pending review"
so the HOD checks the updated version again before approving. This can repeat as many
times as needed; only Approve sends it on to Exam Cell.

## Round 4 additions

* **Fixed exam pattern.** Every AI-generated, combined, or corrected paper now follows
an exact section structure (in `aiService.js`, `PAPER\\\_PATTERNS`):

  * Mid Semester: **Part A** — 5 questions × 1 mark; **Part B** — 5 questions × 3 marks
(20 marks total).
  * End Semester: **Part A** — 5 questions × 2 marks; **Part B** — 5 questions × 4 marks;
**Part C** — 2 questions × 10 marks (50 marks total).
  * Change these in `PAPER\\\_PATTERNS` at the top of `aiService.js` if your actual
university pattern differs — it's centralized in one place.
* **Standard difficulty + question-type mix.** Every generation/combination/correction
prompt now explicitly asks for a balanced paper (not too easy, not too hard) with a
deliberate mix of direct (recall), conceptual, and brainstorming/indirect questions,
rather than leaving difficulty and style to chance.
* **Tweak percentage.** A single -50% (easier) to +50% (harder) slider, available to:

  * **Teachers**, when generating or regenerating an AI paper.
  * **HODs**, when combining a group and when requesting a correction.
The value is stored on the paper/combined paper (`tweakPercent` field) and shown
wherever that paper appears, including on the Exam Cell's final view, so it's always
clear how a paper's difficulty was adjusted from standard.
* **HOD correction loop** (added slightly earlier, listed here for completeness):
requesting a correction retweaks the paper via AI and sends it back to "pending
review" rather than straight to Exam Cell, so the HOD checks the updated version
again before approving.

## Notes / things you may want to revisit

* `node\\\_modules` and `package-lock.json` were removed from both `server/` and
`client/` since dependencies changed (`pdf-parse`, `mammoth` added to the
server) — run `npm install` in each folder after unzipping.
* HOD/Exam Cell dashboards currently show data across the whole system rather
than scoped to a specific department — add a `department`/`school` filter
to the HOD/Exam Cell queries if you need multi-department isolation.
* Legacy `.doc` (old binary Word format) text extraction isn't supported by
any lightweight pure-JS library — `.pdf`, `.docx`, and `.txt` are fully
supported for AI generation/combination.

