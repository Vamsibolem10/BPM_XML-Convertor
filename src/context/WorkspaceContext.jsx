import React, { createContext, useState, useContext } from 'react';
import { Snackbar, Alert } from '@mui/material';

const WorkspaceContext = createContext();

export const useWorkspace = () => useContext(WorkspaceContext);

export const WorkspaceProvider = ({ children }) => {
    const [activeChunks, setActiveChunks] = useState([]);
    const [executionVariables, setExecutionVariables] = useState({
        amount: 650,
        customerName: "Jane Doe",
        country: "US",
        customerSegment: "VIP",
        failureReason: ""
    });
    
    const [codeTab, setCodeTab] = useState('xml');
    const [currentEditingId, setCurrentEditingId] = useState(null);
    const [runningSimulation, setRunningSimulation] = useState(false);
    const [activeStepIndex, setActiveStepIndex] = useState(0);
    const [runningExecutionState, setRunningExecutionState] = useState({});
    const [logs, setLogs] = useState([
        { text: "System Ready. Awaiting trigger signal...", type: "info", timestamp: new Date().toLocaleTimeString() }
    ]);
    
    const [toast, setToast] = useState({ open: false, msg: '', type: 'success' });
    const [savedWorkflows, setSavedWorkflows] = useState(() => {
        const local = localStorage.getItem('bpm_workflows');
        return local ? JSON.parse(local) : [];
    });
    
    const saveWorkflow = (name) => {
        const newWorkflow = {
            id: Date.now(),
            name,
            chunks: activeChunks,
            variables: executionVariables,
            timestamp: new Date().toISOString()
        };
        const updated = [...savedWorkflows, newWorkflow];
        setSavedWorkflows(updated);
        localStorage.setItem('bpm_workflows', JSON.stringify(updated));
        showToast(`Workflow "${name}" saved!`, "success");
    };

    const loadWorkflow = (id) => {
        const workflow = savedWorkflows.find(w => w.id === id);
        if (workflow) {
            setActiveChunks(workflow.chunks);
            setExecutionVariables(workflow.variables);
            showToast(`Loaded workflow "${workflow.name}"!`, "success");
        }
    };

    const deleteWorkflow = (id) => {
        const updated = savedWorkflows.filter(w => w.id !== id);
        setSavedWorkflows(updated);
        localStorage.setItem('bpm_workflows', JSON.stringify(updated));
        showToast("Workflow deleted.", "success");
    };
    const addLog = (text, type = "info") => {
        setLogs(prev => [...prev, { text, type, timestamp: new Date().toLocaleTimeString() }]);
    };
    
    const showToast = (msg, type = "success") => {
        setToast({ open: true, msg, type });
    };

    const handleCloseToast = (event, reason) => {
        if (reason === 'clickaway') {
            return;
        }
        setToast(prev => ({ ...prev, open: false }));
    };

    const value = {
        activeChunks, setActiveChunks,
        executionVariables, setExecutionVariables,
        codeTab, setCodeTab,
        currentEditingId, setCurrentEditingId,
        runningSimulation, setRunningSimulation,
        activeStepIndex, setActiveStepIndex,
        runningExecutionState, setRunningExecutionState,
        logs, setLogs, addLog,
        showToast,
        savedWorkflows, saveWorkflow, loadWorkflow, deleteWorkflow
    };

    return (
        <WorkspaceContext.Provider value={value}>
            {children}
            
            <Snackbar open={toast.open} autoHideDuration={4000} onClose={handleCloseToast} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
                <Alert onClose={handleCloseToast} severity={toast.type} sx={{ width: '100%', boxShadow: 3 }}>
                    {toast.msg}
                </Alert>
            </Snackbar>
        </WorkspaceContext.Provider>
    );
};
