import "@/styles/globals.css";
import type { AppProps } from "next/app";
import CssBaseline from "@mui/material/CssBaseline";
import { useEffect } from "react";
import { AuthProvider, useAuth } from "../contexts/AuthProvider";
import { PerformanceProvider } from "../contexts/PerformanceContext";
import { AppShell } from "../components/AppShell";
import type { NextRouter } from "next/router";
import { ColorModeProvider } from "../contexts/ColorModeContext";

function AuthRedirect({ router }: { router: NextRouter }) {
  useEffect(() => {
    router.replace("/");
  }, [router]);
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#111827' }}>
      <div style={{ color: '#007FFF', fontFamily: 'sans-serif', fontWeight: 600 }}>Redirecionando para login...</div>
    </div>
  );
}

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

  if (!user) {
    return <AuthRedirect router={router} />;
  }

  const ComponentWithLayout = Component as React.ComponentType & { getLayout?: (page: React.ReactNode) => React.ReactNode };
  const getLayout = ComponentWithLayout.getLayout || ((page: React.ReactNode) => page);

  // Wrap private pages in AppShell
  return (
    <AppShell>
      {getLayout(<Component {...pageProps} />)}
    </AppShell>
  );
}

export default function App(props: AppProps) {
  return (
    <ColorModeProvider>
      <CssBaseline />
      <AuthProvider>
        <PerformanceProvider>
          <AppContent {...props} />
        </PerformanceProvider>
      </AuthProvider>
    </ColorModeProvider>
  );
}
