const path = require('path');

class GovernanceService {
    constructor() {
        this.externalActionTools = new Set([
            'sendEmail',
            'sendWhatsApp',
            'sendWhatsAppMedia',
            'googleAds',
            'googleAdsCreateCampaign',
            'googleAdsCreateBudget',
            'googleAdsCreateAdGroup',
            'googleAdsAddKeywords',
            'googleAdsCreateResponsiveSearchAd',
            'linkedinAds',
            'linkedinPublishPost',
            'linkedinDeletePost',
            'xAds',
            'xDeletePost',
            'twitterAds'
        ]);
        this.commandRiskPatterns = [
            /\bnpm\s+publish\b/i,
            /\bgit\s+push\b/i,
            /\bdel\b/i,
            /\brm\b/i,
            /\bshutdown\b/i,
            /\btaskkill\b/i,
            /\bnetsh\b/i
        ];
    }

    evaluate(toolCall) {
        const { name, args = {} } = toolCall || {};
        if (!name) return { requiresApproval: false };

        if (name === 'runCommand') {
            const command = String(args.command || '');
            const risky = this.commandRiskPatterns.some((pattern) => pattern.test(command));
            if (risky) {
                return {
                    requiresApproval: true,
                    reason: 'Command can mutate external systems or perform destructive shell actions.',
                    preview: `Command: ${command}`,
                    details: {
                        type: 'command',
                        command,
                        cwd: args.cwd || null
                    }
                };
            }
        }

        if (name === 'writeFile') {
            const target = String(args.absolutePath || '');
            if (!/outputs|sessions|uploads/i.test(target)) {
                return {
                    requiresApproval: true,
                    reason: 'File write targets a working source file or non-output path.',
                    preview: `Write file: ${target}`,
                    details: {
                        type: 'file_write',
                        absolutePath: target,
                        contentLength: String(args.content || '').length,
                        contentPreview: String(args.content || '').slice(0, 300)
                    }
                };
            }
        }

        if (name === 'replaceFileContent' || name === 'multiReplaceFileContent') {
            const target = String(args.absolutePath || '');
            const isTool = target.includes('/tools/') || target.includes('\\tools\\');
            const isCore = !isTool && !target.toLowerCase().includes('outputs');
            
            return {
                requiresApproval: true,
                risk: isCore ? 'CRITICAL' : 'MODERATE',
                reason: isCore 
                    ? 'SECURITY ALERT: Modifying a CORE system file can break fundamental OS behavior or security.'
                    : 'SOVEREIGN REPAIR: Modifying a tool file to fix a logic blocker.',
                preview: `Target: ${path.basename(target)}\nAction: ${name === 'multiReplaceFileContent' ? 'Multi-section patch' : 'Line replacement'}`,
                details: {
                    type: 'code_evolution',
                    absolutePath: target,
                    isCore,
                    isTool,
                    replacementPreview: String(args.replacementContent || args.chunks?.[0]?.replacementContent || '').slice(0, 300)
                }
            };
        }

        if (name === 'metaAds') {
            const riskyActions = new Set([
                'createCampaign', 'createAdSet', 'createAdCreative', 'createAd',
                'publishOrganicPost', 'publishOrganicPhoto', 'publishOrganicVideo', 'publishOrganicReel', 'deleteObject'
            ]);
            if (riskyActions.has(args.action)) {
                let details = {
                    type: 'meta_ads',
                    action: args.action,
                    payload: args
                };
                if (args.action === 'createCampaign') {
                    details = {
                        type: 'meta_campaign',
                        name: args.name,
                        objective: args.objective,
                        status: 'PAUSED'
                    };
                }
                if (args.action === 'publishOrganicPost') {
                    details = {
                        type: 'meta_organic_post',
                        pageId: args.pageId || null,
                        messagePreview: String(args.message || '').slice(0, 400),
                        link: args.link || null
                    };
                }
                if (args.action === 'deleteObject') {
                    details = {
                        type: 'meta_delete',
                        objectId: args.objectId || null
                    };
                }
                return {
                    requiresApproval: true,
                    reason: 'This action can spend budget, publish publicly, or delete a public Meta object.',
                    preview: `${args.action}: ${JSON.stringify(args)}`,
                    details
                };
            }
        }

        if (name === 'sendEmail') {
            return {
                requiresApproval: true,
                reason: 'This action will contact an external recipient by email.',
                preview: `Email to ${args.to}: ${args.subject}`,
                details: {
                    type: 'email',
                    to: args.to || null,
                    subject: args.subject || '',
                    bodyPreview: String(args.body || '').slice(0, 500),
                    attachments: Array.isArray(args.attachments) ? args.attachments.map((item) => ({ filename: item?.filename || null, path: item?.path || null })) : []
                }
            };
        }

        if (name === 'sendWhatsApp') {
            return {
                requiresApproval: true,
                reason: 'This action will send a WhatsApp message to an external recipient.',
                preview: `WhatsApp to ${args.phone}`,
                details: {
                    type: 'whatsapp_text',
                    phone: args.phone || null,
                    textPreview: String(args.text || '').slice(0, 500)
                }
            };
        }

        if (name === 'sendWhatsAppMedia') {
            return {
                requiresApproval: true,
                reason: 'This action will send WhatsApp media to an external recipient.',
                preview: `WhatsApp media to ${args.phone}`,
                details: {
                    type: 'whatsapp_media',
                    phone: args.phone || null,
                    mediaUrl: args.mediaUrl || null,
                    captionPreview: String(args.caption || '').slice(0, 300)
                }
            };
        }

        if (name === 'linkedinPublishPost' || (name === 'linkedinAds' && args.action === 'publishPost')) {
            return {
                requiresApproval: true,
                reason: 'This action will publish content to LinkedIn publicly.',
                preview: `LinkedIn post for URN ${args.urn}`,
                details: {
                    type: 'linkedin_post',
                    urn: args.urn || null,
                    textPreview: String(args.text || '').slice(0, 500)
                }
            };
        }

        if (name === 'linkedinDeletePost' || (name === 'linkedinAds' && args.action === 'deletePost')) {
            return {
                requiresApproval: true,
                reason: 'This action will delete a public LinkedIn post.',
                preview: `LinkedIn delete: ${args.postId || 'latest post'}`,
                details: {
                    type: 'linkedin_delete',
                    postId: args.postId || null
                }
            };
        }

        if (name === 'googleAds' || ['googleAdsCreateCampaign', 'googleAdsCreateBudget', 'googleAdsCreateAdGroup', 'googleAdsAddKeywords', 'googleAdsCreateResponsiveSearchAd'].includes(name)) {
            return {
                requiresApproval: true,
                reason: 'This action will create or modify paid Google Ads entities.',
                preview: `${args.action || name} for customer ${args.customerId}`,
                details: {
                    type: 'google_ads_campaign',
                    customerId: args.customerId || null,
                    campaignName: args.campaignData?.name || null,
                    budgetResource: args.campaignData?.budget_resource_name || args.amountMicros || null
                }
            };
        }

        if (name === 'xAds' || name === 'twitterAds') {
            return {
                requiresApproval: true,
                reason: 'This action will post content publicly to X (formerly Twitter).',
                preview: `X Post: ${args.text || args.message || 'No text provided'}`,
                details: {
                    type: 'x_post',
                    text: args.text || args.message || null,
                    imagePath: args.imagePath || null
                }
            };
        }

        if (name === 'xDeletePost') {
            return {
                requiresApproval: true,
                reason: 'This action will delete a public X post.',
                preview: `X delete: ${args.postUrl || 'post URL required'}`,
                details: {
                    type: 'x_delete',
                    postUrl: args.postUrl || null
                }
            };
        }

        if (this.externalActionTools.has(name)) {
            return {
                requiresApproval: true,
                reason: 'This action contacts an external audience or paid media channel.',
                preview: `${name}: ${JSON.stringify(args)}`,
                details: {
                    type: name,
                    payload: args
                }
            };
        }

        return { requiresApproval: false };
    }

    isApprovalResponse(input) {
        const normalized = String(input || '')
            .replace(/^\s*\[[^\]]+\]\s*/g, '')
            .trim()
            .toLowerCase();
        if (!normalized) return null;
        if (/^(yes|y|approve|approved|boss approved|go ahead|proceed|continue|continue please|continue with it|do it|do that|publish it|publish now|please publish|send it|ship it|ok publish|okay publish|go live|launch it|run it)\b/.test(normalized)) return true;
        if (/^(no|n|reject|cancel|stop|do not|don't)\b/.test(normalized)) return false;
        return null;
    }
}

module.exports = new GovernanceService();



