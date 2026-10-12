// chatup/frontend/src/theme/ThemeContext.tsx
import React, { createContext, useContext, useState, useMemo } from "react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";

interface ThemeContextType {
    mode: "light" | "dark";
    toggleColorMode: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
    mode: "light",
    toggleColorMode: () => { },
});

export const useAppTheme = () => useContext(ThemeContext);

export const AppThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [mode, setMode] = useState<"light" | "dark">("light");

    const toggleColorMode = () => {
        setMode((prev) => (prev === "light" ? "dark" : "light"));
    };

    const theme = useMemo(
        () =>
            createTheme({
                palette: {
                    mode,
                    primary: {
                        main: mode === "light" ? "#002F6C" : "#4A90E2", // Lions Classic Navy
                    },
                    secondary: {
                        main: "#F2A900", // Lions Gold
                    },
                    background: {
                        default: mode === "light" ? "#F8F9FA" : "#121212",
                        paper: mode === "light" ? "#FFFFFF" : "#1E1E1E",
                    },
                },
                typography: {
                    fontFamily: "'Roboto', 'Helvetica', 'Arial', sans-serif",
                    fontSize: 16, // Senior Friendly base font (Default 14px වෙනුවට 16px)
                    h4: {
                        fontWeight: 700,
                        fontSize: "2rem",
                    },
                    button: {
                        textTransform: "none",
                        fontWeight: 600,
                        fontSize: "1.1rem", // Large clear buttons
                    },
                },
                components: {
                    MuiButton: {
                        styleOverrides: {
                            root: {
                                borderRadius: 10,
                                minHeight: 52, // Large touch targets for senior hands
                            },
                        },
                    },
                    MuiTextField: {
                        styleOverrides: {
                            root: {
                                "& .MuiInputBase-root": {
                                    minHeight: 56,
                                    fontSize: "1.1rem",
                                },
                            },
                        },
                    },
                },
            }),
        [mode]
    );

    return (
        <ThemeContext.Provider value={{ mode, toggleColorMode }}>
            <ThemeProvider theme={theme}>
                <CssBaseline />
                {children}
            </ThemeProvider>
        </ThemeContext.Provider>
    );
};