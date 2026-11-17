import { useEffect, useState } from "react";
import { apiRequest, downloadFile, getUser } from "../api";
import Topbar from "../components/Topbar";
import { tweakLabel } from "../utils/tweak";

function ExamCellDashboard() {
    const user = getUser();

    const [finalPapers, setFinalPapers] = useState([]);
    const [loading, setLoading] = useState(true);

    const loadFinalPapers = async () => {
        setLoading(true);
        try {
            const data = await apiRequest("/exam-cell/final-papers");
            setFinalPapers(data.finalPapers || []);
        } catch (error) {
            alert(error.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadFinalPapers();
    }, []);

    const downloadPaper = async (paper) => {
        try {
            await downloadFile(`/exam-cell/final-papers/${paper._id}/download`, paper.fileName);
        } catch (error) {
            alert(error.message);
        }
    };

    return (
        <div className="app-shell">
            <Topbar user={user} />

            <div className="main-column">
                <div className="page-intro">
                    <h1>Exam Cell dashboard</h1>
                    <p className="subline">
                        {user?.name}, final question papers approved by the HOD appear here.
                    </p>
                </div>

                <div className="panel">
                    <h2>Final approved question papers</h2>

                    {loading && <p className="empty-note">Loading...</p>}
                    {!loading && finalPapers.length === 0 && (
                        <p className="empty-note">No question papers approved by HOD yet.</p>
                    )}

                    {finalPapers.map((paper) => (
                        <div className="record" key={paper._id}>
                            <h3>{paper.subject}</h3>
                            <p className="meta-line">
                                {paper.program}, Semester {paper.semester},{" "}
                                {paper.examType === "mid" ? "Mid Semester" : "End Semester"}
                                {paper.wasCorrected ? ", corrected by HOD" : ""}
                            </p>
                            <p className="meta-line">
                                {paper.targetSchool}
                                {paper.targetDepartment ? `, ${paper.targetDepartment}` : ""}
                            </p>
                            <p className="meta-line">
                                <strong>Approved by:</strong> {paper.hod?.name || "HOD"}
                            </p>
                            <p className="meta-line">
                                <strong>Difficulty:</strong>{" "}
                                {tweakLabel(paper.tweakPercent)}
                            </p>

                            <details>
                                <summary>Preview</summary>
                                <pre>{paper.generatedContent}</pre>
                            </details>

                            <div className="action-row">
                                <button className="primary" onClick={() => downloadPaper(paper)}>
                                    Download
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default ExamCellDashboard;
