import { useState } from "react";
import { Link } from "react-router-dom";
import { API_BASE } from "../api";

function ForgotPassword() {
    const [email, setEmail] = useState("");
    const [message, setMessage] = useState("");
    const [resetLink, setResetLink] = useState("");

    const submit = async (e) => {
        e.preventDefault();
        setMessage("Sending...");
        setResetLink("");
        try {
            const res = await fetch(`${API_BASE}/auth/forgot-password`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email })
            });
            const data = await res.json();
            setMessage(data.message);
            if (data.resetLink) setResetLink(data.resetLink);
        } catch {
            setMessage("Unable to connect to server");
        }
    };

    return (
        <div className="auth-shell">
            <div className="auth-card">
                <div className="auth-mark"><div className="seal">QP</div></div>
                <h1>Forgot password</h1>
                <p className="subline">Enter your email to get a reset link</p>
                <form onSubmit={submit}>
                    <div className="field">
                        <label>Email</label>
                        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                    </div>
                    <button type="submit" style={{ width: "100%" }}>Send reset link</button>
                </form>
                {message && <p className="auth-message">{message}</p>}
                {resetLink && (
                    <a href={resetLink}>
                        <button type="button" style={{ width: "100%" }}>Reset password now</button>
                    </a>
                )}
                <p className="auth-footer"><Link to="/">Back to login</Link></p>
            </div>
        </div>
    );
}

export default ForgotPassword;
