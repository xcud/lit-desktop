/**
 * StreamManager - Updated to use ToolCallProcessor for recursive tool calling
 * 
 * Responsible for managing streaming interactions with Ollama using ToolCallProcessor 
 * for unlimited sequential tool calls and MCPManager for tool execution
 */

const { appendToolResult, logConversation } = require('./ollama-client');
const { ToolCallProcessor } = require('./tool-call-processor');

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
   * Create a streaming chat session with recursive tool calling support
   * @param {string} channelId - The channel ID for this stream
   * @param {Object} ollamaClient - The OllamaClient instance
   * @param {Object} event - The IPC event
   * @param {string} model - The model to use
   * @param {Array} messages - The conversation messages
   * @param {Object} options - Chat options
   * @param {Object} mcpManager - The MCPManager instance for tool execution
   * @returns {Promise<Object>} The result of the streaming session
   */
  async streamChat(channelId, ollamaClient, event, model, messages, options, mcpManager) {
    try {
      console.log(`StreamManager: Starting recursive chat stream for model: ${model}, channelId: ${channelId}`);
      
      // Create an AbortController to allow cancellation
      const abortController = new AbortController();
      
      // Store the AbortController for potential cancellation
      activeStreams.set(channelId, {
        abortController,
        timestamp: Date.now(),
        requestData: { model, messages, options },
        partialResponse: '' // Track partial response for cancellation logging
      });
      
      // Extract original user message for context tracking
      const originalMessage = messages.length > 0 ? 
        messages.find(msg => msg.role === 'user')?.content || '' : '';
      
      // Create ToolCallProcessor for this conversation
      const toolProcessor = new ToolCallProcessor(
        ollamaClient,
        mcpManager,
        model,
        options.temperature || 0.0,
        originalMessage
      );
      
      console.log('StreamManager: Processing stream with ToolCallProcessor for recursive tool calls...');
      
      // Use ToolCallProcessor to handle the streaming with unlimited tool calls
      const result = await toolProcessor.processStreamWithTools(
        channelId,
        event,
        messages,
        options,
        abortController
      );
      
      console.log(`StreamManager: Recursive tool processing completed with ${toolProcessor.getToolCallCount()} tools`);
      
      // Clean up the stream
      activeStreams.delete(channelId);
      
      return result;
      
    } catch (error) {
      console.error('StreamManager: Error in recursive streamChat:', error);
      
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
   * Cancel a streaming request
   * @param {string} channelId - The channel ID to cancel
   * @returns {boolean} True if the stream was cancelled, false if not found
   */
  cancelStream(channelId) {
    console.log(`StreamManager: Attempting to cancel stream: ${channelId}`);
    
    const streamInfo = activeStreams.get(channelId);
    if (streamInfo) {
      console.log(`StreamManager: Cancelling stream: ${channelId}`);
      
      // Log partial conversation before cancellation
      try {
        const partialResponse = streamInfo.partialResponse + '\n\n[CANCELLED BY USER]';
        logConversation(streamInfo.requestData, partialResponse, 'desktop-cancelled');
      } catch (logError) {
        console.error('StreamManager: Error logging cancelled conversation:', logError);
      }
      
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
