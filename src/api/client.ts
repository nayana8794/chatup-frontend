// chatup/frontend/src/api/client.ts
import axios from "axios";

export const API_BASE_URL = "http://127.0.0.1:8000/api/v1";

const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        "Content-Type": "application/json",
    },
});

// Interceptor to add JWT token if stored
apiClient.interceptors.request.use((config) => {
    const token = localStorage.getItem("chatup_token");
    if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export default apiClient;