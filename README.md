# AI Docs Plugin

A Claude Code plugin providing documentation and best practices for AI/LLM libraries.

## Features

This plugin provides **Skills** that Claude can use to access up-to-date documentation and best practices for:

- **Claude API** - Messages API, tool use, Agent SDK, prompt engineering
- **Claude Code** - CLI usage, hooks, plugins, MCP integration
- **OpenAI API** - Chat completions, tool use, vision, embeddings
- **OpenAI Codex** - Codex CLI, AGENTS.md, sandbox, automation
- **Gemini API** - google-genai SDK, multimodal, structured outputs, function calling
- **Gemini CLI** - Google's AI CLI, tools, hooks, extensions, MCP integration
- **Gemini Imagen** - Image generation with Imagen and Gemini native models

## Installation

### From Local Marketplace (Development)

1. Create a test marketplace directory:
   ```bash
   mkdir -p ~/test-marketplace/.claude-plugin
   ```

2. Create `~/test-marketplace/.claude-plugin/marketplace.json`:
   ```json
   {
     "name": "local-marketplace",
     "owner": { "name": "Local" },
     "plugins": [
       {
         "name": "ai-docs",
         "source": "/path/to/ai-docs-plugin",
         "description": "AI documentation and best practices"
       }
     ]
   }
   ```

3. In Claude Code:
   ```
   /plugin marketplace add ~/test-marketplace
   /plugin install ai-docs@local-marketplace
   ```

### From GitHub (Once Published)

```
/plugin marketplace add parkerhancock/ai-docs-plugin
/plugin install ai-docs@parkerhancock
```

## Skills Included

### claude-api

Documentation for Claude/Anthropic API:
- Messages API and streaming
- Tool use and function calling
- Agent SDK (Python & TypeScript)
- Prompt engineering techniques
- Extended thinking and structured outputs
- MCP connector integration

### claude-code

Documentation for Claude Code CLI:
- Setup and configuration
- Hooks and automation
- MCP server integration
- Plugin development
- CI/CD workflows

### openai-api

Documentation for OpenAI API:
- Chat Completions and Responses API
- Tool use / function calling
- Vision and multimodal
- Embeddings
- Streaming and error handling

### openai-codex

Documentation for OpenAI Codex CLI:
- Installation and authentication
- Configuration and AGENTS.md
- Sandbox mode and execpolicy
- Non-interactive mode (`codex exec`)
- TypeScript SDK

### gemini-dev

Documentation for Google Gemini API:
- google-genai SDK patterns
- Multimodal inputs (images, PDFs, audio, video)
- Structured outputs with JSON schemas
- Function calling and tool use
- Context caching and optimization

### gemini-cli

Documentation for Gemini CLI:
- Installation and authentication
- CLI commands and settings
- Built-in tools (file system, shell, web, memory)
- Hooks and extensions
- MCP server integration
- Sandboxing and enterprise setup

### gemini-imagen

Documentation for Gemini image generation:
- Imagen models (imagen-4.0, imagen-3.0)
- Gemini native image models (gemini-2.5-flash-image, gemini-3-pro-preview)
- Text-to-image generation
- Image editing and refinement
- Prompt engineering for images
- Aspect ratios and configuration

## Syncing Documentation

Each skill has a sync script to update documentation from official sources:

```bash
# Sync Claude API docs (platform.claude.com)
cd skills/claude-api
bun run scripts/sync-docs.ts

# Sync Claude Code docs (code.claude.com)
cd skills/claude-code
bun run scripts/sync-docs.ts

# Sync Gemini API docs (ai.google.dev)
cd skills/gemini-dev
bun run scripts/sync-docs.ts

# Sync OpenAI API docs (github.com/openai/openai-python)
cd skills/openai-api
bun run scripts/sync-docs.ts

# Sync OpenAI Codex docs (github.com/openai/codex)
cd skills/openai-codex
bun run scripts/sync-docs.ts

# Sync Gemini CLI docs (github.com/google-gemini/gemini-cli)
cd skills/gemini-cli
bun run scripts/sync-docs.ts

# Sync Gemini Imagen docs (ai.google.dev)
cd skills/gemini-imagen
bun run scripts/sync-docs.ts
```

## Plugin Structure

```
ai-docs-plugin/
├── .claude-plugin/
│   └── plugin.json          # Plugin manifest
├── skills/
│   ├── claude-api/          # 84 docs from platform.claude.com
│   ├── claude-code/         # 42 docs from code.claude.com
│   ├── openai-api/          # 4 docs from github.com/openai/*
│   ├── openai-codex/        # 23 docs from github.com/openai/codex
│   ├── gemini-cli/          # 49 docs from github.com/google-gemini/gemini-cli
│   ├── gemini-dev/          # 15 docs from ai.google.dev
│   └── gemini-imagen/       # 2 docs from ai.google.dev (image generation)
├── .gitignore
└── README.md
```

## License

MIT
