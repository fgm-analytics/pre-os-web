import React, { useState } from 'react';
import { 
  Box, Card, CardContent, TextField, Button, Typography, 
  Alert, CircularProgress, Container, IconButton
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { supabase } from '../lib/supabase';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthProvider';

export default function Login() {
  const router = useRouter();
  const { user } = useAuth();
  
  const [step, setStep] = useState<'EMAIL' | 'OTP'>('EMAIL');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Redirect if already logged in
  React.useEffect(() => {
    if (user) {
      router.push('/performance');
    }
  }, [user, router]);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false // Users should be pre-created by admin
        }
      });

      if (error) {
        setErrorMsg(error.message);
      } else {
        setStep('OTP');
        setSuccessMsg('Código enviado! Verifique sua caixa de entrada.');
      }
    } catch (err: any) {
      setErrorMsg('Ocorreu um erro interno de conexão.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: 'magiclink' // 'magiclink' type works for both magic links and 6-digit OTP codes in Supabase
      });

      if (error) {
        setErrorMsg('Código inválido ou expirado. Tente novamente.');
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

  const handleBack = () => {
    setStep('EMAIL');
    setOtp('');
    setErrorMsg(null);
    setSuccessMsg(null);
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
            {step === 'OTP' && (
              <IconButton onClick={handleBack} sx={{ mb: 2, ml: -1 }} size="small">
                <ArrowBackIcon fontSize="small" />
              </IconButton>
            )}

            <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
              {step === 'EMAIL' ? 'Entrar na sua conta' : 'Insira o código'}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              {step === 'EMAIL' 
                ? 'Insira seu e-mail corporativo para receber o código de acesso.' 
                : `Enviamos um código de 6 dígitos para ${email}`
              }
            </Typography>

            {errorMsg && (
              <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
                {errorMsg}
              </Alert>
            )}

            {successMsg && (
              <Alert severity="success" sx={{ mb: 3, borderRadius: 2 }}>
                {successMsg}
              </Alert>
            )}

            {step === 'EMAIL' ? (
              <form onSubmit={handleSendOtp}>
                <TextField
                  fullWidth
                  label="E-mail"
                  variant="outlined"
                  margin="normal"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
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
                  {loading ? <CircularProgress size={24} color="inherit" /> : 'Receber Código'}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp}>
                <TextField
                  fullWidth
                  label="Código de 6 dígitos"
                  variant="outlined"
                  margin="normal"
                  type="text"
                  required
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ''))} // only numbers
                  slotProps={{ htmlInput: { maxLength: 6, style: { textAlign: 'center', fontSize: '24px', letterSpacing: '4px' } } }}
                  sx={{ mb: 3 }}
                />

                <Button
                  fullWidth
                  size="large"
                  variant="contained"
                  color="primary"
                  type="submit"
                  disabled={loading || otp.length < 6}
                  sx={{ py: 1.5, fontWeight: 700, fontSize: '16px' }}
                >
                  {loading ? <CircularProgress size={24} color="inherit" /> : 'Acessar Painel'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </Box>
    </Container>
  );
}
