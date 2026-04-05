const matrix = [
    {
        id: 'browser_form_submit',
        area: 'browser',
        goal: 'Open a page, fill fields, submit, verify visible transition or blocker classification.'
    },
    {
        id: 'browser_login_gate',
        area: 'browser',
        goal: 'Open login page, detect credential fields, submit, then classify OTP/captcha/checkpoint if present.'
    },
    {
        id: 'meta_organic_image_flow',
        area: 'marketing',
        goal: 'Generate image -> draft organic publish -> approval -> publish result or auth blocker.'
    },
    {
        id: 'quote_to_email_handoff',
        area: 'commercial',
        goal: 'Create quote plan -> artifacts -> email handoff with attachment evidence.'
    },
    {
        id: 'image_generation_evidence',
        area: 'media',
        goal: 'Generate image and verify artifact registration + output path.'
    },
    {
        id: 'video_generation_evidence',
        area: 'media',
        goal: 'Generate video and verify artifact registration + output path.'
    },
    {
        id: 'missing_key_resume',
        area: 'config',
        goal: 'Detect missing key, collect in chat, save to correct scope, resume same mission.'
    }
];

console.log('Critical E2E Matrix');
for (const item of matrix) {
    console.log(`- ${item.id} [${item.area}] :: ${item.goal}`);
}

console.log('\nRun live batch with: npm run test:e2e-critical:live');
