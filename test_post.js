const meta = require('./tools/metaAds');
const path = require('path');

async function run() {
    const pageId = '106214568034999';
    const message = '✨ Premium Soft Roman Silk Kurta ✨\nExperience pure luxury with MK Fashion. Now available!\n\nShop Now: https://mkfashion.in/p/qDYrf_Yn-W\n#MKFashion #SilkKurta #LiveTest';
    const imagePath = 'd:/nexusOS-LLM-stable/nexusOS-LLM/outputs/mk_kurta_promo.png';

    console.log('[Test] Starting Photo Post...');
    const result = await meta.publishPagePhoto(pageId, message, imagePath);
    console.log('[Test] Result:', JSON.stringify(result, null, 2));
    process.exit(0);
}

run().catch(err => {
    console.error('[Test Error]', err);
    process.exit(1);
});
