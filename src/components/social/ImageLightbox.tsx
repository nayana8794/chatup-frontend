// chatup/frontend/src/components/social/ImageLightbox.tsx

import React, { useEffect, useCallback } from "react";
import {
    Dialog,
    DialogContent,
    IconButton,
    Box,
    Chip,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import { resolveMediaUrl } from "../../utils/media";

interface ImageLightboxProps {
    open: boolean;
    images: string[];
    currentIndex: number;
    onClose: () => void;
    onIndexChange: (index: number) => void;
}

export const ImageLightbox: React.FC<ImageLightboxProps> = ({
    open,
    images,
    currentIndex,
    onClose,
    onIndexChange,
}) => {
    const total = images.length;

    const handlePrev = useCallback(() => {
        if (currentIndex > 0) {
            onIndexChange(currentIndex - 1);
        } else {
            onIndexChange(total - 1);
        }
    }, [currentIndex, total, onIndexChange]);

    const handleNext = useCallback(() => {
        if (currentIndex < total - 1) {
            onIndexChange(currentIndex + 1);
        } else {
            onIndexChange(0);
        }
    }, [currentIndex, total, onIndexChange]);

    // Keyboard controls for Arrow keys & Escape
    useEffect(() => {
        if (!open) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "ArrowLeft") handlePrev();
            if (e.key === "ArrowRight") handleNext();
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [open, handlePrev, handleNext, onClose]);

    if (!images || images.length === 0) return null;

    return (
        <Dialog
            fullScreen
            open={open}
            onClose={onClose}
            maxWidth={false}
            sx={{
                zIndex: 1400,
                "& .MuiDialog-paper": {
                    backgroundColor: "rgba(10, 15, 29, 0.98)",
                    boxShadow: "none",
                    margin: 0,
                    width: "100%",
                    maxWidth: "100%",
                    height: "100%",
                    maxHeight: "100%",
                    borderRadius: 0,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    alignItems: "center",
                    position: "relative",
                    overflow: "hidden",
                },
            }}
        >
            {/* Top Header Bar: Counter & Close Button */}
            <Box
                sx={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    zIndex: 20,
                    width: "100%",
                    boxSizing: "border-box",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    pt: {
                        xs: "calc(env(safe-area-inset-top, 0px) + 12px)",
                        sm: "20px",
                    },
                    pb: { xs: 1.5, sm: 2 },
                    pr: {
                        xs: "calc(env(safe-area-inset-right, 0px) + 16px)",
                        sm: "24px",
                    },
                    pl: {
                        xs: "calc(env(safe-area-inset-left, 0px) + 16px)",
                        sm: "24px",
                    },
                    background:
                        "linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 70%, transparent 100%)",
                }}
            >
                {total > 1 ? (
                    <Chip
                        label={`${currentIndex + 1} / ${total}`}
                        sx={{
                            backgroundColor: "rgba(255, 255, 255, 0.2)",
                            color: "#FFFFFF",
                            fontWeight: 700,
                            fontSize: { xs: "0.85rem", sm: "0.95rem" },
                            backdropFilter: "blur(4px)",
                            border: "1px solid rgba(255, 255, 255, 0.1)",
                        }}
                    />
                ) : (
                    <Box sx={{ flex: 1 }} />
                )}

                <IconButton
                    onClick={onClose}
                    sx={{
                        ml: "auto",
                        color: "#FFFFFF",
                        backgroundColor: "rgba(255, 255, 255, 0.18)",
                        "&:hover": { backgroundColor: "rgba(255, 255, 255, 0.35)" },
                        width: { xs: 42, sm: 48 },
                        height: { xs: 42, sm: 48 },
                        borderRadius: "50%",
                        backdropFilter: "blur(6px)",
                        border: "1px solid rgba(255, 255, 255, 0.2)",
                        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.3)",
                        flexShrink: 0,
                    }}
                    aria-label="Close photo viewer"
                >
                    <CloseIcon sx={{ fontSize: { xs: 22, sm: 26 } }} />
                </IconButton>
            </Box>

            {/* Main Image Display */}
            <DialogContent
                sx={{
                    padding: 0,
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    width: "100%",
                    height: "100%",
                    overflow: "hidden",
                    position: "relative",
                }}
            >
                <Box
                    component="img"
                    src={resolveMediaUrl(images[currentIndex])}
                    alt={`Photo ${currentIndex + 1}`}
                    onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                        e.currentTarget.src =
                            "https://placehold.co/800x600/002F6C/FFFFFF?text=Image+Unavailable";
                    }}
                    sx={{
                        maxWidth: "100%",
                        maxHeight: { xs: "75dvh", sm: "85vh" },
                        objectFit: "contain",
                        userSelect: "none",
                        transition: "opacity 0.2s ease",
                    }}
                />
            </DialogContent>

            {/* Navigation Arrow: Previous */}
            {total > 1 && (
                <IconButton
                    onClick={handlePrev}
                    sx={{
                        position: "absolute",
                        left: {
                            xs: "calc(env(safe-area-inset-left, 0px) + 8px)",
                            sm: 24,
                        },
                        top: "50%",
                        transform: "translateY(-50%)",
                        zIndex: 10,
                        color: "#FFFFFF",
                        backgroundColor: "rgba(0, 47, 108, 0.75)",
                        border: "1px solid rgba(242, 169, 0, 0.5)",
                        "&:hover": { backgroundColor: "rgba(0, 47, 108, 0.95)" },
                        width: { xs: 42, sm: 56 },
                        height: { xs: 42, sm: 56 },
                    }}
                    aria-label="Previous photo"
                >
                    <ArrowBackIosNewIcon sx={{ fontSize: { xs: 18, sm: 24 } }} />
                </IconButton>
            )}

            {/* Navigation Arrow: Next */}
            {total > 1 && (
                <IconButton
                    onClick={handleNext}
                    sx={{
                        position: "absolute",
                        right: {
                            xs: "calc(env(safe-area-inset-right, 0px) + 8px)",
                            sm: 24,
                        },
                        top: "50%",
                        transform: "translateY(-50%)",
                        zIndex: 10,
                        color: "#FFFFFF",
                        backgroundColor: "rgba(0, 47, 108, 0.75)",
                        border: "1px solid rgba(242, 169, 0, 0.5)",
                        "&:hover": { backgroundColor: "rgba(0, 47, 108, 0.95)" },
                        width: { xs: 42, sm: 56 },
                        height: { xs: 42, sm: 56 },
                    }}
                    aria-label="Next photo"
                >
                    <ArrowForwardIosIcon sx={{ fontSize: { xs: 18, sm: 24 } }} />
                </IconButton>
            )}

            {/* Bottom Thumbnail Strip */}
            {total > 1 && (
                <Box
                    sx={{
                        position: "absolute",
                        bottom: {
                            xs: "calc(env(safe-area-inset-bottom, 0px) + 16px)",
                            sm: "20px",
                        },
                        display: "flex",
                        gap: 1.5,
                        zIndex: 10,
                        padding: "8px 16px",
                        backgroundColor: "rgba(0, 0, 0, 0.6)",
                        borderRadius: "24px",
                        backdropFilter: "blur(6px)",
                        maxWidth: "90%",
                        overflowX: "auto",
                    }}
                >
                    {images.map((img, idx) => (
                        <Box
                            key={idx}
                            component="img"
                            src={resolveMediaUrl(img)}
                            onClick={() => onIndexChange(idx)}
                            sx={{
                                width: 42,
                                height: 42,
                                borderRadius: "6px",
                                objectFit: "cover",
                                cursor: "pointer",
                                border: idx === currentIndex ? "2px solid #F2A900" : "2px solid transparent",
                                opacity: idx === currentIndex ? 1 : 0.6,
                                transition: "all 0.2s ease",
                            }}
                        />
                    ))}
                </Box>
            )}
        </Dialog>
    );
};