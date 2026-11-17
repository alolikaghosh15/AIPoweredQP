import { logout } from "../api";

const ROLE_LABELS = {
    teacher: "Teacher",
    hod: "Head of Department",
    exam_cell: "Exam Cell"
};

function Topbar({ user }) {
    return (
        <header className="topbar">
            <div className="topbar-brand">
                <div className="seal">QP</div>
                <div>
                    <div className="brand-name">Question Paper Office</div>
                    <div className="brand-sub">Academic examinations workflow</div>
                </div>
            </div>

            <div className="topbar-user">
                {user?.role && (
                    <span className="role-chip">
                        {ROLE_LABELS[user.role] || user.role}
                    </span>
                )}
                <span className="user-name">{user?.name}</span>
                <button onClick={logout}>Log out</button>
            </div>
        </header>
    );
}

export default Topbar;
