class GovernanceService {
    constructor() {
        this.externalActionTools = new Set([
            'sendEmail',
            'sendWhatsApp',
            'sendWhatsAppMedia',
            'googleAdsCreateCampaign',
            'linkedinPublishPost'
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

        if (name === 'replaceFileContent') {
            return {
                requiresApproval: true,
                reason: 'Replacing source file content can alter core behavior.',
                preview: `Replace lines ${args.startLine}-${args.endLine} in ${args.absolutePath}`,
                details: {
                    type: 'replace_file_content',
                    absolutePath: args.absolutePath,
                    startLine: args.startLine,
                    endLine: args.endLine,
                    replacementPreview: String(args.replacementContent || '').slice(0, 300)
                }
            };
        }

        if (name === 'multiReplaceFileContent') {
            return {
                requiresApproval: true,
                reason: 'Multi-replace can alter multiple sections of a source file.',
                preview: `Multi-replace ${Array.isArray(args.chunks) ? args.chunks.length : 0} sections in ${args.absolutePath}`,
                details: {
                    type: 'multi_replace_file_content',
                    absolutePath: args.absolutePath,
                    replacementCount: Array.isArray(args.chunks) ? args.chunks.length : 0
                }
            };
        }

        if (name === 'metaAds') {
            const riskyActions = new Set([
                'createCampaign', 'createAdSet', 'createAdCreative', 'createAd',
                'publishOrganicPost', 'publishOrganicPhoto', 'publishOrganicVideo', 'publishOrganicReel'
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
                return {
                    requiresApproval: true,
                    reason: 'This action can spend budget or publish to a public surface.',
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
                    bodyPreview: String(args.body || '').slice(0, 500)
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

        if (name === 'linkedinPublishPost') {
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

        if (name === 'googleAdsCreateCampaign') {
            return {
                requiresApproval: true,
                reason: 'This action will create a paid Google Ads campaign.',
                preview: `Google Ads campaign for customer ${args.customerId}`,
                details: {
                    type: 'google_ads_campaign',
                    customerId: args.customerId || null,
                    campaignName: args.campaignData?.name || null,
                    budgetResource: args.campaignData?.budget_resource_name || null
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
        const normalized = String(input || '').trim().toLowerCase();
        if (!normalized) return null;
        if (/^(yes|y|approve|approved|go ahead|proceed|send it|ship it)\b/.test(normalized)) return true;
        if (/^(no|n|reject|cancel|stop|do not|don't)\b/.test(normalized)) return false;
        return null;
    }
}

module.exports = new GovernanceService();
