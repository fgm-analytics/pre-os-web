import React, { useState } from 'react';
import { 
  Box, Card, CardContent, TextField, Button, Typography, 
  Alert, CircularProgress, InputAdornment, IconButton, Container
} from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { supabase } from '../lib/supabase';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthProvider';

export default function Login() {
  const router = useRouter();
  const { user } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Redirect if already logged in
  React.useEffect(() => {
    if (user) {
      router.push('/performance');
    }
  }, [user, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setErrorMsg(error.message === 'Invalid login credentials' ? 'E-mail ou senha incorretos.' : error.message);
      } else {
        router.push('/performance');
      }
    } catch (err: any) {
      setErrorMsg('Ocorreu um erro interno de conexão.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="xs" sx={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Box sx={{ width: '100%' }}>
        <Box sx={{ mb: 4, textAlign: 'center' }}>
          <Typography variant="h4" color="primary" sx={{ fontWeight: 800, mb: 1, letterSpacing: '1px' }}>
            FGM DENTAL GROUP
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Plataforma de Preços & Performance Comercial
          </Typography>
        </Box>

        <Card sx={{ border: '1px solid', borderColor: 'divider', boxShadow: '0px 10px 30px rgba(0,0,0,0.2)' }}>
          <CardContent sx={{ p: 4 }}>
            <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>
              Entrar na sua conta
            </Typography>

            {errorMsg && (
              <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
                {errorMsg}
              </Alert>
            )}

            <form onSubmit={handleLogin}>
              <TextField
                fullWidth
                label="E-mail"
                variant="outlined"
                margin="normal"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                sx={{ mb: 2 }}
              />

              <TextField
                fullWidth
                label="Senha"
                variant="outlined"
                margin="normal"
                required
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowPassword(!showPassword)}
                          edge="end"
                        >
                          {showPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    )
                  }
                }}
                sx={{ mb: 3 }}
              />

              <Button
                fullWidth
                size="large"
                variant="contained"
                color="primary"
                type="submit"
                disabled={loading}
                sx={{ py: 1.5, fontWeight: 700, fontSize: '16px' }}
              >
                {loading ? <CircularProgress size={24} color="inherit" /> : 'Acessar Painel'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </Box>
    </Container>
  );
}
