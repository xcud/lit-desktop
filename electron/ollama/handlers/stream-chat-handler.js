/**
 * StreamChatHandler - Updated to use MCPManager
 * 
 * Handles streaming chat requests to Ollama with MCPManager integration
 */

class StreamChatHandler {
  /**
   * Create a new StreamChatHandler
   * @param {OllamaClient} ollamaClient - The OllamaClient instance
   * @param {MCPManager} mcpManager - The MCPManager instance (replaces PromptMaster + ToolHandler)
   * @param {StreamManager} streamManager - The StreamManager instance
   */
  constructor(ollamaClient, mcpManager, streamManager) {
    this.ollamaClient = ollamaClient;
    this.mcpManager = mcpManager;
    this.streamManager = streamManager;
    
    console.log('StreamChatHandler: Initialized with MCPManager');
  }
  
  /**
   * Register the handler with IPC
   * @param {Object} ipcMain - The Electron IPC main instance
   */
  register(ipcMain) {
    ipcMain.handle('ollama:stream-chat', async (event, channelId, model, messages, options) => {
      try {
        console.log('StreamChatHandler: Processing stream chat request');
        console.log('StreamChatHandler: Received model:', typeof model, model);
        console.log('StreamChatHandler: Received messages:', messages.length, 'messages');
        console.log('StreamChatHandler: Received options:', options);
        
        // NEW: Use MCPManager to enhance messages with tool information
        const enhancedMessages = await this.enhanceMessagesWithTools(messages);
        
        console.log(`StreamChatHandler: Enhanced messages with ${await this.getToolCount()} tools`);
        
        // Handle the streaming conversation with MCPManager for tool calls
        return await this.streamManager.streamChat(
          channelId,
          this.ollamaClient,
          event,
          model,
          enhancedMessages,
          options,
          this.mcpManager // Pass MCPManager for tool execution
        );
      } catch (error) {
        console.error('StreamChatHandler: Error in stream chat:', error);
        throw error;
      }
    });
  }
  
  /**
   * NEW: Enhance messages with tool information using MCPManager
   * This replaces the old PromptMaster.enhanceWithTools() method
   */
  async enhanceMessagesWithTools(messages) {
    try {
      // Ensure MCP clients are initialized for desktop user
      await this.mcpManager.ensureUserMcpClients('desktop', 'user');
      
      // Get tool descriptions from MCPManager
      const toolDescriptions = await this.mcpManager.getToolInfoForPrompt('user', 'desktop');
      
      console.log(`StreamChatHandler: Got ${toolDescriptions.length} tools for prompt enhancement`);
      
      // Create tool instructions (using same format as working lit-server)
      const toolInstructions = this.createToolInstructions(toolDescriptions);
      
      // Clone messages array
      const enhancedMessages = [...messages];
      
      // Check if there's already a system message
      const hasSystemMessage = enhancedMessages.some(msg => msg.role === 'system');
      
      if (hasSystemMessage) {
        // If there's already a system message (likely from prompt-composer), don't override it
        console.log('StreamChatHandler: Found existing system message, preserving prompt-composer content');
        return enhancedMessages;
      }
      
      // Only add basic tool instructions if no system message exists (fallback case)
      if (toolInstructions) {
        enhancedMessages.unshift({
          role: 'system',
          content: toolInstructions
        });
        console.log('StreamChatHandler: Added fallback system message with tool instructions');
      }
      
      return enhancedMessages;
      
    } catch (error) {
      console.error('StreamChatHandler: Error enhancing messages with tools:', error);
      // Return original messages if enhancement fails
      return messages;
    }
  }
  
  /**
   * NEW: Create tool instructions string (matching lit-server format)
   */
  createToolInstructions(toolDescriptions) {
    if (!toolDescriptions || toolDescriptions.length === 0) {
      return '';
    }
    
    // Use the same clean JSON format as lit-server
    let instructions = 'You have access to the following tools:\n\n';
    
    // Convert to clean JSON array format like lit-server (with empty parameters to match server behavior)
    const toolsArray = toolDescriptions.map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: {}  // Empty parameters object to match server format
    }));
    
    instructions += JSON.stringify(toolsArray, null, 2);
    
    instructions += `\n\nTo use a tool, respond with JSON in the following format:
{
  "tool": "server_name.tool_name",
  "arguments": {
    "param1": "value1"
  }
}

**KEY INSTRUCTION**: When users ask to "create an MCP tool", use desktop-commander.write_file to save a Python file to /home/ben/.config/lit-desktop/mcp_tools/toolname.py. The content must be properly formatted Python code with actual newlines (not literal \\n characters):

Example tool call:
\`\`\`json
{
  "tool": "desktop-commander.write_file",
  "arguments": {
    "path": "/home/ben/.config/lit-desktop/mcp_tools/toolname.py",
    "content": "def invoke(arguments):\\n    \\"\\"\\"Tool description here.\\n    \\n    Parameters:\\n    - param_name: Description (type)\\n    \\"\\"\\"\\n    try:\\n        value = arguments.get('param_name', 'default')\\n        return f\\"Result: {value}\\"\\n    except Exception as e:\\n        return f\\"Error: {str(e)}\\""
  }
}
\`\`\`

CRITICAL: The \\n in the content string represents actual newlines, not literal backslash-n characters. Use proper Python string escaping.

Only use the tools when explicitly requested by the user or when they would significantly help with the user's request.
When a user asks you to read or write files or access system resources, you should use the appropriate tool rather than saying you can't.`;

    return instructions;
  }
  
  /**
   * Get current tool count for logging
   */
  async getToolCount() {
    try {
      const tools = await this.mcpManager.getToolInfoForPrompt('user', 'desktop');
      return tools.length;
    } catch {
      return 0;
    }
  }
}

module.exports = StreamChatHandler;
