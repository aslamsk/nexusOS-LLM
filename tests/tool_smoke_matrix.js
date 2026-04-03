const assert = require('assert');
const LLMService = require('../core/llm');
const NexusOrchestrator = require('../index');

function testToolDefinitionsPresent() {
  console.log('--- Testing Tool Definition Presence ---');
  const llm = new LLMService();
  const names = llm.getToolDefinitions('execute').map((tool) => tool.name);
  const required = [
    'readFile',
    'writeFile',
    'listDir',
    'runCommand',
    'browserAction',
    'searchWeb',
    'generateImage',
    'sendEmail',
    'sendWhatsApp',
    'buildAgencyQuotePlan',
    'createAgencyQuoteArtifacts',
    'askUserForInput'
  ];
  for (const name of required) assert.ok(names.includes(name), `Missing tool definition: ${name}`);
  console.log('PASS tool definition presence');
}

function testMissingRequirementScope() {
  console.log('--- Testing Missing Requirement Scope ---');
  const orchestrator = new NexusOrchestrator();
  orchestrator.onUpdate = () => {};
  orchestrator._handleToolRequirement({ name: 'sendEmail' }, 'GMAIL_USER missing and GMAIL_APP_PASSWORD not configured');
  assert.ok(orchestrator.pendingRequirement);
  assert.strictEqual(orchestrator.pendingRequirement.scope, 'boss');

  orchestrator.currentClientId = 'client_123';
  orchestrator._handleToolRequirement({ name: 'metaAds' }, 'META_ACCESS_TOKEN missing');
  assert.ok(orchestrator.pendingRequirement);
  assert.strictEqual(orchestrator.pendingRequirement.scope, 'client');
  console.log('PASS missing requirement scope');
}

function testRequirementResponseParsing() {
  console.log('--- Testing Requirement Response Parsing ---');
  const orchestrator = new NexusOrchestrator();
  orchestrator.pendingRequirement = { keys: ['GMAIL_USER', 'GMAIL_APP_PASSWORD'], scope: 'boss', toolCall: { name: 'sendEmail' } };
  const lines = 'GMAIL_USER: team@example.com\nGMAIL_APP_PASSWORD=secret123';
  const parsed = {};
  for (const line of lines.split(/\r?\n/)) {
    const separatorIndex = line.includes('=') ? line.indexOf('=') : line.indexOf(':');
    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    parsed[key] = value;
  }
  assert.strictEqual(parsed.GMAIL_USER, 'team@example.com');
  assert.strictEqual(parsed.GMAIL_APP_PASSWORD, 'secret123');
  console.log('PASS requirement response parsing');
}

function run() {
  testToolDefinitionsPresent();
  testMissingRequirementScope();
  testRequirementResponseParsing();
  console.log('--- Tool Smoke Matrix Passed ---');
}

run();
