import React, { useState } from 'react';
import { 
  AppBar, Toolbar, IconButton, Typography, Drawer, 
  List, ListItemButton, ListItemIcon, ListItemText, 
  Box, Avatar, Menu, MenuItem, Divider, useMediaQuery 
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { 
  Menu as MenuIcon, PriceCheck, BarChart, Logout, AccountCircle 
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthProvider';
import { useRouter } from 'next/router';

interface AppShellProps {
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const { profile, logout } = useAuth();
  const router = useRouter();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  const [drawerOpen, setDrawerOpen] = useState(!isMobile);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const toggleDrawer = () => {
    setDrawerOpen(!drawerOpen);
  };

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = async () => {
    handleMenuClose();
    await logout();
    router.push('/');
  };

  const menuItems = [
    { text: 'Tabela de Preços', icon: <PriceCheck />, path: '/precos' },
    { text: 'Performance Comercial', icon: <BarChart />, path: '/performance' }
  ];

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar 
        position="fixed" 
        sx={{ 
          zIndex: theme.zIndex.drawer + 1,
          bgcolor: 'background.paper',
          borderBottom: '1px solid',
          borderColor: 'divider',
          boxShadow: 'none'
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={toggleDrawer}
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>
          <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center' }}>
            <img 
              src="/fgm-logo.png" 
              alt="FGM Dental Group" 
              style={{ height: '24px', width: 'auto', objectFit: 'contain' }} 
            />
          </Box>

          {profile && (
            <>
              <Box sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }} onClick={handleMenuClick}>
                <Avatar sx={{ bgcolor: 'secondary.main', mr: 1, width: 36, height: 36 }}>
                  {profile.nome.charAt(0).toUpperCase()}
                </Avatar>
                {!isMobile && (
                  <Box sx={{ mr: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{profile.nome}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'capitalize' }}>
                      {profile.role}
                    </Typography>
                  </Box>
                )}
              </Box>
              <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleMenuClose}
                transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
              >
                <MenuItem disabled>
                  <Typography variant="caption">SFMC: {profile.salesforce_id || 'N/A'}</Typography>
                </MenuItem>
                <MenuItem disabled>
                  <Typography variant="caption">Código: {profile.vendedor_code || 'N/A'}</Typography>
                </MenuItem>
                <Divider />
                <MenuItem onClick={handleLogout}>
                  <ListItemIcon>
                    <Logout fontSize="small" />
                  </ListItemIcon>
                  Sair
                </MenuItem>
              </Menu>
            </>
          )}
        </Toolbar>
      </AppBar>

      <Drawer
        variant={isMobile ? 'temporary' : 'persistent'}
        open={drawerOpen}
        onClose={isMobile ? toggleDrawer : undefined}
        sx={{
          width: 240,
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: { 
            width: 240, 
            boxSizing: 'border-box', 
            bgcolor: 'background.paper',
            borderRight: '1px solid',
            borderColor: 'divider',
            pt: 8
          },
        }}
      >
        <Box sx={{ overflow: 'auto', mt: 2 }}>
          <List>
            {menuItems.map((item) => (
              <ListItemButton
                key={item.text}
                onClick={() => {
                  router.push(item.path);
                  if (isMobile) setDrawerOpen(false);
                }}
                selected={router.pathname.startsWith(item.path)}
                sx={{
                  mx: 1.5,
                  my: 0.5,
                  borderRadius: 2,
                  '&.Mui-selected': {
                    bgcolor: 'rgba(0, 127, 255, 0.12)',
                    color: 'primary.main',
                    '& .MuiListItemIcon-root': {
                      color: 'primary.main',
                    },
                    '&:hover': {
                      bgcolor: 'rgba(0, 127, 255, 0.18)',
                    }
                  }
                }}
              >
                <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
                <ListItemText primary={<Typography sx={{ fontWeight: 600, fontSize: '14px' }}>{item.text}</Typography>} />
              </ListItemButton>
            ))}
          </List>
        </Box>
      </Drawer>

      <Box 
        component="main" 
        sx={{ 
          flexGrow: 1, 
          p: 3, 
          pt: 11,
          minWidth: 0,
          overflow: 'hidden',
          width: drawerOpen && !isMobile ? 'calc(100% - 240px)' : '100%',
          transition: theme.transitions.create(['margin', 'width'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
          }),
          ...(drawerOpen && !isMobile && {
            ml: 0,
            transition: theme.transitions.create(['margin', 'width'], {
              easing: theme.transitions.easing.easeOut,
              duration: theme.transitions.duration.enteringScreen,
            }),
          }),
        }}
      >
        {children}
      </Box>
    </Box>
  );
};
