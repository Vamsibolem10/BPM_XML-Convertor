import React, { useState, useEffect } from 'react';
import { Paper, Box, Typography, Button, TextField, Select, MenuItem, FormControl, InputLabel, IconButton, Divider, CircularProgress, Chip, Stack } from '@mui/material';
import ContentCopy from '@mui/icons-material/ContentCopy';
import Download from '@mui/icons-material/Download';
import Close from '@mui/icons-material/Close';
import AutoFixHigh from '@mui/icons-material/AutoFixHigh';
import Hub from '@mui/icons-material/Hub';
import { useWorkspace } from '../context/WorkspaceContext';
import { enhanceTaskDescription, generateSapIntegrationMapping, runSignavioProcessMining, generateOracleIntegrationMapping, runAutonomousAgentResolve } from '../services/MistralService';

const generateBPMN2XML = (nodesList) => {
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
                  id="Definitions_FlowMaestro_V1"
                  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_AutomatedWork" isExecutable="true">`;

    let flows = [];
    nodesList.forEach(node => {
        if (node.next && Array.isArray(node.next)) {
            node.next.forEach(targetId => {
                if (nodesList.some(n => n.id === targetId)) {
                    flows.push({
                        id: `Flow_${node.id}_to_${targetId}`,
                        source: node.id,
                        target: targetId
                    });
                }
            });
        }
    });

    nodesList.forEach(node => {
        const incoming = flows.filter(f => f.target === node.id).map(f => `<bpmn:incoming>${f.id}</bpmn:incoming>`).join('\n      ');
        const outgoing = flows.filter(f => f.source === node.id).map(f => `<bpmn:outgoing>${f.id}</bpmn:outgoing>`).join('\n      ');

        let bpmnTag = 'bpmn:task';
        if (node.type === 'start') bpmnTag = 'bpmn:startEvent';
        else if (node.type === 'end') bpmnTag = 'bpmn:endEvent';
        else if (node.type === 'userTask') bpmnTag = 'bpmn:userTask';
        else if (node.type === 'serviceTask') bpmnTag = 'bpmn:serviceTask';
        else if (node.type === 'gateway') bpmnTag = 'bpmn:exclusiveGateway';

        const safeName = (node.name || node.id).replace(/[<>&'"]/g, c => {
            switch (c) {
                case '<': return '&lt;';
                case '>': return '&gt;';
                case '&': return '&amp;';
                case '\'': return '&apos;';
                case '"': return '&quot;';
                default: return c;
            }
        });

        xml += `\n    <${bpmnTag} id="${node.id}" name="${safeName}">\n      ${incoming}\n      ${outgoing}\n    </${bpmnTag}>`;
    });

    flows.forEach(flow => {
        xml += `\n    <bpmn:sequenceFlow id="${flow.id}" sourceRef="${flow.source}" targetRef="${flow.target}" />`;
    });

    xml += `\n  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_Process">
    <bpmndi:BPMNPlane id="BPMNPlane_Process" bpmnElement="Process_AutomatedWork">`;

    let posX = 100;
    let posY = 150;
    const stepPositions = {};

    nodesList.forEach((node) => {
        stepPositions[node.id] = { posX, posY };
        let width = 100;
        let height = 80;
        if (node.type === 'start' || node.type === 'end') { width = 36; height = 36; }
        else if (node.type === 'gateway') { width = 50; height = 50; }

        xml += `\n      <bpmndi:BPMNShape id="${node.id}_di" bpmnElement="${node.id}">
        <dc:Bounds x="${posX}" y="${posY}" width="${width}" height="${height}" />
      </bpmndi:BPMNShape>`;

        posX += 160;
        if (posX > 750) { posX = 100; posY += 150; }
    });

    flows.forEach(flow => {
        const src = stepPositions[flow.source];
        const tgt = stepPositions[flow.target];
        if (src && tgt) {
            xml += `\n      <bpmndi:BPMNEdge id="${flow.id}_di" bpmnElement="${flow.id}">
        <di:waypoint x="${src.posX + 50}" y="${src.posY + 40}" />
        <di:waypoint x="${tgt.posX}" y="${tgt.posY + 40}" />
      </bpmndi:BPMNEdge>`;
        }
    });

    xml += `\n    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

    return xml;
};

const AutomationOutput = () => {
    const { 
        activeChunks, setActiveChunks,
        codeTab, setCodeTab,
        currentEditingId, setCurrentEditingId,
        showToast
    } = useWorkspace();

    const [editForm, setEditForm] = useState({ name: '', actor: '', description: '', targetYes: '', targetNo: '', standardTarget: '' });
    const [isEnhancing, setIsEnhancing] = useState(false);
    const [sapMapping, setSapMapping] = useState(null);
    const [isGeneratingSap, setIsGeneratingSap] = useState(false);
    const [miningReport, setMiningReport] = useState(null);
    const [isMining, setIsMining] = useState(false);
    const [signavioSubTab, setSignavioSubTab] = useState('sap'); // 'sap' | 'mining' | 'collab'
    const [collaborativeComments, setCollaborativeComments] = useState([
        { id: 1, author: 'BPM Manager', text: 'Looks standard. Needs SAP S/4HANA Finance mapping verification.', time: '10 mins ago' },
        { id: 2, author: 'SAP Solutions Architect', text: 'We should use the standard OData service for Stripe payment verification.', time: '5 mins ago' }
    ]);
    const [newCommentText, setNewCommentText] = useState('');
    const [erpSystem, setErpSystem] = useState('sap'); // 'sap' | 'oracle'
    const [oracleMapping, setOracleMapping] = useState(null);
    const [isGeneratingOracle, setIsGeneratingOracle] = useState(false);
    const [selectedAgentNodeId, setSelectedAgentNodeId] = useState('');
    const [agentErrorMsg, setAgentErrorMsg] = useState('REST API Endpoint connection timeout.');
    const [agentReport, setAgentReport] = useState(null);
    const [isAgentRunning, setIsAgentRunning] = useState(false);

    useEffect(() => {
        if (currentEditingId) {
            const node = activeChunks.find(n => n.id === currentEditingId);
            if (node) {
                setEditForm({
                    name: node.name || '',
                    actor: node.actor || '',
                    description: node.description || '',
                    targetYes: node.type === 'gateway' ? (node.next[0] || '') : '',
                    targetNo: node.type === 'gateway' ? (node.next[1] || '') : '',
                    standardTarget: node.type !== 'gateway' && node.type !== 'end' ? (node.next[0] || '') : ''
                });
            }
        }
    }, [currentEditingId, activeChunks]);

    const codeContent = codeTab === 'xml' ? generateBPMN2XML(activeChunks) : JSON.stringify(activeChunks, null, 2);

    const copyPayloadToClipboard = () => {
        navigator.clipboard.writeText(codeContent);
        showToast("Copied code to clipboard!", "success");
    };

    const downloadCodeFile = () => {
        const ext = codeTab === 'xml' ? 'bpmn' : 'json';
        const mimeType = codeTab === 'xml' ? 'application/xml;charset=utf-8' : 'application/json;charset=utf-8';
        const blob = new Blob([codeContent], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `workflow.${ext}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast(`Downloaded workflow.${ext}`, "success");
    };

    const handleEnhanceInstructions = async () => {
        if (!editForm.name) {
            showToast("Please enter a step name first.", "warning");
            return;
        }

        setIsEnhancing(true);
        showToast("Enhancing instructions using Mistral AI...", "info");

        try {
            const enhanced = await enhanceTaskDescription(editForm.name, editForm.actor, editForm.description);
            setEditForm(prev => ({ ...prev, description: enhanced }));
            showToast("Instructions enhanced successfully!", "success");
        } catch (err) {
            console.error(err);
            showToast("Failed to enhance instructions.", "error");
        } finally {
            setIsEnhancing(false);
        }
    };

    const handleGenerateSapMapping = async () => {
        if (!activeChunks || activeChunks.length === 0) {
            showToast("No process steps to map.", "warning");
            return;
        }

        setIsGeneratingSap(true);
        showToast("Generating SAP S/4HANA Mapping using Gemini AI...", "info");

        try {
            const mappingData = await generateSapIntegrationMapping(activeChunks);
            setSapMapping(mappingData.mappings || []);
            showToast("SAP Module Mappings loaded via Gemini!", "success");
        } catch (err) {
            console.error(err);
            showToast("Failed to generate SAP Mappings.", "error");
        } finally {
            setIsGeneratingSap(false);
        }
    };

    const handleRunProcessMining = async () => {
        if (!activeChunks || activeChunks.length === 0) {
            showToast("No process model for conformance checking.", "warning");
            return;
        }

        setIsMining(true);
        showToast("Mining simulation event logs using Gemini AI...", "info");

        const simulatedLogs = activeChunks.map((chunk, index) => ({
            timestamp: new Date(Date.now() - (activeChunks.length - index) * 600000).toISOString(),
            nodeId: chunk.id,
            nodeName: chunk.name,
            actor: chunk.actor,
            action: "COMPLETED"
        }));

        try {
            const report = await runSignavioProcessMining(activeChunks, simulatedLogs);
            setMiningReport(report);
            showToast("Signavio Process Mining Complete via Gemini!", "success");
        } catch (err) {
            console.error(err);
            showToast("Process Mining failed.", "error");
        } finally {
            setIsMining(false);
        }
    };

    const handleAddComment = () => {
        if (!newCommentText.trim()) return;

        const newComment = {
            id: Date.now(),
            author: 'You (Consultant)',
            text: newCommentText.trim(),
            time: 'Just now'
        };

        setCollaborativeComments(prev => [newComment, ...prev]);
        setNewCommentText('');
        showToast("Collaboration feedback shared!", "success");
    };

    const handleGenerateOracleMapping = async () => {
        if (!activeChunks || activeChunks.length === 0) {
            showToast("No process steps to map.", "warning");
            return;
        }

        setIsGeneratingOracle(true);
        showToast("Generating Oracle Cloud ERP Mapping using Gemini AI...", "info");

        try {
            const mappingData = await generateOracleIntegrationMapping(activeChunks);
            setOracleMapping(mappingData.mappings || []);
            showToast("Oracle Cloud Mappings loaded via Gemini!", "success");
        } catch (err) {
            console.error(err);
            showToast("Failed to generate Oracle Mappings.", "error");
        } finally {
            setIsGeneratingOracle(false);
        }
    };

    const handleRunAutonomousAgent = async () => {
        if (!selectedAgentNodeId) {
            showToast("Please select a target step node.", "warning");
            return;
        }

        const targetNode = activeChunks.find(n => n.id === selectedAgentNodeId);
        if (!targetNode) return;

        setIsAgentRunning(true);
        showToast(`Deploying Autonomous Gemini AI Agent for step: ${targetNode.name}...`, "info");

        try {
            const variablesState = {
                amount: 650,
                customerName: "Jane Doe",
                country: "US",
                customerSegment: "VIP"
            };
            const report = await runAutonomousAgentResolve(targetNode, agentErrorMsg, variablesState);
            setAgentReport(report);
            showToast("Gemini AI Agent resolved exception autonomously!", "success");
        } catch (err) {
            console.error(err);
            showToast("Autonomous resolution agent failed.", "error");
        } finally {
            setIsAgentRunning(false);
        }
    };

    const saveNodeConfigChanges = () => {
        if (!currentEditingId) return;
        
        setActiveChunks(prev => prev.map(node => {
            if (node.id === currentEditingId) {
                const nextNode = { ...node, name: editForm.name, actor: editForm.actor, description: editForm.description, next: [] };
                
                if (node.type === 'gateway') {
                    if (editForm.targetYes) nextNode.next.push(editForm.targetYes);
                    if (editForm.targetNo) nextNode.next.push(editForm.targetNo);
                } else if (node.type !== 'end') {
                    if (editForm.standardTarget) nextNode.next.push(editForm.standardTarget);
                }
                return nextNode;
            }
            return node;
        }));

        setCurrentEditingId(null);
        showToast("Step properties updated!", "success");
    };

    const editingNode = activeChunks.find(n => n.id === currentEditingId);
    const potentialDestinations = activeChunks.filter(n => n.id !== currentEditingId);

    return (
        <Paper elevation={1} sx={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
            <Box p={2.5} sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <Typography variant="overline" color="primary" fontWeight={700}>Step 3</Typography>
                <Typography variant="h6" fontWeight={500} color="text.primary">Automation Output</Typography>
                <Typography variant="body2" color="text.secondary" mt={0.5}>
                    Export standard BPMN 2.0 or JSON.
                </Typography>
            </Box>

            <Box sx={{ display: 'flex', borderBottom: 1, borderColor: 'divider' }}>
                <Button 
                    fullWidth 
                    variant={codeTab === 'xml' ? 'contained' : 'text'} 
                    color="primary"
                    onClick={() => setCodeTab('xml')}
                    sx={{ borderRadius: 0, py: 1.5, fontSize: '0.7rem', fontWeight: codeTab === 'xml' ? 700 : 500 }}
                    disableElevation
                >
                    XML
                </Button>
                <Button 
                    fullWidth 
                    variant={codeTab === 'json' ? 'contained' : 'text'} 
                    color="primary"
                    onClick={() => setCodeTab('json')}
                    sx={{ borderRadius: 0, py: 1.5, fontSize: '0.7rem', fontWeight: codeTab === 'json' ? 700 : 500 }}
                    disableElevation
                >
                    JSON
                </Button>
                <Button 
                    fullWidth 
                    variant={codeTab === 'sap' ? 'contained' : 'text'} 
                    color="primary"
                    onClick={() => setCodeTab('sap')}
                    sx={{ borderRadius: 0, py: 1.5, fontSize: '0.7rem', fontWeight: codeTab === 'sap' ? 700 : 500 }}
                    disableElevation
                >
                    ENTERPRISE
                </Button>
            </Box>

            {codeTab === 'sap' ? (
                <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', minHeight: 300, bgcolor: '#fafafa', p: 2, overflowY: 'auto', maxHeight: 400 }}>
                    {/* Gemini Enterprise Hub Banner */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5, bgcolor: '#eff6ff', p: 1.25, borderRadius: 2, border: '1px solid #dbeafe' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Hub color="primary" sx={{ fontSize: 16 }} />
                            <Typography variant="caption" sx={{ color: 'primary.dark', fontWeight: 700, fontSize: '0.65rem', letterSpacing: 0.5 }}>
                                ENTERPRISE HUB
                            </Typography>
                        </Box>
                        <Chip
                            label="Powered by Google Gemini AI"
                            size="small"
                            sx={{
                                background: 'linear-gradient(135deg, #1a73e8 0%, #8ab4f8 100%)',
                                color: 'white',
                                fontWeight: 700,
                                fontSize: '0.55rem',
                                height: 18,
                                border: 'none',
                                boxShadow: '0 1px 3px rgba(26,115,232,0.2)'
                            }}
                        />
                    </Box>

                    {/* Signavio & Oracle Fusion Subtabs */}
                    <Box sx={{ display: 'flex', bgcolor: '#f1f5f9', p: 0.5, borderRadius: 1.5, mb: 2 }}>
                        <Button 
                            fullWidth 
                            size="small" 
                            variant={signavioSubTab === 'sap' ? 'contained' : 'text'} 
                            color="inherit" 
                            onClick={() => setSignavioSubTab('sap')}
                            sx={{ py: 0.5, fontSize: '0.6rem', fontWeight: 600, bgcolor: signavioSubTab === 'sap' ? 'white' : 'transparent', color: signavioSubTab === 'sap' ? 'primary.main' : 'text.secondary', boxShadow: signavioSubTab === 'sap' ? 1 : 0 }}
                        >
                            ERP Sync
                        </Button>
                        <Button 
                            fullWidth 
                            size="small" 
                            variant={signavioSubTab === 'mining' ? 'contained' : 'text'} 
                            color="inherit" 
                            onClick={() => setSignavioSubTab('mining')}
                            sx={{ py: 0.5, fontSize: '0.6rem', fontWeight: 600, bgcolor: signavioSubTab === 'mining' ? 'white' : 'transparent', color: signavioSubTab === 'mining' ? 'primary.main' : 'text.secondary', boxShadow: signavioSubTab === 'mining' ? 1 : 0 }}
                        >
                            Mining
                        </Button>
                        <Button 
                            fullWidth 
                            size="small" 
                            variant={signavioSubTab === 'agents' ? 'contained' : 'text'} 
                            color="inherit" 
                            onClick={() => setSignavioSubTab('agents')}
                            sx={{ py: 0.5, fontSize: '0.6rem', fontWeight: 600, bgcolor: signavioSubTab === 'agents' ? 'white' : 'transparent', color: signavioSubTab === 'agents' ? 'primary.main' : 'text.secondary', boxShadow: signavioSubTab === 'agents' ? 1 : 0 }}
                        >
                            AI Agents
                        </Button>
                        <Button 
                            fullWidth 
                            size="small" 
                            variant={signavioSubTab === 'collab' ? 'contained' : 'text'} 
                            color="inherit" 
                            onClick={() => setSignavioSubTab('collab')}
                            sx={{ py: 0.5, fontSize: '0.6rem', fontWeight: 600, bgcolor: signavioSubTab === 'collab' ? 'white' : 'transparent', color: signavioSubTab === 'collab' ? 'primary.main' : 'text.secondary', boxShadow: signavioSubTab === 'collab' ? 1 : 0 }}
                        >
                            Collab
                        </Button>
                    </Box>

                    {/* Subtab 1: ERP Integration Mapping (SAP vs Oracle) */}
                    {signavioSubTab === 'sap' && (
                        <Stack spacing={2}>
                            {/* Toggle System Selector */}
                            <Box sx={{ display: 'flex', bgcolor: 'white', border: 1, borderColor: 'divider', borderRadius: 1.5, p: 0.5 }}>
                                <Button
                                    fullWidth
                                    size="small"
                                    onClick={() => setErpSystem('sap')}
                                    sx={{ py: 0.5, fontSize: '0.65rem', fontWeight: 700, bgcolor: erpSystem === 'sap' ? 'primary.main' : 'transparent', color: erpSystem === 'sap' ? 'white' : 'text.secondary', '&:hover': { bgcolor: erpSystem === 'sap' ? 'primary.dark' : 'rgba(0,0,0,0.04)' } }}
                                >
                                    SAP PROFILE
                                </Button>
                                <Button
                                    fullWidth
                                    size="small"
                                    onClick={() => setErpSystem('oracle')}
                                    sx={{ py: 0.5, fontSize: '0.65rem', fontWeight: 700, bgcolor: erpSystem === 'oracle' ? 'primary.main' : 'transparent', color: erpSystem === 'oracle' ? 'white' : 'text.secondary', '&:hover': { bgcolor: erpSystem === 'oracle' ? 'primary.dark' : 'rgba(0,0,0,0.04)' } }}
                                >
                                    ORACLE PROFILE
                                </Button>
                            </Box>

                            {erpSystem === 'sap' ? (
                                <Stack spacing={1.5}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <Typography variant="caption" fontWeight={700} color="text.secondary">SAP MODULE FIELD MAPPINGS</Typography>
                                        <Button 
                                            size="small" 
                                            variant="outlined" 
                                            onClick={handleGenerateSapMapping} 
                                            disabled={isGeneratingSap}
                                            sx={{ py: 0.25, fontSize: '0.65rem', fontWeight: 700 }}
                                            startIcon={isGeneratingSap ? <CircularProgress size={10} color="inherit" /> : null}
                                        >
                                            {isGeneratingSap ? 'Mapping...' : 'Generate SAP Map'}
                                        </Button>
                                    </Box>

                                    {sapMapping ? (
                                        sapMapping.map((map, i) => (
                                            <Paper key={i} variant="outlined" sx={{ p: 1.5, bgcolor: 'white', borderRadius: 2 }}>
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                                    <Typography variant="caption" fontWeight={700} color="primary.main">{map.nodeName}</Typography>
                                                    <Chip label={map.sapModule} size="small" color="primary" variant="outlined" sx={{ height: 18, fontSize: '0.55rem', fontWeight: 700 }} />
                                                </Box>
                                                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1, fontFamily: 'monospace' }}>
                                                    <strong>T-Code:</strong> {map.tcode} | <strong>Interface:</strong> {map.apiStandard}
                                                </Typography>
                                                <Divider sx={{ my: 0.75 }} />
                                                {map.fields && map.fields.length > 0 && (
                                                    <Stack spacing={0.5} sx={{ pl: 1, borderLeft: 2, borderColor: 'grey.200' }}>
                                                        {map.fields.map((fld, j) => (
                                                            <Typography key={j} variant="caption" color="text.secondary" display="block" sx={{ fontSize: '0.6rem' }}>
                                                                <code>{fld.source}</code> &rarr; <strong>{fld.sapTechnicalName}</strong> ({fld.desc})
                                                            </Typography>
                                                        ))}
                                                    </Stack>
                                                )}
                                                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1, fontSize: '0.6rem', fontStyle: 'italic' }}>
                                                    <strong>Note:</strong> {map.integrationNotes}
                                                </Typography>
                                            </Paper>
                                        ))
                                    ) : (
                                        <Box sx={{ py: 3, textAlign: 'center', bgcolor: 'white', border: '1px dashed', borderColor: 'divider', borderRadius: 2 }}>
                                            <Typography variant="caption" color="text.secondary">Click Generate to map pipeline steps to SAP S/4HANA modules, T-Codes, and fields.</Typography>
                                        </Box>
                                    )}
                                </Stack>
                            ) : (
                                <Stack spacing={1.5}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <Typography variant="caption" fontWeight={700} color="text.secondary">ORACLE FUSION ERP REST ENDPOINTS</Typography>
                                        <Button 
                                            size="small" 
                                            variant="outlined" 
                                            onClick={handleGenerateOracleMapping} 
                                            disabled={isGeneratingOracle}
                                            sx={{ py: 0.25, fontSize: '0.65rem', fontWeight: 700 }}
                                            startIcon={isGeneratingOracle ? <CircularProgress size={10} color="inherit" /> : null}
                                        >
                                            {isGeneratingOracle ? 'Mapping...' : 'Generate Oracle Map'}
                                        </Button>
                                    </Box>

                                    {oracleMapping ? (
                                        oracleMapping.map((map, i) => (
                                            <Paper key={i} variant="outlined" sx={{ p: 1.5, bgcolor: 'white', borderRadius: 2 }}>
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                                    <Typography variant="caption" fontWeight={700} color="primary.main">{map.nodeName}</Typography>
                                                    <Chip label={map.oracleModule} size="small" color="secondary" variant="outlined" sx={{ height: 18, fontSize: '0.55rem', fontWeight: 700 }} />
                                                </Box>
                                                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1, fontFamily: 'monospace' }}>
                                                    <strong>REST Path:</strong> <code>{map.restEndpoint}</code>
                                                </Typography>
                                                <Divider sx={{ my: 0.75 }} />
                                                {map.fields && map.fields.length > 0 && (
                                                    <Stack spacing={0.5} sx={{ pl: 1, borderLeft: 2, borderColor: 'grey.200' }}>
                                                        {map.fields.map((fld, j) => (
                                                            <Typography key={j} variant="caption" color="text.secondary" display="block" sx={{ fontSize: '0.6rem' }}>
                                                                <code>{fld.source}</code> &rarr; <strong>{fld.oracleName}</strong> ({fld.desc})
                                                            </Typography>
                                                        ))}
                                                    </Stack>
                                                )}
                                                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1, fontSize: '0.6rem', fontStyle: 'italic' }}>
                                                    <strong>Agent Exception:</strong> {map.agentExceptionNote}
                                                </Typography>
                                            </Paper>
                                        ))
                                    ) : (
                                        <Box sx={{ py: 3, textAlign: 'center', bgcolor: 'white', border: '1px dashed', borderColor: 'divider', borderRadius: 2 }}>
                                            <Typography variant="caption" color="text.secondary">Click Generate to map pipeline steps to Oracle Fusion REST resources, methods, and JSON payloads.</Typography>
                                        </Box>
                                    )}
                                </Stack>
                            )}
                        </Stack>
                    )}

                    {/* Subtab 2: Signavio Process Mining Sim */}
                    {signavioSubTab === 'mining' && (
                        <Stack spacing={2}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Typography variant="caption" fontWeight={700} color="text.secondary">PROCESS CONFORMANCE &amp; VARIANT ANALYSIS</Typography>
                                <Button 
                                    size="small" 
                                    variant="outlined" 
                                    onClick={handleRunProcessMining} 
                                    disabled={isMining}
                                    sx={{ py: 0.25, fontSize: '0.65rem', fontWeight: 700 }}
                                    startIcon={isMining ? <CircularProgress size={10} color="inherit" /> : null}
                                >
                                    {isMining ? 'Mining Logs...' : 'Mine Execution Logs'}
                                </Button>
                            </Box>

                            {miningReport ? (
                                <Stack spacing={2}>
                                    <Box sx={{ display: 'flex', gap: 1 }}>
                                        <Paper variant="outlined" sx={{ flex: 1, p: 1, textAlign: 'center', bgcolor: 'white' }}>
                                            <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: '0.55rem', fontWeight: 700 }}>CONFORMANCE</Typography>
                                            <Typography variant="subtitle2" fontWeight={700} color="success.main">{miningReport.conformanceRating}%</Typography>
                                        </Paper>
                                        <Paper variant="outlined" sx={{ flex: 1, p: 1, textAlign: 'center', bgcolor: 'white' }}>
                                            <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: '0.55rem', fontWeight: 700 }}>AVG THROUGHPUT</Typography>
                                            <Typography variant="subtitle2" fontWeight={700} color="primary.main">{miningReport.throughputTimeAvg}</Typography>
                                        </Paper>
                                    </Box>

                                    <Box>
                                        <Typography variant="caption" fontWeight={700} color="text.secondary" display="block" sx={{ mb: 1 }}>PATH VARIANTS DISCOVERED</Typography>
                                        {miningReport.variantDistribution?.map((vr, i) => (
                                            <Box key={i} sx={{ mb: 1, p: 1, border: 1, borderColor: 'divider', borderRadius: 1.5, bgcolor: 'white' }}>
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                                                    <Typography variant="caption" fontWeight={700}>{vr.variantName}</Typography>
                                                    <Chip label={`${vr.percentage}%`} size="small" color="primary" sx={{ height: 16, fontSize: '0.55rem', fontWeight: 700 }} />
                                                </Box>
                                                <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: '0.6rem' }}>
                                                    {vr.description}
                                                </Typography>
                                            </Box>
                                        ))}
                                    </Box>

                                    <Box>
                                        <Typography variant="caption" fontWeight={700} color="text.secondary" display="block" sx={{ mb: 1 }}>CONFORMANCE DEVIATIONS</Typography>
                                        {miningReport.deviations && miningReport.deviations.length > 0 ? (
                                            miningReport.deviations.map((dev, i) => (
                                                <Paper key={i} variant="outlined" sx={{ p: 1, mb: 1, borderLeft: 3, borderLeftColor: 'warning.main', bgcolor: 'white' }}>
                                                    <Typography variant="caption" fontWeight={700} display="block">{dev.description}</Typography>
                                                    <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: '0.55rem' }}>
                                                        Severity: {dev.impact} | Target step: #{dev.detectedAtNode}
                                                    </Typography>
                                                </Paper>
                                            ))
                                        ) : (
                                            <Typography variant="caption" color="text.secondary">No behavioral deviations detected.</Typography>
                                        )}
                                    </Box>
                                </Stack>
                            ) : (
                                <Box sx={{ py: 3, textAlign: 'center', bgcolor: 'white', border: '1px dashed', borderColor: 'divider', borderRadius: 2 }}>
                                    <Typography variant="caption" color="text.secondary">Click Mine to audit simulated chronological database logs against the process model.</Typography>
                                </Box>
                            )}
                        </Stack>
                    )}

                    {/* Subtab 3: Oracle Fusion Cloud AI Exception Resolution Agents */}
                    {signavioSubTab === 'agents' && (
                        <Stack spacing={2}>
                            <Typography variant="caption" fontWeight={700} color="text.secondary">ORACLE FUSION AUTONOMOUS AI AGENTS</Typography>
                            
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                                <FormControl size="small" fullWidth sx={{ bgcolor: 'white' }}>
                                    <InputLabel id="agent-node-select-label">Select Failure Node</InputLabel>
                                    <Select
                                        labelId="agent-node-select-label"
                                        value={selectedAgentNodeId}
                                        onChange={(e) => setSelectedAgentNodeId(e.target.value)}
                                        label="Select Failure Node"
                                    >
                                        {activeChunks.filter(n => n.type !== 'start' && n.type !== 'end').map(n => (
                                            <MenuItem key={n.id} value={n.id}>{n.name} (#{n.id})</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>

                                <TextField
                                    label="Simulated Exception / Error Details"
                                    placeholder="E.g. Price mismatch: payload amount doesn't align with contract limits."
                                    size="small"
                                    multiline
                                    rows={2}
                                    fullWidth
                                    value={agentErrorMsg}
                                    onChange={(e) => setAgentErrorMsg(e.target.value)}
                                    sx={{ bgcolor: 'white' }}
                                />

                                <Button
                                    variant="contained"
                                    color="primary"
                                    fullWidth
                                    onClick={handleRunAutonomousAgent}
                                    disabled={isAgentRunning || !selectedAgentNodeId}
                                    startIcon={isAgentRunning ? <CircularProgress size={14} color="inherit" /> : null}
                                    sx={{ fontWeight: 600 }}
                                >
                                    {isAgentRunning ? 'Agent Troubleshooting...' : 'Trigger Autonomous Agent Recovery'}
                                </Button>
                            </Box>

                            {agentReport ? (
                                <Paper variant="outlined" sx={{ p: 1.5, bgcolor: '#f0fdf4', border: '1px solid', borderColor: 'success.200', borderRadius: 2 }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                        <Typography variant="caption" fontWeight={700} color="success.main">AGENT ACTION: SUCCESS</Typography>
                                        <Chip label={agentReport.agentName || "Oracle SCM Agent"} size="small" color="success" sx={{ height: 18, fontSize: '0.55rem', fontWeight: 700 }} />
                                    </Box>
                                    
                                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                                        <strong>Root Cause:</strong> {agentReport.rootCauseAnalysis}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                                        <strong>Correction Applied:</strong> {agentReport.correctiveActionsTaken}
                                    </Typography>
                                    
                                    <Box sx={{ bgcolor: 'white', p: 1, border: 1, borderColor: 'divider', borderRadius: 1.5, my: 1 }}>
                                        <Typography variant="caption" fontWeight={700} display="block" sx={{ fontSize: '0.55rem' }}>HEALED VARIABLES STATE</Typography>
                                        <pre style={{ margin: 0, fontSize: '0.6rem', fontFamily: 'monospace', color: '#15803d', overflowX: 'auto' }}>
                                            {JSON.stringify(agentReport.healedVariables, null, 2)}
                                        </pre>
                                    </Box>

                                    <Typography variant="caption" fontWeight={700} color="text.secondary" display="block" sx={{ mt: 1, mb: 0.5, fontSize: '0.55rem' }}>AGENT MIND &amp; LOGS</Typography>
                                    <Stack spacing={0.5} sx={{ pl: 1, borderLeft: 2, borderColor: 'success.300' }}>
                                        {agentReport.logs?.map((log, i) => (
                                            <Typography key={i} variant="caption" color="text.secondary" sx={{ fontSize: '0.55rem' }}>
                                                &bull; {log}
                                            </Typography>
                                        ))}
                                    </Stack>
                                </Paper>
                            ) : (
                                <Box sx={{ py: 3, textAlign: 'center', bgcolor: 'white', border: '1px dashed', borderColor: 'divider', borderRadius: 2 }}>
                                    <Typography variant="caption" color="text.secondary">Configure a task error scenario and deploy Oracle AI agents to autonomously audit and heal the payload variables state.</Typography>
                                </Box>
                            )}
                        </Stack>
                    )}

                    {/* Subtab 4: Collaboration feedback hub */}
                    {signavioSubTab === 'collab' && (
                        <Stack spacing={2}>
                            <Typography variant="caption" fontWeight={700} color="text.secondary">SIGNAVIO COLLABORATION &amp; TEAM CHAT</Typography>
                            
                            <Box sx={{ display: 'flex', gap: 1 }}>
                                <TextField 
                                    placeholder="Add process comment..." 
                                    size="small" 
                                    fullWidth 
                                    value={newCommentText}
                                    onChange={(e) => setNewCommentText(e.target.value)}
                                    sx={{ bgcolor: 'white' }}
                                />
                                <Button variant="contained" color="primary" onClick={handleAddComment} sx={{ py: 0.5, px: 2, fontSize: '0.65rem', fontWeight: 700 }}>
                                    Post
                                </Button>
                            </Box>

                            <Stack spacing={1} sx={{ mt: 1, maxHeight: 200, overflowY: 'auto' }}>
                                {collaborativeComments.map(comment => (
                                    <Paper key={comment.id} variant="outlined" sx={{ p: 1, bgcolor: 'white', borderRadius: 1.5 }}>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                                            <Typography variant="caption" fontWeight={700} color="primary.main">{comment.author}</Typography>
                                            <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.55rem' }}>{comment.time}</Typography>
                                        </Box>
                                        <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: '0.6rem' }}>
                                            {comment.text}
                                        </Typography>
                                    </Paper>
                                ))}
                            </Stack>
                        </Stack>
                    )}
                </Box>
            ) : (
                <Box sx={{ position: 'relative', flexGrow: 1, display: 'flex', flexDirection: 'column', minHeight: 250, bgcolor: 'grey.50' }}>
                    <Box sx={{ position: 'absolute', top: 8, right: 8, zIndex: 10, display: 'flex', gap: 1 }}>
                        <Button variant="outlined" size="small" sx={{ bgcolor: 'white' }} startIcon={<ContentCopy />} onClick={copyPayloadToClipboard}>Copy</Button>
                        <Button variant="outlined" size="small" sx={{ bgcolor: 'white' }} startIcon={<Download />} onClick={downloadCodeFile}>Export</Button>
                    </Box>
                    <Box sx={{ p: 2, flexGrow: 1, overflow: 'auto', maxHeight: 350 }}>
                        <Typography component="pre" sx={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'text.secondary' }}>
                            {codeContent}
                        </Typography>
                    </Box>
                </Box>
            )}

            {editingNode && (
                <Box sx={{ borderTop: 1, borderColor: 'divider', bgcolor: 'background.paper', p: 2.5 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="subtitle2" fontWeight={600}>Edit Node Properties</Typography>
                        <IconButton size="small" onClick={() => setCurrentEditingId(null)}><Close fontSize="small" /></IconButton>
                    </Box>
                    
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                        <TextField 
                            label="Step Name" 
                            size="small" 
                            fullWidth 
                            value={editForm.name}
                            onChange={(e) => setEditForm(prev => ({...prev, name: e.target.value}))}
                        />
                        <TextField 
                            label="Actor Role" 
                            size="small" 
                            fullWidth 
                            value={editForm.actor}
                            onChange={(e) => setEditForm(prev => ({...prev, actor: e.target.value}))}
                        />
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Typography variant="caption" color="text.secondary" fontWeight={600}>TASK INSTRUCTIONS</Typography>
                                <Button 
                                    size="small" 
                                    variant="text" 
                                    color="primary" 
                                    onClick={handleEnhanceInstructions} 
                                    disabled={isEnhancing}
                                    startIcon={isEnhancing ? <CircularProgress size={10} color="inherit" /> : <AutoFixHigh sx={{ fontSize: 12 }} />}
                                    sx={{ py: 0, fontSize: '0.6rem', fontWeight: 600, textTransform: 'none' }}
                                >
                                    {isEnhancing ? 'Enhancing...' : 'AI Suggest Details'}
                                </Button>
                            </Box>
                            <TextField 
                                size="small" 
                                fullWidth 
                                multiline 
                                rows={2}
                                value={editForm.description}
                                onChange={(e) => setEditForm(prev => ({...prev, description: e.target.value}))}
                                placeholder="Enter detailed operational instructions..."
                            />
                        </Box>
                        
                        {editingNode.type === 'gateway' ? (
                            <>
                                <FormControl size="small" fullWidth>
                                    <InputLabel>Path A (Yes)</InputLabel>
                                    <Select label="Path A (Yes)" value={editForm.targetYes} onChange={(e) => setEditForm(prev => ({...prev, targetYes: e.target.value}))}>
                                        <MenuItem value=""><em>None</em></MenuItem>
                                        {potentialDestinations.map(tgt => <MenuItem key={tgt.id} value={tgt.id}>#{tgt.id}: {tgt.name}</MenuItem>)}
                                    </Select>
                                </FormControl>
                                <FormControl size="small" fullWidth>
                                    <InputLabel>Path B (No)</InputLabel>
                                    <Select label="Path B (No)" value={editForm.targetNo} onChange={(e) => setEditForm(prev => ({...prev, targetNo: e.target.value}))}>
                                        <MenuItem value=""><em>None</em></MenuItem>
                                        {potentialDestinations.map(tgt => <MenuItem key={tgt.id} value={tgt.id}>#{tgt.id}: {tgt.name}</MenuItem>)}
                                    </Select>
                                </FormControl>
                            </>
                        ) : editingNode.type === 'end' ? (
                            <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic', bgcolor: 'grey.100', p: 1, borderRadius: 1 }}>
                                End states do not support outgoing pathways.
                            </Typography>
                        ) : (
                            <FormControl size="small" fullWidth>
                                <InputLabel>Next Target</InputLabel>
                                <Select label="Next Target" value={editForm.standardTarget} onChange={(e) => setEditForm(prev => ({...prev, standardTarget: e.target.value}))}>
                                    <MenuItem value=""><em>Stop</em></MenuItem>
                                    {potentialDestinations.map(tgt => <MenuItem key={tgt.id} value={tgt.id}>#{tgt.id}: {tgt.name}</MenuItem>)}
                                </Select>
                            </FormControl>
                        )}
                        
                        <Button variant="contained" color="primary" fullWidth onClick={saveNodeConfigChanges} sx={{ mt: 1 }}>
                            Apply Properties
                        </Button>
                    </Box>
                </Box>
            )}
        </Paper>
    );
};

export default AutomationOutput;
