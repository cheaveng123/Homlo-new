## GPT-OSS 20B TOOL COMPATIBILITY

This project is developed using GPT-OSS 20B through Ollama and Claude Code.

The following tools are confirmed available:
- Bash
- Read
- Edit
- Write
- WebSearch
- WebFetch
- Other tools only when explicitly listed in the current session.

### Repository operations

- NEVER call a tool named Search.
- NEVER call Grep or Glob as dedicated tools unless they are explicitly registered.
- Use Bash with find for file discovery.
- Use Bash with grep for searching source code.
- Use Read to inspect files.
- Use Edit to modify existing files.
- Use Write to create files.
- Use Explore only if the Agent capability and Explore agent type are confirmed available.

### Web operations

- Use WebSearch only for internet searches.
- Use WebFetch only when retrieving webpage content.
- Never confuse repository searching with web searching.

### Tool failure recovery

If a tool returns an unavailable-tool error:
1. Stop immediately.
2. Do not retry the same unavailable tool.
3. Select an available alternative.
4. Continue the task where possible.

### Verification

Never claim a search, file modification, or test succeeded unless it actually did.
