import React, { useState, useEffect } from 'react';
import { 
    Paper, Box, Typography, Button, TextField, IconButton, 
    Divider, Chip, Stack, CircularProgress 
} from '@mui/material';
import KeyboardArrowUp from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown';
import Delete from '@mui/icons-material/Delete';
import Add from '@mui/icons-material/Add';
import DeleteSweep from '@mui/icons-material/DeleteSweep';
import CloudUpload from '@mui/icons-material/CloudUpload';
import { useWorkspace } from '../context/WorkspaceContext';
import { segmentWorkflow } from '../services/MistralService';
import { demoScenarios } from '../data/scenarios';
import { parseDocument } from '../utils/documentParser';

const InputPanel = () => {
    const [narrative, setNarrative] = useState('');
    const [isChunking, setIsChunking] = useState(false);
    const [isParsing, setIsParsing] = useState(false);
    
    const { 
        activeChunks, 
        setActiveChunks, 
        setCurrentEditingId, 
        showToast, 
        addLog,
        setExecutionVariables,
        savedWorkflows, saveWorkflow, loadWorkflow, deleteWorkflow
    } = useWorkspace();

    useEffect(() => {
        const handleLoadScenario = (e) => {
            setNarrative(e.detail);
        };
        window.addEventListener('loadScenarioNarrative', handleLoadScenario);
        
        // Initial load
        setNarrative(demoScenarios.refund.narrative);
        setExecutionVariables(demoScenarios.refund.variables);
        setActiveChunks(demoScenarios.refund.chunks);

        return () => window.removeEventListener('loadScenarioNarrative', handleLoadScenario);
    }, [setExecutionVariables, setActiveChunks]);

    const handleChunking = async () => {
        if (!narrative.trim()) {
            showToast("Please provide a workflow narrative first.", "error");
            return;
        }

        setIsChunking(true);
        addLog("Piping process narrative to Mistral AI parsing engine...", "system");

        try {
            const parsed = await segmentWorkflow(narrative);
            if (parsed.chunks && Array.isArray(parsed.chunks)) {
                setActiveChunks(parsed.chunks);
                addLog(`Loaded ${parsed.chunks.length} automated steps configured from narrative!`, "success");
                showToast("AI Workflow Segmentation Complete!", "success");
            }
        } catch (err) {
            console.error(err);
            addLog(`Failed to call AI model: ${err.message}.`, "error");
            showToast("AI Connection failed. Workspace retained.", "error");
        } finally {
            setIsChunking(false);
        }
    };

    const handleFileUpload = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsParsing(true);
        addLog(`Reading uploaded document: ${file.name} (${(file.size / 1024).toFixed(1)} KB)...`, "system");
        showToast("Processing document...", "info");

        try {
            const extractedText = await parseDocument(file);
            if (!extractedText || !extractedText.trim()) {
                throw new Error("No readable text found in document.");
            }
            setNarrative(extractedText);
            addLog(`Successfully extracted ${extractedText.length} characters from ${file.name}!`, "success");
            showToast("Document parsed successfully!", "success");
        } catch (err) {
            console.error(err);
            addLog(`Failed to parse document: ${err.message}`, "error");
            showToast(err.message, "error");
        } finally {
            setIsParsing(false);
            event.target.value = '';
        }
    };

    const moveStepOrder = (idx, direction) => {
        const newIdx = idx + direction;
        if (newIdx < 0 || newIdx >= activeChunks.length) return;
        
        const newChunks = [...activeChunks];
        const temp = newChunks[idx];
        newChunks[idx] = newChunks[newIdx];
        newChunks[newIdx] = temp;
        setActiveChunks(newChunks);
    };

    const deleteStep = (id) => {
        let newChunks = activeChunks.map(n => ({
            ...n,
            next: n.next.filter(tgt => tgt !== id)
        }));
        newChunks = newChunks.filter(n => n.id !== id);
        setActiveChunks(newChunks);
        showToast(`Removed node #${id} from workspace pipeline.`, "success");
    };

    const addNewManualStep = () => {
        const newId = `task_${Date.now().toString().slice(-4)}`;
        const step = {
            id: newId,
            type: "serviceTask",
            name: "Custom Task Worker",
            actor: "System API Node",
            description: "Format message or do computational processing steps.",
            next: []
        };

        let newChunks = [...activeChunks];
        if (newChunks.length > 0) {
            const lastNode = newChunks[newChunks.length - 1];
            if (lastNode.next.length === 0 && lastNode.type !== 'end') {
                lastNode.next = [...lastNode.next, newId];
            }
        }

        newChunks.push(step);
        setActiveChunks(newChunks);
        setCurrentEditingId(newId);
        showToast("Created custom task placeholder.", "success");
    };

    const clearAllChunks = () => {
        setActiveChunks([]);
        setCurrentEditingId(null);
        showToast("Workspace cleared.", "success");
    };

    return (
        <Paper elevation={1} sx={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
            <Box p={2.5} sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <Typography variant="overline" color="primary" fontWeight={700}>Step 1</Typography>
                <Typography variant="h6" fontWeight={500} color="text.primary">Process Narrative</Typography>
                <Typography variant="body2" color="text.secondary" mt={0.5}>
                    Describe your workflow. Our AI will automatically convert it into executable steps.
                </Typography>
            </Box>

            <Box p={2.5} sx={{ display: 'flex', flexDirection: 'column', flexGrow: 1, overflow: 'auto', gap: 3 }}>
                <Box>
                    <Typography variant="caption" fontWeight={600} color="text.secondary" gutterBottom display="block">
                        SCENARIO PRESETS
                    </Typography>
                    <Stack direction="row" spacing={1}>
                        <Button variant="outlined" size="small" onClick={() => window.dispatchEvent(new CustomEvent('loadScenarioNarrative', { detail: demoScenarios.refund.narrative }))}>Refunds</Button>
                        <Button variant="outlined" size="small" onClick={() => window.dispatchEvent(new CustomEvent('loadScenarioNarrative', { detail: demoScenarios.leads.narrative }))}>Leads Core</Button>
                        <Button variant="outlined" size="small" onClick={() => window.dispatchEvent(new CustomEvent('loadScenarioNarrative', { detail: demoScenarios.it.narrative }))}>IT Setup</Button>
                        <Button variant="outlined" size="small" onClick={() => window.dispatchEvent(new CustomEvent('loadScenarioNarrative', { detail: demoScenarios.procurement.narrative }))}>Procurement</Button>
                    </Stack>
                </Box>
                
                {savedWorkflows.length > 0 && (
                    <Box>
                        <Typography variant="caption" fontWeight={600} color="text.secondary" gutterBottom display="block">
                            SAVED WORKFLOWS
                        </Typography>
                        <Stack direction="row" spacing={1} sx={{ overflowX: 'auto', pb: 1 }}>
                            {savedWorkflows.map(w => (
                                <Chip 
                                    key={w.id} 
                                    label={w.name} 
                                    onClick={() => loadWorkflow(w.id)}
                                    onDelete={() => deleteWorkflow(w.id)}
                                    color="primary"
                                    variant="outlined"
                                    size="small"
                                />
                            ))}
                        </Stack>
                    </Box>
                )}

                <Box sx={{ mb: 1 }}>
                    <Typography variant="caption" fontWeight={600} color="text.secondary" gutterBottom display="block">
                        UPLOAD WORKFLOW DOCUMENT
                    </Typography>
                    <Box 
                        component="label"
                        sx={{ 
                            border: '1.5px dashed', 
                            borderColor: isParsing ? 'grey.400' : 'primary.main', 
                            borderRadius: 1, 
                            p: 2, 
                            bgcolor: isParsing ? 'grey.50' : 'primary.50', 
                            textAlign: 'center', 
                            cursor: isParsing ? 'not-allowed' : 'pointer', 
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 0.5,
                            transition: 'all 0.2s',
                            '&:hover': !isParsing && {
                                bgcolor: 'primary.100',
                                borderColor: 'primary.dark'
                            }
                        }}
                    >
                        <input 
                            type="file" 
                            accept=".txt,.md,.docx,.pdf" 
                            style={{ display: 'none' }} 
                            onChange={handleFileUpload}
                            disabled={isParsing}
                        />
                        {isParsing ? (
                            <CircularProgress size={24} sx={{ mb: 0.5 }} />
                        ) : (
                            <CloudUpload color="primary" sx={{ fontSize: 28 }} />
                        )}
                        <Typography variant="body2" fontWeight={600} color={isParsing ? 'text.secondary' : 'primary.main'}>
                            {isParsing ? 'Extracting text...' : 'Upload PDF, Word or Text document'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            Supported: PDF, DOCX, TXT (Max 5MB)
                        </Typography>
                    </Box>
                </Box>

                <Box sx={{ display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
                    <Typography variant="caption" fontWeight={600} color="text.secondary" gutterBottom display="block">
                        NARRATIVE DESCRIPTION
                    </Typography>
                    <TextField
                        multiline
                        rows={6}
                        fullWidth
                        variant="outlined"
                        placeholder="Paste workflow description here..."
                        value={narrative}
                        onChange={(e) => setNarrative(e.target.value)}
                        sx={{ flexGrow: 1, '& .MuiInputBase-root': { height: '100%', alignItems: 'flex-start' } }}
                    />
                </Box>

                <Button 
                    variant="contained" 
                    color="primary" 
                    fullWidth 
                    size="large"
                    onClick={handleChunking}
                    disabled={isChunking}
                    startIcon={isChunking ? <CircularProgress size={20} color="inherit" /> : null}
                    sx={{ py: 1.5, fontWeight: 600 }}
                >
                    {isChunking ? 'Segmenting Workflow...' : 'Analyse & Create Steps'}
                </Button>

                <Divider />

                <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="caption" fontWeight={600} color="text.secondary">PIPELINE ITEMS</Typography>
                        <Chip label={`${activeChunks.length} Steps`} size="small" color="default" />
                    </Box>
                    
                    <Stack spacing={1.5} sx={{ maxHeight: 300, overflowY: 'auto', pr: 1 }}>
                        {activeChunks.map((node, index) => {
                            let badgeColor = "info";
                            if (node.type === "start") badgeColor = "success";
                            else if (node.type === "end") badgeColor = "error";
                            else if (node.type === "gateway") badgeColor = "warning";

                            return (
                                <Paper 
                                    key={node.id} 
                                    variant="outlined"
                                    onClick={() => setCurrentEditingId(node.id)}
                                    sx={{ 
                                        p: 2, 
                                        cursor: 'pointer', 
                                        '&:hover': { borderColor: 'primary.main', boxShadow: 1 },
                                        transition: 'all 0.2s',
                                        position: 'relative',
                                        '& .action-btns': { opacity: 0 },
                                        '&:hover .action-btns': { opacity: 1 }
                                    }}
                                >
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                        <Chip label={node.type} size="small" color={badgeColor} sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase' }} />
                                        <Typography variant="caption" color="text.disabled" fontFamily="monospace">#{node.id}</Typography>
                                    </Box>
                                    
                                    <Typography variant="subtitle2" fontWeight={600}>{node.name || 'Untitled Task'}</Typography>
                                    <Typography variant="body2" color="text.secondary" noWrap mt={0.5}>{node.description || 'No instructions'}</Typography>
                                    
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1.5, pt: 1.5, borderTop: 1, borderColor: 'divider' }}>
                                        <Typography variant="caption" color="text.secondary">
                                            Actor: <Typography component="span" variant="caption" fontWeight={600} color="text.primary">{node.actor}</Typography>
                                        </Typography>
                                        
                                        <Box className="action-btns" sx={{ display: 'flex', gap: 0.5, transition: 'opacity 0.2s' }} onClick={e => e.stopPropagation()}>
                                            <IconButton size="small" onClick={() => moveStepOrder(index, -1)}><KeyboardArrowUp fontSize="small" /></IconButton>
                                            <IconButton size="small" onClick={() => moveStepOrder(index, 1)}><KeyboardArrowDown fontSize="small" /></IconButton>
                                            <IconButton size="small" color="error" onClick={() => deleteStep(node.id)}><Delete fontSize="small" /></IconButton>
                                        </Box>
                                    </Box>
                                </Paper>
                            )
                        })}
                    </Stack>

                    <Stack direction="row" spacing={1.5} mt={2}>
                        <Button 
                            variant="outlined" 
                            color="inherit" 
                            fullWidth 
                            startIcon={<Add />}
                            onClick={addNewManualStep}
                        >
                            Custom Task
                        </Button>
                        <Button 
                            variant="outlined" 
                            color="error" 
                            fullWidth 
                            startIcon={<DeleteSweep />}
                            onClick={clearAllChunks}
                        >
                            Clear
                        </Button>
                    </Stack>
                    <Box mt={1.5}>
                        <Button 
                            variant="text" 
                            size="small"
                            fullWidth 
                            onClick={() => {
                                const name = prompt("Enter a name to save this workflow:");
                                if (name) saveWorkflow(name);
                            }}
                            disabled={activeChunks.length === 0}
                        >
                            Save Current Workflow
                        </Button>
                    </Box>
                </Box>
            </Box>
        </Paper>
    );
};

export default InputPanel;
