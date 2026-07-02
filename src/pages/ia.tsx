import React from 'react';
import Head from 'next/head';
import { Typography, Box, Container } from '@mui/material';
import { AppShell } from '../components/AppShell';
import { ChatWindow } from '../components/Chatbot/ChatWindow';

export default function IAPage() {
  return (
    <AppShell>
      <Head>
        <title>Assistente IA - FGM Performance</title>
      </Head>
      <Container maxWidth="lg" sx={{ mt: 2, mb: 4 }}>
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 'bold' }}>
            Assistente Comercial IA
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Faça perguntas sobre sua carteira de clientes, atingimento de metas ou clientes em risco de churn. 
            A IA analisará seus dados em tempo real.
          </Typography>
        </Box>
        
        <ChatWindow />
      </Container>
    </AppShell>
  );
}
