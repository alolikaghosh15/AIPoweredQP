import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { API_BASE } from "../api";

function ResetPassword() {
    const { token } = useParams();
    const navigate = useNavigate();
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [message, setMessage] = useState("");

    const submit = async (e) => {
        e.preventDefault();
        if (password !== confirm) return setMessage("Passwords do not match");
        setMessage("Updating...");
        try {
            const res = await fetch(`${API_BASE}/auth/reset-password`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, password })
            });
            const data = await res.json();
            setMessage(data.message);
            if (res.ok) setTimeout(() => navigate("/"), 1500);
        } catch {
            setMessage("Unable to connect to server");
        }
    };

    return (
        <div className="auth-shell">
            <div className="auth-card">
                <div className="auth-mark"><div className="seal">QP</div></div>
                <h1>Reset password</h1>
                <p className="subline">Choose a new password</p>
                <form onSubmit={submit}>
                    <div className="field">
                        <label>New password</label>
                        <input type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required />
                    </div>
                    <div className="field">
                        <label>Confirm password</label>
                        <input type="password" minLength={6} value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
                    </div>
                    <button type="submit" style={{ width: "100%" }}>Update password</button>
                </form>
                {message && <p className="auth-message">{message}</p>}
                <p className="auth-footer"><Link to="/">Back to login</Link></p>
            </div>
        </div>
    );
}

export default ResetPassword;
