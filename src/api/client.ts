// chatup/frontend/src/api/client.ts
import axios from "axios";
import { API_BASE_URL } from "../config";

const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        "Content-Type": "application/json",
    },
});

apiClient.interceptors.request.use((config) => {
    const token = localStorage.getItem("chatup_token");
    if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
    }

    // When uploading FormData (photos), remove Content-Type so browser sets multipart boundary automatically
    if (config.data instanceof FormData && config.headers) {
        delete config.headers["Content-Type"];
    }

    return config;
});

export default apiClient;