export const API_BASE = "http://localhost:5000/api";

export function getToken() {
    return localStorage.getItem("token");
}

export function getUser() {
    try {
        return JSON.parse(localStorage.getItem("user"));
    } catch {
        return null;
    }
}

export function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/";
}

export function authHeaders() {
    return { Authorization: `Bearer ${getToken()}` };
}

// Simple JSON request helper. Throws with the server's message on failure.
export async function apiRequest(path, { method = "GET", body, isFormData } = {}) {
    const headers = { ...authHeaders() };
    if (!isFormData) {
        headers["Content-Type"] = "application/json";
    }

    const response = await fetch(`${API_BASE}${path}`, {
        method,
        headers,
        body: isFormData ? body : body ? JSON.stringify(body) : undefined
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(data.message || "Request failed");
    }

    return data;
}

// Downloads a file from a protected endpoint (needs the auth header,
// so a plain <a href> won't work).
export async function downloadFile(path, fallbackName = "download") {
    const response = await fetch(`${API_BASE}${path}`, {
        headers: authHeaders()
    });

    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || "Download failed");
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fallbackName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
}
