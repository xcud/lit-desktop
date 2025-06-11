/**
 * OllamaClient
 * 
 * Responsible for creating and managing connections to Ollama
 */

const { Ollama } = require('ollama');
const fs = require('fs');
const path = require('path');

/**
 * Log conversation transcript for debugging MCP tool issues
 */
function logConversation(requestData, responseData, source = "desktop") {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, -5);
    const logDir = path.join(__dirname, '../../logs/transcripts');
    
    // Ensure directory exists
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    
    const logFile = path.join(logDir, `transcript-${timestamp}-${source}.log`);
    
    let logContent = "=".repeat(80) + "\n";
    logContent += `CONVERSATION TRANSCRIPT - ${source.toUpperCase()}\n`;
    logContent += `Timestamp: ${new Date().toISOString()}\n`;
    logContent += "=".repeat(80) + "\n\n";
    
    logContent += "REQUEST TO LLM:\n";
    logContent += "-".repeat(40) + "\n";
    logContent += `Model: ${requestData.model || 'unknown'}\n`;
    logContent += `Options: ${JSON.stringify(requestData.options || {}, null, 2)}\n\n`;
    
    logContent += "Messages:\n";
    const messages = requestData.messages || [];
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      logContent += `  [${i}] Role: ${msg.role || 'unknown'}\n`;
      const content = msg.content || '';
      logContent += `      Content: ${content}\n`;
      logContent += "\n";
    }
    
    logContent += "\nRESPONSE FROM LLM:\n";
    logContent += "-".repeat(40) + "\n";
    logContent += responseData;
    logContent += "\n\n";
    
    fs.writeFileSync(logFile, logContent, 'utf8');
    console.log(`Conversation transcript logged to: ${logFile}`);
    
    // Store the log file path globally so tool execution can append to it
    global.currentTranscriptFile = logFile;
    
  } catch (error) {
    console.error('Failed to log conversation transcript:', error);
  }
}

/**
 * Append tool execution results to the current transcript
 */
function appendToolResult(toolCall, toolResult, error = null) {
  try {
    if (!global.currentTranscriptFile) {
      console.warn('No current transcript file to append tool result to');
      return;
    }
    
    let appendContent = "\n" + "=".repeat(80) + "\n";
    appendContent += `ACTUAL TOOL EXECUTION #${Date.now()}\n`;
    appendContent += `Server: ${toolCall.tool ? toolCall.tool.split('.')[0] : 'unknown'}\n`;
    appendContent += `Tool: ${toolCall.tool ? toolCall.tool.split('.')[1] : 'unknown'}\n`;
    appendContent += `Arguments: ${JSON.stringify(toolCall.arguments || {}, null, 2)}\n`;
    appendContent += "-".repeat(40) + "\n";
    
    if (error) {
      appendContent += `TOOL ERROR:\n${error.toString()}\n`;
    } else {
      appendContent += `TOOL RESULT:\n${typeof toolResult === 'object' ? JSON.stringify(toolResult, null, 2) : toolResult}\n`;
    }
    
    appendContent += "=".repeat(80) + "\n\n";
    
    fs.appendFileSync(global.currentTranscriptFile, appendContent, 'utf8');
    console.log(`Tool result appended to transcript: ${global.currentTranscriptFile}`);
    
  } catch (error) {
    console.error('Failed to append tool result to transcript:', error);
  }
}

class OllamaClient {
  /**
   * Create a new OllamaClient
   * @param {string} [host] - The Ollama host URL
   */
  constructor(host = 'http://localhost:11434') {
    this.host = host;
    this.client = new Ollama({ host });
    
    console.log(`OllamaClient: Initialized with host ${host}`);
  }
  
  /**
   * Set the Ollama host
   * @param {string} host - The new host URL
   * @returns {string} The new host URL
   */
  setHost(host) {
    this.host = host;
    this.client = new Ollama({ host });
    console.log(`OllamaClient: Set host to ${host}`);
    return this.host;
  }
  
  /**
   * Get the current Ollama host
   * @returns {string} The current host URL
   */
  getHost() {
    return this.host;
  }
  
  /**
   * Get the Ollama client instance
   * @returns {Ollama} The Ollama client
   */
  getClient() {
    if (!this.client) {
      this.client = new Ollama({ host: this.host });
    }
    return this.client;
  }
  
  /**
   * List available models from Ollama
   * @returns {Promise<Array>} List of available models
   */
  async listModels() {
    try {
      const response = await this.client.list();
      return response.models || [];
    } catch (error) {
      console.error('OllamaClient: Error listing models:', error);
      
      // Return dummy data as fallback
      return [
        { model: 'llama3:latest', name: 'Llama 3', tags: ['latest'] },
        { model: 'mistral:latest', name: 'Mistral', tags: ['latest'] }
      ];
    }
  }
  
  /**
   * Send a chat request to Ollama
   * @param {string} model - The model to use
   * @param {Array} messages - The conversation messages
   * @param {Object} [options] - Chat options
   * @returns {Promise<Object>} The chat response
   */
  async chat(model, messages, options = {}) {
    try {
      return await this.client.chat({
        model,
        messages,
        options
      });
    } catch (error) {
      console.error('OllamaClient: Error in chat:', error);
      throw error;
    }
  }
  
  /**
   * Create a streaming chat session
   * @param {string} model - The model to use
   * @param {Array} messages - The conversation messages
   * @param {Object} [options] - Chat options
   * @param {AbortSignal} [signal] - Signal to abort the request
   * @returns {Promise<AsyncIterable>} Stream of response chunks
   */
  async createChatStream(model, messages, options = {}, signal = null) {
    try {
      // Log the request
      const requestData = {
        model,
        messages,
        options
      };
      
      // Initialize transcript file at the START of the stream so tool calls can append to it
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, -5);
      const logDir = path.join(__dirname, '../../logs/transcripts');
      
      // Ensure directory exists
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      
      const logFile = path.join(logDir, `transcript-${timestamp}-desktop.log`);
      
      // Create initial transcript content
      let logContent = "=".repeat(80) + "\n";
      logContent += `CONVERSATION TRANSCRIPT - DESKTOP\n`;
      logContent += `Timestamp: ${new Date().toISOString()}\n`;
      logContent += "=".repeat(80) + "\n\n";
      
      logContent += "REQUEST TO LLM:\n";
      logContent += "-".repeat(40) + "\n";
      logContent += `Model: ${requestData.model || 'unknown'}\n`;
      logContent += `Options: ${JSON.stringify(requestData.options || {}, null, 2)}\n\n`;
      
      logContent += "Messages:\n";
      const messages_copy = requestData.messages || [];
      for (let i = 0; i < messages_copy.length; i++) {
        const msg = messages_copy[i];
        logContent += `  [${i}] Role: ${msg.role || 'unknown'}\n`;
        logContent += `      Content: ${msg.content || ''}\n\n`;
      }
      
      logContent += "\nRESPONSE FROM LLM:\n";
      logContent += "-".repeat(40) + "\n";
      
      // Write initial transcript and set global path for tool appending
      fs.writeFileSync(logFile, logContent, 'utf8');
      global.currentTranscriptFile = logFile;
      console.log(`Transcript initialized: ${logFile}`);
      
      const stream = await this.client.chat({
        model,
        messages,
        options,
        signal,
        stream: true
      });
      
      // Wrap the stream to collect the full response for logging
      let fullResponse = "";
      const wrappedStream = {
        [Symbol.asyncIterator]: async function* () {
          try {
            for await (const chunk of stream) {
              if (chunk.message && chunk.message.content) {
                fullResponse += chunk.message.content;
              }
              yield chunk;
            }
            
            // Append the final response to the existing transcript
            if (global.currentTranscriptFile) {
              const finalContent = fullResponse || "[No response]";
              fs.appendFileSync(global.currentTranscriptFile, finalContent + "\n", 'utf8');
            }
            
          } catch (error) {
            // Append error to transcript
            if (global.currentTranscriptFile) {
              fs.appendFileSync(global.currentTranscriptFile, `[Stream Error: ${error.message}]\n`, 'utf8');
            }
            throw error;
          }
        }
      };
      
      return wrappedStream;
      
    } catch (error) {
      console.error('OllamaClient: Error creating chat stream:', error);
      throw error;
    }
  }
  
  /**
   * Pull a model from Ollama
   * @param {string} model - The model to pull
   * @returns {Promise<AsyncIterable>} Stream of progress updates
   */
  async pullModel(model) {
    try {
      return await this.client.pull({
        model,
        stream: true
      });
    } catch (error) {
      console.error('OllamaClient: Error pulling model:', error);
      throw error;
    }
  }
}

module.exports = OllamaClient;
module.exports.appendToolResult = appendToolResult;
module.exports.logConversation = logConversation;