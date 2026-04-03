## OpenRouter in Nexus OS

Nexus OS does not use Claude Code's `.claude/settings.local.json` format.

Instead, Nexus resolves LLM config like this:

1. Active client overrides
2. Firestore `configs/default`
3. `.env` fallback

### Recommended setup

For Boss/default usage, save these in `Settings`:

- `OPENROUTER_API_TOKEN`
- `OPENROUTER_MODEL`
- optional: `GROQ_API_KEY`
- optional: `GROQ_MODEL`
- optional: `NVIDIA_NIM_API_KEY`
- optional: `NVIDIA_MODEL`

For client-specific usage, save the same keys under that client's key settings.

### Current fallback order

Nexus uses this provider order:

1. `Gemini`
2. `OpenRouter`
3. `Groq`
4. `NVIDIA`

### Minimal `.env` fallback example

```env
OPENROUTER_API_TOKEN=sk-or-...
OPENROUTER_MODEL=openrouter/free
GROQ_MODEL=llama-3.1-8b-instant
NVIDIA_MODEL=meta/llama-3.1-8b-instruct
```

### Notes

- `.env` is only the last fallback.
- Firestore config is the main runtime source.
- If a client context is active, client overrides can replace Boss/default values.
- If a key is exposed publicly, revoke it and generate a new one.
