/**
 * ToolCallProcessor - Recursive tool calling system for lit-desktop
 * 
 * Ported from lit-server's ToolCallProcessor to enable unlimited sequential tool calls
 * in the desktop environment. This replaces the single-tool limitation of the current
 * StreamManager implementation.
 */

const { appendToolResult, logConversation } = require('./ollama-client');

/**
 * States for the tool processing state machine
 */
const StreamState = {
  NORMAL_TOKENS: "normal",           // Regular text streaming
  TOOL_CALL_DETECTED: "detecting",  // Found opening brace, collecting JSON
  TOOL_EXECUTING: "executing",      // Tool is running
  TOOL_COMPLETED: "completed"       // Tool finished, continuing conversation
};

class ToolCallProcessor {
  /**
   * Initialize the tool call processor for lit-desktop
   * 
   * @param {Object} ollamaClient - The OllamaClient instance
   * @param {Object} mcpManager - The MCPManager instance for tool execution
   * @param {string} model - Model name for continuation requests
   * @param {number} temperature - Temperature for model requests
   * @param {string} originalMessage - The original user request to maintain context
   */
  constructor(ollamaClient, mcpManager, model, temperature = 0.0, originalMessage = "") {
    this.ollamaClient = ollamaClient;
    this.mcpManager = mcpManager;
    this.model = model;
    this.temperature = temperature;
    this.originalMessage = originalMessage;
    
    // Tracking state
    this.toolCallCount = 0;
    this.state = StreamState.NORMAL_TOKENS;
    this.toolCallBuffer = "";
    this.braceCount = 0;
    
    // Configuration
    this.maxToolCalls = 20; // Circuit breaker to prevent infinite loops
    
    console.log('ToolCallProcessor: Initialized with max tool calls:', this.maxToolCalls);
  }
  
  /**
   * Process a streaming response with unlimited tool calls (main entry point)
   * 
   * This replaces the single-tool detection logic in StreamManager and enables
   * true recursive tool execution like lit-server.
   * 
   * @param {string} channelId - The channel ID for IPC communication
   * @param {Object} event - The IPC event for sending responses
   * @param {Array} messages - Conversation messages (Ollama format)
   * @param {Object} options - Chat options
   * @param {AbortController} abortController - Optional abort controller for cancellation
   * @returns {Object} Final response with success status and content
   */
  async processStreamWithTools(channelId, event, messages, options, abortController = null) {
    console.log(`ToolCallProcessor: Starting recursive tool processing (max tools: ${this.maxToolCalls})`);
    
    const sender = event.sender;
    let currentMessages = [...messages]; // Clone to avoid mutation
    let totalResponse = "";
    
    try {
      while (this.toolCallCount < this.maxToolCalls) {
        console.log(`ToolCallProcessor: TOOL CYCLE #${this.toolCallCount + 1} - Starting stream processing`);
        
        // Reset state for this cycle
        this._resetState();
        let cycleContent = "";
        let toolExecutedThisCycle = false;
        
        // Log the request for debugging
        const requestData = {
          model: this.model,
          messages: currentMessages,
          options: { temperature: this.temperature, ...options }
        };
        
        // Create the stream for this cycle
        const stream = await this.ollamaClient.createChatStream(
          this.model,
          currentMessages,
          requestData.options,
          abortController?.signal
        );
        
        // Process stream chunks
        let fullResponse = "";
        let streamComplete = false;
        
        for await (const chunk of stream) {
          const token = chunk.message?.content || '';
          if (!token) continue;
          
          cycleContent += token;
          fullResponse += token;
          
          // Process token through state machine
          const result = await this._processToken(token, channelId, sender);
          
          if (result.action === "continue") {
            // Normal token, continue streaming
            continue;
          } else if (result.action === "tool_detected") {
            // Tool call detected and executed
            const toolResult = result.toolResult;
            const toolCallJson = result.toolCallJson;
            
            console.log(`ToolCallProcessor: Tool #${this.toolCallCount} executed, adding to conversation`);
            
            // Add tool call and result to conversation (lit-server pattern)
            currentMessages.push({
              role: "assistant", 
              content: toolCallJson
            });
            
            // Create self-monitoring prompt based on tool count
            const monitoringPrompt = this._createMonitoringPrompt(this.toolCallCount, toolResult);
            
            currentMessages.push({
              role: "user", 
              content: monitoringPrompt
            });
            
            // Add to total response
            totalResponse += toolCallJson;
            const resultMsg = `\n\nTool result: ${toolResult}\n\n`;
            totalResponse += resultMsg;
            
            // Send result to client via IPC
            if (!sender.isDestroyed()) {
              sender.send(`ollama:stream-response:${channelId}`, {
                content: resultMsg,
                done: false
              });
            }
            
            // Log to transcript
            appendToolResult(JSON.parse(toolCallJson), toolResult);
            
            // Break from current stream to start next cycle
            console.log(`ToolCallProcessor: TOOL CYCLE #${this.toolCallCount} - Breaking to start next cycle`);
            toolExecutedThisCycle = true;
            break;
            
          } else if (result.action === "stream_complete") {
            // Natural end of stream without tool calls
            streamComplete = true;
            break;
          }
        }
        
        // If we exited the streaming loop naturally (no more tokens) AND no tool was executed
        // this cycle, then we're truly done
        if (!streamComplete && !toolExecutedThisCycle) {
          console.log(`ToolCallProcessor: Stream ended naturally after ${this.toolCallCount} tools`);
          totalResponse += cycleContent;
          streamComplete = true;
        }
        
        // If we completed a full stream without tool calls, we're done
        if (streamComplete) {
          console.log(`ToolCallProcessor: Tool processing complete after ${this.toolCallCount} tools`);
          totalResponse += cycleContent;
          
          // Send final completion signal
          if (!sender.isDestroyed()) {
            sender.send(`ollama:stream-response:${channelId}`, {
              content: '',
              done: true
            });
          }
          
          // Log the conversation for debugging (only if no tools were executed this session)
          if (this.toolCallCount === 0) {
            logConversation(requestData, fullResponse, 'desktop');
          }
          break;
        }
        
        // If we hit max tools, add a warning and break
        if (this.toolCallCount >= this.maxToolCalls) {
          console.log(`ToolCallProcessor: Hit maximum tool limit (${this.maxToolCalls})`);
          const warningMsg = `\n\n[Note: Stopped after ${this.maxToolCalls} tool calls to prevent infinite loops]\n\n`;
          totalResponse += warningMsg;
          
          if (!sender.isDestroyed()) {
            sender.send(`ollama:stream-response:${channelId}`, {
              content: warningMsg,
              done: true
            });
          }
          break;
        }
      }
      
      console.log(`ToolCallProcessor: Recursive tool processing complete: ${this.toolCallCount} tools executed`);
      
      // Log the final conversation once at the end (if tools were executed)
      if (this.toolCallCount > 0) {
        const finalRequestData = {
          model: this.model,
          messages: messages, // Original messages
          options: { temperature: this.temperature, ...options }
        };
        logConversation(finalRequestData, totalResponse, 'desktop');
      }
      
      return { success: true, fullResponse: totalResponse };
      
    } catch (error) {
      console.error('ToolCallProcessor: Error in recursive tool processing:', error);
      
      const errorMsg = `\n\nError in tool processing: ${error.message}\n\n`;
      if (!sender.isDestroyed()) {
        sender.send(`ollama:stream-response:${channelId}`, {
          content: errorMsg,
          done: true
        });
      }
      
      return { success: false, error: error.message, fullResponse: totalResponse + errorMsg };
    }
  }
  
  /**
   * Reset the processor state for a new streaming cycle
   */
  _resetState() {
    this.state = StreamState.NORMAL_TOKENS;
    this.toolCallBuffer = "";
    this.braceCount = 0;
  }
  
  /**
   * Process a single token through the state machine
   * 
   * @param {string} token - Token from the stream
   * @param {string} channelId - Channel ID for IPC
   * @param {Object} sender - IPC sender for streaming output
   * @returns {Object} Action result
   */
  async _processToken(token, channelId, sender) {
    // console.log(`ToolCallProcessor: Processing token '${token}' (state=${this.state})`);
    
    if (this.state === StreamState.NORMAL_TOKENS) {
      return await this._handleNormalToken(token, channelId, sender);
    } else if (this.state === StreamState.TOOL_CALL_DETECTED) {
      return await this._handleToolCollectionToken(token, channelId, sender);
    } else {
      // Unknown state, treat as normal
      console.log(`ToolCallProcessor: Unknown state ${this.state}, treating as normal`);
      this.state = StreamState.NORMAL_TOKENS;
      return await this._handleNormalToken(token, channelId, sender);
    }
  }
  
  /**
   * Handle tokens in normal streaming mode
   */
  async _handleNormalToken(token, channelId, sender) {
    // Check if this might be the start of a tool call
    if (token.trim() === "{") {
      console.log("ToolCallProcessor: Found opening brace, starting tool call collection");
      this.state = StreamState.TOOL_CALL_DETECTED;
      this.toolCallBuffer = token;
      this.braceCount = 1;
      
      // Send the brace to the stream for now
      if (!sender.isDestroyed()) {
        sender.send(`ollama:stream-response:${channelId}`, {
          content: token,
          done: false
        });
      }
      
      return { action: "continue" };
    } else {
      // Normal token, send to stream
      if (!sender.isDestroyed()) {
        sender.send(`ollama:stream-response:${channelId}`, {
          content: token,
          done: false
        });
      }
      
      return { action: "continue" };
    }
  }
  
  /**
   * Handle tokens while collecting a potential tool call
   */
  async _handleToolCollectionToken(token, channelId, sender) {
    this.toolCallBuffer += token;
    
    // Count braces to determine when JSON is complete
    for (const char of token) {
      if (char === "{") {
        this.braceCount++;
      } else if (char === "}") {
        this.braceCount--;
      }
    }
    
    console.log(`ToolCallProcessor: Collection - '${token}' -> buffer='${this.toolCallBuffer}' braces=${this.braceCount}`);
    
    // If braces are balanced, we might have a complete JSON object
    if (this.braceCount === 0) {
      console.log(`ToolCallProcessor: Balanced braces detected, validating JSON: '${this.toolCallBuffer}'`);
      
      // Strip out <think>...</think> blocks before validation (lit-server approach)
      const cleanedBuffer = this.toolCallBuffer.replace(/<think>.*?<\/think>/gs, '').trim();
      
      // Try to validate as tool call
      const toolCall = this._extractToolCall(cleanedBuffer);
      
      if (toolCall) {
        // Valid tool call detected
        this.toolCallCount++;
        console.log(`ToolCallProcessor: TOOL EXECUTION #${this.toolCallCount}: ${toolCall.server}.${toolCall.tool}`);
        
        // Execute the tool
        const toolResult = await this._executeToolCall(toolCall);
        
        console.log(`ToolCallProcessor: TOOL RESULT #${this.toolCallCount}: ${toolResult.substring(0, 100)}...`);
        
        // Send the complete tool call to stream (replacing the individual tokens)
        if (!sender.isDestroyed()) {
          sender.send(`ollama:stream-response:${channelId}`, {
            content: token, // Send the final token to complete the JSON display
            done: false
          });
        }
        
        // Reset state and return tool execution result
        this._resetState();
        
        return {
          action: "tool_detected",
          toolResult: toolResult,
          toolCallJson: cleanedBuffer
        };
      } else {
        // Not a valid tool call, treat as normal text
        console.log(`ToolCallProcessor: Not a valid tool call, resuming normal streaming`);
        this.state = StreamState.NORMAL_TOKENS;
        
        // Send the final token to complete the output
        if (!sender.isDestroyed()) {
          sender.send(`ollama:stream-response:${channelId}`, {
            content: token,
            done: false
          });
        }
        
        return { action: "continue" };
      }
    } else {
      // Still collecting, send token to stream
      if (!sender.isDestroyed()) {
        sender.send(`ollama:stream-response:${channelId}`, {
          content: token,
          done: false
        });
      }
      
      return { action: "continue" };
    }
  }
  
  /**
   * Extract and validate a tool call from JSON text (adapted from lit-server)
   * 
   * @param {string} jsonText - The JSON text to parse
   * @returns {Object|null} Parsed tool call or null if invalid
   */
  _extractToolCall(jsonText) {
    try {
      const parsed = JSON.parse(jsonText);
      
      // Validate tool call structure
      if (!parsed.tool || (!parsed.arguments && !parsed.parameters)) {
        console.log('ToolCallProcessor: Invalid tool call format - missing tool or arguments/parameters');
        return null;
      }
      
      // Parse server name and tool name from "server.tool" format
      const toolParts = parsed.tool.split('.');
      
      if (toolParts.length === 2) {
        // Standard "server.tool" format
        return {
          server: toolParts[0],
          tool: toolParts[1],
          arguments: parsed.arguments || parsed.parameters || {}
        };
      } else if (toolParts.length === 1) {
        // No server prefix, assume mcp-dynamic-tools (like StreamManager does)
        return {
          server: 'mcp-dynamic-tools',
          tool: toolParts[0],
          arguments: parsed.arguments || parsed.parameters || {}
        };
      } else {
        console.log('ToolCallProcessor: Invalid tool format:', parsed.tool);
        return null;
      }
      
    } catch (error) {
      console.log('ToolCallProcessor: JSON parsing error:', error.message);
      return null;
    }
  }
  
  /**
   * Execute a tool call using MCPManager (adapted from StreamManager)
   * 
   * @param {Object} toolCall - The parsed tool call
   * @returns {string} Tool execution result
   */
  async _executeToolCall(toolCall) {
    try {
      console.log(`ToolCallProcessor: Executing ${toolCall.server}.${toolCall.tool}`);
      console.log('ToolCallProcessor: Tool arguments:', JSON.stringify(toolCall.arguments, null, 2));
      
      // Execute the tool using MCPManager
      const result = await this.mcpManager.callTool(
        toolCall.server,
        toolCall.tool,
        toolCall.arguments,
        'user' // Default username for desktop
      );
      
      console.log('ToolCallProcessor: Tool execution completed successfully');
      return result;
      
    } catch (error) {
      console.error('ToolCallProcessor: Tool execution error:', error);
      
      // Provide helpful error messages (like StreamManager does)
      const errorMessage = error.message;
      if (errorMessage.includes('not found')) {
        return `Tool '${toolCall.server}.${toolCall.tool}' not found. Available tools can be viewed by asking "what tools are available?" or create a new tool by asking me to "create an MCP tool".`;
      } else if (errorMessage.includes('No such file or directory')) {
        return `File not found: ${toolCall.arguments?.path || 'unknown file'}. The file does not exist.`;
      } else if (errorMessage.includes('Permission denied')) {
        return `Permission denied: Cannot access ${toolCall.arguments?.path || 'file/directory'}.`;
      } else {
        return `Error executing tool: ${errorMessage}`;
      }
    }
  }
  
  /**
   * Create a self-monitoring prompt that encourages the LLM to assess its progress
   * (directly adapted from lit-server)
   * 
   * @param {number} toolCount - Number of tools executed so far
   * @param {string} toolResult - Result from the most recent tool execution
   * @returns {string} Monitoring prompt
   */
  _createMonitoringPrompt(toolCount, toolResult) {
    // Base prompt with tool result
    let prompt = `Tool result: ${toolResult}\n\n`;
    
    // Add reminder of original task if available
    if (this.originalMessage) {
      prompt += `REMINDER: Your original task was: "${this.originalMessage}"\n\n`;
    }
    
    // Add self-monitoring guidance based on tool count (lit-server logic)
    if (toolCount === 1) {
      prompt += "You've executed 1 tool call. Continue if you're making progress toward your original goal.";
    } else if (toolCount <= 3) {
      prompt += `You've now executed ${toolCount} tool calls. Take a moment to assess: Does the most recent tool result indicate you've successfully completed the user's request? If so, it's time to summarize your work and conclude rather than continuing. If not, are you getting closer to completing the user's request? If you're uncertain about the next step, consider asking the user for clarification.`;
    } else if (toolCount <= 6) {
      prompt += `You've executed ${toolCount} tool calls so far. Take a moment to assess: Does the most recent tool result indicate you've successfully completed the user's request? If so, it's time to summarize your work and conclude rather than continuing. If not, are you making clear progress toward the original goal, or should you pause and check with the user about your approach?`;
    } else if (toolCount <= 9) {
      prompt += `You've made ${toolCount} tool calls now. Take a moment to assess: Does the most recent tool result indicate you've successfully completed the user's request? If so, it's time to summarize your work and conclude rather than continuing. If not, you should be close to completing the user's original request. If you're not sure this next step is essential, it's better to ask the user for guidance.`;
    } else {
      prompt += `You've executed ${toolCount} tool calls. Take a moment to assess: Does the most recent tool result indicate you've successfully completed the user's request? If so, it's time to summarize your work and conclude rather than continuing. This is quite a lot of tool calls - make sure you're still on track to solve the user's original problem. Consider summarizing what you've accomplished and asking if you should continue.`;
    }
    
    return prompt;
  }
  
  /**
   * Get current tool call count
   * @returns {number} Number of tools executed so far
   */
  getToolCallCount() {
    return this.toolCallCount;
  }
  
  /**
   * Check if max tool calls reached
   * @returns {boolean} True if at maximum
   */
  isAtMaxToolCalls() {
    return this.toolCallCount >= this.maxToolCalls;
  }
  
  /**
   * Reset tool call count (for new conversations)
   */
  resetToolCallCount() {
    this.toolCallCount = 0;
    console.log('ToolCallProcessor: Tool call count reset');
  }
}

module.exports = { ToolCallProcessor, StreamState };
