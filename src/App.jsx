import React from 'react';
import { ThemeProvider, createTheme, CssBaseline, Box, Container, Grid } from '@mui/material';
import Header from './components/Header';
import InputPanel from './components/InputPanel';
import VisualPipeline from './components/VisualPipeline';
import AutomationOutput from './components/AutomationOutput';
import Footer from './components/Footer';
import { WorkspaceProvider } from './context/WorkspaceContext';

const theme = createTheme({
  palette: {
    primary: {
      main: '#1a73e8', // Google Blue
    },
    background: {
      default: '#f8f9fa', 
    }
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    button: {
      textTransform: 'none',
      fontWeight: 500,
    }
  },
  shape: {
    borderRadius: 8,
  }
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <WorkspaceProvider>
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
          <Header />
          <Container maxWidth="xl" sx={{ flexGrow: 1, py: 3 }}>
            <Grid container spacing={4}>
              <Grid size={12}>
                <InputPanel />
              </Grid>
              <Grid size={12}>
                <VisualPipeline />
              </Grid>
              <Grid size={12}>
                <AutomationOutput />
              </Grid>
            </Grid>
          </Container>
          <Footer />
        </Box>
      </WorkspaceProvider>
    </ThemeProvider>
  );
}

export default App;
