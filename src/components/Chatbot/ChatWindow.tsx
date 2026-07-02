import React, { useState, useRef, useEffect } from 'react';
import { 
  Box, TextField, IconButton, Typography, Paper, 
  CircularProgress, Avatar, Divider 
} from '@mui/material';
import { Send as SendIcon, SmartToy, Person } from '@mui/icons-material';

interface Message {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string | null;
  name?: string;
  tool_calls?: any[];
}

import { usePerformanceContext } from '../../contexts/PerformanceContext';

export const ChatWindow: React.FC = () => {
  const { selectedSeller, selectedSellerCode } = usePerformanceContext();
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Olá! Sou seu assistente de vendas da FGM. Como posso ajudar com sua carteira de clientes hoje?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<null | HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: Message = { role: 'user', content: input };
    const newMessages = [...messages, userMessage];
    
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.filter(m => m.role !== 'tool' && !m.tool_calls), // Send simplified history for this demo
          vendedorId: selectedSeller,
          vendedorCode: selectedSellerCode
        })
      });

      if (!response.ok) {
        let errorMsg = 'Falha ao comunicar com a IA';
        try {
          const errorData = await response.json();
          if (errorData.error) errorMsg = errorData.error;
        } catch (e) {
          // Fallback if not JSON
        }
        throw new Error(errorMsg);
      }

      const assistantMessage = await response.json();
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error: any) {
      console.error('Frontend Error:', error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `Desculpe, ocorreu um erro: ${error.message}` 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Paper 
      elevation={3} 
      sx={{ 
        display: 'flex', 
        flexDirection: 'column', 
        height: 'calc(100vh - 120px)',
        maxHeight: '800px',
        maxWidth: '800px',
        mx: 'auto',
        overflow: 'hidden',
        borderRadius: 3
      }}
    >
      <Box sx={{ p: 2, bgcolor: 'primary.main', color: 'white', display: 'flex', alignItems: 'center' }}>
        <SmartToy sx={{ mr: 1 }} />
        <Typography variant="h6" sx={{ fontWeight: 'bold' }}>Assistente Comercial IA</Typography>
      </Box>
      <Divider />
      
      <Box sx={{ flexGrow: 1, p: 3, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2, bgcolor: 'background.default' }}>
        {messages.filter(m => m.content).map((msg, index) => (
          <Box 
            key={index} 
            sx={{ 
              display: 'flex', 
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              mb: 1
            }}
          >
            {msg.role === 'assistant' && (
              <Avatar sx={{ bgcolor: 'primary.main', mr: 1, width: 32, height: 32 }}>
                <SmartToy fontSize="small" />
              </Avatar>
            )}
            
            <Paper 
              elevation={1}
              sx={{ 
                p: 2, 
                maxWidth: '75%', 
                bgcolor: msg.role === 'user' ? 'primary.light' : 'background.paper',
                color: msg.role === 'user' ? 'primary.contrastText' : 'text.primary',
                borderRadius: 2,
                borderTopRightRadius: msg.role === 'user' ? 0 : 2,
                borderTopLeftRadius: msg.role === 'assistant' ? 0 : 2,
              }}
            >
              <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                {msg.content}
              </Typography>
            </Paper>

            {msg.role === 'user' && (
              <Avatar sx={{ bgcolor: 'secondary.main', ml: 1, width: 32, height: 32 }}>
                <Person fontSize="small" />
              </Avatar>
            )}
          </Box>
        ))}
        {isLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-start', mb: 1 }}>
             <Avatar sx={{ bgcolor: 'primary.main', mr: 1, width: 32, height: 32 }}>
                <SmartToy fontSize="small" />
              </Avatar>
            <Paper elevation={1} sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 2, borderTopLeftRadius: 0, display: 'flex', alignItems: 'center' }}>
              <CircularProgress size={20} sx={{ mr: 2 }} />
              <Typography variant="body2" color="text.secondary">Analisando dados...</Typography>
            </Paper>
          </Box>
        )}
        <div ref={messagesEndRef} />
      </Box>

      <Divider />
      <Box sx={{ p: 2, bgcolor: 'background.paper' }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-end' }}>
          <TextField
            fullWidth
            placeholder="Pergunte sobre seus clientes, metas ou faturamento..."
            variant="outlined"
            size="small"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            multiline
            maxRows={4}
            disabled={isLoading}
            sx={{ mr: 1 }}
          />
          <IconButton 
            color="primary" 
            onClick={handleSend} 
            disabled={!input.trim() || isLoading}
            sx={{ 
              bgcolor: 'primary.main', 
              color: 'white', 
              '&:hover': { bgcolor: 'primary.dark' },
              height: 40,
              width: 40
            }}
          >
            <SendIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>
    </Paper>
  );
};
