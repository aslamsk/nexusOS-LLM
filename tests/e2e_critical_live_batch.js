const fs = require('fs');
const path = require('path');
const NexusOrchestrator = require('../index');

const OUTPUT_ROOT = path.join(__dirname, '..', 'outputs', 'e2e_live_batch');

const scenarios = [
  {
    id: 'browser_form_submit',
    area: 'browser',
    request: 'open https://example.com and inspect the page without closing the browser',
    timeoutMs: 45000,
    successHints: ['browserAction'],
    note: 'Smoke browser open + page extraction path.'
  },
  {
    id: 'browser_login_gate',
    area: 'browser',
    request: 'open https://www.facebook.com/ and inspect the login gate; if otp, captcha, mfa, or checkpoint appears, classify it clearly and stop',
    timeoutMs: 70000,
    successHints: ['browserAction', 'otp', 'captcha', 'checkpoint', 'mfa'],
    note: 'Verifies login-gate handling and honest blocker reporting.'
  },
  {
    id: 'meta_organic_image_flow',
    area: 'marketing',
    request: 'create a single image organic ad for chicken pickles starting at Rs. 380 and prepare the meta organic publish flow',
    timeoutMs: 70000,
    successHints: ['generateImage', 'approval', 'metaAds'],
    note: 'Verifies image-first organic Meta path.'
  },
  {
    id: 'quote_to_email_handoff',
    area: 'commercial',
    request: 'create a quote for monthly marketing services and prepare email handoff with attachment evidence',
    timeoutMs: 70000,
    successHints: ['buildAgencyQuotePlan', 'createAgencyQuoteArtifacts', 'sendEmail'],
    note: 'Verifies quote artifact path and outbound handoff.'
  },
  {
    id: 'image_generation_evidence',
    area: 'media',
    request: 'generate an image banner for a chicken pickle ad and keep the output file available',
    timeoutMs: 60000,
    successHints: ['generateImage'],
    note: 'Verifies image artifact registration.'
  },
  {
    id: 'video_generation_evidence',
    area: 'media',
    request: 'generate a short promo video for chicken pickles and keep the output file available',
    timeoutMs: 90000,
    successHints: ['generateVideo'],
    note: 'Verifies video artifact registration.'
  }
];

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function summarizeScenarioResult(scenario, record) {
  const updates = record.updates || [];
  const textBlob = updates
    .map((u) => [u.type, u.message || u.name || ''].filter(Boolean).join(' '))
    .join('\n')
    .toLowerCase();

  const matchedHints = scenario.successHints.filter((hint) => textBlob.includes(String(hint).toLowerCase()));
  const finalUpdate = updates[updates.length - 1] || null;
  const stoppedForBlocker = ['input_requested', 'approval_requested'].includes(finalUpdate?.type);

  return {
    scenarioId: scenario.id,
    area: scenario.area,
    finalType: finalUpdate?.type || 'none',
    matchedHints,
    blockerLike: stoppedForBlocker,
    updateCount: updates.length,
    recentUpdates: updates.slice(-8)
  };
}

async function runScenario(scenario) {
  const taskDir = path.join(OUTPUT_ROOT, scenario.id);
  ensureDir(taskDir);
  const updates = [];
  const orchestrator = new NexusOrchestrator((event) => {
    updates.push({
      at: new Date().toISOString(),
      type: event.type,
      message: event.message || '',
      name: event.name || '',
      args: event.args || null
    });
  }, taskDir);

  let timeoutHandle;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutHandle = setTimeout(() => {
      try { orchestrator.stop(); } catch (_) {}
      reject(new Error(`Scenario timed out after ${scenario.timeoutMs}ms`));
    }, scenario.timeoutMs);
  });

  const startedAt = Date.now();
  try {
    await Promise.race([
      orchestrator.execute(scenario.request),
      timeoutPromise
    ]);
    clearTimeout(timeoutHandle);
    const summary = summarizeScenarioResult(scenario, { updates });
    return {
      ok: true,
      id: scenario.id,
      elapsedMs: Date.now() - startedAt,
      note: scenario.note,
      ...summary
    };
  } catch (error) {
    clearTimeout(timeoutHandle);
    return {
      ok: false,
      id: scenario.id,
      area: scenario.area,
      elapsedMs: Date.now() - startedAt,
      note: scenario.note,
      error: error.message,
      updateCount: updates.length,
      recentUpdates: updates.slice(-8)
    };
  }
}

async function runBatch() {
  ensureDir(OUTPUT_ROOT);
  const requestedIds = process.argv.slice(2);
  const selected = requestedIds.length
    ? scenarios.filter((scenario) => requestedIds.includes(scenario.id))
    : scenarios;

  if (!selected.length) {
    console.error('No matching scenarios selected.');
    process.exit(1);
  }

  const results = [];
  console.log(`Running critical live batch for ${selected.length} scenario(s)...`);
  for (const scenario of selected) {
    console.log(`\n[START] ${scenario.id} :: ${scenario.note}`);
    const result = await runScenario(scenario);
    results.push(result);
    console.log(`[END] ${scenario.id} :: ${result.ok ? 'completed' : 'failed'} :: ${result.elapsedMs}ms`);
    if (result.error) console.log(`  Error: ${result.error}`);
    if (Array.isArray(result.matchedHints) && result.matchedHints.length) {
      console.log(`  Matched hints: ${result.matchedHints.join(', ')}`);
    }
    if (Array.isArray(result.recentUpdates) && result.recentUpdates.length) {
      console.log('  Recent updates:');
      for (const update of result.recentUpdates) {
        console.log(`    - [${update.type}] ${String(update.message || update.name || '').slice(0, 180)}`);
      }
    }
  }

  const reportPath = path.join(OUTPUT_ROOT, `critical_live_batch_${Date.now()}.json`);
  fs.writeFileSync(reportPath, JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2));
  console.log(`\nSaved batch report to ${reportPath}`);
}

runBatch().catch((error) => {
  console.error('Critical live batch failed:', error);
  process.exit(1);
});
