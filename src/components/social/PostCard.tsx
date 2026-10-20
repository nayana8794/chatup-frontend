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
} from "@mui/material";
import FavoriteIcon from "@mui/icons-material/Favorite";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import ChatIcon from "@mui/icons-material/Chat";
import ShareIcon from "@mui/icons-material/Share";
import { resolveMediaUrl } from "../../utils/media";
import { ImageLightbox } from "./ImageLightbox";

export interface SocialPostData {
    id: number;
    author_name: string;
    author_role: string;
    author_avatar?: string;
    created_at: string;
    content: string;
    image_urls: string[];
    likes_count: number;
    comments_count: number;
    has_liked?: boolean;
}

interface PostCardProps {
    post: SocialPostData;
    onLikeToggle: (postId: number) => void;
    onCommentClick: (postId: number) => void;
}

export const PostCard: React.FC<PostCardProps> = ({
    post,
    onLikeToggle,
    onCommentClick,
}) => {
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [selectedImageIndex, setSelectedImageIndex] = useState(0);

    const images = post.image_urls || [];
    const totalImages = images.length;

    const handleImageClick = (index: number) => {
        setSelectedImageIndex(index);
        setLightboxOpen(true);
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

    const renderCollage = () => {
        if (totalImages === 0) return null;

        if (totalImages === 1) {
            return (
                <Box
                    sx={{
                        width: "100%",
                        maxHeight: "420px",
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
                            maxHeight: "420px",
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
                    borderRadius: 3,
                    boxShadow: "0 2px 10px rgba(0, 47, 108, 0.08)",
                    border: "1px solid",
                    borderColor: "divider",
                    backgroundColor: "background.paper",
                    overflow: "hidden",
                    mb: 2.5,
                }}
            >
                <CardContent sx={{ pb: 1.5, pt: 2, px: 2 }}>
                    <Stack direction="row" sx={{ alignItems: "center", gap: 1.5 }}>
                        <Avatar
                            src={resolveMediaUrl(post.author_avatar)}
                            sx={{
                                width: 48,
                                height: 48,
                                backgroundColor: "#002F6C",
                                fontWeight: 700,
                                fontSize: "1.1rem",
                            }}
                        >
                            {post.author_name ? post.author_name.charAt(0) : "M"}
                        </Avatar>

                        <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Stack direction="row" sx={{ alignItems: "center", gap: 1 }}>
                                <Typography
                                    sx={{
                                        fontWeight: 700,
                                        fontSize: "1.05rem",
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
                            <Typography sx={{ fontSize: "0.82rem", color: "text.secondary", mt: 0.3 }}>
                                {formatUtcDate(post.created_at)}
                            </Typography>
                        </Box>
                    </Stack>

                    {post.content && (
                        <Typography
                            sx={{
                                mt: 1.8,
                                fontSize: "0.98rem",
                                color: "text.primary",
                                lineHeight: 1.5,
                                wordBreak: "break-word",
                            }}
                        >
                            {post.content}
                        </Typography>
                    )}
                </CardContent>

                {renderCollage()}

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
                    <Typography sx={{ fontSize: "0.85rem", color: "text.secondary" }}>
                        {post.comments_count} {post.comments_count === 1 ? "Comment" : "Comments"}
                    </Typography>
                </Box>

                <Divider />

                <Box sx={{ display: "flex", px: 1, py: 0.5 }}>
                    <Button
                        fullWidth
                        onClick={() => onLikeToggle(post.id)}
                        startIcon={
                            post.has_liked ? (
                                <FavoriteIcon sx={{ color: "#E0245E" }} />
                            ) : (
                                <FavoriteBorderIcon />
                            )
                        }
                        sx={{
                            color: post.has_liked ? "#E0245E" : "text.secondary",
                            fontWeight: 700,
                            textTransform: "none",
                            py: 1,
                        }}
                    >
                        {post.has_liked ? "Liked" : "Like"}
                    </Button>

                    <Button
                        fullWidth
                        onClick={() => onCommentClick(post.id)}
                        startIcon={<ChatIcon />}
                        sx={{
                            color: "text.secondary",
                            fontWeight: 700,
                            textTransform: "none",
                            py: 1,
                        }}
                    >
                        Comment
                    </Button>

                    <Button
                        fullWidth
                        startIcon={<ShareIcon />}
                        sx={{
                            color: "text.secondary",
                            fontWeight: 700,
                            textTransform: "none",
                            py: 1,
                        }}
                    >
                        Share
                    </Button>
                </Box>
            </Card>

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