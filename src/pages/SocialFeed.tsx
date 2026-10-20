// chatup/frontend/src/pages/SocialFeed.tsx
import React, { useState, useEffect, useCallback } from "react";
import {
    Container,
    Box,
    Typography,
    Button,
    Paper,
    Card,
    CardHeader,
    CardContent,
    CardActions,
    Avatar,
    IconButton,
    TextField,
    Stack,
    CircularProgress,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Chip,
    Tooltip,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AddPhotoAlternateIcon from "@mui/icons-material/AddPhotoAlternate";
import FavoriteIcon from "@mui/icons-material/Favorite";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import ChatBubbleIcon from "@mui/icons-material/ChatBubble";
import SendIcon from "@mui/icons-material/Send";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import CloseIcon from "@mui/icons-material/Close";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { useRealtime } from "../context/useRealtime";
import apiClient from "../api/client";
import { API_BASE_URL } from "../config";

interface Comment {
    id: string;
    user_id: string;
    author_name: string;
    content: string;
    created_at: string;
}

interface Post {
    id: string;
    author_id?: string;
    author_name: string;
    author_role: string;
    caption: string;
    image_urls: string[];
    created_at: string;
    likes_count: number;
    is_liked_by_me: boolean;
    comments: Comment[];
}

export const SocialFeed: React.FC<{ onBack?: () => void; inline?: boolean; limit?: number }> = ({
    onBack,
    inline = false,
    limit,
}) => {
    const { t } = useTranslation();
    const { user } = useAuth();
    const { lastEvent } = useRealtime();

    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);

    // Modal states
    const [openPostModal, setOpenPostModal] = useState(false);
    const [editingPostId, setEditingPostId] = useState<string | null>(null);
    const [caption, setCaption] = useState("");
    const [uploadedImages, setUploadedImages] = useState<string[]>([]);
    const [uploading, setUploading] = useState(false);

    // Lightbox
    const [activeLightboxImg, setActiveLightboxImg] = useState<string | null>(null);
    const [commentInputs, setCommentInputs] = useState<{ [postId: string]: string }>({});

    const toFullUrl = (url: string) => {
        if (!url) return "";
        return url.startsWith("http") ? url : `${API_BASE_URL.replace("/api/v1", "")}${url}`;
    };

    // Silent fetch parameter: preserves scroll position and prevents screen jump
    const fetchPosts = useCallback(
        async (isSilent = false) => {
            try {
                if (!isSilent) {
                    setLoading(true);
                }
                const res = await apiClient.get("/social/posts");
                const data = limit ? res.data.slice(0, limit) : res.data;
                setPosts(data);
            } catch (err) {
                console.error(err);
            } finally {
                if (!isSilent) {
                    setLoading(false);
                }
            }
        },
        [limit]
    );

    useEffect(() => {
        fetchPosts(false); // First time initial load
    }, [fetchPosts]);

    // Real-time synchronization without unmounting the list or resetting scroll position
    useEffect(() => {
        if (
            lastEvent?.type === "SOCIAL_POST_CREATED" ||
            lastEvent?.type === "SOCIAL_POST_UPDATED" ||
            lastEvent?.type === "SOCIAL_POST_DELETED" ||
            lastEvent?.type === "SOCIAL_POST_LIKED" ||
            lastEvent?.type === "SOCIAL_POST_COMMENTED"
        ) {
            fetchPosts(true); // Silent background refresh keeps user in the exact same place
        }
    }, [lastEvent, fetchPosts]);

    const handleFilesSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const formData = new FormData();
        for (let i = 0; i < files.length; i++) {
            formData.append("files", files[i]);
        }

        try {
            setUploading(true);
            const res = await apiClient.post("/social/upload-images", formData, {
                headers: { "Content-Type": "multipart/form-data" },
            });

            const newUrls = res.data.image_urls.map((u: string) => toFullUrl(u));
            setUploadedImages((prev) => [...prev, ...newUrls]);
        } catch (err) {
            alert("Failed to upload photos. Please try again.");
        } finally {
            setUploading(false);
        }
    };

    const handleRemoveUploadedImage = (indexToRemove: number) => {
        setUploadedImages((prev) => prev.filter((_, idx) => idx !== indexToRemove));
    };

    const handleOpenCreateModal = () => {
        setEditingPostId(null);
        setCaption("");
        setUploadedImages([]);
        setOpenPostModal(true);
    };

    const handleOpenEditModal = (post: Post) => {
        setEditingPostId(post.id);
        setCaption(post.caption);
        setUploadedImages(post.image_urls.map((u) => toFullUrl(u)));
        setOpenPostModal(true);
    };

    // In-place post save
    const handleSavePost = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!caption.trim()) return;

        try {
            const payload = {
                caption,
                image_urls: uploadedImages,
            };

            if (editingPostId) {
                const res = await apiClient.put(`/social/posts/${editingPostId}`, payload);
                // In-place update: updates only this post without jumping
                setPosts((prev) =>
                    prev.map((p) =>
                        p.id === editingPostId
                            ? { ...p, caption: res.data.caption, image_urls: res.data.image_urls }
                            : p
                    )
                );
            } else {
                const res = await apiClient.post("/social/posts", payload);
                // Prepend new post smoothly
                setPosts((prev) => [res.data, ...prev]);
            }

            setOpenPostModal(false);
            setCaption("");
            setUploadedImages([]);
        } catch (err: any) {
            alert(err.response?.data?.detail || "Error saving post");
        }
    };

    // In-place delete
    const handleDeletePost = async (postId: string) => {
        if (!window.confirm(t("delete_post") + "?")) return;
        try {
            // Optimistic in-place removal
            setPosts((prev) => prev.filter((p) => p.id !== postId));
            await apiClient.delete(`/social/posts/${postId}`);
        } catch (err: any) {
            alert(err.response?.data?.detail || "Error deleting post");
            fetchPosts(true);
        }
    };

    // Optimistic In-Place Like / Unlike
    const handleToggleLike = async (postId: string) => {
        // 1. Immediately toggle like state in memory (Zero scroll jump!)
        setPosts((prev) =>
            prev.map((p) => {
                if (p.id !== postId) return p;
                const newStatus = !p.is_liked_by_me;
                return {
                    ...p,
                    is_liked_by_me: newStatus,
                    likes_count: newStatus ? p.likes_count + 1 : Math.max(0, p.likes_count - 1),
                };
            })
        );

        // 2. Perform backend API sync in background
        try {
            await apiClient.post(`/social/posts/${postId}/like`);
        } catch (err) {
            // Revert if API fails
            fetchPosts(true);
        }
    };

    // In-Place Comment Insertion
    const handleAddComment = async (postId: string, e: React.FormEvent) => {
        e.preventDefault();
        const text = commentInputs[postId];
        if (!text || !text.trim()) return;

        const trimmed = text.trim();
        setCommentInputs((prev) => ({ ...prev, [postId]: "" }));

        try {
            const res = await apiClient.post(`/social/posts/${postId}/comments`, { content: trimmed });
            // In-place comment append without unmounting
            setPosts((prev) =>
                prev.map((p) => {
                    if (p.id !== postId) return p;
                    return {
                        ...p,
                        comments: [...p.comments, res.data],
                    };
                })
            );
        } catch (err) {
            console.error(err);
            fetchPosts(true);
        }
    };

    const canManagePost = (authorId?: string) => {
        return (
            authorId === user?.user_id ||
            ["SUPER_ADMIN", "PRESIDENT", "SECRETARY"].includes(user?.role || "")
        );
    };

    // Facebook-Style Photo Collage Renderer
    const renderFacebookPhotoCollage = (images: string[]) => {
        if (!images || images.length === 0) return null;

        const fullImages = images.map((img) => toFullUrl(img));
        const count = fullImages.length;

        if (count === 1) {
            return (
                <Box
                    sx={{ maxHeight: 480, overflow: "hidden", cursor: "pointer", bgcolor: "grey.200" }}
                    onClick={() => setActiveLightboxImg(fullImages[0])}
                >
                    <img
                        src={fullImages[0]}
                        alt="Post media"
                        style={{ width: "100%", maxHeight: 480, objectFit: "cover", display: "block" }}
                    />
                </Box>
            );
        }

        if (count === 2) {
            return (
                <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px", height: 280 }}>
                    {fullImages.slice(0, 2).map((img, idx) => (
                        <Box
                            key={idx}
                            sx={{ height: "100%", overflow: "hidden", cursor: "pointer" }}
                            onClick={() => setActiveLightboxImg(img)}
                        >
                            <img src={img} alt="Post media" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        </Box>
                    ))}
                </Box>
            );
        }

        if (count === 3) {
            return (
                <Box sx={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "2px", height: 320 }}>
                    <Box
                        sx={{ height: "100%", overflow: "hidden", cursor: "pointer" }}
                        onClick={() => setActiveLightboxImg(fullImages[0])}
                    >
                        <img src={fullImages[0]} alt="Post media" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    </Box>
                    <Box sx={{ display: "grid", gridTemplateRows: "1fr 1fr", gap: "2px", height: "100%" }}>
                        {fullImages.slice(1, 3).map((img, idx) => (
                            <Box
                                key={idx}
                                sx={{ height: "100%", overflow: "hidden", cursor: "pointer" }}
                                onClick={() => setActiveLightboxImg(img)}
                            >
                                <img src={img} alt="Post media" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            </Box>
                        ))}
                    </Box>
                </Box>
            );
        }

        const extraCount = count - 4;
        return (
            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr", gap: "2px", height: 340 }}>
                {fullImages.slice(0, 3).map((img, idx) => (
                    <Box
                        key={idx}
                        sx={{ height: "100%", overflow: "hidden", cursor: "pointer" }}
                        onClick={() => setActiveLightboxImg(img)}
                    >
                        <img src={img} alt="Post media" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    </Box>
                ))}

                <Box
                    sx={{ position: "relative", height: "100%", overflow: "hidden", cursor: "pointer" }}
                    onClick={() => setActiveLightboxImg(fullImages[3])}
                >
                    <img src={fullImages[3]} alt="Post media" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    {extraCount > 0 && (
                        <Box
                            sx={{
                                position: "absolute",
                                inset: 0,
                                bgcolor: "rgba(0,0,0,0.55)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "white",
                                fontSize: "1.8rem",
                                fontWeight: 900,
                                backdropFilter: "blur(2px)",
                            }}
                        >
                            +{extraCount}
                        </Box>
                    )}
                </Box>
            </Box>
        );
    };

    const contentBody = (
        <Box>
            {!inline && (
                <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={2}
                    sx={{
                        justifyContent: "space-between",
                        alignItems: { xs: "stretch", sm: "center" },
                        mb: 4,
                    }}
                >
                    {onBack && (
                        <Button
                            startIcon={<ArrowBackIcon />}
                            onClick={onBack}
                            variant="outlined"
                            sx={{ fontWeight: "bold", minHeight: 48 }}
                        >
                            {t("back_to_dashboard")}
                        </Button>
                    )}
                    <Typography variant="h5" sx={{ fontWeight: 800, textAlign: { xs: "center", sm: "left" } }}>
                        📸 {t("social_title")}
                    </Typography>
                    <Button
                        variant="contained"
                        color="primary"
                        startIcon={<AddPhotoAlternateIcon />}
                        onClick={handleOpenCreateModal}
                        sx={{ fontWeight: "bold", minHeight: 48 }}
                    >
                        {t("create_post")}
                    </Button>
                </Stack>
            )}

            {inline && (
                <Paper
                    elevation={2}
                    sx={{
                        p: 2,
                        mb: 3,
                        borderRadius: 3,
                        display: "flex",
                        alignItems: "center",
                        gap: 2,
                        cursor: "pointer",
                        bgcolor: "background.paper",
                        "&:hover": { bgcolor: "action.hover" },
                    }}
                    onClick={handleOpenCreateModal}
                >
                    <Avatar sx={{ bgcolor: "primary.main", fontWeight: 800 }}>
                        {user?.full_name?.charAt(0) || "U"}
                    </Avatar>
                    <Typography variant="body1" color="text.secondary" sx={{ fontWeight: 600, flex: 1 }}>
                        {t("post_placeholder")}
                    </Typography>
                    <Button variant="contained" size="small" startIcon={<AddPhotoAlternateIcon />} sx={{ fontWeight: 800 }}>
                        {t("create_post")}
                    </Button>
                </Paper>
            )}

            {loading ? (
                <Box sx={{ display: "flex", justifyContent: "center", p: 6 }}>
                    <CircularProgress size={50} />
                </Box>
            ) : posts.length === 0 ? (
                <Paper sx={{ p: 5, textAlign: "center", borderRadius: 3 }}>
                    <Typography color="text.secondary" variant="h6">
                        {t("no_posts_found")}
                    </Typography>
                </Paper>
            ) : (
                <Stack spacing={3}>
                    {posts.map((post) => (
                        <Card key={post.id} elevation={3} sx={{ borderRadius: 4, overflow: "hidden" }}>
                            <CardHeader
                                avatar={
                                    <Avatar sx={{ bgcolor: "primary.main", fontWeight: 800 }}>
                                        {post.author_name?.charAt(0) || "U"}
                                    </Avatar>
                                }
                                title={
                                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                        <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                                            {post.author_name}
                                        </Typography>
                                        <Chip
                                            label={post.author_role}
                                            size="small"
                                            color="primary"
                                            sx={{ height: 20, fontSize: "0.65rem", fontWeight: 800 }}
                                        />
                                    </Box>
                                }
                                subheader={new Date(post.created_at).toLocaleString([], {
                                    dateStyle: "medium",
                                    timeStyle: "short",
                                })}
                                action={
                                    canManagePost(post.author_id) && (
                                        <Stack direction="row" spacing={0.5}>
                                            {post.author_id === user?.user_id && (
                                                <Tooltip title={t("edit_post")}>
                                                    <IconButton size="small" onClick={() => handleOpenEditModal(post)}>
                                                        <EditIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            )}
                                            <Tooltip title={t("delete_post")}>
                                                <IconButton size="small" color="error" onClick={() => handleDeletePost(post.id)}>
                                                    <DeleteIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                        </Stack>
                                    )
                                }
                            />

                            <CardContent sx={{ pt: 0, pb: 1.5 }}>
                                <Typography variant="body1" sx={{ fontSize: "1.05rem", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                                    {post.caption}
                                </Typography>
                            </CardContent>

                            {/* Facebook Collage */}
                            {renderFacebookPhotoCollage(post.image_urls)}

                            <CardActions sx={{ px: 2, py: 1.5, justifyContent: "space-between", borderTop: "1px solid", borderColor: "divider" }}>
                                <Button
                                    startIcon={post.is_liked_by_me ? <FavoriteIcon color="error" /> : <FavoriteBorderIcon />}
                                    onClick={() => handleToggleLike(post.id)}
                                    sx={{ fontWeight: 800, color: post.is_liked_by_me ? "error.main" : "text.secondary" }}
                                >
                                    {post.likes_count} {t("likes_count")}
                                </Button>
                                <Button startIcon={<ChatBubbleIcon />} sx={{ fontWeight: 800, color: "text.secondary" }}>
                                    {post.comments.length} {t("comments_count")}
                                </Button>
                            </CardActions>

                            {/* Comments Section */}
                            <Box sx={{ bgcolor: "grey.50", p: 2, borderTop: "1px solid", borderColor: "divider" }}>
                                <Stack spacing={1.5} sx={{ mb: 2 }}>
                                    {post.comments.map((comm) => (
                                        <Box key={comm.id} sx={{ bgcolor: "background.paper", p: 1.5, borderRadius: 2, boxShadow: 0.5 }}>
                                            <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                                                <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                                                    {comm.author_name}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    {new Date(comm.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                                </Typography>
                                            </Box>
                                            <Typography variant="body2">{comm.content}</Typography>
                                        </Box>
                                    ))}
                                </Stack>

                                <Box component="form" onSubmit={(e) => handleAddComment(post.id, e)} sx={{ display: "flex", gap: 1 }}>
                                    <TextField
                                        fullWidth
                                        size="small"
                                        placeholder={t("write_comment")}
                                        value={commentInputs[post.id] || ""}
                                        onChange={(e) => setCommentInputs({ ...commentInputs, [post.id]: e.target.value })}
                                        sx={{ bgcolor: "background.paper", borderRadius: 2 }}
                                    />
                                    <IconButton
                                        type="submit"
                                        color="primary"
                                        sx={{ bgcolor: "primary.main", color: "white", "&:hover": { bgcolor: "primary.dark" } }}
                                    >
                                        <SendIcon fontSize="small" />
                                    </IconButton>
                                </Box>
                            </Box>
                        </Card>
                    ))}
                </Stack>
            )}

            {/* Modal: Create / Edit Post */}
            <Dialog
                open={openPostModal}
                onClose={() => setOpenPostModal(false)}
                maxWidth="sm"
                fullWidth
                sx={{ "& .MuiDialog-paper": { m: 2, borderRadius: 3.5 } }}
            >
                <DialogTitle sx={{ fontWeight: 900, fontSize: "1.3rem" }}>
                    {editingPostId ? `✏️ ${t("edit_post")}` : `📸 ${t("create_post")}`}
                </DialogTitle>
                <Box component="form" onSubmit={handleSavePost}>
                    <DialogContent>
                        <Stack spacing={2.5}>
                            <TextField
                                fullWidth
                                multiline
                                rows={4}
                                required
                                label={t("post_placeholder")}
                                value={caption}
                                onChange={(e) => setCaption(e.target.value)}
                                sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2.5 } }}
                            />

                            <Box>
                                <Button
                                    component="label"
                                    variant="outlined"
                                    size="large"
                                    startIcon={<AddPhotoAlternateIcon />}
                                    disabled={uploading}
                                    sx={{
                                        fontWeight: 800,
                                        borderRadius: 2.5,
                                        py: 1.2,
                                        width: "100%",
                                        borderStyle: "dashed",
                                        borderWidth: 2,
                                    }}
                                >
                                    {uploading ? "Uploading Photos…" : "Add Photos from Device"}
                                    <input type="file" hidden multiple accept="image/*" onChange={handleFilesSelect} />
                                </Button>
                            </Box>

                            {uploadedImages.length > 0 && (
                                <Box>
                                    <Typography variant="caption" sx={{ fontWeight: 800, color: "text.secondary", mb: 1, display: "block" }}>
                                        Selected Photos ({uploadedImages.length}):
                                    </Typography>
                                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5 }}>
                                        {uploadedImages.map((url, idx) => (
                                            <Box
                                                key={idx}
                                                sx={{
                                                    position: "relative",
                                                    width: 80,
                                                    height: 80,
                                                    borderRadius: 2.5,
                                                    overflow: "visible",
                                                    border: "1.5px solid",
                                                    borderColor: "divider",
                                                }}
                                            >
                                                <img
                                                    src={url}
                                                    alt={`Thumbnail ${idx + 1}`}
                                                    style={{
                                                        width: "100%",
                                                        height: "100%",
                                                        objectFit: "cover",
                                                        borderRadius: 8,
                                                        display: "block",
                                                    }}
                                                />
                                                <IconButton
                                                    size="small"
                                                    onClick={() => handleRemoveUploadedImage(idx)}
                                                    sx={{
                                                        position: "absolute",
                                                        top: -8,
                                                        right: -8,
                                                        bgcolor: "#f44336",
                                                        color: "white",
                                                        boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
                                                        "&:hover": { bgcolor: "#d32f2f" },
                                                        width: 22,
                                                        height: 22,
                                                        p: 0,
                                                    }}
                                                >
                                                    <CloseIcon sx={{ fontSize: 14 }} />
                                                </IconButton>
                                            </Box>
                                        ))}
                                    </Box>
                                </Box>
                            )}
                        </Stack>
                    </DialogContent>
                    <DialogActions sx={{ p: 2.5 }}>
                        <Button onClick={() => setOpenPostModal(false)}>Cancel</Button>
                        <Button
                            type="submit"
                            variant="contained"
                            color="primary"
                            disabled={uploading || !caption.trim()}
                            sx={{ fontWeight: 800, minHeight: 46, px: 3, borderRadius: 2.5 }}
                        >
                            {editingPostId ? "Save Changes" : t("post_to_wall")}
                        </Button>
                    </DialogActions>
                </Box>
            </Dialog>

            {/* Full-Screen Image Lightbox */}
            <Dialog
                open={Boolean(activeLightboxImg)}
                onClose={() => setActiveLightboxImg(null)}
                maxWidth="lg"
                sx={{ "& .MuiDialog-paper": { bgcolor: "transparent", boxShadow: "none", m: 1 } }}
            >
                <Box sx={{ position: "relative", textAlign: "center" }}>
                    <IconButton
                        onClick={() => setActiveLightboxImg(null)}
                        sx={{
                            position: "absolute",
                            top: 10,
                            right: 10,
                            color: "white",
                            bgcolor: "rgba(0,0,0,0.6)",
                            "&:hover": { bgcolor: "rgba(0,0,0,0.85)" },
                        }}
                    >
                        <CloseIcon />
                    </IconButton>
                    {activeLightboxImg && (
                        <img
                            src={activeLightboxImg}
                            alt="Enlarged view"
                            style={{
                                maxWidth: "100%",
                                maxHeight: "90vh",
                                borderRadius: 12,
                                objectFit: "contain",
                                boxShadow: "0 10px 40px rgba(0,0,0,0.8)",
                            }}
                        />
                    )}
                </Box>
            </Dialog>
        </Box>
    );

    if (inline) {
        return contentBody;
    }

    return <Container maxWidth="md" sx={{ py: { xs: 2, sm: 4 }, px: { xs: 1.5, sm: 3 } }}>{contentBody}</Container>;
};