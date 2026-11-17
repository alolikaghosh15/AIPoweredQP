import { useEffect, useState } from "react";
import { apiRequest, downloadFile, getUser } from "../api";
import Topbar from "../components/Topbar";
import StatusTag from "../components/StatusTag";
import { tweakLabel } from "../utils/tweak";

function HODDashboard() {
    const user = getUser();

    const [groups, setGroups] = useState([]);
    const [selectedByGroup, setSelectedByGroup] = useState({});
    const [combining, setCombining] = useState(false);
    const [combineTweaks, setCombineTweaks] = useState({});

    const [combinedPapers, setCombinedPapers] = useState([]);
    const [correctionDrafts, setCorrectionDrafts] = useState({});
    const [correctionTweaks, setCorrectionTweaks] = useState({});
    const [loading, setLoading] = useState(true);

    // Deadlines
    const [deadlines, setDeadlines] = useState([]);
    const [deadlineForm, setDeadlineForm] = useState({
        program: "",
        subject: "",
        semester: "",
        examType: "mid",
        deadline: ""
    });

    const loadSubmitted = async () => {
        try {
            const data = await apiRequest("/hod/submitted-papers");
            setGroups(data.groups || []);
        } catch (error) {
            alert(error.message);
        }
    };

    const loadCombined = async () => {
        try {
            const data = await apiRequest("/hod/combined-papers");
            setCombinedPapers(data.combinedPapers || []);
        } catch (error) {
            alert(error.message);
        }
    };

    const loadDeadlines = async () => {
        try {
            const data = await apiRequest("/hod/deadlines");
            setDeadlines(data.deadlines || []);
        } catch (error) {
            alert(error.message);
        }
    };

    const loadAll = async () => {
        setLoading(true);
        await Promise.all([loadSubmitted(), loadCombined(), loadDeadlines()]);
        setLoading(false);
    };

    useEffect(() => {
        loadAll();
    }, []);

    // ==================================================
    // DEADLINES
    // ==================================================

    const saveDeadline = async () => {
        const { program, subject, semester, examType, deadline } = deadlineForm;
        if (!program || !subject || !semester || !examType || !deadline) {
            alert("Please fill in program, subject, semester, exam type and deadline.");
            return;
        }
        try {
            await apiRequest("/hod/deadlines", {
                method: "POST",
                body: { ...deadlineForm, semester: Number(semester) }
            });
            setDeadlineForm({ program: "", subject: "", semester: "", examType: "mid", deadline: "" });
            loadDeadlines();
        } catch (error) {
            alert(error.message);
        }
    };

    const removeDeadline = async (id) => {
        if (!window.confirm("Remove this deadline?")) return;
        try {
            await apiRequest(`/hod/deadlines/${id}`, { method: "DELETE" });
            loadDeadlines();
        } catch (error) {
            alert(error.message);
        }
    };

    // ==================================================
    // GROUPED SUBMITTED PAPERS / COMBINATION
    // ==================================================

    const toggleSelection = (groupKey, paperId) => {
        setSelectedByGroup((prev) => {
            const current = new Set(prev[groupKey] || []);
            if (current.has(paperId)) current.delete(paperId);
            else current.add(paperId);
            return { ...prev, [groupKey]: Array.from(current) };
        });
    };

    const combineGroup = async (groupKey) => {
        const paperIds = selectedByGroup[groupKey];
        if (!paperIds || paperIds.length === 0) {
            alert("Please select at least one question paper to combine.");
            return;
        }
        setCombining(true);
        try {
            const data = await apiRequest("/hod/combine", {
                method: "POST",
                body: { paperIds, tweakPercent: combineTweaks[groupKey] ?? 50 }
            });
            alert(data.message);
            setSelectedByGroup((prev) => ({ ...prev, [groupKey]: [] }));
            loadAll();
        } catch (error) {
            alert(error.message);
        } finally {
            setCombining(false);
        }
    };

    const approveCombined = async (id) => {
        try {
            const data = await apiRequest(`/hod/combined-papers/${id}/approve`, {
                method: "PATCH"
            });
            alert(data.message);
            loadCombined();
        } catch (error) {
            alert(error.message);
        }
    };

    const requestCorrection = async (id) => {
        const comment = correctionDrafts[id];
        if (!comment || !comment.trim()) {
            alert("Please describe the correction needed first.");
            return;
        }
        try {
            const data = await apiRequest(`/hod/combined-papers/${id}/correction`, {
                method: "PATCH",
                body: { comment, tweakPercent: correctionTweaks[id] }
            });
            alert(data.message);
            setCorrectionDrafts((prev) => ({ ...prev, [id]: "" }));
            loadCombined();
        } catch (error) {
            alert(error.message);
        }
    };

    const downloadSourcePaper = async (paper) => {
        try {
            await downloadFile(`/hod/source-papers/${paper._id}/download`, paper.fileName);
        } catch (error) {
            alert(error.message);
        }
    };

    const downloadCombined = async (combinedPaper) => {
        try {
            await downloadFile(`/hod/combined-papers/${combinedPaper._id}/download`, combinedPaper.fileName);
        } catch (error) {
            alert(error.message);
        }
    };

    const pendingCombined = combinedPapers.filter((c) => c.status === "pending_review");
    const finalizedCombined = combinedPapers.filter((c) => c.status === "finalized");

    return (
        <div className="app-shell">
            <Topbar user={user} />

            <div className="main-column">
                <div className="page-intro">
                    <h1>HOD dashboard</h1>
                    <p className="subline">
                        {user?.name}, review submitted papers and finalize them for the Exam Cell.
                    </p>
                </div>

                <div className="panel">
                    <h2>Submission deadlines</h2>
                    <p className="meta-line" style={{ marginBottom: "16px" }}>
                        Teachers can edit or submit a question paper only before its deadline.
                        Once it passes, any paper still in draft is automatically sent to you as-is.
                    </p>

                    <div className="field-row">
                        <div className="field">
                            <label>Program</label>
                            <input
                                type="text"
                                value={deadlineForm.program}
                                onChange={(e) => setDeadlineForm((f) => ({ ...f, program: e.target.value }))}
                                placeholder="B.Tech"
                            />
                        </div>
                        <div className="field">
                            <label>Semester</label>
                            <input
                                type="number"
                                min="1"
                                value={deadlineForm.semester}
                                onChange={(e) => setDeadlineForm((f) => ({ ...f, semester: e.target.value }))}
                                placeholder="1"
                            />
                        </div>
                    </div>

                    <div className="field-row">
                        <div className="field">
                            <label>Subject</label>
                            <input
                                type="text"
                                value={deadlineForm.subject}
                                onChange={(e) => setDeadlineForm((f) => ({ ...f, subject: e.target.value }))}
                                placeholder="Mathematics"
                            />
                        </div>
                        <div className="field">
                            <label>Examination</label>
                            <select
                                value={deadlineForm.examType}
                                onChange={(e) => setDeadlineForm((f) => ({ ...f, examType: e.target.value }))}
                            >
                                <option value="mid">Mid Semester</option>
                                <option value="end">End Semester</option>
                            </select>
                        </div>
                    </div>

                    <div className="field">
                        <label>Deadline</label>
                        <input
                            type="datetime-local"
                            value={deadlineForm.deadline}
                            onChange={(e) => setDeadlineForm((f) => ({ ...f, deadline: e.target.value }))}
                        />
                    </div>

                    <button className="primary" onClick={saveDeadline}>Save deadline</button>

                    {deadlines.length > 0 && (
                        <div style={{ marginTop: "20px" }}>
                            {deadlines.map((d) => {
                                const passed = new Date(d.deadline) <= new Date();
                                return (
                                    <div className="record" key={d._id}>
                                        <div className="record-title-row">
                                            <h4>{d.subject}</h4>
                                            <span
                                                className="meta-line"
                                                style={{ color: passed ? "var(--rust)" : "var(--sage)" }}
                                            >
                                                {passed ? "Passed" : "Upcoming"}
                                            </span>
                                        </div>
                                        <p className="meta-line">
                                            {d.program}, Semester {d.semester},{" "}
                                            {d.examType === "mid" ? "Mid Semester" : "End Semester"}
                                        </p>
                                        <p className="meta-line">
                                            {new Date(d.deadline).toLocaleString()}
                                        </p>
                                        <button onClick={() => removeDeadline(d._id)}>Remove</button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="panel">
                    <h2>Submitted question papers</h2>
                    <p className="meta-line" style={{ marginBottom: "16px" }}>
                        Grouped by subject, program, semester and exam type.
                    </p>

                    {loading && <p className="empty-note">Loading...</p>}
                    {!loading && groups.length === 0 && (
                        <p className="empty-note">No papers submitted yet.</p>
                    )}

                    {groups.map((group) => (
                        <div className="record" key={group.key}>
                            <h3>{group.subject}</h3>
                            <p className="meta-line">
                                {group.program}, Semester {group.semester},{" "}
                                {group.examType === "mid" ? "Mid Semester" : "End Semester"}
                            </p>
                            <p className="meta-line">
                                {group.targetSchool}
                                {group.targetDepartment ? `, ${group.targetDepartment}` : ""}
                            </p>

                            <div style={{ marginTop: "12px" }}>
                                {group.papers.map((paper) => (
                                    <div key={paper._id} style={{ marginBottom: "8px" }}>
                                        <label>
                                            <input
                                                type="checkbox"
                                                checked={(selectedByGroup[group.key] || []).includes(paper._id)}
                                                onChange={() => toggleSelection(group.key, paper._id)}
                                            />
                                            {paper.teacher?.name || "Unknown teacher"},{" "}
                                            {paper.source === "ai" ? "AI generated" : "manual upload"},
                                            feedback: {paper.feedback || "none"}
                                            {paper.autoSubmitted ? ", auto-submitted after deadline" : ""}
                                        </label>{" "}
                                        <button onClick={() => downloadSourcePaper(paper)}>View</button>
                                    </div>
                                ))}
                            </div>

                            <div className="field" style={{ marginTop: "12px", maxWidth: "320px" }}>
                                <label>
                                    Combine at: {tweakLabel(combineTweaks[group.key] ?? 50)}
                                </label>
                                <input
                                    type="range"
                                    min="1"
                                    max="100"
                                    step="1"
                                    value={combineTweaks[group.key] ?? 50}
                                    onChange={(e) =>
                                        setCombineTweaks((prev) => ({ ...prev, [group.key]: Number(e.target.value) }))
                                    }
                                />
                            </div>

                            <div className="action-row">
                                <button
                                    className="primary"
                                    disabled={combining}
                                    onClick={() => combineGroup(group.key)}
                                >
                                    {combining ? "Combining..." : "Combine selected papers with AI"}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="panel">
                    <h2>Combined papers pending review</h2>

                    {pendingCombined.length === 0 && (
                        <p className="empty-note">Nothing pending review.</p>
                    )}

                    {pendingCombined.map((combinedPaper) => (
                        <div className="record" key={combinedPaper._id}>
                            <div className="record-title-row">
                                <h3>{combinedPaper.subject}</h3>
                                <StatusTag status={combinedPaper.status} />
                            </div>
                            <p className="meta-line">
                                {combinedPaper.program}, Semester {combinedPaper.semester},{" "}
                                {combinedPaper.examType === "mid" ? "Mid Semester" : "End Semester"}
                            </p>
                            <p className="meta-line">
                                <strong>Difficulty:</strong>{" "}
                                {tweakLabel(combinedPaper.tweakPercent)}
                            </p>
                            {combinedPaper.wasCorrected && (
                                <p className="meta-line" style={{ color: "var(--brass-deep)" }}>
                                    Retweaked from your last correction request — please review again.
                                </p>
                            )}

                            <details>
                                <summary>View combined paper</summary>
                                <pre>{combinedPaper.generatedContent}</pre>
                            </details>

                            <div className="action-row">
                                <button onClick={() => downloadCombined(combinedPaper)}>Download</button>
                                <button className="primary" onClick={() => approveCombined(combinedPaper._id)}>
                                    Approve
                                </button>
                            </div>

                            <div className="field" style={{ marginTop: "14px" }}>
                                <label>Request a correction</label>
                                <textarea
                                    rows={2}
                                    value={correctionDrafts[combinedPaper._id] || ""}
                                    onChange={(e) =>
                                        setCorrectionDrafts((prev) => ({
                                            ...prev,
                                            [combinedPaper._id]: e.target.value
                                        }))
                                    }
                                    placeholder="Describe what needs to change..."
                                />
                            </div>

                            <div className="field" style={{ maxWidth: "320px" }}>
                                <label>
                                    Re-tweak difficulty to: {tweakLabel(correctionTweaks[combinedPaper._id] ?? combinedPaper.tweakPercent)}
                                </label>
                                <input
                                    type="range"
                                    min="1"
                                    max="100"
                                    step="1"
                                    value={correctionTweaks[combinedPaper._id] ?? combinedPaper.tweakPercent}
                                    onChange={(e) =>
                                        setCorrectionTweaks((prev) => ({
                                            ...prev,
                                            [combinedPaper._id]: Number(e.target.value)
                                        }))
                                    }
                                />
                            </div>

                            <button onClick={() => requestCorrection(combinedPaper._id)}>
                                Request AI correction
                            </button>
                        </div>
                    ))}
                </div>

                <div className="panel">
                    <h2>Finalized papers sent to Exam Cell</h2>

                    {finalizedCombined.length === 0 && (
                        <p className="empty-note">None finalized yet.</p>
                    )}

                    {finalizedCombined.map((combinedPaper) => (
                        <div className="record" key={combinedPaper._id}>
                            <div className="record-title-row">
                                <h3>{combinedPaper.subject}</h3>
                                <StatusTag status={combinedPaper.status} />
                            </div>
                            <p className="meta-line">
                                Semester {combinedPaper.semester},{" "}
                                {combinedPaper.examType === "mid" ? "Mid Semester" : "End Semester"}
                                {combinedPaper.wasCorrected ? ", corrected by HOD" : ""}
                            </p>
                            <p className="meta-line">
                                <strong>Difficulty:</strong>{" "}
                                {tweakLabel(combinedPaper.tweakPercent)}
                            </p>
                            <div className="action-row">
                                <button onClick={() => downloadCombined(combinedPaper)}>Download</button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default HODDashboard;
