// chatup/frontend/src/utils/media.ts

/**
 * Resolves any media URL from backend into a fully qualified URL.
 * Handles relative paths (/static/uploads/...) against VITE_API_URL.
 */
export const resolveMediaUrl = (url: string | null | undefined): string => {
    if (!url) return "";
    if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("blob:") || url.startsWith("data:")) {
        return url;
    }

    const rawApiUrl = import.meta.env.VITE_API_URL || "";
    // Strip trailing slash from API base
    const cleanApiUrl = rawApiUrl.endsWith("/") ? rawApiUrl.slice(0, -1) : rawApiUrl;
    // Ensure relative path starts with slash
    const cleanPath = url.startsWith("/") ? url : `/${url}`;

    return `${cleanApiUrl}${cleanPath}`;
};