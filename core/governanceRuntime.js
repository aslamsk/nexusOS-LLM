function buildPendingApproval(normalizedToolCall, governance) {
    return {
        requestedAt: new Date().toISOString(),
        toolCall: normalizedToolCall,
        reason: governance.reason,
        preview: governance.preview,
        details: governance.details || null
    };
}

function buildApprovalRequestMessage(name, governance) {
    return `Approval required for ${name}. ${governance.reason}\n\nPreview:\n${governance.preview}\n\nReply YES to approve.`;
}

function buildApprovalPromptMessage(pending) {
    return `Approval pending for ${pending.toolCall.name}. Please reply YES to approve or NO to cancel.`;
}

function buildApprovedCall(pending) {
    return {
        ...pending.toolCall,
        args: { ...(pending.toolCall.args || {}), boss_approved: true }
    };
}

module.exports = {
    buildPendingApproval,
    buildApprovalRequestMessage,
    buildApprovalPromptMessage,
    buildApprovedCall
};
