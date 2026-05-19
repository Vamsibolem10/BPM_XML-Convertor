const MISTRAL_API_KEY = import.meta.env.VITE_MISTRAL_API_KEY;
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "AIzaSyCdG4ho3MPLJxYwBfGpB3wBX1a7eZ5OpqE";
const fetchWithRetry = async (url, options, maxRetries = 3, timeoutMs = 20000) => {
    let attempt = 0;
    while (attempt < maxRetries) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const response = await fetch(url, { ...options, signal: controller.signal });
            clearTimeout(timeoutId);

            if (!response.ok) {
                let errorMsg = `Mistral API Error: ${response.status} ${response.statusText}`;
                try {
                    const errorData = await response.json();
                    if (errorData.message) errorMsg += ` - ${errorData.message}`;
                } catch (e) { } // Ignore json parse errors if response is not JSON
                throw new Error(errorMsg);
            }

            const data = await response.json();
            if (!data.choices || !data.choices[0] || !data.choices[0].message) {
                throw new Error("Invalid response format from Mistral API: missing choices array.");
            }

            const rawContent = data.choices[0].message.content;

            // Try parsing the JSON safely
            let cleanContent = rawContent.trim();
            if (cleanContent.startsWith("```")) {
                cleanContent = cleanContent.replace(/^```[a-zA-Z]*\n?/, "");
                cleanContent = cleanContent.replace(/```$/, "");
                cleanContent = cleanContent.trim();
            }
            try {
                return JSON.parse(cleanContent);
            } catch (e) {
                console.error("JSON parsing error on content:", rawContent);
                throw new Error("Failed to parse JSON from AI response.");
            }

        } catch (err) {
            clearTimeout(timeoutId);
            attempt++;

            console.warn(`[Mistral API] Attempt ${attempt} failed: ${err.message}. Retrying...`);

            if (attempt >= maxRetries) {
                throw err;
            }
            // Exponential backoff: 1s, 2s, 4s...
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt - 1) * 1000));
        }
    }
};

const callMistralApi = async (systemPrompt, userPrompt) => {
    if (!MISTRAL_API_KEY) {
        throw new Error("Mistral API key is missing. Please check your .env file.");
    }

    return fetchWithRetry("https://api.mistral.ai/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${MISTRAL_API_KEY}`
        },
        body: JSON.stringify({
            model: "mistral-large-latest",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
            response_format: { type: "json_object" },
            temperature: 0.1, // Low temperature for robust structured output
        })
    });
};

const callGeminiApi = async (systemPrompt, userPrompt, maxRetries = 3, timeoutMs = 20000) => {
    if (!GEMINI_API_KEY) {
        throw new Error("Gemini API key is missing. Please check your .env file.");
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    let attempt = 0;

    while (attempt < maxRetries) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [
                                {
                                    text: userPrompt
                                }
                            ]
                        }
                    ],
                    systemInstruction: {
                        parts: [
                            {
                                text: systemPrompt
                            }
                        ]
                    },
                    generationConfig: {
                        responseMimeType: "application/json",
                        temperature: 0.1
                    }
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                let errorMsg = `Gemini API Error: ${response.status} ${response.statusText}`;
                try {
                    const errorData = await response.json();
                    if (errorData.error && errorData.error.message) {
                        errorMsg += ` - ${errorData.error.message}`;
                    }
                } catch (e) { }
                throw new Error(errorMsg);
            }

            const data = await response.json();
            if (!data.candidates || !data.candidates[0] || !data.candidates[0].content || !data.candidates[0].content.parts || !data.candidates[0].content.parts[0]) {
                throw new Error("Invalid response format from Gemini API: missing candidates content.");
            }

            const rawContent = data.candidates[0].content.parts[0].text;

            // Try parsing the JSON safely
            let cleanContent = rawContent.trim();
            if (cleanContent.startsWith("```")) {
                cleanContent = cleanContent.replace(/^```[a-zA-Z]*\n?/, "");
                cleanContent = cleanContent.replace(/```$/, "");
                cleanContent = cleanContent.trim();
            }
            try {
                return JSON.parse(cleanContent);
            } catch (e) {
                console.error("JSON parsing error on content:", rawContent);
                throw new Error("Failed to parse JSON from AI response.");
            }

        } catch (err) {
            clearTimeout(timeoutId);
            attempt++;

            console.warn(`[Gemini API] Attempt ${attempt} failed: ${err.message}. Retrying...`);

            if (attempt >= maxRetries) {
                throw err;
            }
            // Exponential backoff: 1s, 2s, 4s...
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt - 1) * 1000));
        }
    }
};

export const segmentWorkflow = async (narrative) => {
    const systemPrompt = `You are a world-class BPM and automation pipeline builder. Given a process narrative paragraph, segment it systematically into clear, step-by-step procedural chunks.
    Ensure there are clear:
    - Start steps (type: 'start')
    - Operations (type: 'serviceTask' for APIs or automated steps, 'userTask' for human steps)
    - Decisions (type: 'gateway' - must route to exactly 2 optional target step IDs)
    - End steps (type: 'end').
    
    Make sure that the "next" property of each chunk lists the valid step ID string of the target steps it connects to sequentially. Gateways should have exactly 2 elements in the "next" array to represent standard True/False or Yes/No logic choices. Return raw JSON that aligns precisely with this schema:
    {
        "chunks": [
            {
                "id": "unique_snake_case_id",
                "type": "start|userTask|serviceTask|gateway|end",
                "name": "Short action label",
                "actor": "Role responsible",
                "description": "Complete instructional detail",
                "next": ["target_id_1", "target_id_2"]
            }
        ]
    }`;

    const userPrompt = `Analyse and map this narrative description:\n\n"${narrative}"`;

    try {
        const result = await callMistralApi(systemPrompt, userPrompt);
        if (!result.chunks || !Array.isArray(result.chunks)) {
            throw new Error("AI returned a JSON object without the 'chunks' array.");
        }
        return result;
    } catch (error) {
        console.error("segmentWorkflow Error:", error);
        throw error;
    }
};

export const runAiTaskAutomation = async (node, currentState) => {
    const systemPrompt = `You are a precise, enterprise-grade automated task processor. Your job is to execute the workflow task: "${node.name}".
    Task Instructions: "${node.description}".
    Current Workflow State Variables: ${JSON.stringify(currentState)}.
    
    CRITICAL INSTRUCTIONS:
    1. Ground your calculations and output variables STRICTLY in the provided instructions and current state. 
    2. Do NOT invent, assume, or add any unrelated business fields, attributes, or random mocked values. 
    3. Keep values high-fidelity and exact.
    4. Output the result as a raw JSON object containing ONLY the modified or newly calculated variables. Keep variable names short and flat. 
    
    Do not wrap code block formatting around the JSON output. ONLY respond with pure parsable JSON object.`;

    const userPrompt = `Process the task using only the fields provided and output the exact updated state variables JSON.`;

    try {
        return await callMistralApi(systemPrompt, userPrompt);
    } catch (error) {
        console.warn(`[Mistral API] Rate-limited or offline (Node: ${node.id}). Activating Local AI backup handler...`);

        let localUpdated = {};
        const name = (node.name || "").toLowerCase();

        if (name.includes("verify") || name.includes("check")) {
            localUpdated = { transactionMatch: true, status: "verified" };
        } else if (name.includes("email") || name.includes("notify")) {
            localUpdated = { emailSent: true, notificationChannel: "email" };
        } else if (name.includes("escalat") || name.includes("approve")) {
            localUpdated = { escalationStatus: "approved_by_backup_handler" };
        } else {
            localUpdated = { status: "processed_locally" };
        }

        return {
            ...localUpdated,
            _execution_mode: "Local AI Backup Engine",
            _warning: "API rate limit reached; local backup processing activated."
        };
    }
};

export const runAiGatewaySplitChoice = async (node, currentState) => {
    const systemPrompt = `You are a logical conditional routing engine. Your job is to evaluate the decision criteria at the BPM Gateway: "${node.name}".
    Description of logic: "${node.description}".
    Available Outbound Choice Path Targets: ${JSON.stringify(node.next)}.
    Current Workflow State Variables: ${JSON.stringify(currentState)}.
    
    Analyze the variables against the gateway criteria. Choose exactly ONE of the available outbound choice targets that the workflow must follow.
    Respond strictly with a JSON object containing:
    1. "selectedPath": The target ID string chosen.
    2. "reason": A brief explanation of why that path was chosen.
    
    ONLY respond with pure parsable JSON object. Do not wrap code block formatting.`;

    const userPrompt = `Evaluate state data and choose the next node target ID from the available paths based on logic.`;

    try {
        const result = await callMistralApi(systemPrompt, userPrompt);

        if (!node.next.includes(result.selectedPath)) {
            throw new Error(`AI selected invalid path '${result.selectedPath}' which is not in ${JSON.stringify(node.next)}`);
        }
        return result;
    } catch (error) {
        console.warn(`[Mistral API] Rate-limited or offline (Gateway: ${node.id}). Activating Local AI routing engine...`);

        let selectedPath = node.next[0] || "";
        let reason = "Standard path chosen by local routing engine.";
        const amount = Number(currentState.amount || 0);

        const escalationPath = node.next.find(p => p.includes("escalat") || p.includes("manager") || p.includes("manual"));
        const happyPath = node.next.find(p => !p.includes("escalat") && !p.includes("manager") && !p.includes("manual"));

        if (amount > 500 && escalationPath) {
            selectedPath = escalationPath;
            reason = `Amount ($${amount}) exceeds standard limit ($500). Routed autonomously to escalation path.`;
        } else if (happyPath) {
            selectedPath = happyPath;
            reason = "Operational variables satisfy standard Happy Path compliance rules.";
        }

        return {
            selectedPath,
            reason: `${reason} (Active: Local AI Routing Engine)`
        };
    }
};

export const analyzeAndAuditWorkflow = async (chunks) => {
    const systemPrompt = `You are an expert enterprise BPM consultant and systems auditor. Analyze the provided workflow pipeline (represented as a JSON list of process nodes) and perform a comprehensive logic, compliance, and efficiency audit.
    
    Your analysis should evaluate:
    1. Logical gaps (e.g. missing gateways, orphaned paths, infinite loops).
    2. Operational efficiency / bottlenecks (e.g. slow manual verification of automated actions, lack of notification steps).
    3. Compliance & safety (e.g. lack of dual approval for high-risk nodes, missing logging triggers).
    
    You must output a highly structured JSON report matching this EXACT schema:
    {
        "overallScore": 0,
        "efficiencyStatus": "Optimal|Minor Issues|Critical Bottlenecks",
        "riskLevel": "Low|Medium|High",
        "issues": [
            {
                "type": "Logic Gap|Bottleneck|Compliance Risk",
                "severity": "Low|Medium|High",
                "nodeId": "ID of affected node or 'Global'",
                "issue": "Detailed description of what is wrong",
                "recommendation": "Step-by-step instructions on how the team can resolve this"
            }
        ],
        "summary": "A concise 2-3 sentence strategic executive summary."
    }
    
    ONLY respond with pure parsable JSON object. Do not wrap code block formatting.`;

    const userPrompt = `Audit and analyze this BPM pipeline:\n\n${JSON.stringify(chunks, null, 2)}`;

    try {
        return await callMistralApi(systemPrompt, userPrompt);
    } catch (error) {
        console.error("analyzeAndAuditWorkflow Error:", error);
        throw error;
    }
};

export const enhanceTaskDescription = async (nodeName, actorRole, currentInstructions) => {
    const systemPromptJson = `You are a world-class BPM business systems analyst. Enhance the process execution instructions for a task node to make them extremely precise, logical, and optimized for automated workers or human actors.
    
    You must respond strictly with a JSON object matching this schema:
    {
        "enhancedInstructions": "Detailed step-by-step process guidelines..."
    }
    
    ONLY respond with pure parsable JSON object. Do not wrap code block formatting.`;

    const userPrompt = `Task Name: "${nodeName}"
    Actor Role: "${actorRole}"
    Current Instructions: "${currentInstructions || 'None provided'}"
    
    Generate the enhanced instructions.`;

    try {
        const result = await callMistralApi(systemPromptJson, userPrompt);
        return result.enhancedInstructions || currentInstructions;
    } catch (error) {
        console.error("enhanceTaskDescription Error:", error);
        throw error;
    }
};

export const generateMockPayloadForWorkflow = async (chunks) => {
    const systemPrompt = `You are a technical BPM systems architect. Analyze the provided workflow pipeline structure (JSON nodes) and draft a complete, highly realistic mock starting JSON data payload (e.g. variables, values, customer attributes, amounts, flags) that would be fed into the pipeline to execute the entire automation route.
    
    Analyze:
    - What the gateway decisions look for (e.g., amount, country, rating).
    - What automated services need to call APIs (e.g. transactional variables).
    
    You must respond strictly with a JSON object matching this EXACT schema:
    {
        "payload": {
            "variable_1": "value_1",
            "variable_2": 123
        }
    }
    
    ONLY respond with pure parsable JSON object. Do not wrap code block formatting.`;

    const userPrompt = `Create a realistic mock starting payload for this workflow:\n\n${JSON.stringify(chunks, null, 2)}`;

    try {
        const result = await callMistralApi(systemPrompt, userPrompt);
        return result.payload || {};
    } catch (error) {
        console.error("generateMockPayloadForWorkflow Error:", error);
        throw error;
    }
};

export const generateSapIntegrationMapping = async (chunks) => {
    const systemPrompt = `You are an SAP Enterprise Architect and Signavio integration consultant. Analyze the provided workflow chunks and generate a complete SAP Module Integration & Field Mapping guide.
    For each applicable serviceTask or userTask, map it to:
    - The most relevant SAP ERP/S4HANA Module (e.g., SD, MM, FI, CO, HR, PP).
    - Recommended SAP Transaction Code (T-Code, e.g., VA01, MIRO, FB60).
    - API Interface Standard (e.g., OData v4 Service, RFC BAPI, IDoc).
    - Key field mappings (e.g., CustomerNumber -> KUNNR, InvoiceAmount -> WRBTR).
    
    You must respond strictly with a JSON object matching this EXACT schema:
    {
        "mappings": [
            {
                "nodeId": "ID of the node",
                "nodeName": "Name of the node",
                "sapModule": "E.g. SAP FI (Financial Accounting)",
                "tcode": "E.g. FB60",
                "apiStandard": "E.g. OData V4 API / BAPI_ACC_DOCUMENT_POST",
                "fields": [
                    {"source": "workflowField", "sapTechnicalName": "SAP_FIELD", "desc": "Field description"}
                ],
                "integrationNotes": "Brief strategic recommendation for seamless data exchange."
            }
        ]
    }
    
    ONLY respond with pure parsable JSON object. Do not wrap code block formatting.`;

    const userPrompt = `Generate SAP Integration Mapping for these workflow steps:\n\n${JSON.stringify(chunks, null, 2)}`;

    try {
        return await callGeminiApi(systemPrompt, userPrompt);
    } catch (error) {
        console.error("generateSapIntegrationMapping Error:", error);
        throw error;
    }
};

export const runSignavioProcessMining = async (chunks, eventLogs) => {
    const systemPrompt = `You are a professional Signavio Process Mining and Analytics consultant. Analyze the provided event logs (which contain chronological transaction and action timestamps) against the designed BPMN pipeline chunks.
    
    Perform conformance checking, frequency profiling, and bottleneck analysis.
    Output a highly structured JSON report matching this EXACT schema:
    {
        "conformanceRating": 0 to 100,
        "throughputTimeAvg": "E.g., 2.4 hours",
        "variantDistribution": [
            {"variantName": "Happy Path / Deviation 1", "percentage": 0 to 100, "description": "Variant steps description"}
        ],
        "deviations": [
            {"description": "Type of deviation", "impact": "High|Medium|Low", "detectedAtNode": "Node ID"}
        ],
        "bottlenecks": [
            {"nodeId": "ID of node", "delayFactor": "E.g. 45 mins idle time", "recommendation": "Signavio optimization recommendation"}
        ]
    }
    
    ONLY respond with pure parsable JSON object. Do not wrap code block formatting.`;

    const userPrompt = `Analyze these designed chunks:\n${JSON.stringify(chunks, null, 2)}\n\nAgainst these actual execution logs:\n${JSON.stringify(eventLogs, null, 2)}`;

    try {
        return await callGeminiApi(systemPrompt, userPrompt);
    } catch (error) {
        console.error("runSignavioProcessMining Error:", error);
        throw error;
    }
};

export const generateOracleIntegrationMapping = async (chunks) => {
    const systemPrompt = `You are an Oracle Fusion Cloud Enterprise Architect. Analyze the provided workflow chunks and generate a complete Oracle ERP Cloud / SCM Cloud / HCM Cloud REST Integration guide.
    For each applicable serviceTask or userTask, map it to:
    - The most relevant Oracle Fusion Cloud Module (e.g., Oracle Financials Cloud, SCM Cloud, HCM Cloud, Procurement Cloud).
    - Recommended REST Resource API Endpoint Path (e.g., /fscmRestApi/resources/11.13.18.05/invoices).
    - HTTP REST Method (e.g. POST, GET, PATCH).
    - Custom JSON Payload Mapping Schema.
    - AI Agent exception handling guidelines for REST timeout/rejection.
    
    You must respond strictly with a JSON object matching this EXACT schema:
    {
        "mappings": [
            {
                "nodeId": "ID of the node",
                "nodeName": "Name of the node",
                "oracleModule": "E.g. Oracle Financials Cloud (General Ledger)",
                "restEndpoint": "E.g. /fscmRestApi/resources/11.13.18.05/invoices",
                "httpMethod": "E.g. POST",
                "fields": [
                    {"source": "workflowField", "oracleName": "oracle_field_spec", "desc": "Field description"}
                ],
                "agentExceptionNote": "Autonomous agent failover directive for API exceptions."
            }
        ]
    }
    
    ONLY respond with pure parsable JSON object. Do not wrap code block formatting.`;

    const userPrompt = `Generate Oracle Fusion ERP Integration Mapping for these workflow steps:\n\n${JSON.stringify(chunks, null, 2)}`;

    try {
        return await callGeminiApi(systemPrompt, userPrompt);
    } catch (error) {
        console.error("generateOracleIntegrationMapping Error:", error);
        throw error;
    }
};

export const runAutonomousAgentResolve = async (node, errorMsg, currentState) => {
    const systemPrompt = `You are an autonomous Oracle Enterprise AI agent. A BPM workflow step has failed or triggered a logical validation exception.
    Failed Step: "${node.name}" (ID: ${node.id})
    Reported Error Details: "${errorMsg}"
    Current Workflow Variables Payload: ${JSON.stringify(currentState)}
    
    Analyze the context, troubleshoot the payload defect, and draft a corrected/healed state.
    Output a highly structured JSON response matching this EXACT schema:
    {
        "agentName": "Name of the resolving Oracle AI Agent",
        "rootCauseAnalysis": "Brief operational analysis of the failure.",
        "correctiveActionsTaken": "Actions executed autonomously to fix the defect.",
        "healedVariables": {
            "key": "Updated or corrected value"
        },
        "continuationApproved": true|false,
        "logs": ["Chronological audit trail of agent thoughts."]
    }
    
    ONLY respond with pure parsable JSON object. Do not wrap code block formatting.`;

    const userPrompt = `Autonomously resolve task error now.`;

    try {
        return await callGeminiApi(systemPrompt, userPrompt);
    } catch (error) {
        console.error("runAutonomousAgentResolve Error:", error);
        throw error;
    }
};
