import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { useMemo } from "react";

export default function App({ Component, pageProps }: AppProps) {
  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: "dark",
          primary: {
            main: "#6366f1", // Indigo
            light: "#818cf8",
            dark: "#4f46e5",
          },
          secondary: {
            main: "#14b8a6", // Teal
            light: "#2dd4bf",
            dark: "#0f766e",
          },
          background: {
            default: "#030712", // Very dark blue/gray
            paper: "#0b0f19",   // Dark paper container
          },
          text: {
            primary: "#f3f4f6",
            secondary: "#9ca3af",
          },
          divider: "rgba(255, 255, 255, 0.08)",
        },
        typography: {
          fontFamily: "'Outfit', 'Plus Jakarta Sans', sans-serif",
          h1: {
            fontWeight: 700,
          },
          h2: {
            fontWeight: 700,
          },
          h3: {
            fontWeight: 600,
          },
          h4: {
            fontWeight: 600,
          },
          h5: {
            fontWeight: 500,
          },
          h6: {
            fontWeight: 500,
          },
          button: {
            textTransform: "none",
            fontWeight: 600,
          },
        },
        components: {
          MuiPaper: {
            styleOverrides: {
              root: {
                backgroundImage: "none",
                borderRadius: 12,
                border: "1px solid rgba(255, 255, 255, 0.05)",
              },
            },
          },
          MuiButton: {
            styleOverrides: {
              root: {
                borderRadius: 8,
                transition: "all 0.2s ease-in-out",
                "&:hover": {
                  transform: "translateY(-1px)",
                  boxShadow: "0 4px 12px rgba(99, 102, 241, 0.2)",
                },
              },
            },
          },
          MuiTableCell: {
            styleOverrides: {
              root: {
                borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
              },
              head: {
                fontWeight: 600,
                backgroundColor: "rgba(11, 15, 25, 0.95)",
                backdropFilter: "blur(8px)",
              },
            },
          },
        },
      }),
    []
  );

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Component {...pageProps} />
    </ThemeProvider>
  );
}
