const LABELS = {
    draft: "Draft",
    submitted: "Submitted to HOD",
    in_combination: "Combined by HOD",
    pending_review: "Pending review",
    finalized: "Finalized"
};

function StatusTag({ status }) {
    return (
        <span className={`status ${status}`}>
            <span className="dot" />
            {LABELS[status] || status}
        </span>
    );
}

export default StatusTag;
