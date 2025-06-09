/**
 * OllamaService - Updated to use MCPManager
 * 
 * Main service that coordinates Ollama API interactions, tools, and streaming.
 * Now uses the working MCPManager instead of the broken MCP integration.
 */

const { ipcMain } = require('electron');
const OllamaClient = require('./ollama/ollama-client');
const StreamManager = require('./ollama/stream-manager');
const MCPManager = require('./mcp-manager'); // NEW: Use our working MCPManager

// Import all handlers - removed general ChatHandler, added specific TitleGenerationHandler
const ListModelsHandler = require('./ollama/handlers/list-models-handler');
const SetHostHandler = require('./ollama/handlers/set-host-handler');
const TitleGenerationHandler = require('./ollama/handlers/title-generation-handler'); // For title generation only
const StreamChatHandler = require('./ollama/handlers/stream-chat-handler');
const CancelStreamHandler = require('./ollama/handlers/cancel-stream-handler');
const PullModelHandler = require('./ollama/handlers/pull-model-handler');

class OllamaService {
  constructor() {
    // Initialize components
    this.ollamaClient = new OllamaClient();
    this.mcpManager = new MCPManager(); // NEW: Use MCPManager instead of PromptMaster + ToolHandler
    this.streamManager = new StreamManager();
    
    console.log('OllamaService: Initialized with MCPManager successfully');
    
    // Setup handlers immediately - no delay needed
    this.setupIpcHandlers();
  }
  
  /**
   * Set up IPC handlers for renderer process communication
   */
  setupIpcHandlers() {
    console.log('OllamaService: Setting up IPC handlers with MCPManager');
    
    // Create and register each handler - specific handlers for specific purposes
    const handlers = [
      new ListModelsHandler(this.ollamaClient),
      new SetHostHandler(this.ollamaClient),
      new TitleGenerationHandler(this.ollamaClient, this.mcpManager), // For title generation only
      new StreamChatHandler(this.ollamaClient, this.mcpManager, this.streamManager), // Main chat is always streaming
      new CancelStreamHandler(this.streamManager),
      new PullModelHandler(this.ollamaClient)
    ];
    
    // Register each handler
    for (const handler of handlers) {
      handler.register(ipcMain);
    }
    
    console.log('OllamaService: All IPC handlers registered with MCPManager integration');
  }
  
  /**
   * Set the Ollama host
   * @param {string} host - The new host URL
   * @returns {string} The new host URL
   */
  setHost(host) {
    return this.ollamaClient.setHost(host);
  }
  
  /**
   * Get the current Ollama host
   * @returns {string} The current host URL
   */
  getHost() {
    return this.ollamaClient.getHost();
  }
  
  /**
   * Clean up expired streams
   */
  cleanupExpiredStreams() {
    this.streamManager.cleanupExpiredStreams();
  }
  
  /**
   * NEW: Get MCP Manager instance for use by handlers
   */
  getMCPManager() {
    return this.mcpManager;
  }
}

// Export the service
module.exports = new OllamaService();
