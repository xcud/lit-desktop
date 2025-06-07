# MCP Dynamic Tools Integration Plan

## Mission
Integrate the standalone `mcp-dynamic-tools` server into the LIT desktop electron app to enable dynamic tool creation functionality that currently works in the LIT server.

## Current State Analysis

### Working Server Implementation
- **Location**: `/home/ben/lit-platform/lit/src/lit/bin/mcp_server.py`
- **Functionality**: LITMCPServer discovers Python files in `/data/{team}/mcp_tools/` and exposes them as MCP tools
- **Key Features**: 
  - AST-based tool analysis
  - Dynamic tool discovery on each `tools/list` request
  - Built-in CRUD operations for tool management
  - Team-based tool isolation

### Standalone Implementation  
- **Location**: `/home/ben/mcp-dynamic-tools/src/mcp_dynamic_tools/server.py`
- **Functionality**: DynamicMCPServer with similar capabilities but as standalone MCP server
- **Key Features**:
  - Same AST-based analysis as LIT server
  - Built-in CRUD tools (read_tool, write_tool, delete_tool)
  - Configurable tools directory
  - Standalone executable

### Desktop App Current State
- **MCP Manager**: `/home/ben/lit-platform/lit-chat-electron/electron/mcp-manager.js`
- **Current Config**: Only has `desktop-commander` server configured
- **Config Location**: `/home/ben/.config/lit-chat/mcp.json`

## Integration Strategy

### Phase 1: Add Dynamic Tools Server to Configuration
1. **Update MCP Configuration** - Add the standalone dynamic tools server to the desktop app's MCP config
2. **Test Basic Connectivity** - Verify the desktop app can connect to and discover tools from the dynamic server
3. **Choose Tools Directory** - Determine appropriate location for dynamic tools in desktop context

### Phase 2: Verify Dynamic Tool Creation Flow
1. **Test Tool Creation** - Use desktop-commander.write_file to create a Python tool file
2. **Test Tool Discovery** - Verify new tool appears in subsequent MCP tool lists
3. **Test Tool Execution** - Verify new tool can be called successfully

### Phase 3: Address Any Integration Issues
1. **Fix Path/Permission Issues** - Ensure tools directory is accessible
2. **Handle Tool Isolation** - Adapt team-based isolation for desktop single-user context
3. **Error Handling** - Ensure robust error handling for tool creation/execution

### Phase 4: Optimization and Polish
1. **Tool Refresh Logic** - Implement efficient tool refresh without full restart
2. **Configuration Management** - Ensure proper persistence of dynamic tools
3. **Documentation** - Document the integration for future reference

## Implementation Details

### Tools Directory Strategy
**Option A**: Use user-specific directory like `/home/ben/.config/lit-chat/mcp_tools/`
**Option B**: Use project-relative directory like `/home/ben/lit-platform/lit-chat-electron/tools/`
**Option C**: Use temporary directory for session-based tools

**Recommendation**: Option A for persistence across sessions

### Configuration Update
Add to `/home/ben/.config/lit-chat/mcp.json`:
```json
{
  "mcpServers": {
    "desktop-commander": {
      "command": "npx",
      "args": ["@wonderwhy-er/desktop-commander@latest"],
      "description": "Access and manipulate files on the local system"
    },
    "mcp-dynamic-tools": {
      "command": "python",
      "args": [
        "/home/ben/mcp-dynamic-tools/src/mcp_dynamic_tools/server.py",
        "--tools-dir",
        "/home/ben/.config/lit-chat/mcp_tools"
      ],
      "description": "Dynamic tool creation and management"
    }
  }
}
```

## Expected Challenges and Solutions

### Challenge 1: Path Resolution
- **Issue**: The standalone server may not resolve paths correctly from desktop app context
- **Solution**: Use absolute paths in configuration and verify working directory

### Challenge 2: Tool Discovery Timing
- **Issue**: Desktop app may need to refresh tools after creation without full restart
- **Solution**: Leverage existing `refreshLitPlatformTools` mechanism or implement similar for dynamic-tools

### Challenge 3: Permission/Access Issues  
- **Issue**: Tool files may not be readable/writable from MCP server process
- **Solution**: Ensure proper directory permissions and use appropriate user context

### Challenge 4: Python Environment
- **Issue**: MCP server may not find required Python packages
- **Solution**: Ensure server runs in same Python environment as desktop app or use virtual environment

## Success Criteria

1. **Basic Integration**: Dynamic tools server appears in MCP configuration and connects successfully
2. **Tool Creation**: Can use desktop-commander.write_file to create a Python tool file
3. **Tool Discovery**: New tools appear in tools list after creation
4. **Tool Execution**: Can successfully call newly created tools
5. **Persistence**: Tools persist across desktop app restarts

## Current Status
- [x] Phase 1: Add Dynamic Tools Server to Configuration
  - [x] Fixed PromptMaster instructions to use "arguments" instead of "parameters"
  - [x] Added mcp-dynamic-tools server to MCP configuration
  - [x] Created tools directory at `/home/ben/.config/lit-chat/mcp_tools`
  - [x] Verified server can start successfully with correct arguments
- [x] Phase 2: Verify Dynamic Tool Creation Flow  
  - [x] Tools are being discovered correctly (logs show mcp-dynamic-tools.read_tool, write_tool, delete_tool)
  - [x] Fixed stream-manager and chat-handler to accept both "arguments" and "parameters"
  - [x] **FIXED**: Replaced broken JSON extraction with lit-server's proven approach
  - [x] **FIXED**: Implemented brace counting for balanced JSON detection (like lit-server)
  - [x] **FIXED**: Added proper MCP protocol communication for mcp-dynamic-tools
  - [x] **FIXED**: Resolved syntax errors in stream-manager.js
  - [x] **FIXED**: Corrected MCP client call format (object with name/arguments)
- [x] Phase 3: Test Complete Integration
  - [x] ✅ **SUCCESS**: Password generator tool created successfully!
  - [x] **FIXED**: Added instruction about using server prefix for newly created tools
  - [x] **FIXED**: Implemented automatic tool refresh after tool creation
  - [x] **FIXED**: Added force refresh mechanism to clear tool cache
- [x] Phase 4: Final Testing and Polish
  - [x] ✅ **IDENTIFIED**: Tool refresh timing issue - LLM tries to use tool before refresh completes
  - [x] **FIXED**: Made tool refresh synchronous and immediate after tool creation
  - [x] **FIXED**: Added fallback mechanism to try mcp-dynamic-tools for tools without server prefix
  - [x] **FIXED**: Updated instruction to handle immediate usage edge case
  - [ ] Test complete workflow: create tool → use immediately → verify it works

## Next Steps
1. Start with Phase 1 - Add the mcp-dynamic-tools server to the desktop app configuration
2. Create the tools directory if it doesn't exist
3. Test basic connectivity and tool discovery
