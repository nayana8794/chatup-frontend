// chatup/frontend/src/context/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect } from "react";

export interface UserData {
    user_id: string;
    tenant_id?: string;
    full_name: string;
    role: string;
    language: string;
    access_token: string;
    must_change_password?: boolean;
}

interface AuthContextType {
    user: UserData | null;
    login: (userData: UserData) => void;
    logout: () => void;
    clearMustChangePassword: () => void;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    login: () => { },
    logout: () => { },
    clearMustChangePassword: () => { },
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<UserData | null>(null);

    useEffect(() => {
        const storedUser = localStorage.getItem("chatup_user");
        if (storedUser) {
            setUser(JSON.parse(storedUser));
        }
    }, []);

    const login = (userData: UserData) => {
        setUser(userData);
        localStorage.setItem("chatup_token", userData.access_token);
        localStorage.setItem("chatup_user", JSON.stringify(userData));
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem("chatup_token");
        localStorage.removeItem("chatup_user");
    };

    const clearMustChangePassword = () => {
        if (user) {
            const updatedUser = { ...user, must_change_password: false };
            setUser(updatedUser);
            localStorage.setItem("chatup_user", JSON.stringify(updatedUser));
        }
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, clearMustChangePassword }}>
            {children}
        </AuthContext.Provider>
    );
};