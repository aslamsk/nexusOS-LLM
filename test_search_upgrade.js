const SkillReader = require('./tools/skillReader');

async function testSearch() {
    console.log('--- Nexus OS Semantic Search Test ---');
    
    const queries = [
        'seo audit',
        '3d cartoon character',
        'react patterns',
        'security hardening'
    ];

    queries.forEach(query => {
        console.log(`\nQuery: "${query}"`);
        const results = SkillReader.findBestSkill(query);
        console.log('Results:', JSON.stringify(results, null, 2));
    });
}

testSearch();
