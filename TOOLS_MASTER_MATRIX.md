# Nexus OS Tools Master Matrix

## Core Execution
| Tool | Purpose | Keys | Scope | Priority | Test Status |
|---|---|---|---|---|---|
| readFile | Read file contents | none | boss | critical | pending |
| writeFile | Write file contents | none | boss | critical | pending |
| listDir | List directories | none | boss | critical | pending |
| runCommand | Run terminal commands | none | boss | critical | pending |
| browserAction | Browser automation and extraction | none | boss | critical | partial |
| askUserForInput | Clarification and approvals | none | boss/client | critical | covered |

## Search And Intelligence
| Tool | Purpose | Keys | Scope | Priority | Test Status |
|---|---|---|---|---|---|
| searchWeb | Web search | BRAVE_SEARCH_API_KEY or TAVILY_API_KEY | boss/client | high | pending |
| codeMap | Codebase map | none | boss | medium | pending |
| codeSearch | Search code symbols/text | none | boss | medium | pending |
| codeFindFn | Find functions | none | boss | medium | pending |
| saveMemory | Save memory entries | firestore | boss/client | high | pending |
| searchMemory | Recall memory entries | firestore | boss/client | high | pending |
| delegateToAgent | Delegate to specialist | provider-dependent | boss/client | medium | pending |
| listSkills | List available skills | none | boss | low | pending |
| listAgenticSkills | List agentic skills | none | boss | low | pending |
| readAgenticSkill | Read a skill | none | boss | low | pending |
| createSkill | Create a skill | filesystem | boss | low | pending |
| executeSkill | Execute skill | skill-dependent | boss | low | pending |

## Media And Assets
| Tool | Purpose | Keys | Scope | Priority | Test Status |
|---|---|---|---|---|---|
| generateImage | Generate image assets | GEMINI_API_KEY or fallback | boss/client | high | pending |
| generateVideo | Generate video assets | REPLICATE_API_TOKEN | boss/client | medium | pending |
| removeBg | Remove image backgrounds | provider dependent | boss/client | medium | pending |

## Marketing And Ads
| Tool | Purpose | Keys | Scope | Priority | Test Status |
|---|---|---|---|---|---|
| analyzeMarketingPage | Analyze landing page | browser/search | boss/client | high | pending |
| scanCompetitors | Competitor scan | search keys | boss/client | high | pending |
| generateSocialCalendar | Build content calendar | none/search | boss/client | medium | pending |
| metaAds | Meta ads and organic publishing | META_ACCESS_TOKEN and related ids | boss/client | critical | pending |
| googleAdsCreateBudget | Google Ads budget | GOOGLE_ADS_* | boss/client | high | pending |
| googleAdsCreateCampaign | Google Ads campaign | GOOGLE_ADS_* | boss/client | high | pending |
| googleAdsCreateAdGroup | Google Ads ad group | GOOGLE_ADS_* | boss/client | high | pending |
| googleAdsAddKeywords | Google Ads keywords | GOOGLE_ADS_* | boss/client | high | pending |
| googleAdsCreateResponsiveSearchAd | Google Ads RSA | GOOGLE_ADS_* | boss/client | high | pending |
| linkedinPublishPost | LinkedIn publish | LINKEDIN_ACCESS_TOKEN | boss/client | medium | pending |
| linkedinDeletePost | LinkedIn delete | LINKEDIN_ACCESS_TOKEN | boss/client | medium | pending |
| xAds | X ads/posting actions | X_* | boss/client | medium | pending |
| xDeletePost | Delete X post | X_* | boss/client | low | pending |
| scanNiche | Niche scanning | search keys | boss/client | medium | pending |
| proposeCampaign | Campaign proposal generation | none | boss/client | medium | pending |

## Commercial And Communication
| Tool | Purpose | Keys | Scope | Priority | Test Status |
|---|---|---|---|---|---|
| buildAgencyQuotePlan | Build quote plan | none | boss/client | critical | pending |
| createAgencyQuoteArtifacts | Create quote artifacts | filesystem | boss/client | critical | pending |
| sendEmail | Send email | GMAIL_USER and GMAIL_APP_PASSWORD | boss/client | critical | pending |
| readEmail | Read inbox | GMAIL_USER and GMAIL_APP_PASSWORD | boss/client | high | pending |
| sendWhatsApp | Send WhatsApp text | WhatsApp/Meta creds | boss/client | critical | pending |
| sendWhatsAppMedia | Send WhatsApp media | WhatsApp/Meta creds | boss/client | high | pending |

## Stability Gates
- Critical tools must have happy path, missing-key path, invalid-input path, and boss-vs-client scope tests.
- Every missing-key tool must verify chat-based save-and-resume behavior.
- UI workflows must verify Setup -> Settings -> Capabilities -> Clients -> Mission Control path.
- Release readiness means all critical smoke tests pass and all critical E2E flows pass.
