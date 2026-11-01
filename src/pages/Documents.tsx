// chatup/frontend/src/pages/Documents.tsx
import React, { useState, useEffect, useCallback } from "react";
import {
    Container,
    Box,
    Typography,
    Button,
    Card,
    CardContent,
    Stack,
    Chip,
    TextField,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    MenuItem,
    Alert,
    CircularProgress,
    InputAdornment,
    IconButton,
    Tooltip,
    FormControlLabel,
    Switch,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import SearchIcon from "@mui/icons-material/Search";
import FolderSpecialIcon from "@mui/icons-material/FolderSpecial";
import DownloadIcon from "@mui/icons-material/Download";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import DeleteIcon from "@mui/icons-material/Delete";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import ArticleIcon from "@mui/icons-material/Article";
import ImageIcon from "@mui/icons-material/Image";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import LockIcon from "@mui/icons-material/Lock";
import ShieldIcon from "@mui/icons-material/Shield";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { useRealtime } from "../context/useRealtime";
import apiClient from "../api/client";

interface ClubDoc {
    id: string;
    title: string;
    description?: string;
    category: "BYLAWS" | "DISTRICT" | "FINANCIAL" | "CERTIFICATES" | "PROJECTS" | "GENERAL";
    file_url: string;
    file_name: string;
    file_size_bytes: number;
    file_type: string;
    uploader_name: string;
    is_board_only: boolean;
    created_at: string;
}

const CATEGORY_CHIPS = [
    { key: "ALL", label: "all_documents" },
    { key: "BYLAWS", label: "cat_bylaws" },
    { key: "DISTRICT", label: "cat_district" },
    { key: "FINANCIAL", label: "cat_financial" },
    { key: "CERTIFICATES", label: "cat_certificates" },
    { key: "PROJECTS", label: "cat_projects" },
];

const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
};

const getFileIcon = (fileType: string) => {
    const ft = fileType.toLowerCase();
    if (ft === "pdf") return <PictureAsPdfIcon sx={{ fontSize: 36, color: "#d32f2f" }} />;
    if (["doc", "docx", "txt"].includes(ft)) return <ArticleIcon sx={{ fontSize: 36, color: "#1976D2" }} />;
    if (["jpg", "jpeg", "png", "webp"].includes(ft)) return <ImageIcon sx={{ fontSize: 36, color: "#388e3c" }} />;
    return <InsertDriveFileIcon sx={{ fontSize: 36, color: "#f57c00" }} />;
};

export const Documents: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const { t } = useTranslation();
    const { user } = useAuth();
    const { lastEvent } = useRealtime();

    const isOfficer = [
        "SUPER_ADMIN",
        "PRESIDENT",
        "VICE_PRESIDENT",
        "SECRETARY",
        "VICE_SECRETARY",
        "PLANNER",
        "VICE_PLANNER",
        "TREASURER",
        "VICE_TREASURER",
    ].includes(user?.role || "");

    const [documents, setDocuments] = useState<ClubDoc[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedCategory, setSelectedCategory] = useState("ALL");
    const [filterBoardOnly, setFilterBoardOnly] = useState<boolean | null>(null);
    const [searchQuery, setSearchQuery] = useState("");

    // Upload Modal State
    const [openUpload, setOpenUpload] = useState(false);
    const [uploadTitle, setUploadTitle] = useState("");
    const [uploadCategory, setUploadCategory] = useState("BYLAWS");
    const [uploadDesc, setUploadDesc] = useState("");
    const [isBoardOnly, setIsBoardOnly] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState("");

    const fetchDocuments = useCallback(async () => {
        try {
            setLoading(true);
            const res = await apiClient.get<ClubDoc[]>("/documents", {
                params: {
                    category: selectedCategory !== "ALL" ? selectedCategory : undefined,
                    search: searchQuery || undefined,
                    board_only: filterBoardOnly !== null ? filterBoardOnly : undefined,
                },
            });
            setDocuments(res.data);
        } catch (err) {
            console.error("Failed to fetch documents:", err);
        } finally {
            setLoading(false);
        }
    }, [selectedCategory, searchQuery, filterBoardOnly]);

    useEffect(() => {
        fetchDocuments();
    }, [fetchDocuments]);

    useEffect(() => {
        if (lastEvent?.type === "DOCUMENT_UPLOADED" || lastEvent?.type === "DOCUMENT_DELETED") {
            fetchDocuments();
        }
    }, [lastEvent, fetchDocuments]);

    const handleUploadSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedFile) {
            setUploadError(t("please_select_file", "Please select a file to upload."));
            return;
        }

        setUploadError("");
        setUploading(true);

        const formData = new FormData();
        formData.append("title", uploadTitle.trim());
        formData.append("category", uploadCategory);
        formData.append("is_board_only", String(isBoardOnly));
        if (uploadDesc.trim()) formData.append("description", uploadDesc.trim());
        formData.append("file", selectedFile);

        try {
            await apiClient.post("/documents", formData, {
                headers: { "Content-Type": "multipart/form-data" },
            });
            setOpenUpload(false);
            setUploadTitle("");
            setUploadDesc("");
            setIsBoardOnly(false);
            setSelectedFile(null);
            fetchDocuments();
        } catch (err: any) {
            setUploadError(err.response?.data?.detail || t("upload_failed", "Failed to upload document"));
        } finally {
            setUploading(false);
        }
    };

    const handleDeleteDocument = async (docId: string, title: string) => {
        if (!window.confirm(`${t("confirm_delete_doc", "Delete official document")} "${title}"?`)) return;
        try {
            await apiClient.delete(`/documents/${docId}`);
            fetchDocuments();
        } catch (err: any) {
            alert(err.response?.data?.detail || "Failed to delete document");
        }
    };

    return (
        <Container maxWidth="lg" sx={{ py: { xs: 2, sm: 3.5 }, px: { xs: 1.5, sm: 3 } }}>
            {/* Top Header Bar: Center-Aligned Title matching Events & Voting */}
            <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={2}
                sx={{
                    justifyContent: "space-between",
                    alignItems: { xs: "stretch", sm: "center" },
                    mb: 3,
                }}
            >
                <Box sx={{ minWidth: { sm: 200 } }}>
                    <Button
                        startIcon={<ArrowBackIcon />}
                        onClick={onBack}
                        variant="outlined"
                        sx={{
                            fontWeight: 800,
                            minHeight: 44,
                            borderRadius: 2.5,
                            px: 2.5,
                            textTransform: "none",
                            fontSize: "0.95rem",
                            borderColor: "rgba(0, 47, 108, 0.35)",
                            color: "primary.main",
                            width: { xs: "100%", sm: "auto" },
                        }}
                    >
                        {t("back_to_dashboard", "Back to Dashboard")}
                    </Button>
                </Box>

                <Typography
                    variant="h5"
                    sx={{
                        fontWeight: 900,
                        fontSize: { xs: "1.25rem", sm: "1.65rem" },
                        color: "text.primary",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 1.2,
                        textAlign: "center",
                        flex: 1,
                    }}
                >
                    📁 {t("documents_title", "Document & Certificate Repository")}
                </Typography>

                <Box
                    sx={{
                        minWidth: { sm: 200 },
                        display: "flex",
                        justifyContent: { xs: "center", sm: "flex-end" },
                    }}
                >
                    {isOfficer ? (
                        <Button
                            variant="contained"
                            color="primary"
                            startIcon={<UploadFileIcon />}
                            onClick={() => setOpenUpload(true)}
                            sx={{
                                fontWeight: 900,
                                minHeight: 44,
                                borderRadius: 2.5,
                                px: 2.5,
                                bgcolor: "#002F6C",
                                textTransform: "none",
                                fontSize: "0.95rem",
                                width: { xs: "100%", sm: "auto" },
                                "&:hover": { bgcolor: "#001f4d" },
                            }}
                        >
                            {t("upload_document_btn", "Upload Document")}
                        </Button>
                    ) : (
                        <Box sx={{ width: 0, display: { xs: "none", sm: "block" } }} />
                    )}
                </Box>
            </Stack>

            {/* Search & Category Filter Bar */}
            <Card elevation={1} sx={{ p: { xs: 1.8, sm: 2 }, borderRadius: 3.5, mb: 3 }}>
                <Stack spacing={1.5}>
                    <TextField
                        fullWidth
                        placeholder={t("search_documents_placeholder", "Search official files by title or description...")}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        slotProps={{
                            input: {
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchIcon color="action" />
                                    </InputAdornment>
                                ),
                            },
                        }}
                    />

                    <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1 }}>
                        {CATEGORY_CHIPS.map((cat) => (
                            <Chip
                                key={cat.key}
                                label={t(cat.label, cat.key)}
                                onClick={() => {
                                    setSelectedCategory(cat.key);
                                    setFilterBoardOnly(null);
                                }}
                                color={selectedCategory === cat.key && filterBoardOnly === null ? "primary" : "default"}
                                variant={selectedCategory === cat.key && filterBoardOnly === null ? "filled" : "outlined"}
                                sx={{ fontWeight: 800, borderRadius: 2 }}
                            />
                        ))}

                        {/* Dedicated Board-Only Confidential Filter (Officers Only) */}
                        {isOfficer && (
                            <Chip
                                icon={<LockIcon sx={{ fontSize: 14 }} />}
                                label={t("cat_board_only", "Board Only (Confidential)")}
                                onClick={() => {
                                    setFilterBoardOnly(filterBoardOnly === true ? null : true);
                                    setSelectedCategory("ALL");
                                }}
                                color={filterBoardOnly === true ? "warning" : "default"}
                                variant={filterBoardOnly === true ? "filled" : "outlined"}
                                sx={{
                                    fontWeight: 900,
                                    borderRadius: 2,
                                    bgcolor: filterBoardOnly === true ? "#F2A900" : undefined,
                                    color: filterBoardOnly === true ? "#002F6C" : undefined,
                                }}
                            />
                        )}
                    </Box>
                </Stack>
            </Card>

            {/* Documents List */}
            {loading ? (
                <Box sx={{ display: "flex", justifyContent: "center", p: 6 }}>
                    <CircularProgress size={50} />
                </Box>
            ) : documents.length === 0 ? (
                <Card elevation={1} sx={{ p: { xs: 4, sm: 5 }, borderRadius: 4, textAlign: "center", border: "1px solid", borderColor: "divider" }}>
                    <FolderSpecialIcon sx={{ fontSize: 60, color: "text.secondary", mb: 1.5 }} />
                    <Typography variant="h6" sx={{ fontWeight: 800, mb: 0.5 }}>
                        {t("no_documents_found", "No Official Documents Found")}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        {t("no_documents_desc", "There are currently no documents uploaded in this category.")}
                    </Typography>
                </Card>
            ) : (
                <Stack spacing={2}>
                    {documents.map((doc) => (
                        <Card
                            key={doc.id}
                            elevation={2}
                            sx={{
                                borderRadius: 3.5,
                                borderLeft: "6px solid",
                                borderLeftColor: doc.is_board_only ? "#F2A900" : "#002F6C",
                            }}
                        >
                            <CardContent sx={{ p: { xs: 1.8, sm: 2.5 } }}>
                                <Box
                                    sx={{
                                        display: "flex",
                                        flexDirection: { xs: "column", sm: "row" },
                                        justifyContent: "space-between",
                                        alignItems: { xs: "flex-start", sm: "center" },
                                        gap: 2,
                                    }}
                                >
                                    <Box sx={{ display: "flex", alignItems: "center", gap: 2, minWidth: 0, flex: 1 }}>
                                        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                            {getFileIcon(doc.file_type)}
                                        </Box>
                                        <Box sx={{ minWidth: 0, flex: 1 }}>
                                            <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", mb: 0.3 }}>
                                                <Typography variant="h6" sx={{ fontWeight: 800, color: "text.primary", fontSize: { xs: "1rem", sm: "1.1rem" } }} noWrap>
                                                    {doc.title}
                                                </Typography>

                                                {/* Security Badge for Board-Only Documents */}
                                                {doc.is_board_only && (
                                                    <Chip
                                                        icon={<ShieldIcon sx={{ fontSize: 13, color: "#002F6C !important" }} />}
                                                        label={t("board_only_badge", "Board Confidential")}
                                                        size="small"
                                                        sx={{
                                                            bgcolor: "rgba(242, 169, 0, 0.2)",
                                                            color: "#002F6C",
                                                            border: "1px solid #F2A900",
                                                            fontWeight: 900,
                                                            fontSize: "0.68rem",
                                                            height: 22,
                                                        }}
                                                    />
                                                )}
                                            </Box>

                                            {doc.description && (
                                                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }} noWrap>
                                                    {doc.description}
                                                </Typography>
                                            )}

                                            <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", gap: 0.5 }}>
                                                <Chip
                                                    label={t(`cat_${doc.category.toLowerCase()}`, doc.category)}
                                                    size="small"
                                                    sx={{ bgcolor: "rgba(0, 47, 108, 0.08)", color: "#002F6C", fontWeight: 800, height: 22 }}
                                                />
                                                <Typography variant="caption" color="text.secondary">
                                                    {formatBytes(doc.file_size_bytes)} • {new Date(doc.created_at).toLocaleDateString()} • {doc.uploader_name}
                                                </Typography>
                                            </Stack>
                                        </Box>
                                    </Box>

                                    {/* Action Buttons */}
                                    <Stack direction="row" spacing={1} sx={{ alignSelf: { xs: "flex-end", sm: "center" } }}>
                                        <Tooltip title={t("open_preview", "Open / Preview")}>
                                            <IconButton
                                                color="primary"
                                                component="a"
                                                href={doc.file_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                sx={{ border: "1px solid", borderColor: "divider" }}
                                            >
                                                <OpenInNewIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>

                                        <Tooltip title={t("download_file", "Download")}>
                                            <IconButton
                                                color="success"
                                                component="a"
                                                href={doc.file_url}
                                                download={doc.file_name}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                sx={{ border: "1px solid", borderColor: "divider" }}
                                            >
                                                <DownloadIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>

                                        {isOfficer && (
                                            <Tooltip title={t("delete_btn", "Delete")}>
                                                <IconButton
                                                    color="error"
                                                    onClick={() => handleDeleteDocument(doc.id, doc.title)}
                                                    sx={{ border: "1px solid", borderColor: "divider" }}
                                                >
                                                    <DeleteIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                        )}
                                    </Stack>
                                </Box>
                            </CardContent>
                        </Card>
                    ))}
                </Stack>
            )}

            {/* Upload Document Dialog with Board-Only Switch */}
            <Dialog open={openUpload} onClose={() => !uploading && setOpenUpload(false)} maxWidth="sm" fullWidth sx={{ "& .MuiDialog-paper": { m: 2, borderRadius: 3.5 } }}>
                <DialogTitle sx={{ fontWeight: 800 }}>📁 {t("upload_document_modal_title", "Upload Official Club Document")}</DialogTitle>
                <Box component="form" onSubmit={handleUploadSubmit}>
                    <DialogContent dividers>
                        {uploadError && <Alert severity="error" sx={{ mb: 2 }}>{uploadError}</Alert>}

                        <TextField
                            fullWidth
                            required
                            label={t("doc_title_label", "Document Title")}
                            value={uploadTitle}
                            onChange={(e) => setUploadTitle(e.target.value)}
                            margin="normal"
                            placeholder="e.g. Club Bylaws & Constitution 2026"
                        />

                        <TextField
                            fullWidth
                            select
                            label={t("doc_category_label", "Category / Folder")}
                            value={uploadCategory}
                            onChange={(e) => setUploadCategory(e.target.value)}
                            margin="normal"
                        >
                            <MenuItem value="BYLAWS">{t("cat_bylaws", "Bylaws & Constitution")}</MenuItem>
                            <MenuItem value="DISTRICT">{t("cat_district", "District Circulars")}</MenuItem>
                            <MenuItem value="FINANCIAL">{t("cat_financial", "Financial Audits & Statements")}</MenuItem>
                            <MenuItem value="CERTIFICATES">{t("cat_certificates", "Certificates & Awards")}</MenuItem>
                            <MenuItem value="PROJECTS">{t("cat_projects", "Charity & Project Reports")}</MenuItem>
                            <MenuItem value="GENERAL">{t("cat_general", "General Documents")}</MenuItem>
                        </TextField>

                        <TextField
                            fullWidth
                            multiline
                            rows={2}
                            label={t("doc_desc_label", "Description (Optional)")}
                            value={uploadDesc}
                            onChange={(e) => setUploadDesc(e.target.value)}
                            margin="normal"
                            placeholder="Brief summary or purpose of this document"
                        />

                        {/* Board Only Confidential Toggle Switch */}
                        <Box sx={{ mt: 2, p: 1.5, bgcolor: "rgba(242, 169, 0, 0.08)", borderRadius: 2.5, border: "1px solid rgba(242, 169, 0, 0.3)" }}>
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={isBoardOnly}
                                        onChange={(e) => setIsBoardOnly(e.target.checked)}
                                        color="warning"
                                    />
                                }
                                label={
                                    <Box>
                                        <Typography variant="subtitle2" sx={{ fontWeight: 800, color: "#002F6C" }}>
                                            🔒 {t("restrict_board_only", "Restrict to Board Officers Only")}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            {t("restrict_board_only_desc", "Regular club members will not be able to view or download this file.")}
                                        </Typography>
                                    </Box>
                                }
                                sx={{ m: 0, width: "100%" }}
                            />
                        </Box>

                        <Box sx={{ mt: 2.5, p: 2, border: "2px dashed #002F6C", borderRadius: 3, textAlign: "center", bgcolor: "rgba(0, 47, 108, 0.03)" }}>
                            <input
                                type="file"
                                id="doc-file-input"
                                style={{ display: "none" }}
                                onChange={(e) => {
                                    if (e.target.files && e.target.files[0]) {
                                        setSelectedFile(e.target.files[0]);
                                        if (!uploadTitle) {
                                            setUploadTitle(e.target.files[0].name.replace(/\.[^/.]+$/, ""));
                                        }
                                    }
                                }}
                            />
                            <label htmlFor="doc-file-input">
                                <Button variant="outlined" component="span" startIcon={<UploadFileIcon />} sx={{ fontWeight: 800, mb: 1 }}>
                                    {t("choose_file_btn", "Choose File (PDF, DOCX, Images)")}
                                </Button>
                            </label>
                            {selectedFile && (
                                <Typography variant="body2" sx={{ fontWeight: 700, color: "success.main", mt: 1 }}>
                                    ✓ {selectedFile.name} ({formatBytes(selectedFile.size)})
                                </Typography>
                            )}
                        </Box>
                    </DialogContent>
                    <DialogActions sx={{ p: 2 }}>
                        <Button onClick={() => setOpenUpload(false)} disabled={uploading}>
                            {t("cancel_btn", "Cancel")}
                        </Button>
                        <Button type="submit" variant="contained" disabled={uploading} sx={{ fontWeight: 800, bgcolor: "#002F6C" }}>
                            {uploading ? <CircularProgress size={24} color="inherit" /> : t("confirm_upload_btn", "Upload to Repository")}
                        </Button>
                    </DialogActions>
                </Box>
            </Dialog>
        </Container>
    );
};