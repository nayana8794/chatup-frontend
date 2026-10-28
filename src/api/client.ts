// chatup/frontend/src/api/client.ts
import axios from "axios";

const apiClient = axios.create({
    baseURL: import.meta.env.VITE_API_URL
        ? `${import.meta.env.VITE_API_URL.replace(/\/$/, "")}/api/v1`
        : "/api/v1",
});

apiClient.interceptors.request.use((config) => {
    const token = localStorage.getItem("chatup_token");
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Automatic graceful logout when token expires
apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            const detail = error.response?.data?.detail;
            if (detail === "Could not validate credentials" || detail === "Token has expired") {
                localStorage.removeItem("chatup_token");
                localStorage.removeItem("chatup_user");
                if (window.location.pathname !== "/login") {
                    window.location.href = "/";
                }
            }
        }
        return Promise.reject(error);
    }
);

export default apiClient;