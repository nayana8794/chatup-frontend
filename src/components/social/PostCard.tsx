// chatup/frontend/src/components/social/PostCard.tsx
import React, { useState } from "react";
import {
    Card,
    CardContent,
    Box,
    Typography,
    Avatar,
    Chip,
    Button,
    Stack,
    Divider,
    IconButton,
    TextField,
    Tooltip,
} from "@mui/material";
import FavoriteIcon from "@mui/icons-material/Favorite";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import ChatBubbleIcon from "@mui/icons-material/ChatBubble";
import SendIcon from "@mui/icons-material/Send";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import { resolveMediaUrl } from "../../utils/media";
import { ImageLightbox } from "./ImageLightbox";

export interface SocialComment {
    id: string;
    user_id: string;
    author_name: string;
    content: string;
    created_at: string;
}

export interface SocialPostData {
    id: string;
    author_id?: string;
    author_name: string;
    author_role: string;
    author_avatar?: string;
    created_at: string;
    caption: string;
    image_urls: string[];
    likes_count: number;
    comments_count?: number;
    is_liked_by_me: boolean;
    comments: SocialComment[];
}

interface PostCardProps {
    post: SocialPostData;
    currentUserId?: string;
    currentUserRole?: string;
    onLikeToggle: (postId: string) => void;
    onCommentAdd: (postId: string, content: string) => void;
    onEdit?: (post: SocialPostData) => void;
    onDelete?: (postId: string) => void;
}

export const PostCard: React.FC<PostCardProps> = ({
    post,
    currentUserId,
    currentUserRole,
    onLikeToggle,
    onCommentAdd,
    onEdit,
    onDelete,
}) => {
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [selectedImageIndex, setSelectedImageIndex] = useState(0);
    const [showComments, setShowComments] = useState(false);
    const [commentText, setCommentText] = useState("");

    const images = post.image_urls || [];
    const totalImages = images.length;

    const handleImageClick = (index: number) => {
        setSelectedImageIndex(index);
        setLightboxOpen(true);
    };

    const handleCommentSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!commentText.trim()) return;
        onCommentAdd(post.id, commentText.trim());
        setCommentText("");
    };

    const formatUtcDate = (dateStr: string) => {
        try {
            const safeStr = dateStr.endsWith("Z") ? dateStr : `${dateStr}Z`;
            const date = new Date(safeStr);
            return date.toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
            });
        } catch {
            return dateStr;
        }
    };

    const canManage =
        post.author_id === currentUserId ||
        ["SUPER_ADMIN", "PRESIDENT", "SECRETARY"].includes(currentUserRole || "");

    const renderCollage = () => {
        if (totalImages === 0) return null;

        if (totalImages === 1) {
            return (
                <Box
                    sx={{
                        width: "100%",
                        maxHeight: "450px",
                        overflow: "hidden",
                        cursor: "pointer",
                        backgroundColor: "#F0F2F5",
                    }}
                    onClick={() => handleImageClick(0)}
                >
                    <Box
                        component="img"
                        src={resolveMediaUrl(images[0])}
                        alt="Post photo"
                        onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                            e.currentTarget.src =
                                "https://placehold.co/600x400/002F6C/FFFFFF?text=Photo+Unavailable";
                        }}
                        sx={{
                            width: "100%",
                            height: "auto",
                            maxHeight: "450px",
                            objectFit: "cover",
                            display: "block",
                        }}
                    />
                </Box>
            );
        }

        if (totalImages === 2) {
            return (
                <Box sx={{ display: "flex", gap: "2px", height: "260px" }}>
                    {images.map((img, idx) => (
                        <Box
                            key={idx}
                            sx={{ flex: 1, overflow: "hidden", cursor: "pointer", position: "relative" }}
                            onClick={() => handleImageClick(idx)}
                        >
                            <Box
                                component="img"
                                src={resolveMediaUrl(img)}
                                alt={`Photo ${idx + 1}`}
                                onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                                    e.currentTarget.src =
                                        "https://placehold.co/400x300/002F6C/FFFFFF?text=Photo+Unavailable";
                                }}
                                sx={{ width: "100%", height: "100%", objectFit: "cover" }}
                            />
                        </Box>
                    ))}
                </Box>
            );
        }

        if (totalImages === 3) {
            return (
                <Box sx={{ display: "flex", gap: "2px", height: "300px" }}>
                    <Box
                        sx={{ flex: 1.2, overflow: "hidden", cursor: "pointer" }}
                        onClick={() => handleImageClick(0)}
                    >
                        <Box
                            component="img"
                            src={resolveMediaUrl(images[0])}
                            alt="Photo 1"
                            onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                                e.currentTarget.src =
                                    "https://placehold.co/400x300/002F6C/FFFFFF?text=Photo+Unavailable";
                            }}
                            sx={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                    </Box>
                    <Box sx={{ flex: 1, display: "flex", flexDirection: "column", gap: "2px" }}>
                        {images.slice(1, 3).map((img, idx) => (
                            <Box
                                key={idx}
                                sx={{ flex: 1, overflow: "hidden", cursor: "pointer" }}
                                onClick={() => handleImageClick(idx + 1)}
                            >
                                <Box
                                    component="img"
                                    src={resolveMediaUrl(img)}
                                    alt={`Photo ${idx + 2}`}
                                    onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                                        e.currentTarget.src =
                                            "https://placehold.co/400x300/002F6C/FFFFFF?text=Photo+Unavailable";
                                    }}
                                    sx={{ width: "100%", height: "100%", objectFit: "cover" }}
                                />
                            </Box>
                        ))}
                    </Box>
                </Box>
            );
        }

        const displayImages = images.slice(0, 4);
        const extraCount = totalImages - 4;

        return (
            <Box
                sx={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gridTemplateRows: "140px 140px",
                    gap: "2px",
                }}
            >
                {displayImages.map((img, idx) => {
                    const isLastWithOverlay = idx === 3 && extraCount > 0;
                    return (
                        <Box
                            key={idx}
                            sx={{ position: "relative", overflow: "hidden", cursor: "pointer" }}
                            onClick={() => handleImageClick(idx)}
                        >
                            <Box
                                component="img"
                                src={resolveMediaUrl(img)}
                                alt={`Photo ${idx + 1}`}
                                onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                                    e.currentTarget.src =
                                        "https://placehold.co/400x300/002F6C/FFFFFF?text=Photo+Unavailable";
                                }}
                                sx={{ width: "100%", height: "100%", objectFit: "cover" }}
                            />
                            {isLastWithOverlay && (
                                <Box
                                    sx={{
                                        position: "absolute",
                                        inset: 0,
                                        backgroundColor: "rgba(0, 47, 108, 0.75)",
                                        display: "flex",
                                        justifyContent: "center",
                                        alignItems: "center",
                                    }}
                                >
                                    <Typography sx={{ color: "#FFFFFF", fontWeight: 800, fontSize: "1.5rem" }}>
                                        +{extraCount}
                                    </Typography>
                                </Box>
                            )}
                        </Box>
                    );
                })}
            </Box>
        );
    };

    return (
        <>
            <Card
                sx={{
                    borderRadius: 3.5,
                    boxShadow: "0 2px 12px rgba(0, 47, 108, 0.08)",
                    border: "1px solid",
                    borderColor: "divider",
                    backgroundColor: "background.paper",
                    overflow: "hidden",
                    mb: 2.5,
                }}
            >
                <CardContent sx={{ pb: 1.5, pt: 2, px: 2 }}>
                    <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between" }}>
                        <Stack direction="row" sx={{ alignItems: "center", gap: 1.5 }}>
                            <Avatar
                                src={resolveMediaUrl(post.author_avatar)}
                                sx={{
                                    width: 46,
                                    height: 46,
                                    backgroundColor: "#002F6C",
                                    fontWeight: 700,
                                    fontSize: "1.1rem",
                                }}
                            >
                                {post.author_name ? post.author_name.charAt(0) : "U"}
                            </Avatar>

                            <Box sx={{ minWidth: 0 }}>
                                <Stack direction="row" sx={{ alignItems: "center", gap: 1 }}>
                                    <Typography
                                        sx={{
                                            fontWeight: 800,
                                            fontSize: "1.02rem",
                                            color: "text.primary",
                                            lineHeight: 1.2,
                                        }}
                                        noWrap
                                    >
                                        {post.author_name}
                                    </Typography>
                                    <Chip
                                        label={post.author_role}
                                        size="small"
                                        sx={{
                                            height: 20,
                                            fontSize: "0.68rem",
                                            fontWeight: 700,
                                            backgroundColor: "#002F6C",
                                            color: "#FFFFFF",
                                        }}
                                    />
                                </Stack>
                                <Typography sx={{ fontSize: "0.8rem", color: "text.secondary", mt: 0.3 }}>
                                    {formatUtcDate(post.created_at)}
                                </Typography>
                            </Box>
                        </Stack>

                        {/* Author / Leadership Controls */}
                        {canManage && (
                            <Stack direction="row" spacing={0.5}>
                                {post.author_id === currentUserId && onEdit && (
                                    <Tooltip title="Edit Post">
                                        <IconButton size="small" onClick={() => onEdit(post)}>
                                            <EditIcon fontSize="small" />
                                        </IconButton>
                                    </Tooltip>
                                )}
                                {onDelete && (
                                    <Tooltip title="Delete Post">
                                        <IconButton size="small" color="error" onClick={() => onDelete(post.id)}>
                                            <DeleteIcon fontSize="small" />
                                        </IconButton>
                                    </Tooltip>
                                )}
                            </Stack>
                        )}
                    </Stack>

                    {post.caption && (
                        <Typography
                            sx={{
                                mt: 1.8,
                                fontSize: "0.98rem",
                                color: "text.primary",
                                lineHeight: 1.55,
                                whiteSpace: "pre-wrap",
                            }}
                        >
                            {post.caption}
                        </Typography>
                    )}
                </CardContent>

                {/* Facebook Smart Photo Collage */}
                {renderCollage()}

                {/* Counters */}
                <Box
                    sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        px: 2,
                        py: 1,
                        color: "text.secondary",
                    }}
                >
                    <Typography sx={{ fontSize: "0.85rem", color: "text.secondary" }}>
                        {post.likes_count} {post.likes_count === 1 ? "Like" : "Likes"}
                    </Typography>
                    <Typography
                        sx={{ fontSize: "0.85rem", color: "text.secondary", cursor: "pointer" }}
                        onClick={() => setShowComments(!showComments)}
                    >
                        {post.comments ? post.comments.length : 0} Comments
                    </Typography>
                </Box>

                <Divider />

                {/* Action Buttons */}
                <Box sx={{ display: "flex", px: 1, py: 0.5 }}>
                    <Button
                        fullWidth
                        onClick={() => onLikeToggle(post.id)}
                        startIcon={
                            post.is_liked_by_me ? (
                                <FavoriteIcon sx={{ color: "#E0245E" }} />
                            ) : (
                                <FavoriteBorderIcon />
                            )
                        }
                        sx={{
                            color: post.is_liked_by_me ? "#E0245E" : "text.secondary",
                            fontWeight: 800,
                            textTransform: "none",
                            py: 1,
                        }}
                    >
                        {post.is_liked_by_me ? "Liked" : "Like"}
                    </Button>

                    <Button
                        fullWidth
                        onClick={() => setShowComments(!showComments)}
                        startIcon={<ChatBubbleIcon />}
                        sx={{
                            color: "text.secondary",
                            fontWeight: 800,
                            textTransform: "none",
                            py: 1,
                        }}
                    >
                        Comment
                    </Button>
                </Box>

                {/* Expandable Comments Drawer/Section */}
                {showComments && (
                    <Box sx={{ bgcolor: "grey.50", p: 2, borderTop: "1px solid", borderColor: "divider" }}>
                        <Stack spacing={1.5} sx={{ mb: 2 }}>
                            {post.comments &&
                                post.comments.map((comm) => (
                                    <Box
                                        key={comm.id}
                                        sx={{
                                            bgcolor: "background.paper",
                                            p: 1.5,
                                            borderRadius: 2,
                                            boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
                                        }}
                                    >
                                        <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                                            <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                                                {comm.author_name}
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                {formatUtcDate(comm.created_at)}
                                            </Typography>
                                        </Box>
                                        <Typography variant="body2">{comm.content}</Typography>
                                    </Box>
                                ))}
                        </Stack>

                        {/* Add Comment Input Form */}
                        <Box component="form" onSubmit={handleCommentSubmit} sx={{ display: "flex", gap: 1 }}>
                            <TextField
                                fullWidth
                                size="small"
                                placeholder="Write a comment..."
                                value={commentText}
                                onChange={(e) => setCommentText(e.target.value)}
                                sx={{ bgcolor: "background.paper", borderRadius: 2 }}
                            />
                            <IconButton
                                type="submit"
                                color="primary"
                                sx={{
                                    bgcolor: "#002F6C",
                                    color: "white",
                                    "&:hover": { bgcolor: "#001E47" },
                                }}
                            >
                                <SendIcon fontSize="small" />
                            </IconButton>
                        </Box>
                    </Box>
                )}
            </Card>

            {/* Lightbox with previous/next navigation for all images in this post */}
            <ImageLightbox
                open={lightboxOpen}
                images={images}
                currentIndex={selectedImageIndex}
                onClose={() => setLightboxOpen(false)}
                onIndexChange={(idx) => setSelectedImageIndex(idx)}
            />
        </>
    );
};