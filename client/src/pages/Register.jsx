import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { API_BASE } from "../api";

function Register() {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [role, setRole] = useState("teacher");
    const [school, setSchool] = useState("");
    const [department, setDepartment] = useState("");
    const [message, setMessage] = useState("");

    const navigate = useNavigate();

    const needsScope = role === "hod" || role === "exam_cell";

    const handleRegister = async (e) => {
        e.preventDefault();
        setMessage("Registering...");

        try {
            const response = await fetch(`${API_BASE}/auth/register`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name,
                    email,
                    password,
                    role,
                    school: needsScope ? school : undefined,
                    department: needsScope ? department : undefined
                })
            });

            const data = await response.json();

            if (!response.ok) {
                setMessage(data.message || "Registration failed");
                return;
            }

            setMessage("Registration successful. Redirecting to login...");
            setTimeout(() => navigate("/"), 1000);
        } catch (error) {
            console.error(error);
            setMessage("Unable to connect to server");
        }
    };

    return (
        <div className="auth-shell">
            <div className="auth-card">
                <div className="auth-mark">
                    <div className="seal">QP</div>
                </div>

                <h1>Create an account</h1>
                <p className="subline">Question Paper Office</p>

                <form onSubmit={handleRegister}>
                    <div className="field">
                        <label>Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Enter full name"
                            required
                        />
                    </div>

                    <div className="field">
                        <label>Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@university.edu"
                            required
                        />
                    </div>

                    <div className="field">
                        <label>Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Choose a password"
                            required
                        />
                    </div>

                    <div className="field">
                        <label>Role</label>
                        <select value={role} onChange={(e) => setRole(e.target.value)}>
                            <option value="teacher">Teacher</option>
                            <option value="hod">Head of Department</option>
                            <option value="exam_cell">Exam Cell</option>
                        </select>
                    </div>

                    {needsScope && (
                        <>
                            <div className="field">
                                <label>School / faculty</label>
                                <input
                                    type="text"
                                    value={school}
                                    onChange={(e) => setSchool(e.target.value)}
                                    placeholder="Engineering"
                                    required
                                />
                            </div>

                            <div className="field">
                                <label>Department (leave blank if school-wide)</label>
                                <input
                                    type="text"
                                    value={department}
                                    onChange={(e) => setDepartment(e.target.value)}
                                    placeholder="CSE"
                                />
                            </div>

                            <p className="meta-line" style={{ marginBottom: "16px" }}>
                                This must match how teachers enter their school and department
                                exactly, so you only see papers from your own department.
                            </p>
                        </>
                    )}

                    <button type="submit" style={{ width: "100%" }}>
                        Register
                    </button>
                </form>

                {message && <p className="auth-message">{message}</p>}

                <p className="auth-footer">
                    Already have an account? <Link to="/">Log in here</Link>
                </p>
            </div>
        </div>
    );
}

export default Register;
