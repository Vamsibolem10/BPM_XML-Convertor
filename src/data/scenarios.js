export const demoScenarios = {
    refund: {
        narrative: "Starts when a customer files a refund query. First check the transaction details against our database. Next, check if the requested refund amount is greater than $500. If yes, escalate to the regional manager for direct manual approval. If no, process the refund automated transfer immediately via the Stripe API. Finish the flow by sending a confirmation notification email to the client.",
        variables: {
            amount: 650,
            customerName: "Jane Doe",
            country: "US"
        },
        chunks: [
            {
                id: "start_1",
                type: "start",
                name: "Customer Refund Request",
                actor: "Customer",
                description: "Initiated when customer files a digital refund request transaction payload.",
                next: ["task_verify"]
            },
            {
                id: "task_verify",
                type: "serviceTask",
                name: "Database Verification",
                actor: "System API",
                description: "Query and extract order history parameters matching transaction metadata.",
                next: ["gateway_check"]
            },
            {
                id: "gateway_check",
                type: "gateway",
                name: "Is Refund > $500?",
                actor: "Logical Engine",
                description: "Determine route based on 'amount' parameter logic check.",
                next: ["task_escalate", "task_auto_stripe"]
            },
            {
                id: "task_escalate",
                type: "userTask",
                name: "Escalate to Director",
                actor: "Regional Manager",
                description: "Manual oversight task to check client portfolio risk before authorization.",
                next: ["task_notify"]
            },
            {
                id: "task_auto_stripe",
                type: "serviceTask",
                name: "Automate Payout via Stripe",
                actor: "Stripe API Integration",
                description: "Submit request payload to Stripe transfer endpoint using bank ID.",
                next: ["task_notify"]
            },
            {
                id: "task_notify",
                type: "serviceTask",
                name: "Dispatch Client Email",
                actor: "SendGrid API Node",
                description: "Format template and dispatch confirmation message payload.",
                next: ["end_1"]
            },
            {
                id: "end_1",
                type: "end",
                name: "Process Complete",
                actor: "System Logs",
                description: "Close case files and log operational status parameters.",
                next: []
            }
        ]
    },
    leads: {
        narrative: "Starts when a prospect submits a query form. Run verification check to evaluate if they belong to a enterprise tier domain. If they use a free domain like gmail, send them a standard tutorial drip. If they are a corporate user, route them directly to our premium sales rep to schedule an outreach phone call.",
        variables: {
            prospectEmail: "sales@enterprisecorp.com",
            domain: "enterprisecorp.com",
            companyName: "Enterprise Corp"
        },
        chunks: [
            {
                id: "start_2",
                type: "start",
                name: "Lead Query Submitted",
                actor: "Inbound Form",
                description: "Lead registers contact credentials in form database.",
                next: ["task_domain"]
            },
            {
                id: "task_domain",
                type: "serviceTask",
                name: "Lookup Domain Classification",
                actor: "Clearbit API Node",
                description: "Fetch demographic company insights for prospect email address domain.",
                next: ["gateway_lead"]
            },
            {
                id: "gateway_lead",
                type: "gateway",
                name: "Is Corporate Lead?",
                actor: "Logical Engine",
                description: "Branch according to whether the lead uses a free host versus an enterprise domain.",
                next: ["task_premium", "task_standard_drip"]
            },
            {
                id: "task_premium",
                type: "userTask",
                name: "Assign Senior SDR Outreach",
                actor: "Sales Rep",
                description: "Assign direct notification task inside CRM dashboard to phone corporate lead.",
                next: ["end_2"]
            },
            {
                id: "task_standard_drip",
                type: "serviceTask",
                name: "Trigger Tutorial Drip",
                actor: "HubSpot API",
                description: "Auto-subscribe generic lead to public onboarding guide campaigns sequence.",
                next: ["end_2"]
            },
            {
                id: "end_2",
                type: "end",
                name: "Lead Process Complete",
                actor: "Analytics Pipeline",
                description: "Record lead conversion source tags and terminate pipeline state.",
                next: []
            }
        ]
    },
    it: {
        narrative: "Starts when a new employee signs their contract. Check if security clearance background evaluation is clean. If check fails, abort and flag to HR leads. If clean, draft automated security credential access rules and set up corporate Slack profiles.",
        variables: {
            employeeName: "Mark Mercer",
            clearanceStatus: "Passed",
            department: "Security Ops"
        },
        chunks: [
            {
                id: "start_3",
                type: "start",
                name: "Contract Finalized",
                actor: "Docusign Webhook",
                description: "Trigger initial ingestion sequence when offer contract is parsed.",
                next: ["task_verify_check"]
            },
            {
                id: "task_verify_check",
                type: "serviceTask",
                name: "Verify Background Details",
                actor: "API Provider",
                description: "Validate employee credentials and security record flags.",
                next: ["gateway_it_chk"]
            },
            {
                id: "gateway_it_chk",
                type: "gateway",
                name: "Is Clearance Passed?",
                actor: "HR System",
                description: "Fork routing mapping relative to outcome metrics check.",
                next: ["task_setup_slack", "task_alert_hr"]
            },
            {
                id: "task_setup_slack",
                type: "serviceTask",
                name: "Create Identity Slack Profile",
                actor: "Identity API",
                description: "Submit provisioning request data to Slack workspace profiles manager.",
                next: ["end_3"]
            },
            {
                id: "task_alert_hr",
                type: "userTask",
                name: "Flag Security Risks to Director",
                actor: "HR Team",
                description: "Escalate failure logs to board for investigation review.",
                next: ["end_3"]
            },
            {
                id: "end_3",
                type: "end",
                name: "Onboarding State Checked",
                actor: "System",
                description: "Audit action trails and save files status.",
                next: []
            }
        ]
    },
    procurement: {
        narrative: "When a new software procurement request is submitted, first check the software against the approved vendor list. If it is unapproved, trigger a security compliance review. If the security review fails, reject the request and notify the employee. If approved (or already on the approved list), automatically generate a purchase order and send it to the Finance API.",
        variables: {
            softwareName: "Acme Analytics",
            cost: 12000,
            department: "Marketing"
        },
        chunks: [
            {
                id: "start_4",
                type: "start",
                name: "Procurement Request Filed",
                actor: "Employee",
                description: "Employee submits software request form.",
                next: ["task_vendor_check"]
            },
            {
                id: "task_vendor_check",
                type: "serviceTask",
                name: "Check Approved Vendor DB",
                actor: "Procurement API",
                description: "Validate if software vendor is on the pre-approved organizational list.",
                next: ["gateway_approved"]
            },
            {
                id: "gateway_approved",
                type: "gateway",
                name: "Is Vendor Approved?",
                actor: "Logical Engine",
                description: "Route based on whether vendor is already approved.",
                next: ["task_generate_po", "task_security_review"]
            },
            {
                id: "task_security_review",
                type: "userTask",
                name: "Security Compliance Review",
                actor: "InfoSec Team",
                description: "Manual review of vendor SOC2 compliance and data privacy.",
                next: ["gateway_security_pass"]
            },
            {
                id: "gateway_security_pass",
                type: "gateway",
                name: "Did Security Pass?",
                actor: "Logical Engine",
                description: "Route based on security review outcome.",
                next: ["task_generate_po", "task_reject"]
            },
            {
                id: "task_generate_po",
                type: "serviceTask",
                name: "Generate Purchase Order",
                actor: "Finance ERP",
                description: "Create and dispatch PO to vendor automatically.",
                next: ["end_4"]
            },
            {
                id: "task_reject",
                type: "serviceTask",
                name: "Reject Request",
                actor: "Notification Service",
                description: "Send rejection email with security reasoning.",
                next: ["end_4"]
            },
            {
                id: "end_4",
                type: "end",
                name: "Procurement Closed",
                actor: "System",
                description: "Log final outcome to procurement database.",
                next: []
            }
        ]
    }
};
