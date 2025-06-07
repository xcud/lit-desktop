/**
 * OllamaClient
 * 
 * Responsible for creating and managing connections to Ollama
 */

const { Ollama } = require('ollama');
const fs = require('fs');
const path = require('path');

/**
 * Log conversation for debugging MCP tool issues
 */
function logConversation(requestData, responseData, source = "desktop") {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, -5);
    const logDir = path.join(__dirname, '../../logs/conversations');
    
    // Ensure directory exists
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    
    const logFile = path.join(logDir, `conversation-${timestamp}-${source}.log`);
    
    let logContent = "=".repeat(80) + "\n";
    logContent += `CONVERSATION LOG - ${source.toUpperCase()}\n`;
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
    console.log(`Conversation logged to: ${logFile}`);
    
  } catch (error) {
    console.error('Failed to log conversation:', error);
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
            
            // Log the conversation after stream completes
            logConversation(requestData, fullResponse, "desktop");
            
          } catch (error) {
            // Log even if there's an error
            logConversation(requestData, fullResponse || "[Stream Error]", "desktop");
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