// chatup/frontend/src/pages/SocialFeed.tsx
import React, { useState, useEffect, useCallback } from "react";
import {
    Container,
    Box,
    Typography,
    Button,
    Paper,
    Avatar,
    IconButton,
    TextField,
    Stack,
    CircularProgress,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Tabs,
    Tab,
    useMediaQuery,
    useTheme,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AddPhotoAlternateIcon from "@mui/icons-material/AddPhotoAlternate";
import CloseIcon from "@mui/icons-material/Close";
import PublicIcon from "@mui/icons-material/Public";
import PersonIcon from "@mui/icons-material/Person";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { useRealtime } from "../context/useRealtime";
import apiClient from "../api/client";
import { PostCard, type SocialPostData } from "../components/social/PostCard";
import { resolveMediaUrl } from "../utils/media";

export const SocialFeed: React.FC<{ onBack?: () => void; inline?: boolean; limit?: number }> = ({
    onBack,
    inline = false,
    limit,
}) => {
    const { t } = useTranslation();
    const { user } = useAuth();
    const { lastEvent } = useRealtime();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

    const [posts, setPosts] = useState<SocialPostData[]>([]);
    const [loading, setLoading] = useState(true);

    const [wallTab, setWallTab] = useState<"COMMUNITY" | "MY_POSTS">("COMMUNITY");

    // Modal states
    const [openPostModal, setOpenPostModal] = useState(false);
    const [editingPostId, setEditingPostId] = useState<string | null>(null);
    const [caption, setCaption] = useState("");
    const [uploadedImages, setUploadedImages] = useState<string[]>([]);
    const [uploading, setUploading] = useState(false);

    const fetchPosts = useCallback(
        async (isSilent = false) => {
            try {
                if (!isSilent) setLoading(true);
                const res = await apiClient.get("/social/posts");
                const data = limit ? res.data.slice(0, limit) : res.data;
                setPosts(data);
            } catch (err) {
                console.error(err);
            } finally {
                if (!isSilent) setLoading(false);
            }
        },
        [limit]
    );

    useEffect(() => {
        fetchPosts(false);
    }, [fetchPosts]);

    useEffect(() => {
        if (
            lastEvent?.type === "SOCIAL_POST_CREATED" ||
            lastEvent?.type === "SOCIAL_POST_UPDATED" ||
            lastEvent?.type === "SOCIAL_POST_DELETED" ||
            lastEvent?.type === "SOCIAL_POST_LIKED" ||
            lastEvent?.type === "SOCIAL_POST_COMMENTED"
        ) {
            fetchPosts(true);
        }
    }, [lastEvent, fetchPosts]);

    // Point 2 Fix: Mobile Upload Fix without breaking multipart boundary
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
                headers: { "Content-Type": undefined }, // Browser will automatically set multipart boundary
            });
            const newUrls = res.data.image_urls.map((u: string) => resolveMediaUrl(u));
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

    const handleOpenEditModal = (post: SocialPostData) => {
        setEditingPostId(post.id);
        setCaption(post.caption);
        setUploadedImages(post.image_urls.map((u) => resolveMediaUrl(u)));
        setOpenPostModal(true);
    };

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
                setPosts((prev) =>
                    prev.map((p) =>
                        p.id === editingPostId
                            ? { ...p, caption: res.data.caption, image_urls: res.data.image_urls }
                            : p
                    )
                );
            } else {
                const res = await apiClient.post("/social/posts", payload);
                setPosts((prev) => [res.data, ...prev]);
            }

            setOpenPostModal(false);
            setCaption("");
            setUploadedImages([]);
        } catch (err: any) {
            alert(err.response?.data?.detail || "Error saving post");
        }
    };

    const handleDeletePost = async (postId: string) => {
        if (!window.confirm(t("delete_post") + "?")) return;
        try {
            setPosts((prev) => prev.filter((p) => p.id !== postId));
            await apiClient.delete(`/social/posts/${postId}`);
        } catch (err: any) {
            alert(err.response?.data?.detail || "Error deleting post");
            fetchPosts(true);
        }
    };

    const handleToggleLike = async (postId: string) => {
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

        try {
            await apiClient.post(`/social/posts/${postId}/like`);
        } catch (err) {
            fetchPosts(true);
        }
    };

    const handleAddComment = async (postId: string, content: string) => {
        try {
            const res = await apiClient.post(`/social/posts/${postId}/comments`, { content });
            setPosts((prev) =>
                prev.map((p) => {
                    if (p.id !== postId) return p;
                    return {
                        ...p,
                        comments: [...(p.comments || []), res.data],
                    };
                })
            );
        } catch (err) {
            fetchPosts(true);
        }
    };

    const myPostsCount = posts.filter((p) => p.author_id === user?.user_id).length;
    const displayedPosts = wallTab === "MY_POSTS"
        ? posts.filter((p) => p.author_id === user?.user_id)
        : posts;

    const contentBody = (
        <Box sx={{ width: "100%", maxWidth: "100%", overflowX: "hidden" }}>
            {/* Header Bar */}
            {!inline && (
                <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={2}
                    sx={{
                        justifyContent: "space-between",
                        alignItems: { xs: "stretch", sm: "center" },
                        mb: 3,
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

            {/* Inline Create Post Bar */}
            {inline && (
                <Paper
                    elevation={2}
                    sx={{
                        p: 2,
                        mb: 2.5,
                        borderRadius: 3.5,
                        display: "flex",
                        alignItems: "center",
                        gap: 1.5,
                        cursor: "pointer",
                        bgcolor: "background.paper",
                        "&:hover": { bgcolor: "action.hover" },
                    }}
                    onClick={handleOpenCreateModal}
                >
                    <Avatar sx={{ bgcolor: "#002F6C", fontWeight: 800 }}>
                        {user?.full_name?.charAt(0) || "U"}
                    </Avatar>
                    <Typography variant="body1" color="text.secondary" sx={{ fontWeight: 600, flex: 1, fontSize: "0.95rem" }} noWrap>
                        {t("post_placeholder")}
                    </Typography>
                    <Button variant="contained" size="small" startIcon={<AddPhotoAlternateIcon />} sx={{ fontWeight: 800, whiteSpace: "nowrap" }}>
                        {t("create_post")}
                    </Button>
                </Paper>
            )}

            {/* Point 3 & 4 Fix: Translated & Responsive Full-Width Tabs on Mobile */}
            <Tabs
                value={wallTab}
                onChange={(_, val) => setWallTab(val)}
                variant={isMobile ? "fullWidth" : "standard"}
                sx={{
                    mb: 3,
                    borderBottom: 1,
                    borderColor: "divider",
                    "& .MuiTab-root": {
                        fontWeight: 800,
                        fontSize: { xs: "0.85rem", sm: "0.95rem" },
                        minHeight: 48,
                    },
                }}
            >
                <Tab
                    icon={<PublicIcon fontSize="small" />}
                    iconPosition="start"
                    label={`${t("community_feed_tab")} (${posts.length})`}
                    value="COMMUNITY"
                />
                <Tab
                    icon={<PersonIcon fontSize="small" />}
                    iconPosition="start"
                    label={`${t("my_posts_tab")} (${myPostsCount})`}
                    value="MY_POSTS"
                />
            </Tabs>

            {/* Posts Stream */}
            {loading ? (
                <Box sx={{ display: "flex", justifyContent: "center", p: 6 }}>
                    <CircularProgress size={50} />
                </Box>
            ) : displayedPosts.length === 0 ? (
                <Paper sx={{ p: 4, textAlign: "center", borderRadius: 3.5 }}>
                    <Typography color="text.secondary" variant="body1" sx={{ fontWeight: 600 }}>
                        {wallTab === "MY_POSTS" ? t("no_my_posts", "You haven't posted anything yet.") : t("no_posts_found")}
                    </Typography>
                    {wallTab === "MY_POSTS" && (
                        <Button
                            variant="outlined"
                            startIcon={<AddPhotoAlternateIcon />}
                            onClick={handleOpenCreateModal}
                            sx={{ mt: 2, fontWeight: 800 }}
                        >
                            {t("create_first_post", "Create My First Post")}
                        </Button>
                    )}
                </Paper>
            ) : (
                <Box sx={{ width: "100%" }}>
                    {displayedPosts.map((post) => (
                        <PostCard
                            key={post.id}
                            post={post}
                            currentUserId={user?.user_id}
                            currentUserRole={user?.role}
                            onLikeToggle={handleToggleLike}
                            onCommentAdd={handleAddComment}
                            onEdit={handleOpenEditModal}
                            onDelete={handleDeletePost}
                        />
                    ))}
                </Box>
            )}

            {/* Modal: Create / Edit Post with Multiple Thumbnails */}
            <Dialog
                open={openPostModal}
                onClose={() => setOpenPostModal(false)}
                maxWidth="sm"
                fullWidth
                sx={{ "& .MuiDialog-paper": { m: { xs: 1.5, sm: 2 }, borderRadius: 3.5 } }}
            >
                <DialogTitle sx={{ fontWeight: 900, fontSize: "1.3rem" }}>
                    {editingPostId ? `✏️ ${t("edit_post")}` : `📸 ${t("create_post")}`}
                </DialogTitle>
                <Box component="form" onSubmit={handleSavePost}>
                    <DialogContent sx={{ px: { xs: 2, sm: 3 } }}>
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

                            {/* Thumbnails with Delete (❌) Badge */}
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
                                                    width: 75,
                                                    height: 75,
                                                    borderRadius: 2.5,
                                                    border: "1.5px solid",
                                                    borderColor: "divider",
                                                }}
                                            >
                                                <Box
                                                    component="img"
                                                    src={url}
                                                    alt={`Thumbnail ${idx + 1}`}
                                                    sx={{
                                                        width: "100%",
                                                        height: "100%",
                                                        objectFit: "cover",
                                                        borderRadius: "9px",
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
        </Box>
    );

    if (inline) return contentBody;
    return <Container maxWidth="md" sx={{ py: { xs: 2, sm: 4 }, px: { xs: 1.5, sm: 3 } }}>{contentBody}</Container>;
};