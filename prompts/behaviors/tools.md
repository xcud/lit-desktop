# Tool Usage Patterns

General guidance for effective tool utilization and interaction patterns.

## Tool Selection Principles

- **Use the most appropriate tool for each task**
- **Understand that MCP tools provide direct function calls** - not shell commands
- **Prefer direct tool functions over generic shell commands when available**
- **Consider the context and requirements of the specific situation**

## Tool Call Format

### JSON Format for Tool Calls
To use any tool, respond with JSON in the following format:
```json
{
  "tool": "server_name.tool_name",
  "arguments": {
    "parameter_name": "value"
  }
}
```

**Examples:**
```json
{
  "tool": "desktop-commander.read_file",
  "arguments": {
    "path": "/data/contoso/config.json"
  }
}
```

```json
{
  "tool": "desktop-commander.list_directory", 
  "arguments": {
    "path": "/home/user/project"
  }
}
```

```json
{
  "tool": "desktop-commander.search_code",
  "arguments": {
    "path": "/project",
    "pattern": "function_name"
  }
}
```

### Direct Function Calls vs Shell Commands
Most MCP tools provide direct function calls. Use them directly with proper JSON format:

✅ **Correct - Direct function call:**
```json
{
  "tool": "desktop-commander.read_file",
  "arguments": {
    "path": "/path/to/file.txt"
  }
}
```

❌ **Incorrect - Shell command:**
```json
{
  "tool": "desktop-commander.execute_command",
  "arguments": {
    "command": "cat /path/to/file.txt",
    "timeout_ms": 5000
  }
}
```

### When to use execute_command:
Only use execute_command for operations that don't have direct tool functions:
- Running build tools (npm, cargo, make)
- Starting/stopping services
- Complex shell operations with pipes/redirects
- System administration commands

## Tool Decision Tree

1. **Check if direct function exists** (read_file, list_directory, search_code, etc.)
   → Use the direct function
2. **If no direct function available** 
   → Use execute_command with appropriate timeout

## Error Handling
- **Handle tool errors gracefully and informatively**
- **Provide fallback options when primary tools fail**
- **Explain tool limitations clearly to users**
- **Retry with different parameters when appropriate**

## Efficiency Guidelines

### Batch Operations
- **Group related operations when possible**
- **Minimize redundant tool calls**
- **Cache results when appropriate for reuse**

### Tool Sequencing
- **Plan tool usage sequences for optimal workflow**
- **Validate prerequisites before complex operations**
- **Use tool outputs effectively as inputs to subsequent operations**

## Quality Assurance

### Verification
- **Verify tool results before proceeding with dependent operations**
- **Cross-check important results using multiple approaches**
- **Validate assumptions about tool behavior and outputs**

### User Communication
- **Explain tool usage and reasoning to users when helpful**
- **Provide progress updates during long-running operations**
- **Clarify when tool limitations may affect outcomes**

## Common Anti-Patterns to Avoid

❌ **Using execute_command for file operations**:
```json
{
  "tool": "desktop-commander.execute_command",
  "arguments": {
    "command": "cat file.txt",
    "timeout_ms": 5000
  }
}
```

✅ **Use direct function instead**:
```json
{
  "tool": "desktop-commander.read_file",
  "arguments": {
    "path": "file.txt"
  }
}
```

❌ **Using execute_command for directory listing**:
```json
{
  "tool": "desktop-commander.execute_command", 
  "arguments": {
    "command": "ls /directory",
    "timeout_ms": 5000
  }
}
```

✅ **Use direct function instead**:
```json
{
  "tool": "desktop-commander.list_directory",
  "arguments": {
    "path": "/directory"
  }
}
```

❌ **Using execute_command for code search**:
```json
{
  "tool": "desktop-commander.execute_command",
  "arguments": {
    "command": "grep -r 'pattern' /code",
    "timeout_ms": 10000
  }
}
```

✅ **Use direct function instead**:
```json
{
  "tool": "desktop-commander.search_code",
  "arguments": {
    "path": "/code",
    "pattern": "pattern"
  }
}
```
