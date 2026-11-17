import { useState } from "react";
import {
    BrowserRouter,
    Routes,
    Route,
    Navigate,
    Link,
    useNavigate
} from "react-router-dom";

import { API_BASE, getToken, getUser } from "./api";

import Register from "./pages/Register";
import TeacherDashboard from "./pages/TeacherDashboard";
import HODDashboard from "./pages/HODDashboard";
import ExamCellDashboard from "./pages/ExamCellDashboard";


function Login() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [message, setMessage] = useState("");

    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setMessage("Logging in...");

        try {
            const response = await fetch(`${API_BASE}/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (!response.ok) {
                setMessage(data.message);
                return;
            }

            localStorage.setItem("token", data.token);
            localStorage.setItem("user", JSON.stringify(data.user));

            if (data.user.role === "teacher") {
                navigate("/teacher-dashboard");
            } else if (data.user.role === "hod") {
                navigate("/hod-dashboard");
            } else if (data.user.role === "exam_cell") {
                navigate("/exam-cell-dashboard");
            } else {
                setMessage("Unknown user role");
            }
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

                <h1>Question Paper Office</h1>
                <p className="subline">Sign in to continue</p>

                <form onSubmit={handleLogin}>
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
                            placeholder="Enter your password"
                            required
                        />
                    </div>

                    <button type="submit" style={{ width: "100%" }}>
                        Log in
                    </button>
                </form>

                {message && <p className="auth-message">{message}</p>}

                <p className="auth-footer">
                    Don't have an account? <Link to="/register">Register here</Link>
                </p>
            </div>
        </div>
    );
}


// Only lets the request through if a token exists and (optionally)
// the logged-in user's role is in `allowedRoles`.
function ProtectedRoute({ allowedRoles, children }) {
    const token = getToken();
    const user = getUser();

    if (!token || !user) {
        return <Navigate to="/" replace />;
    }

    if (allowedRoles && !allowedRoles.includes(user.role)) {
        return <Navigate to="/" replace />;
    }

    return children;
}


function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Login />} />
                <Route path="/register" element={<Register />} />

                <Route
                    path="/teacher-dashboard"
                    element={
                        <ProtectedRoute allowedRoles={["teacher"]}>
                            <TeacherDashboard />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/hod-dashboard"
                    element={
                        <ProtectedRoute allowedRoles={["hod"]}>
                            <HODDashboard />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/exam-cell-dashboard"
                    element={
                        <ProtectedRoute allowedRoles={["exam_cell"]}>
                            <ExamCellDashboard />
                        </ProtectedRoute>
                    }
                />

                <Route path="*" element={<Navigate to="/" />} />
            </Routes>
        </BrowserRouter>
    );
}

export default App;
