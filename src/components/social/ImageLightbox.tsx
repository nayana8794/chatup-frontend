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
            open={open}
            onClose={onClose}
            maxWidth={false}
            slotProps={{
                paper: {
                    sx: {
                        backgroundColor: "rgba(10, 15, 29, 0.96)",
                        boxShadow: "none",
                        margin: 0,
                        width: "100vw",
                        height: "100vh",
                        maxHeight: "100vh",
                        maxWidth: "100vw",
                        borderRadius: 0,
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "center",
                        alignItems: "center",
                        position: "relative",
                        overflow: "hidden",
                    },
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
                    zIndex: 10,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: { xs: "16px", sm: "24px" },
                    background: "linear-gradient(to bottom, rgba(0,0,0,0.8), transparent)",
                }}
            >
                <Chip
                    label={`${currentIndex + 1} / ${total}`}
                    sx={{
                        backgroundColor: "rgba(255, 255, 255, 0.2)",
                        color: "#FFFFFF",
                        fontWeight: 700,
                        fontSize: "0.95rem",
                        backdropFilter: "blur(4px)",
                    }}
                />

                <IconButton
                    onClick={onClose}
                    sx={{
                        color: "#FFFFFF",
                        backgroundColor: "rgba(255, 255, 255, 0.15)",
                        "&:hover": { backgroundColor: "rgba(255, 255, 255, 0.3)" },
                        width: 48,
                        height: 48,
                    }}
                    aria-label="Close photo viewer"
                >
                    <CloseIcon fontSize="medium" />
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
                        maxWidth: "100vw",
                        maxHeight: "85vh",
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
                        left: { xs: 8, sm: 24 },
                        top: "50%",
                        transform: "translateY(-50%)",
                        zIndex: 10,
                        color: "#FFFFFF",
                        backgroundColor: "rgba(0, 47, 108, 0.75)",
                        border: "1px solid rgba(242, 169, 0, 0.5)",
                        "&:hover": { backgroundColor: "rgba(0, 47, 108, 0.95)" },
                        width: { xs: 48, sm: 56 },
                        height: { xs: 48, sm: 56 },
                    }}
                    aria-label="Previous photo"
                >
                    <ArrowBackIosNewIcon fontSize="medium" />
                </IconButton>
            )}

            {/* Navigation Arrow: Next */}
            {total > 1 && (
                <IconButton
                    onClick={handleNext}
                    sx={{
                        position: "absolute",
                        right: { xs: 8, sm: 24 },
                        top: "50%",
                        transform: "translateY(-50%)",
                        zIndex: 10,
                        color: "#FFFFFF",
                        backgroundColor: "rgba(0, 47, 108, 0.75)",
                        border: "1px solid rgba(242, 169, 0, 0.5)",
                        "&:hover": { backgroundColor: "rgba(0, 47, 108, 0.95)" },
                        width: { xs: 48, sm: 56 },
                        height: { xs: 48, sm: 56 },
                    }}
                    aria-label="Next photo"
                >
                    <ArrowForwardIosIcon fontSize="medium" />
                </IconButton>
            )}

            {/* Bottom Thumbnail Strip */}
            {total > 1 && (
                <Box
                    sx={{
                        position: "absolute",
                        bottom: 16,
                        display: "flex",
                        gap: 1.5,
                        zIndex: 10,
                        padding: "8px 16px",
                        backgroundColor: "rgba(0, 0, 0, 0.5)",
                        borderRadius: "24px",
                        backdropFilter: "blur(6px)",
                        maxWidth: "90vw",
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