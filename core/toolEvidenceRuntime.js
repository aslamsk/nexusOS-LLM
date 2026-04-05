function classifyDeliverableEvidence({
    contract = {},
    artifact = null,
    latestTarget = null,
    currentRun = {},
    shouldForceBrowserContinuation = false
} = {}) {
    const deliverable = String(contract.expectedDeliverable || '').toLowerCase();

    if (!deliverable || deliverable === 'direct answer or requested output') {
        if (shouldForceBrowserContinuation) {
            return {
                hasEvidence: Boolean(currentRun?.toolsUsed?.browserAction),
                reason: 'browser_progress_required'
            };
        }
        return { hasEvidence: true, reason: 'direct_answer' };
    }

    if (deliverable.includes('quote')) {
        return {
            hasEvidence: Boolean(artifact?.kind === 'quote_bundle' || artifact?.files?.pdf || artifact?.files?.markdown),
            reason: 'quote_bundle'
        };
    }
    if (deliverable.includes('invoice')) {
        return {
            hasEvidence: Boolean(artifact?.files?.pdf || /invoice/i.test(String(artifact?.kind || '')) || /invoice/i.test(String(artifact?.path || ''))),
            reason: 'invoice_artifact'
        };
    }
    if (deliverable.includes('image asset')) {
        return {
            hasEvidence: Boolean(artifact?.kind === 'image' || /\.(png|jpg|jpeg|webp)$/i.test(String(artifact?.path || ''))),
            reason: 'image_artifact'
        };
    }
    if (deliverable.includes('video asset')) {
        return {
            hasEvidence: Boolean(artifact?.kind === 'video' || /\.mp4$/i.test(String(artifact?.path || ''))),
            reason: 'video_artifact'
        };
    }
    if (deliverable.includes('email')) {
        return {
            hasEvidence: Boolean(latestTarget?.channel === 'email'),
            reason: 'email_delivery'
        };
    }
    if (deliverable.includes('whatsapp message')) {
        return {
            hasEvidence: Boolean(latestTarget?.channel === 'whatsapp'),
            reason: 'whatsapp_delivery'
        };
    }
    if (deliverable.includes('analysis report')) {
        return {
            hasEvidence: Boolean(artifact?.path || artifact?.url || currentRun?.toolCalls > 0),
            reason: 'analysis_output'
        };
    }
    if (deliverable.includes('verified fix')) {
        return {
            hasEvidence: Boolean(
                artifact?.kind === 'code' ||
                currentRun?.toolsUsed?.replaceFileContent ||
                currentRun?.toolsUsed?.multiReplaceFileContent ||
                currentRun?.toolsUsed?.writeFile
            ),
            reason: 'verified_code_change'
        };
    }
    if (deliverable.includes('code change')) {
        return {
            hasEvidence: Boolean(artifact?.kind === 'code'),
            reason: 'code_artifact'
        };
    }

    return { hasEvidence: true, reason: 'default' };
}

function extractToolOutcomePlan({
    toolCall = {},
    result,
    formatToolResult,
    pendingActionChain = [],
    resolveLatestTargetId
} = {}) {
    const name = String(toolCall?.name || '');
    const action = String(toolCall?.args?.action || '');
    const text = typeof formatToolResult === 'function' ? formatToolResult(result) : String(result || '');

    const plan = {
        taskLabel: `${name}${action ? `:${action}` : ''}`,
        artifact: null,
        target: null,
        queueUpdate: null
    };

    if (name === 'generateImage' && /^Success:/i.test(text)) {
        const savedPath = toolCall?.args?.savePath || text.match(/saved to\s+(.+)$/i)?.[1]?.trim();
        if (savedPath) {
            plan.artifact = {
                kind: 'image',
                path: savedPath,
                prompt: toolCall?.args?.prompt || '',
                sourceTool: 'generateImage',
                aspectRatio: toolCall?.args?.aspectRatio || null
            };
        }
        if (pendingActionChain?.length && pendingActionChain[0]?.status === 'pending_confirmation') {
            plan.queueUpdate = {
                type: 'await_boss',
                message: `Step 1 completed. The generated image is ready. Reply YES to continue to the next queued step (${pendingActionChain[0].type}), or describe changes to revise the image first.`
            };
        }
        return plan;
    }

    if (name === 'generateVideo' && /^SUCCESS:/i.test(text)) {
        const outputPath = toolCall?.args?.outputPath || text.match(/at\s+(.+)$/i)?.[1]?.trim();
        if (outputPath) {
            plan.artifact = {
                kind: 'video',
                path: outputPath,
                prompt: toolCall?.args?.prompt || '',
                sourceTool: 'generateVideo'
            };
        }
        return plan;
    }

    if ((name === 'writeFile' || name === 'replaceFileContent' || name === 'multiReplaceFileContent') && toolCall?.args?.absolutePath) {
        plan.artifact = {
            kind: 'code',
            path: toolCall.args.absolutePath,
            prompt: toolCall?.args?.replacementContent || '',
            sourceTool: name
        };
        return plan;
    }

    if (name === 'createAgencyQuoteArtifacts' && result?.files) {
        plan.artifact = {
            kind: 'quote_bundle',
            url: result.files.pdf || result.files.markdown || null,
            path: null,
            prompt: toolCall?.args?.scope || '',
            sourceTool: name,
            files: result.files
        };
        return plan;
    }

    if ((name === 'sendEmail' || name === 'sendWhatsApp' || name === 'sendWhatsAppMedia') && !String(text).toLowerCase().startsWith('error')) {
        plan.target = {
            channel: name === 'sendEmail' ? 'email' : 'whatsapp',
            type: 'message_delivery',
            action: name,
            details: { preview: text.slice(0, 400), attachments: toolCall?.args?.attachments || [] }
        };
        return plan;
    }

    if ((name === 'linkedinAds' && action === 'deletePost' && result && !result.error) || (name === 'linkedinDeletePost' && result && !result.error)) {
        plan.target = {
            id: result?.id || toolCall?.args?.postId || (typeof resolveLatestTargetId === 'function' ? resolveLatestTargetId('linkedin') : null),
            channel: 'linkedin',
            type: 'deleted_output',
            action: action || name,
            status: 'deleted',
            details: result || null
        };
        return plan;
    }

    if ((name === 'xAds' && action === 'deletePost' && result && !result.error) || (name === 'xDeletePost' && result && !result.error)) {
        plan.target = {
            id: toolCall?.args?.postUrl || result?.url || (typeof resolveLatestTargetId === 'function' ? resolveLatestTargetId('x') : null),
            channel: 'x',
            type: 'deleted_output',
            action: action || name,
            status: 'deleted',
            details: result || null
        };
        return plan;
    }

    if ((name === 'metaAds' && action.startsWith('publishOrganic') && result && !result.error) || (name === 'linkedinAds' && action === 'publishPost' && result && !result.error) || (name === 'xAds' && result && !result.error)) {
        const publishedCopy = String(toolCall?.args?.text || toolCall?.args?.message || '').trim();
        if (publishedCopy) {
            plan.artifact = {
                kind: 'content',
                path: null,
                url: null,
                prompt: publishedCopy,
                sourceTool: `${name}${action ? `:${action}` : ''}`,
                files: toolCall?.args?.imagePath ? { imagePath: toolCall.args.imagePath } : null
            };
        }
        plan.target = {
            id: result?.id || result?.post_id || result?.url || result?.surfaces?.facebook?.post_id || result?.surfaces?.facebook?.id || null,
            channel: name === 'metaAds' ? 'meta' : name === 'linkedinAds' ? 'linkedin' : 'x',
            type: 'published_output',
            action: action || name,
            details: result?.surfaces || result || null
        };
        if (pendingActionChain?.length && pendingActionChain[0]?.type === 'promote_generated_asset') {
            plan.queueUpdate = { type: 'consume_first' };
        }
    }

    return plan;
}

module.exports = {
    classifyDeliverableEvidence,
    extractToolOutcomePlan
};
