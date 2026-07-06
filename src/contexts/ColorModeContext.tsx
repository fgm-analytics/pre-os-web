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
            main: "#017FFF", // Bright Blue
            light: "#4dabff",
            dark: "#0059b2",
          },
          secondary: {
            main: "#8ec2c2", // Teal Mid
            light: "#b7d5d5",
            dark: "#5f9191",
          },
          success: {
            main: "#00A870",
          },
          background: {
            default: mode === "light" ? "#ffffff" : "#1a1a1a",
            paper: mode === "light" ? "#ffffff" : "#222222",
          },
          text: {
            primary: mode === "light" ? "#444444" : "#f5f5f5", // Charcoal ink / Off-white
            secondary: mode === "light" ? "#888888" : "#a3a3a3",
          },
          divider: mode === "light" ? "#d9d9d9" : "#333333",
        },
        typography: {
          fontFamily: "'Inter', sans-serif",
          h1: { fontWeight: 700, fontSize: "51.2px", lineHeight: "56.32px" },
          h2: { fontWeight: 700, fontSize: "41.6px", lineHeight: "45.76px" },
          h3: { fontWeight: 700, fontSize: "30.4px", lineHeight: "33.44px" },
          h4: { fontWeight: 700, fontSize: "24px", lineHeight: "27.2px" },
          h5: { fontWeight: 700, fontSize: "22.4px", lineHeight: "31.36px" },
          h6: { fontWeight: 700 },
          body1: { fontSize: "16px", lineHeight: "27.2px", fontWeight: 400 }, // 1.7x line height
          body2: { fontSize: "14px", lineHeight: "20px" },
          caption: { fontSize: "12.8px", lineHeight: "17.92px", fontWeight: 700 }, // label-sm from design
          button: { textTransform: "none", fontWeight: 400 },
        },
        components: {
          MuiPaper: {
            styleOverrides: {
              root: {
                backgroundImage: "none",
                borderRadius: 32, // 32px radius dominant (lg)
                border: `1px solid ${mode === "light" ? "#d9d9d9" : "#333333"}`,
                boxShadow: mode === "light" 
                  ? "none" 
                  : "0px 8px 24px rgba(0,0,0,0.20)",
              },
            },
          },
          MuiButton: {
            styleOverrides: {
              root: {
                borderRadius: 32,
                transition: "all 0.2s ease-in-out",
                boxShadow: "none",
                backgroundColor: mode === "light" ? "#444444" : "#f5f5f5",
                color: mode === "light" ? "#ffffff" : "#222222",
                "&:hover": {
                  transform: "translateY(-1px)",
                  boxShadow: "0px 4px 12px rgba(0, 0, 0, 0.1)",
                  backgroundColor: mode === "light" ? "#222222" : "#ffffff",
                },
              },
              outlined: {
                backgroundColor: "transparent",
                color: mode === "light" ? "#444444" : "#f5f5f5",
                borderColor: mode === "light" ? "#d9d9d9" : "#333333",
                "&:hover": {
                  backgroundColor: mode === "light" ? "#f3f5f7" : "#333333",
                  borderColor: mode === "light" ? "#888888" : "#888888",
                },
              },
              text: {
                backgroundColor: "transparent",
                color: mode === "light" ? "#444444" : "#f5f5f5",
                "&:hover": {
                  backgroundColor: mode === "light" ? "#f3f5f7" : "#333333",
                }
              }
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
                borderBottom: `1px solid ${mode === "light" ? "#d9d9d9" : "#333333"}`,
              },
              head: {
                fontWeight: 700,
                backgroundColor: mode === "light" ? "#ffffff" : "#222222",
                color: mode === "light" ? "#888888" : "#a3a3a3",
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
