import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { useMemo } from "react";
import { AuthProvider, useAuth } from "../contexts/AuthProvider";
import { AppShell } from "../components/AppShell";

function AppContent({ Component, pageProps, router }: AppProps) {
  const { user, loading } = useAuth();

  // Pages that do not need authentication (e.g. login)
  const isPublicPage = router.pathname === "/";

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#111827' }}>
        {/* Simple loader */}
        <div style={{ color: '#007FFF', fontFamily: 'sans-serif', fontWeight: 600 }}>Carregando plataforma...</div>
      </div>
    );
  }

  if (isPublicPage) {
    return <Component {...pageProps} />;
  }

  // Wrap private pages in AppShell
  return (
    <AppShell>
      <Component {...pageProps} />
    </AppShell>
  );
}

export default function App(props: AppProps) {
  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: "dark",
          primary: {
            main: "#007FFF", // Primary 500 (Azul Institucional)
            light: "#0068D6", // Primary 600
            dark: "#003C82", // Primary 800
          },
          secondary: {
            main: "#00B7B3", // Turquesa 500
            light: "#2FD1CD", // Turquesa 400
            dark: "#0051A8", // Azul 700 (Primary 700)
          },
          success: {
            main: "#00A870", // Destaque - Verde Clínico
          },
          background: {
            default: "#111827", // Neutrals 900
            paper: "#1F2937",   // Neutrals 800
          },
          text: {
            primary: "#F9FAFB", // Neutrals 50
            secondary: "#9CA3AF", // Neutrals 400
          },
          divider: "#374151", // Neutrals 700
        },
        typography: {
          fontFamily: "'Inter', sans-serif",
          h1: {
            fontWeight: 700,
            fontSize: "64px",
            lineHeight: "72px",
          },
          h2: {
            fontWeight: 700,
            fontSize: "48px",
            lineHeight: "56px",
          },
          h3: {
            fontWeight: 600,
            fontSize: "36px",
            lineHeight: "44px",
          },
          h4: {
            fontWeight: 600,
            fontSize: "28px",
            lineHeight: "36px",
          },
          h5: {
            fontWeight: 600,
            fontSize: "24px",
            lineHeight: "32px",
          },
          h6: {
            fontWeight: 500,
          },
          body1: {
            fontSize: "16px",
            lineHeight: "28px", // FGM Body
          },
          body2: {
            fontSize: "14px",
            lineHeight: "20px", // FGM Caption/Body Small
          },
          caption: {
            fontSize: "12px",
            lineHeight: "16px",
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
                borderRadius: 12, // CARDS 12px
                border: "1px solid #374151", // Neutrals 700
                boxShadow: "0px 8px 24px rgba(0,0,0,0.10)", // Shadow MEDIUM
              },
            },
          },
          MuiButton: {
            styleOverrides: {
              root: {
                borderRadius: 8, // BOTÕES 8px
                transition: "all 0.2s ease-in-out",
                boxShadow: "0px 2px 8px rgba(0,0,0,0.08)", // Shadow SMALL
                "&:hover": {
                  transform: "translateY(-1px)",
                  boxShadow: "0px 8px 24px rgba(0, 127, 255, 0.2)", // Medium shadow with primary glow
                },
              },
            },
          },
          MuiOutlinedInput: {
            styleOverrides: {
              root: {
                borderRadius: 8, // Shapes border radius (Inputs 8px)
              },
            },
          },
          MuiTableCell: {
            styleOverrides: {
              root: {
                borderBottom: "1px solid #374151",
              },
              head: {
                fontWeight: 600,
                backgroundColor: "#1F2937",
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
      <AuthProvider>
        <AppContent {...props} />
      </AuthProvider>
    </ThemeProvider>
  );
}
