/**
 * StreamManager - Updated to use MCPManager
 * 
 * Responsible for managing streaming interactions with Ollama using MCPManager for tool calls
 */

const { appendToolResult } = require('./ollama-client');

// Keep track of active streaming requests
const activeStreams = new Map();

class StreamManager {
  /**
   * Create a new StreamManager
   */
  constructor() {
    // StreamManager initialized
  }
  
  /**
   * Create a streaming chat session
   * @param {string} channelId - The channel ID for this stream
   * @param {Object} ollamaClient - The OllamaClient instance
   * @param {Object} event - The IPC event
   * @param {string} model - The model to use
   * @param {Array} messages - The conversation messages
   * @param {Object} options - Chat options
   * @param {Object} mcpManager - The MCPManager instance (replaces toolHandler)
   * @returns {Promise<Object>} The result of the streaming session
   */
  async streamChat(channelId, ollamaClient, event, model, messages, options, mcpManager) {
    try {
      console.log(`StreamManager: Starting chat stream for model: ${model}, channelId: ${channelId}`);
      
      const client = ollamaClient.getClient();
      const sender = event.sender;
      
      // Create an AbortController to allow cancellation
      const abortController = new AbortController();
      
      // Store the AbortController for potential cancellation
      activeStreams.set(channelId, {
        abortController,
        timestamp: Date.now()
      });
      
      // Variables to track tool calls during streaming
      let isCollectingToolCall = false;
      let toolCallText = '';
      let fullResponse = '';
      let braceCount = 0; // For balanced brace detection (lit-server approach)
      
      // Stream the response
      const stream = await ollamaClient.createChatStream(
        model,
        messages,
        options,
        abortController.signal
      );
      
      console.log('StreamManager: Processing stream chunks with MCPManager tool detection...');
      
      // Buffering variables
      let buffer = '';
      const BUFFER_FLUSH_SIZE = 100; // Characters
      const MAX_FLUSH_INTERVAL = 100; // Milliseconds
      let lastFlushTime = Date.now();
      
      // Function to flush the buffer
      const flushBuffer = () => {
        if (buffer && !sender.isDestroyed()) {
          sender.send(`ollama:stream-response:${channelId}`, {
            content: buffer,
            done: false
          });
          buffer = '';
          lastFlushTime = Date.now();
        }
      };
      
      // Process the stream chunks
      for await (const chunk of stream) {
        const content = chunk.message?.content || '';
        
        try {
          // Update the timestamp to prevent premature cleanup
          const streamInfo = activeStreams.get(channelId);
          if (streamInfo) {
            streamInfo.timestamp = Date.now();
          }
          
          // Build up the full response for tool call detection
          fullResponse += content;
          
          // Simple tool call detection - look for JSON with "tool" field  
          if (!isCollectingToolCall && (content.includes('{') && fullResponse.includes('"tool"'))) {
            isCollectingToolCall = true;
            braceCount = 0; // Initialize brace counting (lit-server approach)
            
            // Count braces in the full response so far
            for (let char of fullResponse) {
              if (char === '{') braceCount++;
              if (char === '}') braceCount--;
            }
            
            // Stop adding to buffer when collecting tool call
            flushBuffer(); // Flush what we have so far
            continue;
          }
          
          if (isCollectingToolCall) {
            // We're collecting a tool call, count braces in this token
            for (let char of content) {
              if (char === '{') braceCount++;
              if (char === '}') braceCount--;
            }
            
            // console.log('StreamManager: Token brace count update:', braceCount);
            
            // Check if braces are balanced (lit-server approach)
            if (braceCount === 0) {
              console.log('StreamManager: Balanced braces detected, attempting tool extraction');
              
              // Try to extract tool call from complete response
              toolCallText = this.extractJsonFromText(fullResponse);
              console.log('StreamManager: Extracted tool call:', toolCallText);
              
              if (toolCallText && this.isCompleteToolCall(toolCallText)) {
                console.log('StreamManager: Tool call appears complete, attempting execution');
                console.log('StreamManager: Final tool call JSON:', toolCallText);
                
                // Try to execute the tool call
                const toolResult = await this.executeToolCall(toolCallText, mcpManager);
                
                // Always send tool results (success or error) to the client and continue streaming
                if (!sender.isDestroyed()) {
                  sender.send(`ollama:stream-response:${channelId}`, {
                    content: `\n\n**Tool Result:**\n${toolResult}\n\n`,
                    done: false
                  });
                }
                
                // Reset tool collection state and continue streaming
                isCollectingToolCall = false;
                toolCallText = '';
                continue;
              } else {
                // Tool call not complete yet, continue collecting
                continue;
              }
            } else {
              // Tool call detected but braces not balanced yet, continue collecting
              continue;
            }
          }
          
          // Regular content handling
          if (!isCollectingToolCall) {
            buffer += content;
            
            // Flush buffer if needed
            const currentTime = Date.now();
            if (buffer.length >= BUFFER_FLUSH_SIZE || (currentTime - lastFlushTime) >= MAX_FLUSH_INTERVAL) {
              flushBuffer();
            }
          }
          
        } catch (chunkError) {
          console.error('StreamManager: Error processing chunk:', chunkError);
          // Continue processing despite errors
        }
      }
      
      // Flush any remaining buffer
      flushBuffer();
      
      // Send completion signal
      if (!sender.isDestroyed()) {
        sender.send(`ollama:stream-response:${channelId}`, {
          content: '',
          done: true
        });
      }
      
      console.log('StreamManager: Stream completed successfully');
      
      // Clean up the stream
      activeStreams.delete(channelId);
      
      return { success: true, fullResponse };
      
    } catch (error) {
      console.error('StreamManager: Error in streamChat:', error);
      
      // Clean up on error
      activeStreams.delete(channelId);
      
      // Send error to client
      if (event && event.sender && !event.sender.isDestroyed()) {
        event.sender.send(`ollama:stream-response:${channelId}`, {
          content: `\n\nError: ${error.message}`,
          done: true
        });
      }
      
      throw error;
    }
  }
  
  /**
   * Extract JSON from text (using lit-server proven approach)
   */
  extractJsonFromText(text) {
    try {
      // Strip out <think>...</think> blocks before processing (lit-server approach)
      text = text.replace(/<think>.*?<\/think>/gs, '');
      
      // Strip out markdown code blocks (```json ... ```)
      text = text.replace(/```json\s*([\s\S]*?)\s*```/g, '$1');
      text = text.replace(/```\s*([\s\S]*?)\s*```/g, '$1');
      
      // Simple check for a JSON tool call format (lit-server approach)
      const trimmed = text.trim();
      if (!(trimmed.startsWith("{") && trimmed.endsWith("}"))) {
        return '';
      }
      
      // Try to parse the JSON directly (lit-server approach)
      JSON.parse(trimmed);
      return trimmed;
      
    } catch (error) {
      console.log('StreamManager: JSON extraction error:', error.message);
      return '';
    }
  }
  
  /**
   * Check if tool call JSON is complete
   */
  isCompleteToolCall(jsonText) {
    if (!jsonText) return false;
    
    try {
      const parsed = JSON.parse(jsonText);
      return parsed.tool && (parsed.arguments || parsed.parameters);
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Execute a tool call using MCPManager
   */
  async executeToolCall(toolCallText, mcpManager) {
    try {
      console.log('StreamManager: Executing tool call:', toolCallText);
      
      const toolCall = JSON.parse(toolCallText);
      console.log('StreamManager: Parsed tool call object:', JSON.stringify(toolCall, null, 2));
      
      if (!toolCall.tool || (!toolCall.arguments && !toolCall.parameters)) {
        console.log('StreamManager: Invalid tool call format - missing tool or arguments/parameters');
        console.log('StreamManager: toolCall.tool:', toolCall.tool);
        console.log('StreamManager: toolCall.arguments:', toolCall.arguments);
        console.log('StreamManager: toolCall.parameters:', toolCall.parameters);
        return null;
      }
      
      // Parse server name and tool name
      const [serverName, toolName] = toolCall.tool.split('.');
      const toolArgs = toolCall.arguments || toolCall.parameters || {};
      console.log('StreamManager: Tool arguments:', JSON.stringify(toolArgs, null, 2));
      
      if (!serverName || !toolName) {
        // If no server specified, could be a newly created tool - try mcp-dynamic-tools
        if (toolCall.tool && !toolCall.tool.includes('.')) {
          console.log(`StreamManager: No server prefix found for '${toolCall.tool}', trying mcp-dynamic-tools.${toolCall.tool}`);

          try {
            const result = await mcpManager.callTool('mcp-dynamic-tools', toolCall.tool, toolArgs, 'user');
            
            if (result && !result.includes('not found') && !result.includes('Error')) {
              console.log('StreamManager: Tool execution completed successfully');
              console.log('StreamManager: Tool result:', result);
              
              // Log to transcript
              appendToolResult(toolCall, result);
              
              return result;
            }
            else {
              // Return the actual error from the MCP manager instead of generic message
              const errorResult = result || `Tool '${toolCall.tool}' not found. Available tools can be viewed by asking "what tools are available?" or create a new tool by asking me to "create an MCP tool".`;
              
              // Log error to transcript
              appendToolResult(toolCall, null, errorResult);
              
              return errorResult;
            }

          }catch (error) {
            console.log('StreamManager: Error calling tool via mcp-dynamic-tools:', error.message);
            const errorResult = `Tool '${toolCall.tool}' not found. Available tools can be viewed by asking "what tools are available?" or create a new tool by asking me to "create an MCP tool".`;
            
            // Log error to transcript
            appendToolResult(toolCall, null, error.message);
            
            return errorResult;
          }
        }
        
        console.log('StreamManager: Invalid tool format');
        const errorResult = `Error: Invalid tool format '${toolCall.tool}'. Expected format: 'server.tool'`;
        
        // Log error to transcript
        appendToolResult(toolCall, null, errorResult);
        
        return errorResult;
      }
      
      console.log(`StreamManager: Calling ${serverName}.${toolName}`);
      
      // Execute the tool using MCPManager  
      const result = await mcpManager.callTool(serverName, toolName, toolArgs, 'user');
      
      console.log('StreamManager: Tool execution completed successfully');
      console.log('StreamManager: Tool result:', result);
      
      // Log successful result to transcript
      appendToolResult(toolCall, result);
      
      return result;
      
    } catch (error) {
      console.error('StreamManager: Tool execution error:', error);
      console.error('StreamManager: Error stack:', error.stack);
      
      // Parse toolCall from toolCallText if needed
      let parsedToolCall;
      try {
        parsedToolCall = JSON.parse(toolCallText);
      } catch (parseError) {
        parsedToolCall = { tool: 'unknown', arguments: {} };
      }
      
      // Provide more helpful error messages
      const errorMessage = error.message;
      let resultMessage;
      if (errorMessage.includes('not found')) {
        resultMessage = `Tool '${parsedToolCall.tool}' not found. Available tools can be viewed by asking "what tools are available?" or create a new tool by asking me to "create an MCP tool".`;
      } else if (errorMessage.includes('No such file or directory')) {
        resultMessage = `File not found: ${parsedToolCall.arguments?.path || 'unknown file'}. The file does not exist.`;
      } else if (errorMessage.includes('Permission denied')) {
        resultMessage = `Permission denied: Cannot access ${parsedToolCall.arguments?.path || 'file/directory'}.`;
      } else {
        resultMessage = `Error executing tool: ${errorMessage}`;
      }
      
      // Log error to transcript
      appendToolResult(parsedToolCall, null, error.message);
      
      return resultMessage;
    }
  }
  
  /**
   * Cancel a streaming request
   * @param {string} channelId - The channel ID to cancel
   * @returns {boolean} True if the stream was cancelled, false if not found
   */
  cancelStream(channelId) {
    console.log(`StreamManager: Attempting to cancel stream: ${channelId}`);
    
    const streamInfo = activeStreams.get(channelId);
    if (streamInfo) {
      console.log(`StreamManager: Cancelling stream: ${channelId}`);
      streamInfo.abortController.abort();
      activeStreams.delete(channelId);
      return true;
    } else {
      console.log(`StreamManager: Stream not found for cancellation: ${channelId}`);
      return false;
    }
  }
  
  /**
   * Get information about a specific stream
   * @param {string} channelId - The channel ID to get info for
   * @returns {Object|null} Stream information or null if not found
   */
  getStreamInfo(channelId) {
    return activeStreams.get(channelId) || null;
  }
  
  /**
   * Get information about all active streams
   * @returns {Array} Array of stream information objects
   */
  getActiveStreams() {
    const streams = [];
    for (const [channelId, streamInfo] of activeStreams) {
      streams.push({
        channelId,
        timestamp: streamInfo.timestamp,
        age: Date.now() - streamInfo.timestamp
      });
    }
    return streams;
  }
  
  /**
   * Clean up expired streams (older than 10 minutes)
   */
  cleanupExpiredStreams() {
    const MAX_AGE = 10 * 60 * 1000; // 10 minutes
    const now = Date.now();
    
    for (const [channelId, streamInfo] of activeStreams) {
      if (now - streamInfo.timestamp > MAX_AGE) {
        console.log(`StreamManager: Cleaning up expired stream: ${channelId}`);
        streamInfo.abortController.abort();
        activeStreams.delete(channelId);
      }
    }
  }
}

module.exports = StreamManager;
