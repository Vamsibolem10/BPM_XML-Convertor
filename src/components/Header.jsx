import React from 'react';
import { AppBar, Toolbar, Typography, Button, Box, Chip, Paper } from '@mui/material';
import PlayArrow from '@mui/icons-material/PlayArrow';
import AutoAwesome from '@mui/icons-material/AutoAwesome';
import { useWorkspace } from '../context/WorkspaceContext';
import { demoScenarios } from '../data/scenarios';

const Header = () => {
    const { 
        setExecutionVariables, 
        setActiveChunks, 
        setCurrentEditingId, 
        showToast,
        runningSimulation 
    } = useWorkspace();

    const resetToDemo = (key) => {
        const data = demoScenarios[key];
        if (!data) return;
        
        setExecutionVariables(data.variables);
        setActiveChunks(JSON.parse(JSON.stringify(data.chunks)));
        setCurrentEditingId(null);
        showToast(`Loaded "${key.toUpperCase()}" scenario pipeline!`, "success");
        
        const event = new CustomEvent('loadScenarioNarrative', { detail: data.narrative });
        window.dispatchEvent(event);
    };

    return (
        <AppBar position="static" color="inherit" elevation={1} sx={{ zIndex: 20 }}>
            <Toolbar sx={{ justifyContent: 'space-between', flexWrap: 'wrap', py: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Box sx={{ bgcolor: 'primary.main', color: 'white', p: 1, borderRadius: 1, display: 'flex' }}>
                        <PlayArrow />
                    </Box>
                    <Box>
                        <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary', lineHeight: 1.2 }}>
                            FlowMaestro Workspace
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                            Simple Process Chunking & Real-time AI Automation
                        </Typography>
                    </Box>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: { xs: 1, sm: 0 } }}>
                    <Chip 
                        icon={<AutoAwesome sx={{ fontSize: '1rem !important', color: runningSimulation ? '#d32f2f' : 'inherit' }} />} 
                        label="Automation Active (Mistral AI)" 
                        color={runningSimulation ? 'error' : 'primary'}
                        variant="outlined"
                        size="small"
                        sx={{ fontWeight: 500 }}
                    />
                    <Button 
                        variant="outlined" 
                        color="inherit" 
                        size="small"
                        onClick={() => resetToDemo('refund')}
                    >
                        Reset Demo
                    </Button>
                </Box>
            </Toolbar>
        </AppBar>
    );
};

export default Header;
