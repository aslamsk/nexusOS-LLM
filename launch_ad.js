require('dotenv').config();
const meta = require('./tools/metaAds');

async function go() {
    try {
        console.log('--- FINALIZING AD DEPLOYMENT ---');
        
        const pageId = '106214568034999';
        const adSetId = '120246101298510188';
        const hash = 'a5e7037edbdc3584af230918ed6231ff';

        // 1. Create Ad Creative
        console.log('Step 1: Creating Ad Creative...');
        const creative = await meta.createAdCreative(
            'South Indian Ad Creative', 
            'Discover the Elegance', 
            'Exquisite South Indian fashion for the modern woman. Shop the MK Fashion collection today.', 
            hash, 
            pageId
        );
        if (creative.error) {
            console.log('CREATIVE_ERROR: ' + creative.error);
            return;
        }
        console.log('CREATIVE_ID: ' + creative.id);

        // 2. Create Final Ad
        console.log('\nStep 2: Creating Final Ad...');
        const ad = await meta.createAd(adSetId, creative.id, 'Main Ad - South Indian Style');
        if (ad.error) {
            console.log('AD_ERROR: ' + ad.error);
            return;
        }
        console.log('AD_ID: ' + ad.id);
        
        console.log('\n--- MISSION COMPLETE: AD IS LIVE (PAUSED) ---');
        console.log('Ads Manager: https://adsmanager.facebook.com/adsmanager/manage/ads?act=' + meta.adAccountId.replace('act_', ''));

    } catch (e) {
        console.error('CRITICAL ERROR:', e);
    }
}

go();
