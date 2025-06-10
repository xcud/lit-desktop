/**
 * ChatHandler - Updated to use MCPManager
 * 
 * Handles non-streaming chat requests to Ollama with MCPManager integration
 */

class ChatHandler {
  /**
   * Create a new ChatHandler
   * @param {OllamaClient} ollamaClient - The OllamaClient instance
   * @param {MCPManager} mcpManager - The MCPManager instance (replaces PromptMaster + ToolHandler)
   */
  constructor(ollamaClient, mcpManager) {
    this.ollamaClient = ollamaClient;
    this.mcpManager = mcpManager;
    
    console.log('ChatHandler: Initialized with MCPManager');
  }
  
  /**
   * Register the handler with IPC
   * @param {Object} ipcMain - The Electron IPC main instance
   */
  register(ipcMain) {
    ipcMain.handle('ollama:chat', async (event, model, messages, options) => {
      try {
        console.log('ChatHandler: Processing non-streaming chat request');
        
        // NEW: Use MCPManager to enhance messages with tool information
        const enhancedMessages = await this.enhanceMessagesWithTools(messages);
        
        console.log(`ChatHandler: Enhanced messages with ${await this.getToolCount()} tools`);
        
        // Make the chat request to Ollama
        const response = await this.ollamaClient.chat({
          model,
          messages: enhancedMessages,
          ...options
        });
        
        console.log('ChatHandler: Received response from Ollama');
        
        // Check if response contains a tool call and handle it
        if (response && response.message && response.message.content) {
          const toolCallResult = await this.handlePotentialToolCall(response.message.content);
          if (toolCallResult) {
            // Tool was executed, return the result
            return {
              ...response,
              message: {
                ...response.message,
                content: toolCallResult
              }
            };
          }
        }
        
        return response;
        
      } catch (error) {
        console.error('ChatHandler: Error in chat:', error);
        throw error;
      }
    });
  }
  
  /**
   * NEW: Enhance messages with tool information using MCPManager
   * Reuses the same logic as StreamChatHandler
   */
  async enhanceMessagesWithTools(messages) {
    try {
      // Ensure MCP clients are initialized for desktop user
      await this.mcpManager.ensureUserMcpClients('desktop', 'user');
      
      // Get tool descriptions from MCPManager
      const toolDescriptions = this.mcpManager.getToolInfoForPrompt('user', 'desktop');
      
      console.log(`ChatHandler: Got ${toolDescriptions.length} tools for prompt enhancement`);
      
      // Create tool instructions
      const toolInstructions = this.createToolInstructions(toolDescriptions);
      
      // Clone messages array
      const enhancedMessages = [...messages];
      
      // Check if there's already a system message
      const hasSystemMessage = enhancedMessages.some(msg => msg.role === 'system');
      
      if (!hasSystemMessage && toolInstructions) {
        // Add system message with tool information at the beginning
        enhancedMessages.unshift({
          role: 'system',
          content: toolInstructions
        });
        console.log('ChatHandler: Added system message with tool instructions');
      } else if (hasSystemMessage && toolInstructions) {
        // Find and enhance existing system message
        const systemMsgIndex = enhancedMessages.findIndex(msg => msg.role === 'system');
        enhancedMessages[systemMsgIndex].content += '\n\n' + toolInstructions;
        console.log('ChatHandler: Enhanced existing system message with tool instructions');
      }
      
      return enhancedMessages;
      
    } catch (error) {
      console.error('ChatHandler: Error enhancing messages with tools:', error);
      // Return original messages if enhancement fails
      return messages;
    }
  }
  
  /**
   * NEW: Create tool instructions string (same as StreamChatHandler)
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
   * NEW: Handle potential tool calls in response content
   */
  async handlePotentialToolCall(content) {
    try {
      // Try to extract a tool call from the content
      const toolCall = this.extractToolCall(content);
      
      if (toolCall) {
        console.log('ChatHandler: Detected tool call:', toolCall);
        
        // Parse server name and tool name
        const [serverName, toolName] = toolCall.tool.split('.');
        
        if (!serverName || !toolName) {
          return `Error: Invalid tool format '${toolCall.tool}'. Expected format: 'server.tool'`;
        }
        
        // Execute the tool using MCPManager
        const toolArgs = toolCall.arguments || toolCall.parameters || {};
        const result = await this.mcpManager.callTool(serverName, toolName, toolArgs, 'user');
        
        console.log('ChatHandler: Tool execution result:', result);
        return result;
      }
      
      return null; // No tool call detected
      
    } catch (error) {
      console.error('ChatHandler: Error handling tool call:', error);
      return `Error executing tool: ${error.message}`;
    }
  }
  
  /**
   * NEW: Extract tool call from text (simplified version)
   */
  extractToolCall(text) {
    try {
      // Look for JSON in the text
      const jsonMatch = text.match(/\{[^}]*"tool"[^}]*\}/);
      if (jsonMatch) {
        const toolCall = JSON.parse(jsonMatch[0]);
        if (toolCall.tool && (toolCall.arguments || toolCall.parameters)) {
          return toolCall;
        }
      }
      return null;
    } catch (error) {
      console.log('ChatHandler: Could not extract tool call from text');
      return null;
    }
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

module.exports = ChatHandler;
