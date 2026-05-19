import React, { useEffect, useRef, useState } from 'react';
import { 
    Paper, Box, Typography, Button, TextField,
    Dialog, DialogTitle, DialogContent, DialogActions,
    Chip, Stack, CircularProgress
} from '@mui/material';
import PlayCircleOutlined from '@mui/icons-material/PlayCircleOutlined';
import StopCircleOutlined from '@mui/icons-material/StopCircleOutlined';
import Download from '@mui/icons-material/Download';
import Analytics from '@mui/icons-material/Analytics';
import Psychology from '@mui/icons-material/Psychology';
import { useWorkspace } from '../context/WorkspaceContext';
import { 
    runAiTaskAutomation, 
    runAiGatewaySplitChoice,
    analyzeAndAuditWorkflow,
    generateMockPayloadForWorkflow
} from '../services/MistralService';

const VisualPipeline = () => {
    const {
        activeChunks,
        executionVariables, setExecutionVariables,
        runningSimulation, setRunningSimulation,
        activeStepIndex, setActiveStepIndex,
        runningExecutionState, setRunningExecutionState,
        logs, addLog, showToast, setCurrentEditingId
    } = useWorkspace();

    const svgRef = useRef(null);
    const gridRef = useRef(null);
    const logMonitorRef = useRef(null);
    const [connections, setConnections] = useState([]);
    const [isAuditing, setIsAuditing] = useState(false);
    const [auditReport, setAuditReport] = useState(null);
    const [auditOpen, setAuditOpen] = useState(false);
    const [isSuggestingVars, setIsSuggestingVars] = useState(false);
    
    useEffect(() => {
        if (logMonitorRef.current) {
            logMonitorRef.current.scrollTop = logMonitorRef.current.scrollHeight;
        }
    }, [logs]);

    const handleVariablesChange = (e) => {
        try {
            const val = JSON.parse(e.target.value);
            setExecutionVariables(val);
        } catch (err) {
            // allow typing invalid json temporarily
        }
    };

    const drawWorkflowConnectors = () => {
        if (!svgRef.current || !gridRef.current) return;
        const svg = svgRef.current;
        const svgRect = svg.getBoundingClientRect();
        
        const newConns = [];

        activeChunks.forEach((node) => {
            const srcEl = document.getElementById(`canvas-node-${node.id}`);
            if (!srcEl) return;
            const srcBox = srcEl.getBoundingClientRect();

            node.next.forEach((targetId) => {
                const tgtEl = document.getElementById(`canvas-node-${targetId}`);
                if (!tgtEl) return;
                const tgtBox = tgtEl.getBoundingClientRect();

                const x1 = (srcBox.left + srcBox.width / 2) - svgRect.left;
                const y1 = srcBox.bottom - svgRect.top;
                const x2 = (tgtBox.left + tgtBox.width / 2) - svgRect.left;
                const y2 = tgtBox.top - svgRect.top;

                let isCurrentLivePath = false;
                if (runningSimulation && activeChunks[activeStepIndex]) {
                    const currentNode = activeChunks[activeStepIndex];
                    if (currentNode.id === node.id && (currentNode.next.includes(targetId) || runningExecutionState._chosenNext === targetId)) {
                        isCurrentLivePath = true;
                    }
                }

                const controlOffset = Math.abs(y2 - y1) / 2;
                const spline = `M ${x1} ${y1} C ${x1} ${y1 + controlOffset}, ${x2} ${y2 - controlOffset}, ${x2} ${y2}`;

                newConns.push({
                    id: `${node.id}-${targetId}`,
                    d: spline,
                    isCurrentLivePath,
                    x2, y2
                });
            });
        });
        setConnections(newConns);
    };

    useEffect(() => {
        const timeout = setTimeout(drawWorkflowConnectors, 100);
        window.addEventListener('resize', drawWorkflowConnectors);
        return () => {
            clearTimeout(timeout);
            window.removeEventListener('resize', drawWorkflowConnectors);
        }
    }, [activeChunks, runningSimulation, activeStepIndex, runningExecutionState]);

    const resetAutomation = () => {
        setRunningSimulation(false);
        addLog("Automation processing sequence terminated.", "system");
    };

    const validateWorkflow = () => {
        if (activeChunks.length === 0) {
            showToast("Workflow contains no steps to automate.", "error");
            return false;
        }
        
        let hasStart = false;
        let hasEnd = false;
        let errors = [];

        activeChunks.forEach(node => {
            if (node.type === 'start') hasStart = true;
            if (node.type === 'end') hasEnd = true;
            
            if (node.type === 'gateway' && node.next.length !== 2) {
                errors.push(`Gateway #${node.id} must have exactly 2 target routes.`);
            }
            if (node.type !== 'end' && node.next.length === 0) {
                errors.push(`Node #${node.id} is a dead end (no target).`);
            }
        });

        if (!hasStart) errors.push("Workflow requires at least one 'start' node.");
        if (!hasEnd) errors.push("Workflow requires at least one 'end' node.");

        if (errors.length > 0) {
            errors.forEach(err => addLog(`[VALIDATION ERROR] ${err}`, "error"));
            showToast("Workflow validation failed. Check logs.", "error");
            return false;
        }

        return true;
    };

    const startWorkAutomation = () => {
        if (runningSimulation) {
            resetAutomation();
            return;
        }

        if (!validateWorkflow()) return;

        setRunningSimulation(true);
        setActiveStepIndex(0);
        setRunningExecutionState(executionVariables);
        
        addLog("Starting Workflow Automation Run...", "system");
        addLog(`Initial State Variables: ${JSON.stringify(executionVariables)}`, "info");
    };

    const exportLogs = () => {
        const logContent = logs.map(l => `[${l.timestamp}] [${l.type.toUpperCase()}] ${l.text}`).join('\n');
        const blob = new Blob([logContent], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `workflow_audit_log_${Date.now()}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast("Audit log exported successfully", "success");
    };

    const runWorkflowAudit = async () => {
        if (!activeChunks || activeChunks.length === 0) {
            showToast("No process nodes to audit.", "error");
            return;
        }

        setIsAuditing(true);
        addLog("Initiating comprehensive AI process safety, compliance, and logic audit...", "system");
        showToast("Generating AI Audit Report...", "info");

        try {
            const report = await analyzeAndAuditWorkflow(activeChunks);
            setAuditReport(report);
            setAuditOpen(true);
            addLog(`AI Audit Complete! Health Score: ${report.overallScore}/100. Risks: ${report.riskLevel}.`, "success");
            showToast("Process audit complete!", "success");
        } catch (err) {
            console.error(err);
            addLog(`Failed to run AI process audit: ${err.message}`, "error");
            showToast("Process audit failed.", "error");
        } finally {
            setIsAuditing(false);
        }
    };

    const handleSuggestVariables = async () => {
        if (!activeChunks || activeChunks.length === 0) {
            showToast("No process nodes to analyze for payload.", "error");
            return;
        }

        setIsSuggestingVars(true);
        addLog("Analyzing workflow steps to dynamically generate starting payload variables schema...", "system");
        showToast("Generating input payload variables...", "info");

        try {
            const mockVars = await generateMockPayloadForWorkflow(activeChunks);
            setExecutionVariables(mockVars);
            addLog(`Successfully updated payload variables automatically: ${JSON.stringify(mockVars)}`, "success");
            showToast("Mock payload drafted!", "success");
        } catch (err) {
            console.error(err);
            addLog(`Failed to suggest payload variables: ${err.message}`, "error");
            showToast("Failed to suggest payload variables.", "error");
        } finally {
            setIsSuggestingVars(false);
        }
    };

    useEffect(() => {
        if (!runningSimulation) return;

        const executeStep = async () => {
            if (activeStepIndex >= activeChunks.length || activeStepIndex < 0) {
                addLog("Workflow reached termination boundary successfully.", "success");
                resetAutomation();
                return;
            }

            const current = activeChunks[activeStepIndex];
            addLog(`[EXECUTION STEP] Activating #${current.id}: "${current.name}"...`, "system");

            const nodeEl = document.getElementById(`canvas-node-${current.id}`);
            if (nodeEl) nodeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

            await new Promise(resolve => setTimeout(resolve, 2500));

            try {
                if (current.type === 'start') {
                    addLog(`[Start Event] Processing initiated by Actor: ${current.actor}`, "info");
                    moveNext(current.next[0]);
                } 
                else if (current.type === 'end') {
                    addLog(`[End Event] Workflow completed safely by Actor: ${current.actor}`, "success");
                    addLog(`Final State variables: ${JSON.stringify(runningExecutionState)}`, "success");
                    resetAutomation();
                } 
                else if (current.type === 'serviceTask' || current.type === 'userTask') {
                    const taskTypeName = current.type === 'serviceTask' ? 'Service Task' : 'User Task';
                    addLog(`[${taskTypeName}] ${current.type === 'userTask' ? 'Manual intervention' : 'System API working'}: "${current.description}"...`, "info");
                    
                    const updatedVariables = await runAiTaskAutomation(current, runningExecutionState);
                    
                    setRunningExecutionState(prev => {
                        const nextState = { ...prev, ...updatedVariables };
                        setExecutionVariables(nextState);
                        return nextState;
                    });
                    
                    addLog(`[Task Result] Successfully computed output! New variables: ${JSON.stringify(updatedVariables)}`, "success");
                    moveNext(current.next[0]);
                } 
                else if (current.type === 'gateway') {
                    addLog(`[Gateway Decision] Evaluating split paths: "${current.name}"...`, "info");
                    
                    const decision = await runAiGatewaySplitChoice(current, runningExecutionState);
                    addLog(`[Decision Evaluated] Split chosen path: #${decision.selectedPath} Reason: "${decision.reason}"`, "success");
                    
                    setRunningExecutionState(prev => ({ ...prev, _chosenNext: decision.selectedPath }));
                    moveNext(decision.selectedPath);
                }
            } catch (err) {
                addLog(`[FATAL RUNTIME ERROR] Task Failed! Error details: ${err.message}`, "error");
                resetAutomation();
            }
        };

        executeStep();
    }, [runningSimulation, activeStepIndex]);

    const moveNext = (nextId) => {
        if (!nextId) {
            addLog("No direct target mapping listed. Halting sequence.", "system");
            resetAutomation();
            return;
        }
        const nextIndex = activeChunks.findIndex(c => c.id === nextId);
        if (nextIndex !== -1) {
            setActiveStepIndex(nextIndex);
        } else {
            addLog(`Routing error: Node #${nextId} not found in workspace list.`, "error");
            resetAutomation();
        }
    };

    return (
        <Paper elevation={1} sx={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
            <Box p={2.5} sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <Typography variant="overline" color="primary" fontWeight={700}>Step 2</Typography>
                <Typography variant="h6" fontWeight={500} color="text.primary">Visual Pipeline Map</Typography>
                <Typography variant="body2" color="text.secondary" mt={0.5}>
                    Interactive node flow showing chronological data routes.
                </Typography>
            </Box>

            <Box sx={{ position: 'relative', bgcolor: '#f8fafc', flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 360 }}>
                <svg ref={svgRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0 }}>
                    {connections.map(conn => (
                        <g key={conn.id}>
                            <path
                                d={conn.d}
                                fill="none"
                                stroke={conn.isCurrentLivePath ? '#1a73e8' : '#cbd5e1'}
                                strokeWidth={conn.isCurrentLivePath ? '3' : '2'}
                                className={conn.isCurrentLivePath ? 'active-path-line' : ''}
                                style={{ filter: conn.isCurrentLivePath ? 'drop-shadow(0 1px 2px rgba(0,0,0,0.1))' : 'none' }}
                            />
                            <circle
                                cx={conn.x2}
                                cy={conn.y2}
                                r={conn.isCurrentLivePath ? '5' : '3'}
                                fill={conn.isCurrentLivePath ? '#1a73e8' : '#94a3b8'}
                            />
                        </g>
                    ))}
                </svg>

                <Box ref={gridRef} sx={{ position: 'relative', zIndex: 1, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '48px 32px', p: 4 }}>
                    {activeChunks.length === 0 ? (
                        <Typography color="text.secondary" variant="body2" sx={{ py: 6 }}>
                            Pipeline empty. Segment some text steps to build visual routes.
                        </Typography>
                    ) : (
                        activeChunks.map((node, idx) => {
                            let baseColor = "#fff";
                            let borderColor = "#e2e8f0";
                            let headerBg = "#f8fafc";
                            let textColor = "#334155";
                            let headerTextColor = "#64748b";

                            if (node.type === "start") {
                                baseColor = "#f0fdf4"; borderColor = "#bbf7d0"; headerBg = "#dcfce7"; textColor = "#166534"; headerTextColor = "#15803d";
                            } else if (node.type === "end") {
                                baseColor = "#fef2f2"; borderColor = "#fecaca"; headerBg = "#fee2e2"; textColor = "#991b1b"; headerTextColor = "#b91c1c";
                            } else if (node.type === "gateway") {
                                baseColor = "#fffbeb"; borderColor = "#fde68a"; headerBg = "#fef3c7"; textColor = "#92400e"; headerTextColor = "#b45309";
                            } else if (node.type === "serviceTask") {
                                baseColor = "#1a73e8"; borderColor = "#1557b0"; headerBg = "#1967d2"; textColor = "#fff"; headerTextColor = "#e8eaed";
                            }

                            const isActiveLive = runningSimulation && idx === activeStepIndex;
                            const boxShadow = isActiveLive ? '0 0 0 4px rgba(26, 115, 232, 0.4), 0 10px 15px -3px rgba(0, 0, 0, 0.1)' : '0 1px 2px 0 rgba(0, 0, 0, 0.05)';
                            const transform = isActiveLive ? 'scale(1.05)' : 'none';

                            return (
                                <Box 
                                    key={node.id}
                                    id={`canvas-node-${node.id}`}
                                    onClick={() => setCurrentEditingId(node.id)}
                                    sx={{
                                        width: 176,
                                        minHeight: 96,
                                        display: 'flex',
                                        flexDirection: 'column',
                                        bgcolor: baseColor,
                                        border: `1px solid ${borderColor}`,
                                        borderRadius: 2,
                                        cursor: 'pointer',
                                        userSelect: 'none',
                                        boxShadow,
                                        transform,
                                        transition: 'all 0.2s',
                                        '&:hover': !isActiveLive && {
                                            transform: 'translateY(-4px)',
                                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                                        }
                                    }}
                                >
                                    <Box sx={{ px: 1.5, py: 0.75, borderBottom: `1px solid ${borderColor}`, borderTopLeftRadius: 8, borderTopRightRadius: 8, bgcolor: headerBg, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <Typography sx={{ fontSize: '0.55rem', fontWeight: 700, textTransform: 'uppercase', color: headerTextColor }}>{node.type}</Typography>
                                        <Typography sx={{ fontSize: '0.55rem', opacity: 0.7, color: headerTextColor }}>#{node.id}</Typography>
                                    </Box>
                                    <Box sx={{ p: 1.5, flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                        <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: textColor, lineHeight: 1.2, mb: 1 }}>{node.name}</Typography>
                                        <Typography sx={{ fontSize: '0.55rem', fontWeight: 600, textTransform: 'uppercase', textAlign: 'right', color: node.type === 'serviceTask' ? 'rgba(255,255,255,0.7)' : 'text.secondary' }}>
                                            {node.actor}
                                        </Typography>
                                    </Box>
                                </Box>
                            )
                        })
                    )}
                </Box>

                <Paper elevation={0} sx={{ m: 2, p: 2, border: 1, borderColor: 'divider', position: 'relative', zIndex: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1, minHeight: 30 }}>
                        <Typography variant="caption" fontWeight={600} color="text.secondary">PAYLOAD VARIABLES (JSON)</Typography>
                        {!runningSimulation && (
                            <Button 
                                size="small" 
                                variant="text" 
                                color="primary" 
                                onClick={handleSuggestVariables} 
                                disabled={isSuggestingVars}
                                startIcon={isSuggestingVars ? <CircularProgress size={12} color="inherit" /> : <Psychology sx={{ fontSize: 16 }} />}
                                sx={{ py: 0, fontSize: '0.65rem', fontWeight: 600, textTransform: 'none' }}
                            >
                                {isSuggestingVars ? 'Drafting payload...' : 'AI Auto-Draft Payload'}
                            </Button>
                        )}
                    </Box>
                    <TextField 
                        multiline
                        fullWidth
                        rows={4}
                        value={runningSimulation ? JSON.stringify(runningExecutionState, null, 2) : JSON.stringify(executionVariables, null, 2)}
                        onChange={handleVariablesChange}
                        disabled={runningSimulation}
                        sx={{ '& .MuiInputBase-root': { fontFamily: 'monospace', fontSize: '0.8rem', bgcolor: runningSimulation ? '#e0f2fe' : 'grey.50' } }}
                    />
                </Paper>
            </Box>

            {activeChunks && activeChunks.length > 0 && (
                <Box sx={{ mx: 2, mb: 1, p: 2, border: 1, borderColor: 'divider', borderRadius: 2, bgcolor: '#fbfcfe' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                        <Typography variant="caption" fontWeight={700} color="primary" sx={{ letterSpacing: 0.8, textTransform: 'uppercase' }}>
                            AI Optimization &amp; KPI Dashboard
                        </Typography>
                        <Chip 
                            label={runningSimulation ? "Real-time Tracking" : "Performance Forecast"} 
                            color={runningSimulation ? "success" : "primary"} 
                            variant="outlined" 
                            size="small" 
                            sx={{ height: 18, fontSize: '0.55rem', fontWeight: 700 }} 
                        />
                    </Box>

                    <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                        {/* Cost Savings */}
                        <Box sx={{ flex: '1 1 100px', p: 1, bgcolor: 'white', border: 1, borderColor: 'divider', borderRadius: 1.5, display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 80 }}>
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.55rem', fontWeight: 600 }}>COST SAVED</Typography>
                            <Typography variant="subtitle2" fontWeight={700} color="success.main" sx={{ mt: 0.25 }}>
                                ${(() => {
                                    if (runningSimulation) {
                                        let hours = 0;
                                        for (let i = 0; i <= activeStepIndex; i++) {
                                            const node = activeChunks[i];
                                            if (node) {
                                                if (node.type === 'serviceTask') hours += 1.5;
                                                if (node.type === 'userTask') hours += 0.25;
                                            }
                                        }
                                        return (hours * 60).toFixed(2);
                                    } else {
                                        let hours = 0;
                                        activeChunks.forEach(node => {
                                            if (node.type === 'serviceTask') hours += 1.5;
                                            if (node.type === 'userTask') hours += 0.25;
                                        });
                                        return (hours * 60).toFixed(2);
                                    }
                                })()}
                            </Typography>
                        </Box>

                        {/* Labor Hours Saved */}
                        <Box sx={{ flex: '1 1 100px', p: 1, bgcolor: 'white', border: 1, borderColor: 'divider', borderRadius: 1.5, display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 80 }}>
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.55rem', fontWeight: 600 }}>HOURS REDUCED</Typography>
                            <Typography variant="subtitle2" fontWeight={700} color="primary.main" sx={{ mt: 0.25 }}>
                                {(() => {
                                    if (runningSimulation) {
                                        let hours = 0;
                                        for (let i = 0; i <= activeStepIndex; i++) {
                                            const node = activeChunks[i];
                                            if (node) {
                                                if (node.type === 'serviceTask') hours += 1.5;
                                                if (node.type === 'userTask') hours += 0.25;
                                            }
                                        }
                                        return hours.toFixed(1);
                                    } else {
                                        let hours = 0;
                                        activeChunks.forEach(node => {
                                            if (node.type === 'serviceTask') hours += 1.5;
                                            if (node.type === 'userTask') hours += 0.25;
                                        });
                                        return hours.toFixed(1);
                                    }
                                })()}h
                            </Typography>
                        </Box>

                        {/* Automation Rate */}
                        <Box sx={{ flex: '1 1 100px', p: 1, bgcolor: 'white', border: 1, borderColor: 'divider', borderRadius: 1.5, display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 80 }}>
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.55rem', fontWeight: 600 }}>AUTOMATION RATE</Typography>
                            <Typography variant="subtitle2" fontWeight={700} color="info.main" sx={{ mt: 0.25 }}>
                                {(() => {
                                    const total = activeChunks.length || 1;
                                    const service = activeChunks.filter(n => n.type === 'serviceTask').length;
                                    return ((service / total) * 100).toFixed(0);
                                })()}%
                            </Typography>
                        </Box>

                        {/* Quality Index */}
                        <Box sx={{ flex: '1 1 100px', p: 1, bgcolor: 'white', border: 1, borderColor: 'divider', borderRadius: 1.5, display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 80 }}>
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.55rem', fontWeight: 600 }}>PROCESS RELIABILITY</Typography>
                            <Typography variant="subtitle2" fontWeight={700} color="warning.main" sx={{ mt: 0.25 }}>
                                {(() => {
                                    const score = auditReport ? auditReport.overallScore : 95;
                                    return score;
                                })()}%
                            </Typography>
                        </Box>
                    </Box>
                </Box>
            )}

            <Box p={2.5} sx={{ borderTop: 1, borderColor: 'divider' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Box>
                        <Typography variant="subtitle2" fontWeight={600}>Execution Engine</Typography>
                        <Typography variant="caption" color="text.secondary">Runs process with LLM processing tasks</Typography>
                    </Box>
                    <Box display="flex" gap={1}>
                        <Button
                            variant="outlined"
                            size="small"
                            onClick={runWorkflowAudit}
                            disabled={isAuditing}
                            startIcon={isAuditing ? <CircularProgress size={16} color="inherit" /> : <Analytics />}
                            sx={{ color: 'primary.main', borderColor: 'primary.200', '&:hover': { borderColor: 'primary.main', bgcolor: 'primary.50' } }}
                        >
                            {isAuditing ? 'Auditing...' : 'AI Process Audit'}
                        </Button>
                        <Button
                            variant="outlined"
                            size="small"
                            onClick={exportLogs}
                            startIcon={<Download />}
                            sx={{ color: 'text.secondary', borderColor: 'divider' }}
                        >
                            Export Logs
                        </Button>
                        <Button 
                            variant="contained" 
                            color={runningSimulation ? "error" : "primary"}
                            onClick={startWorkAutomation} 
                            startIcon={runningSimulation ? <StopCircleOutlined /> : <PlayCircleOutlined />}
                            sx={{ fontWeight: 600 }}
                        >
                            {runningSimulation ? 'Stop Run' : 'Run Live Work'}
                        </Button>
                    </Box>
                </Box>

                <Box ref={logMonitorRef} sx={{ height: 150, overflowY: 'auto', bgcolor: '#1e293b', borderRadius: 1, p: 2, '& > div': { mb: 0.5 } }}>
                    {logs.map((log, i) => {
                        let color = "#cbd5e1";
                        if (log.type === "system") color = "#fbbf24";
                        else if (log.type === "success") color = "#34d399";
                        else if (log.type === "error") color = "#f87171";

                        return (
                            <Typography key={i} sx={{ color, fontFamily: 'monospace', fontSize: '0.75rem' }}>
                                <Box component="span" sx={{ color: '#64748b', mr: 1 }}>[{log.timestamp}]</Box>
                                {log.text}
                            </Typography>
                        )
                    })}
                </Box>
            </Box>

            {auditReport && (
                <Dialog 
                    open={auditOpen} 
                    onClose={() => setAuditOpen(false)} 
                    maxWidth="md" 
                    fullWidth
                    PaperProps={{ sx: { borderRadius: 3, p: 1 } }}
                >
                    <DialogTitle sx={{ pb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Analytics color="primary" sx={{ fontSize: 28 }} />
                            <Typography variant="h6" fontWeight={700}>AI Optimization &amp; Audit Report</Typography>
                        </Box>
                        <Chip 
                            label={`Health Score: ${auditReport.overallScore}/100`} 
                            color={auditReport.overallScore >= 80 ? "success" : auditReport.overallScore >= 50 ? "warning" : "error"} 
                            sx={{ fontWeight: 700, px: 1 }} 
                        />
                    </DialogTitle>
                    <DialogContent dividers>
                        <Stack spacing={3}>
                            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                                <Box sx={{ flex: '1 1 200px', p: 2, border: 1, borderColor: 'divider', borderRadius: 2, bgcolor: 'grey.50', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 100 }}>
                                    <Typography variant="caption" color="text.secondary" fontWeight={600}>EFFICIENCY SPEED</Typography>
                                    <Typography variant="h6" fontWeight={700} sx={{ mt: 0.5, color: auditReport.efficiencyStatus === 'Optimal' ? 'success.main' : 'warning.main' }}>
                                        {auditReport.efficiencyStatus}
                                    </Typography>
                                </Box>
                                <Box sx={{ flex: '1 1 200px', p: 2, border: 1, borderColor: 'divider', borderRadius: 2, bgcolor: 'grey.50', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 100 }}>
                                    <Typography variant="caption" color="text.secondary" fontWeight={600}>COMPLIANCE RISK LEVEL</Typography>
                                    <Typography variant="h6" fontWeight={700} sx={{ mt: 0.5, color: auditReport.riskLevel === 'Low' ? 'success.main' : auditReport.riskLevel === 'Medium' ? 'warning.main' : 'error.main' }}>
                                        {auditReport.riskLevel}
                                    </Typography>
                                </Box>
                            </Box>

                            <Box>
                                <Typography variant="subtitle2" fontWeight={700} gutterBottom>EXECUTIVE SUMMARY</Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6, bgcolor: '#eff6ff', p: 2, borderRadius: 2, borderLeft: 4, borderLeftColor: 'primary.main' }}>
                                    {auditReport.summary}
                                </Typography>
                            </Box>

                            <Box>
                                <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>DETECTED OPPORTUNITIES &amp; GAPS ({auditReport.issues?.length || 0})</Typography>
                                <Stack spacing={2}>
                                    {auditReport.issues && auditReport.issues.length > 0 ? (
                                        auditReport.issues.map((issue, index) => (
                                            <Paper key={index} variant="outlined" sx={{ p: 2, transition: 'all 0.2s', '&:hover': { borderColor: 'primary.light', boxShadow: 1 } }}>
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, mb: 1 }}>
                                                    <Stack direction="row" spacing={1} alignItems="center">
                                                        <Chip 
                                                            label={issue.type} 
                                                            size="small" 
                                                            color={issue.type === 'Compliance Risk' ? 'error' : issue.type === 'Bottleneck' ? 'warning' : 'info'} 
                                                            sx={{ fontSize: '0.65rem', fontWeight: 700 }}
                                                        />
                                                        <Typography variant="caption" color="text.secondary" fontFamily="monospace">Node: {issue.nodeId}</Typography>
                                                    </Stack>
                                                    <Chip label={`Severity: ${issue.severity}`} size="small" variant="outlined" color={issue.severity === 'High' ? 'error' : issue.severity === 'Medium' ? 'warning' : 'default'} sx={{ height: 20, fontSize: '0.6rem', fontWeight: 600 }} />
                                                </Box>
                                                <Typography variant="subtitle2" fontWeight={600} gutterBottom>{issue.issue}</Typography>
                                                <Typography variant="body2" color="text.secondary" sx={{ mt: 1, pl: 1.5, borderLeft: 2, borderColor: 'grey.300', fontStyle: 'italic' }}>
                                                    <strong>Recommendation:</strong> {issue.recommendation}
                                                </Typography>
                                            </Paper>
                                        ))
                                    ) : (
                                        <Typography variant="body2" color="text.secondary">No logical gaps, bottlenecks, or compliance risks detected in this pipeline!</Typography>
                                    )}
                                </Stack>
                            </Box>
                        </Stack>
                    </DialogContent>
                    <DialogActions sx={{ px: 3, py: 2 }}>
                        <Button onClick={() => setAuditOpen(false)} variant="contained" color="primary" sx={{ px: 4 }}>
                            Acknowledge Report
                        </Button>
                    </DialogActions>
                </Dialog>
            )}
        </Paper>
    );
};

export default VisualPipeline;
