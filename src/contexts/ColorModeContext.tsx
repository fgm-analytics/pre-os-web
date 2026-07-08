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

  useEffect(() => {
    if (mode === "dark") {
      document.documentElement.classList.add("dark-mode");
      document.documentElement.classList.remove("light-mode");
    } else {
      document.documentElement.classList.add("light-mode");
      document.documentElement.classList.remove("dark-mode");
    }
  }, [mode]);

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
            default: mode === "light" ? "#ECF0F3" : "#1E222B",
            paper: mode === "light" ? "#ECF0F3" : "#1E222B",
          },
          text: {
            primary: mode === "light" ? "#444444" : "#f5f5f5", // Charcoal ink / Off-white
            secondary: mode === "light" ? "#666666" : "#a3a3a3",
          },
          divider: mode === "light" ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.05)",
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
          button: { textTransform: "none", fontWeight: 600 },
        },
        components: {
          MuiPaper: {
            styleOverrides: {
              root: {
                backgroundImage: "none",
                borderRadius: 24, // 24px radius dominant (lg)
                border: "none",
                boxShadow: mode === "light" 
                  ? "8px 8px 16px #d1d9e6, -8px -8px 16px #ffffff" 
                  : "8px 8px 16px #13151b, -8px -8px 16px #292f3b",
              },
            },
          },
          MuiButton: {
            styleOverrides: {
              root: {
                borderRadius: 20,
                transition: "all 0.2s ease-in-out",
                fontWeight: 600,
                padding: "8px 20px",
                backgroundColor: mode === "light" ? "#ECF0F3" : "#1E222B",
                color: mode === "light" ? "#444444" : "#f5f5f5",
                boxShadow: mode === "light"
                  ? "4px 4px 8px #d1d9e6, -4px -4px 8px #ffffff"
                  : "4px 4px 8px #13151b, -4px -4px 8px #292f3b",
                "&:hover": {
                  boxShadow: mode === "light"
                    ? "2px 2px 4px #d1d9e6, -2px -2px 4px #ffffff"
                    : "2px 2px 4px #13151b, -2px -2px 4px #292f3b",
                  transform: "translateY(1px)",
                  backgroundColor: mode === "light" ? "#ECF0F3" : "#1E222B",
                },
                "&:active": {
                  boxShadow: mode === "light"
                    ? "inset 3px 3px 6px #d1d9e6, inset -3px -3px 6px #ffffff"
                    : "inset 3px 3px 6px #13151b, inset -3px -3px 6px #292f3b",
                  transform: "translateY(0px)",
                },
              },
              contained: {
                background: "linear-gradient(135deg, #017FFF 0%, #00b4d8 100%)",
                color: "#ffffff",
                boxShadow: mode === "light"
                  ? "4px 4px 8px #d1d9e6, -4px -4px 8px rgba(255,255,255,0.8)"
                  : "4px 4px 8px #13151b, -4px -4px 8px rgba(255,255,255,0.05)",
                "&:hover": {
                  background: "linear-gradient(135deg, #0066cc 0%, #0096c7 100%)",
                  boxShadow: mode === "light"
                    ? "2px 2px 4px #d1d9e6, -2px -2px 4px rgba(255,255,255,0.8)"
                    : "2px 2px 4px #13151b, -2px -2px 4px rgba(255,255,255,0.05)",
                },
                "&:active": {
                  boxShadow: "inset 3px 3px 6px rgba(0,0,0,0.3)",
                },
              },
              outlined: {
                backgroundColor: "transparent",
                color: mode === "light" ? "#017FFF" : "#4dabff",
                border: "none",
                boxShadow: mode === "light"
                  ? "inset 3px 3px 6px #d1d9e6, inset -3px -3px 6px #ffffff"
                  : "inset 3px 3px 6px #13151b, inset -3px -3px 6px #292f3b",
                "&:hover": {
                  border: "none",
                  backgroundColor: mode === "light" ? "rgba(1, 127, 255, 0.05)" : "rgba(77, 171, 255, 0.05)",
                  boxShadow: mode === "light"
                    ? "inset 2px 2px 4px #d1d9e6, inset -2px -2px 4px #ffffff"
                    : "inset 2px 2px 4px #13151b, inset -2px -2px 4px #292f3b",
                },
              },
              text: {
                backgroundColor: "transparent",
                color: mode === "light" ? "#444444" : "#f5f5f5",
                boxShadow: "none",
                "&:hover": {
                  backgroundColor: mode === "light" ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.03)",
                  boxShadow: "none",
                }
              }
            },
          },
          MuiOutlinedInput: {
            styleOverrides: {
              root: {
                borderRadius: 16,
                backgroundColor: mode === "light" ? "#ECF0F3" : "#1E222B",
                boxShadow: mode === "light"
                  ? "inset 3px 3px 6px #d1d9e6, inset -3px -3px 6px #ffffff"
                  : "inset 3px 3px 6px #13151b, inset -3px -3px 6px #292f3b",
                "& .MuiOutlinedInput-notchedOutline": {
                  border: "none",
                },
                "&:hover .MuiOutlinedInput-notchedOutline": {
                  border: "none",
                },
                "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                  border: "none",
                },
              },
            },
          },
          MuiTabs: {
            styleOverrides: {
              root: {
                backgroundColor: mode === "light" ? "#ECF0F3" : "#1E222B",
                borderRadius: 20,
                padding: 4,
                boxShadow: mode === "light"
                  ? "inset 3px 3px 6px #d1d9e6, inset -3px -3px 6px #ffffff"
                  : "inset 3px 3px 6px #13151b, inset -3px -3px 6px #292f3b",
                "& .MuiTabs-indicator": {
                  display: "none",
                },
              },
            },
          },
          MuiTab: {
            styleOverrides: {
              root: {
                borderRadius: 16,
                margin: "2px 6px",
                minHeight: 38,
                padding: "6px 16px",
                fontWeight: 600,
                transition: "all 0.2s ease-in-out",
                color: mode === "light" ? "#666666" : "#a3a3a3",
                "&.Mui-selected": {
                  color: "#017FFF",
                  backgroundColor: mode === "light" ? "#ECF0F3" : "#1E222B",
                  boxShadow: mode === "light"
                    ? "3px 3px 6px #d1d9e6, -3px -3px 6px #ffffff"
                    : "3px 3px 6px #13151b, -3px -3px 6px #292f3b",
                },
              },
            },
          },
          MuiTableCell: {
            styleOverrides: {
              root: {
                borderBottom: `1px solid ${mode === "light" ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.04)"}`,
              },
              head: {
                fontWeight: 700,
                backgroundColor: mode === "light" ? "#ECF0F3" : "#1E222B",
                color: mode === "light" ? "#666666" : "#a3a3a3",
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
