import { useEffect, useState } from "react";
import { apiRequest, downloadFile, getUser } from "../api";
import Topbar from "../components/Topbar";
import StatusTag from "../components/StatusTag";
import { tweakLabel } from "../utils/tweak";

const STATUS_LABELS = {
    draft: "Draft",
    submitted: "Submitted to HOD",
    in_combination: "Combined by HOD"
};

function TeacherDashboard() {
    const user = getUser();

    const [assignments, setAssignments] = useState([]);
    const [targetSchool, setTargetSchool] = useState("");
    const [targetDepartment, setTargetDepartment] = useState("");
    const [program, setProgram] = useState("");
    const [newSubject, setNewSubject] = useState("");
    const [newSemester, setNewSemester] = useState("");

    // Inline "edit assignment" state
    const [editingId, setEditingId] = useState(null);
    const [editDraft, setEditDraft] = useState(null);

    const [selectedAssignment, setSelectedAssignment] = useState(null);
    const [examType, setExamType] = useState("");
    const [questionPaperFile, setQuestionPaperFile] = useState(null);
    const [typedPaper, setTypedPaper] = useState("");

    const [notesFile, setNotesFile] = useState(null);
    const [syllabusFile, setSyllabusFile] = useState(null);
    const [pyqFile, setPyqFile] = useState(null);
    const [tweakPercent, setTweakPercent] = useState(50);
    const [groups, setGroups] = useState([]);
    const [generating, setGenerating] = useState(false);

    const [questionPapers, setQuestionPapers] = useState([]);
    const [loadingPapers, setLoadingPapers] = useState(true);

    // Per-paper tweak value used when regenerating an AI draft
    const [regenerateTweaks, setRegenerateTweaks] = useState({});

    // Deadline for the currently selected assignment + exam type
    const [deadlineInfo, setDeadlineInfo] = useState(null);

    const loadAssignments = async () => {
        try {
            const data = await apiRequest("/teacher/assignments");
            setAssignments(data.assignments || []);
        } catch (error) {
            alert(error.message);
        }
    };

    const loadQuestionPapers = async () => {
        setLoadingPapers(true);
        try {
            const data = await apiRequest("/teacher/question-papers");
            setQuestionPapers(data.questionPapers || []);
        } catch (error) {
            alert(error.message);
        } finally {
            setLoadingPapers(false);
        }
    };

    useEffect(() => {
        loadAssignments();
        loadQuestionPapers();
    }, []);

    // Look up the deadline whenever the workspace's assignment/exam changes
    useEffect(() => {
        if (!selectedAssignment || !examType) {
            setDeadlineInfo(null);
            return;
        }

        (async () => {
            try {
                const data = await apiRequest(
                    `/teacher/deadline?assignmentId=${selectedAssignment._id}&examType=${examType}`
                );
                setDeadlineInfo(data.deadline);
            } catch (error) {
                setDeadlineInfo(null);
            }
        })();
    }, [selectedAssignment, examType]);

    const deadlinePassed = deadlineInfo?.isPast === true;

    // ==================================================
    // ADD / EDIT / DELETE ASSIGNMENT
    // ==================================================

    const addAssignment = async () => {
        if (!targetSchool || !program || !newSubject || !newSemester) {
            alert("Please enter school, program, subject and semester");
            return;
        }
        try {
            const data = await apiRequest("/teacher/assignments", {
                method: "POST",
                body: {
                    targetSchool,
                    targetDepartment,
                    program,
                    subject: newSubject,
                    semester: Number(newSemester)
                }
            });
            setAssignments(data.assignments || []);
            setTargetSchool("");
            setTargetDepartment("");
            setProgram("");
            setNewSubject("");
            setNewSemester("");
        } catch (error) {
            alert(error.message);
        }
    };

    const startEditing = (assignment) => {
        setEditingId(assignment._id);
        setEditDraft({
            targetSchool: assignment.targetSchool,
            targetDepartment: assignment.targetDepartment || "",
            program: assignment.program,
            subject: assignment.subject,
            semester: assignment.semester
        });
    };

    const cancelEditing = () => {
        setEditingId(null);
        setEditDraft(null);
    };

    const saveEditing = async (assignmentId) => {
        if (!editDraft.targetSchool || !editDraft.program || !editDraft.subject || !editDraft.semester) {
            alert("Please fill in school, program, subject and semester");
            return;
        }
        try {
            const data = await apiRequest(`/teacher/assignments/${assignmentId}`, {
                method: "PATCH",
                body: {
                    ...editDraft,
                    semester: Number(editDraft.semester)
                }
            });
            setAssignments(data.assignments || []);
            cancelEditing();
        } catch (error) {
            alert(error.message);
        }
    };

    const deleteAssignment = async (assignmentId) => {
        if (!window.confirm("Delete this teaching assignment?")) return;
        try {
            const data = await apiRequest(`/teacher/assignments/${assignmentId}`, {
                method: "DELETE"
            });
            setAssignments(data.assignments || []);
            if (selectedAssignment?._id === assignmentId) {
                setSelectedAssignment(null);
                setExamType("");
                setQuestionPaperFile(null);
            }
        } catch (error) {
            alert(error.message);
        }
    };

    // ==================================================
    // MANUAL UPLOAD
    // ==================================================

    const uploadQuestionPaper = async () => {
        if (!selectedAssignment) return alert("Please select a teaching assignment.");
        if (!examType) return alert("Please select an examination.");
        if (!questionPaperFile && !typedPaper.trim()) {
            return alert("Upload a PDF/DOCX or type the question paper.");
        }
        if (questionPaperFile && typedPaper.trim()) {
            return alert("Please use either a file upload or typed questions, not both.");
        }
        try {
            const formData = new FormData();
            formData.append("assignmentId", selectedAssignment._id);
            formData.append("examType", examType);
            if (questionPaperFile) formData.append("questionPaper", questionPaperFile);
            else formData.append("typedText", typedPaper);
            await apiRequest("/teacher/question-papers", {
                method: "POST",
                body: formData,
                isFormData: true
            });
            setQuestionPaperFile(null);
            setTypedPaper("");
            loadQuestionPapers();
        } catch (error) {
            alert(error.message);
        }
    };

    // ==================================================
    // AI GENERATION
    // ==================================================

    const generateWithAI = async () => {
        if (!selectedAssignment) return alert("Please select a teaching assignment.");
        if (!examType) return alert("Please select an examination.");
        if (!notesFile && !syllabusFile && !pyqFile) {
            return alert("Please upload at least one of: notes, syllabus, previous year questions.");
        }
        for (let i = 0; i < groups.length; i++) {
            if (!(Number(groups[i].count) >= 1) || !(Number(groups[i].marks) > 0)) {
                return alert(`Group ${String.fromCharCode(65 + i)}: enter valid questions and marks.`);
            }
        }
        setGenerating(true);
        try {
            const formData = new FormData();
            formData.append("assignmentId", selectedAssignment._id);
            formData.append("examType", examType);
            if (notesFile) formData.append("notes", notesFile);
            if (syllabusFile) formData.append("syllabus", syllabusFile);
            if (pyqFile) formData.append("pyq", pyqFile);
            formData.append("tweakPercent", tweakPercent);
            if (groups.length) {
                formData.append(
                    "pattern",
                    JSON.stringify(
                        groups.map((g, i) => ({
                            label: `Group ${String.fromCharCode(65 + i)}`,
                            count: Number(g.count),
                            marks: Number(g.marks)
                        }))
                    )
                );
            }
            const data = await apiRequest("/teacher/question-papers/generate", {
                method: "POST",
                body: formData,
                isFormData: true
            });
            alert(data.message);
            setNotesFile(null);
            setSyllabusFile(null);
            setPyqFile(null);
            setTweakPercent(50);
            setGroups([]);
            loadQuestionPapers();
        } catch (error) {
            alert(error.message);
        } finally {
            setGenerating(false);
        }
    };

    // ==================================================
    // FEEDBACK / REGENERATE / SUBMIT / DOWNLOAD
    // ==================================================

    const giveFeedback = async (paperId, feedback) => {
        try {
            await apiRequest(`/teacher/question-papers/${paperId}/feedback`, {
                method: "PATCH",
                body: { feedback }
            });
            loadQuestionPapers();
        } catch (error) {
            alert(error.message);
        }
    };

    const regeneratePaper = async (paperId) => {
        try {
            const data = await apiRequest(`/teacher/question-papers/${paperId}/regenerate`, {
                method: "POST",
                body: { tweakPercent: regenerateTweaks[paperId] }
            });
            alert(data.message);
            loadQuestionPapers();
        } catch (error) {
            alert(error.message);
        }
    };

    const submitToHOD = async (paperId) => {
        if (!window.confirm("Submit this question paper to the HOD?")) return;
        try {
            const data = await apiRequest(`/teacher/question-papers/${paperId}/submit`, {
                method: "PATCH"
            });
            alert(data.message);
            loadQuestionPapers();
        } catch (error) {
            alert(error.message);
        }
    };

    const downloadPaper = async (paper) => {
        try {
            await downloadFile(`/teacher/question-papers/${paper._id}/download`, paper.fileName);
        } catch (error) {
            alert(error.message);
        }
    };

    // ==================================================
    // RENDER
    // ==================================================

    return (
        <div className="app-shell">
            <Topbar user={user} />

            <div className="main-column">
                <div className="page-intro">
                    <h1>Teacher dashboard</h1>
                    <p className="subline">
                        {user?.name}, manage your teaching assignments and question papers here.
                    </p>
                </div>

                <div className="panel">
                    <h2>Personal information</h2>
                    <p className="meta-line"><strong>Name:</strong> {user?.name || "N/A"}</p>
                    <p className="meta-line"><strong>Email:</strong> {user?.email || "N/A"}</p>
                    <p className="meta-line"><strong>Role:</strong> Teacher</p>
                </div>

                <div className="panel">
                    <h2>My teaching assignments</h2>

                    {assignments.length === 0 && (
                        <p className="empty-note">No teaching assignments added yet.</p>
                    )}

                    {assignments.map((assignment) => (
                        <div className="record" key={assignment._id}>
                            {editingId === assignment._id ? (
                                <>
                                    <div className="field-row">
                                        <div className="field">
                                            <label>Target school / faculty</label>
                                            <input
                                                type="text"
                                                value={editDraft.targetSchool}
                                                onChange={(e) =>
                                                    setEditDraft((d) => ({ ...d, targetSchool: e.target.value }))
                                                }
                                            />
                                        </div>
                                        <div className="field">
                                            <label>Target department</label>
                                            <input
                                                type="text"
                                                value={editDraft.targetDepartment}
                                                onChange={(e) =>
                                                    setEditDraft((d) => ({ ...d, targetDepartment: e.target.value }))
                                                }
                                            />
                                        </div>
                                    </div>
                                    <div className="field-row">
                                        <div className="field">
                                            <label>Program</label>
                                            <input
                                                type="text"
                                                value={editDraft.program}
                                                onChange={(e) =>
                                                    setEditDraft((d) => ({ ...d, program: e.target.value }))
                                                }
                                            />
                                        </div>
                                        <div className="field">
                                            <label>Semester</label>
                                            <input
                                                type="number"
                                                min="1"
                                                value={editDraft.semester}
                                                onChange={(e) =>
                                                    setEditDraft((d) => ({ ...d, semester: e.target.value }))
                                                }
                                            />
                                        </div>
                                    </div>
                                    <div className="field">
                                        <label>Subject</label>
                                        <input
                                            type="text"
                                            value={editDraft.subject}
                                            onChange={(e) =>
                                                setEditDraft((d) => ({ ...d, subject: e.target.value }))
                                            }
                                        />
                                    </div>

                                    <div className="action-row">
                                        <button className="primary" onClick={() => saveEditing(assignment._id)}>
                                            Save changes
                                        </button>
                                        <button onClick={cancelEditing}>Cancel</button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="record-title-row">
                                        <h3>{assignment.subject}</h3>
                                    </div>
                                    <p className="meta-line">
                                        {assignment.targetSchool}
                                        {assignment.targetDepartment ? `, ${assignment.targetDepartment}` : ""}
                                    </p>
                                    <p className="meta-line">
                                        {assignment.program}, Semester {assignment.semester}
                                    </p>

                                    <div className="action-row">
                                        <button
                                            className="primary"
                                            onClick={() => {
                                                setSelectedAssignment(assignment);
                                                setExamType("");
                                                setQuestionPaperFile(null);
                                                setNotesFile(null);
                                                setSyllabusFile(null);
                                                setPyqFile(null);
                                            }}
                                        >
                                            Create question paper
                                        </button>
                                        <button onClick={() => startEditing(assignment)}>Edit</button>
                                        <button className="danger" onClick={() => deleteAssignment(assignment._id)}>
                                            Delete assignment
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    ))}
                </div>

                <div className="panel">
                    <h2>Add teaching assignment</h2>

                    <div className="field-row">
                        <div className="field">
                            <label>Target school / faculty</label>
                            <input
                                type="text"
                                value={targetSchool}
                                onChange={(e) => setTargetSchool(e.target.value)}
                                placeholder="Engineering"
                            />
                        </div>
                        <div className="field">
                            <label>Target department</label>
                            <input
                                type="text"
                                value={targetDepartment}
                                onChange={(e) => setTargetDepartment(e.target.value)}
                                placeholder="CSE"
                            />
                        </div>
                    </div>

                    <div className="field-row">
                        <div className="field">
                            <label>Program</label>
                            <input
                                type="text"
                                value={program}
                                onChange={(e) => setProgram(e.target.value)}
                                placeholder="B.Tech"
                            />
                        </div>
                        <div className="field">
                            <label>Semester</label>
                            <input
                                type="number"
                                min="1"
                                value={newSemester}
                                onChange={(e) => setNewSemester(e.target.value)}
                                placeholder="1"
                            />
                        </div>
                    </div>

                    <div className="field">
                        <label>Subject</label>
                        <input
                            type="text"
                            value={newSubject}
                            onChange={(e) => setNewSubject(e.target.value)}
                            placeholder="Mathematics"
                        />
                    </div>

                    <button className="primary" onClick={addAssignment}>Add assignment</button>
                </div>

                {selectedAssignment && (
                    <div className="panel workspace-enter">
                        <h2>Question paper workspace</h2>
                        <h3>{selectedAssignment.subject}</h3>
                        <p className="meta-line">
                            {selectedAssignment.targetSchool}
                            {selectedAssignment.targetDepartment ? `, ${selectedAssignment.targetDepartment}` : ""},{" "}
                            {selectedAssignment.program}, Semester {selectedAssignment.semester}
                        </p>

                        <div className="field" style={{ marginTop: "16px" }}>
                            <label>Examination</label>
                            <select value={examType} onChange={(e) => setExamType(e.target.value)}>
                                <option value="">Select exam</option>
                                <option value="mid">Mid Semester</option>
                                <option value="end">End Semester</option>
                            </select>
                        </div>

                        {examType && deadlineInfo && (
                            <p
                                className="meta-line"
                                style={{ color: deadlinePassed ? "var(--rust)" : "var(--ink-soft)" }}
                            >
                                <strong>Submission deadline:</strong>{" "}
                                {new Date(deadlineInfo.deadline).toLocaleString()}
                                {deadlinePassed && " — this deadline has passed"}
                            </p>
                        )}

                        {deadlinePassed ? (
                            <p className="empty-note" style={{ color: "var(--rust)" }}>
                                The deadline for this exam has passed. Any draft question paper for it
                                has been automatically submitted to the HOD, and you can no longer
                                create or edit one here.
                            </p>
                        ) : (
                            <>
                                <h3 style={{ marginTop: "22px" }}>Manual question paper</h3>
                                <p className="meta-line">Upload a PDF or DOCX (up to 2 MB), or type the questions below.</p>
                                <div className="field">
                                    <input
                                        type="file"
                                        accept=".pdf,.docx"
                                        onChange={(e) => setQuestionPaperFile(e.target.files[0])}
                                    />
                                </div>
                                <div className="field">
                                    <label>Or type the question paper (include groups, marks and questions)</label>
                                    <textarea
                                        rows={10}
                                        value={typedPaper}
                                        onChange={(e) => setTypedPaper(e.target.value)}
                                        placeholder={"Group A (1 mark x 5 questions)\n1. ...\n2. ...\n\nGroup B (5 marks x 3 questions)\n6. ..."}
                                        style={{ width: "100%" }}
                                    />
                                </div>
                                <button className="primary" onClick={uploadQuestionPaper}>
                                    Upload question paper
                                </button>

                                <h3 style={{ marginTop: "26px" }}>Generate using AI</h3>
                                <p className="meta-line">
                                    Upload at least one of the following (PDF or DOCX, up to 2 MB each):
                                </p>

                                <div className="field">
                                    <label>Notes</label>
                                    <input
                                        type="file"
                                        accept=".pdf,.docx"
                                        onChange={(e) => setNotesFile(e.target.files[0])}
                                    />
                                </div>
                                <div className="field">
                                    <label>Syllabus</label>
                                    <input
                                        type="file"
                                        accept=".pdf,.docx"
                                        onChange={(e) => setSyllabusFile(e.target.files[0])}
                                    />
                                </div>
                                <div className="field">
                                    <label>Previous year questions</label>
                                    <input
                                        type="file"
                                        accept=".pdf,.docx"
                                        onChange={(e) => setPyqFile(e.target.files[0])}
                                    />
                                </div>

                                <div className="field">
                                    <label>Groups / marking scheme (optional — leave empty for the default pattern)</label>
                                    {groups.map((g, i) => (
                                        <div key={i} style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "6px", flexWrap: "wrap" }}>
                                            <strong>Group {String.fromCharCode(65 + i)}</strong>
                                            <input
                                                type="number" min="1" style={{ width: "70px" }}
                                                value={g.marks}
                                                onChange={(e) => setGroups((p) => p.map((x, j) => (j === i ? { ...x, marks: e.target.value } : x)))}
                                            />
                                            <span>marks ×</span>
                                            <input
                                                type="number" min="1" style={{ width: "70px" }}
                                                value={g.count}
                                                onChange={(e) => setGroups((p) => p.map((x, j) => (j === i ? { ...x, count: e.target.value } : x)))}
                                            />
                                            <span>questions</span>
                                            <button type="button" onClick={() => setGroups((p) => p.filter((_, j) => j !== i))}>Remove</button>
                                        </div>
                                    ))}
                                    <button
                                        type="button"
                                        onClick={() => setGroups((p) => [...p, { marks: 1, count: 5 }])}
                                        disabled={groups.length >= 10}
                                    >
                                        + Add group
                                    </button>
                                    {groups.length > 0 && (
                                        <p className="meta-line">
                                            Total marks: {groups.reduce((a, g) => a + (Number(g.marks) || 0) * (Number(g.count) || 0), 0)}
                                        </p>
                                    )}
                                </div>

                                <div className="field">
                                    <label>
                                        Tweak difficulty: {tweakLabel(tweakPercent)}
                                    </label>
                                    <input
                                        type="range"
                                        min="1"
                                        max="100"
                                        step="1"
                                        value={tweakPercent}
                                        onChange={(e) => setTweakPercent(Number(e.target.value))}
                                    />
                                </div>

                                <button className="primary" onClick={generateWithAI} disabled={generating}>
                                    {generating ? "Generating..." : "Generate question paper"}
                                </button>
                            </>
                        )}
                    </div>
                )}

                <div className="panel">
                    <h2>My question papers</h2>

                    {loadingPapers && <p className="empty-note">Loading...</p>}
                    {!loadingPapers && questionPapers.length === 0 && (
                        <p className="empty-note">No question papers created yet.</p>
                    )}

                    {questionPapers.map((paper) => (
                        <div className="record" key={paper._id}>
                            <div className="record-title-row">
                                <h3>
                                    {paper.subject}, {paper.examType === "mid" ? "Mid Semester" : "End Semester"}
                                </h3>
                                <StatusTag status={paper.status} />
                            </div>
                            <p className="meta-line">
                                {paper.source === "ai" ? `AI generated, version ${paper.version}` : "Manual upload"}
                                {paper.autoSubmitted ? " — auto-submitted after deadline" : ""}
                            </p>
                            {paper.pattern?.length > 0 && (
                                <p className="meta-line">
                                    <strong>Pattern:</strong>{" "}
                                    {paper.pattern.map((g) => `${g.label}: ${g.marks}m × ${g.count}`).join(", ")}
                                </p>
                            )}
                            {paper.source === "ai" && (
                                <p className="meta-line">
                                    <strong>Difficulty:</strong>{" "}
                                    {tweakLabel(paper.tweakPercent)}
                                </p>
                            )}
                            <p className="meta-line">
                                <strong>Feedback:</strong> {paper.feedback || "Not given yet"}
                            </p>

                            <div className="action-row">
                                <button onClick={() => downloadPaper(paper)}>Download</button>

                                {paper.status === "draft" && !paper.autoSubmitted && (
                                    <>
                                        <button onClick={() => giveFeedback(paper._id, "easy")}>Easy</button>
                                        <button onClick={() => giveFeedback(paper._id, "moderate")}>Moderate</button>
                                        <button onClick={() => giveFeedback(paper._id, "difficult")}>Difficult</button>
                                        <button className="primary" onClick={() => submitToHOD(paper._id)}>
                                            Submit to HOD
                                        </button>
                                    </>
                                )}
                            </div>

                            {paper.status === "draft" && !paper.autoSubmitted && paper.source === "ai" && (
                                <div className="field" style={{ marginTop: "12px", maxWidth: "320px" }}>
                                    <label>
                                        Regenerate at: {tweakLabel(regenerateTweaks[paper._id] ?? paper.tweakPercent)}
                                    </label>
                                    <input
                                        type="range"
                                        min="1"
                                        max="100"
                                        step="1"
                                        value={regenerateTweaks[paper._id] ?? paper.tweakPercent}
                                        onChange={(e) =>
                                            setRegenerateTweaks((prev) => ({
                                                ...prev,
                                                [paper._id]: Number(e.target.value)
                                            }))
                                        }
                                    />
                                    <button onClick={() => regeneratePaper(paper._id)} style={{ marginTop: "8px" }}>
                                        Regenerate with AI
                                    </button>
                                </div>
                            )}

                            {paper.content && (
                                <details style={{ marginTop: "14px" }}>
                                    <summary>Preview content</summary>
                                    <pre>{paper.content}</pre>
                                </details>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default TeacherDashboard;
