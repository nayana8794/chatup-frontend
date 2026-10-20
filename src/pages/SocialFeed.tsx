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
    CardMedia,
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
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
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
    image_url?: string;
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
    const [imageUrl, setImageUrl] = useState("");
    const [localPreview, setLocalPreview] = useState<string | null>(null);
    const [uploadingImage, setUploadingImage] = useState(false);

    const [commentInputs, setCommentInputs] = useState<{ [postId: string]: string }>({});

    const fetchPosts = useCallback(async () => {
        try {
            setLoading(true);
            const res = await apiClient.get("/social/posts");
            const data = limit ? res.data.slice(0, limit) : res.data;
            setPosts(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [limit]);

    useEffect(() => {
        fetchPosts();
    }, [fetchPosts]);

    useEffect(() => {
        if (
            lastEvent?.type === "SOCIAL_POST_CREATED" ||
            lastEvent?.type === "SOCIAL_POST_UPDATED" ||
            lastEvent?.type === "SOCIAL_POST_DELETED" ||
            lastEvent?.type === "SOCIAL_POST_LIKED" ||
            lastEvent?.type === "SOCIAL_POST_COMMENTED"
        ) {
            fetchPosts();
        }
    }, [lastEvent, fetchPosts]);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // 1. Instant client-side preview for seamless user feedback
        const previewUrl = URL.createObjectURL(file);
        setLocalPreview(previewUrl);

        // 2. Upload file to backend static storage
        const formData = new FormData();
        formData.append("file", file);

        try {
            setUploadingImage(true);
            const res = await apiClient.post("/social/upload-image", formData, {
                headers: { "Content-Type": "multipart/form-data" },
            });

            const serverPath = res.data.image_url;
            const fullUrl = serverPath.startsWith("http")
                ? serverPath
                : `${API_BASE_URL.replace("/api/v1", "")}${serverPath}`;
            setImageUrl(fullUrl);
        } catch (err) {
            alert("Failed to upload image to server. You can alternatively paste an image URL.");
            setLocalPreview(null);
        } finally {
            setUploadingImage(false);
        }
    };

    const handleRemovePhoto = () => {
        setImageUrl("");
        setLocalPreview(null);
    };

    const handleOpenCreateModal = () => {
        setEditingPostId(null);
        setCaption("");
        setImageUrl("");
        setLocalPreview(null);
        setOpenPostModal(true);
    };

    const handleOpenEditModal = (post: Post) => {
        setEditingPostId(post.id);
        setCaption(post.caption);
        setImageUrl(post.image_url || "");
        setLocalPreview(null);
        setOpenPostModal(true);
    };

    const handleSavePost = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!caption.trim()) return;

        try {
            const payload = {
                caption,
                image_url: imageUrl.trim() ? imageUrl.trim() : null,
            };

            if (editingPostId) {
                await apiClient.put(`/social/posts/${editingPostId}`, payload);
            } else {
                await apiClient.post("/social/posts", payload);
            }

            setOpenPostModal(false);
            setImageUrl("");
            setLocalPreview(null);
            fetchPosts();
        } catch (err: any) {
            alert(err.response?.data?.detail || "Error saving post");
        }
    };

    const handleDeletePost = async (postId: string) => {
        if (!window.confirm("Are you sure you want to delete this post?")) return;
        try {
            await apiClient.delete(`/social/posts/${postId}`);
            fetchPosts();
        } catch (err: any) {
            alert(err.response?.data?.detail || "Error deleting post");
        }
    };

    const handleToggleLike = async (postId: string) => {
        try {
            await apiClient.post(`/social/posts/${postId}/like`);
            fetchPosts();
        } catch (err) {
            console.error(err);
        }
    };

    const handleAddComment = async (postId: string, e: React.FormEvent) => {
        e.preventDefault();
        const text = commentInputs[postId];
        if (!text || !text.trim()) return;

        try {
            await apiClient.post(`/social/posts/${postId}/comments`, { content: text.trim() });
            setCommentInputs((prev) => ({ ...prev, [postId]: "" }));
            fetchPosts();
        } catch (err) {
            console.error(err);
        }
    };

    const canManagePost = (authorId?: string) => {
        return (
            authorId === user?.user_id ||
            ["SUPER_ADMIN", "PRESIDENT", "SECRETARY"].includes(user?.role || "")
        );
    };

    const previewSrc = localPreview || imageUrl;

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
                        Post
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

                            <CardContent sx={{ pt: 0, pb: 1 }}>
                                <Typography variant="body1" sx={{ fontSize: "1.05rem", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                                    {post.caption}
                                </Typography>
                            </CardContent>

                            {post.image_url && (
                                <CardMedia
                                    component="img"
                                    image={post.image_url}
                                    alt="Post attachment"
                                    sx={{ maxHeight: 450, objectFit: "cover", bgcolor: "grey.200" }}
                                    onError={(e: any) => {
                                        // Prevent showing broken image placeholder if URL fails
                                        e.currentTarget.style.display = "none";
                                    }}
                                />
                            )}

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

                                <Box
                                    component="form"
                                    onSubmit={(e) => handleAddComment(post.id, e)}
                                    sx={{ display: "flex", gap: 1 }}
                                >
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

            {/* Create / Edit Post Modal */}
            <Dialog
                open={openPostModal}
                onClose={() => setOpenPostModal(false)}
                maxWidth="sm"
                fullWidth
                sx={{ "& .MuiDialog-paper": { m: 2, borderRadius: 3 } }}
            >
                <DialogTitle sx={{ fontWeight: 800 }}>
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
                            />

                            {/* Photo Upload & Preview Section */}
                            <Box>
                                <Stack direction="row" spacing={1} sx={{ mb: 1.5, alignItems: "center" }}>
                                    <Button
                                        component="label"
                                        variant="outlined"
                                        startIcon={<CloudUploadIcon />}
                                        disabled={uploadingImage}
                                        sx={{ fontWeight: 800, minHeight: 44 }}
                                    >
                                        {uploadingImage ? "Uploading Image..." : "Upload Photo from Device"}
                                        <input type="file" hidden accept="image/*" onChange={handleFileChange} />
                                    </Button>

                                    {previewSrc && (
                                        <Button
                                            variant="text"
                                            color="error"
                                            startIcon={<CloseIcon />}
                                            onClick={handleRemovePhoto}
                                            sx={{ fontWeight: 700 }}
                                        >
                                            Remove
                                        </Button>
                                    )}
                                </Stack>

                                <TextField
                                    fullWidth
                                    size="small"
                                    label={t("image_url_label")}
                                    value={imageUrl}
                                    onChange={(e) => {
                                        setImageUrl(e.target.value);
                                        setLocalPreview(null);
                                    }}
                                    placeholder="Or paste direct image URL here..."
                                />
                            </Box>

                            {/* Responsive Photo Preview Box */}
                            {previewSrc && (
                                <Box
                                    sx={{
                                        position: "relative",
                                        borderRadius: 3,
                                        overflow: "hidden",
                                        border: "1px solid",
                                        borderColor: "divider",
                                        maxHeight: 220,
                                        bgcolor: "grey.100",
                                        textAlign: "center",
                                    }}
                                >
                                    <img
                                        src={previewSrc}
                                        alt="Preview"
                                        style={{
                                            width: "100%",
                                            maxHeight: 220,
                                            objectFit: "contain",
                                            display: "block",
                                        }}
                                    />
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
                            disabled={uploadingImage}
                            sx={{ fontWeight: 800, minHeight: 44 }}
                        >
                            {editingPostId ? "Save Changes" : t("post_to_wall")}
                        </Button>
                    </DialogActions>
                </Box>
            </Dialog>
        </Box>
    );

    if (inline) {
        return contentBody;
    }

    return <Container maxWidth="md" sx={{ py: { xs: 2, sm: 4 }, px: { xs: 1.5, sm: 3 } }}>{contentBody}</Container>;
};