# MCP Service Architecture

## Overview

The MCP (Model Context Protocol) service has been refactored into a modular architecture with clear separation of concerns. This makes the code more maintainable, testable, and easier to extend.

## Modules

### ConfigurationManager

Responsible for loading, saving, and managing MCP configuration:
- Loads configuration from Electron Store or falls back to defaults
- Handles built-in services from built-in.json
- Manages cached tools

### ServerManager

Handles starting, stopping, and monitoring MCP servers:
- Manages the lifecycle of server processes
- Creates and maintains MCP client connections
- Infers protocol settings based on server type

### ToolRegistry

Manages tool discovery, caching, and retrieval:
- Discovers tools from servers via MCP protocol
- Caches tools for future use
- Provides a unified view of all available tools

### ToolExecutor

Handles the execution of tool calls:
- Routes tool calls to the appropriate server
- Provides fallback implementations for common tools
- Handles error cases and edge conditions

## Main Service

The main `McpService` class acts as a facade that coordinates the modules and exposes a simplified API for the rest of the application.

## Usage

```javascript
const mcpService = require('./mcp-service-new');

// Initialize the service
mcpService.initialize(config);

// Get all available tools
const tools = await mcpService.getAllTools();

// Call a tool
const result = await mcpService.callTool('server-name', 'tool-name', args);

// Clean up when done
await mcpService.cleanup();
```

## Benefits of the New Architecture

1. **Better Separation of Concerns**: Each module has a clear, focused responsibility.
2. **Reduced Duplication**: Common functionality is centralized in the appropriate module.
3. **Improved Error Handling**: Consistent error handling across the codebase.
4. **Enhanced Testability**: Modules can be tested independently.
5. **Better Maintainability**: Smaller, focused modules are easier to understand and modify.
6. **Extensibility**: Adding new functionality is simpler with a modular design.

## Migration Strategy

To migrate to the new architecture:

1. Rename the existing `mcp-service.js` to `mcp-service-old.js`
2. Rename `mcp-service-new.js` to `mcp-service.js`
3. Run tests to verify the new implementation works correctly
4. If issues arise, you can temporarily revert by swapping back the file names

## Testing

You can test the new architecture without disrupting the existing code by running:

```
node electron/test-mcp-service.js
```