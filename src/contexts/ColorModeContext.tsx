import React, { createContext, useMemo, useState, useEffect } from "react";
import { ThemeProvider, createTheme } from "@mui/material/styles";

interface ColorModeContextType {
  toggleColorMode: () => void;
  mode: "light" | "dark";
}

export const ColorModeContext = createContext<ColorModeContextType>({
  toggleColorMode: () => {},
  mode: "light",
});

export const ColorModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setMode] = useState<"light" | "dark">("light"); // Default is light

  useEffect(() => {
    // Load from localStorage if available
    const savedMode = localStorage.getItem("themeMode");
    if (savedMode === "dark" || savedMode === "light") {
      setMode(savedMode);
    }
  }, []);

  const colorMode = useMemo(
    () => ({
      toggleColorMode: () => {
        setMode((prevMode) => {
          const newMode = prevMode === "light" ? "dark" : "light";
          localStorage.setItem("themeMode", newMode);
          return newMode;
        });
      },
      mode,
    }),
    [mode]
  );

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode,
          primary: {
            main: "#007FFF", // Primary 500
            light: "#0068D6", // Primary 600
            dark: "#003C82", // Primary 800
          },
          secondary: {
            main: "#00B7B3", // Turquesa 500
            light: "#2FD1CD", // Turquesa 400
            dark: "#0051A8", // Azul 700
          },
          success: {
            main: "#00A870", // Destaque Verde Clínico
          },
          background: {
            default: mode === "light" ? "#F4F5F7" : "#111827", // Evita branco puro no light
            paper: mode === "light" ? "#FAFAFB" : "#1F2937",   // Evita branco puro
          },
          text: {
            primary: mode === "light" ? "#1F2937" : "#F9FAFB", // Evita preto puro no light
            secondary: mode === "light" ? "#4B5563" : "#9CA3AF",
          },
          divider: mode === "light" ? "#E5E7EB" : "#374151",
        },
        typography: {
          fontFamily: "'Inter', sans-serif",
          h1: { fontWeight: 700, fontSize: "64px", lineHeight: "72px" },
          h2: { fontWeight: 700, fontSize: "48px", lineHeight: "56px" },
          h3: { fontWeight: 600, fontSize: "36px", lineHeight: "44px" },
          h4: { fontWeight: 600, fontSize: "28px", lineHeight: "36px" },
          h5: { fontWeight: 600, fontSize: "24px", lineHeight: "32px" },
          h6: { fontWeight: 500 },
          body1: { fontSize: "16px", lineHeight: "28px" },
          body2: { fontSize: "14px", lineHeight: "20px" },
          caption: { fontSize: "12px", lineHeight: "16px" },
          button: { textTransform: "none", fontWeight: 600 },
        },
        components: {
          MuiPaper: {
            styleOverrides: {
              root: {
                backgroundImage: "none",
                borderRadius: 12,
                border: `1px solid ${mode === "light" ? "#E5E7EB" : "#374151"}`,
                boxShadow: mode === "light" 
                  ? "0px 4px 12px rgba(0,0,0,0.05)" 
                  : "0px 8px 24px rgba(0,0,0,0.10)",
              },
            },
          },
          MuiButton: {
            styleOverrides: {
              root: {
                borderRadius: 8,
                transition: "all 0.2s ease-in-out",
                boxShadow: "0px 2px 8px rgba(0,0,0,0.08)",
                "&:hover": {
                  transform: "translateY(-1px)",
                  boxShadow: "0px 8px 24px rgba(0, 127, 255, 0.2)",
                },
              },
            },
          },
          MuiOutlinedInput: {
            styleOverrides: {
              root: {
                borderRadius: 8,
              },
            },
          },
          MuiTableCell: {
            styleOverrides: {
              root: {
                borderBottom: `1px solid ${mode === "light" ? "#E5E7EB" : "#374151"}`,
              },
              head: {
                fontWeight: 600,
                backgroundColor: mode === "light" ? "#F9FAFB" : "#1F2937",
                backdropFilter: "blur(8px)",
              },
            },
          },
        },
      }),
    [mode]
  );

  return (
    <ColorModeContext.Provider value={colorMode}>
      <ThemeProvider theme={theme}>{children}</ThemeProvider>
    </ColorModeContext.Provider>
  );
};
