/**
 * MCP Service - Main entry point
 * 
 * Uses a modular architecture for managing MCP servers and tools
 */

const { ipcMain } = require('electron');
const configManager = require('./services/configuration-manager');
const serverManager = require('./services/server-manager');
const toolRegistry = require('./services/tool-registry');
const toolExecutor = require('./services/tool-executor');

class McpService {
  constructor() {
    console.log('McpService constructor complete');
  }
  
  /**
   * Initialize the MCP service
   * @param {Object} config - Configuration object
   */
  initialize(config) {
    console.log('McpService initialization started');
    
    // Initialize components in the right order
    configManager.initialize(config);
    
    // Setup IPC handlers
    this.setupIpcHandlers();
    
    // Start auto-start servers
    serverManager.startAutoStartServers();
    
    // Pre-cache tools for faster responses
    toolRegistry.discoverAllTools();
    
    console.log('McpService initialization complete');
  }
  
  /**
   * Set up IPC handlers for renderer process communication
   */
  setupIpcHandlers() {
    console.log('Setting up IPC handlers');
    
    // List available MCP tools
    ipcMain.handle('mcp:list-tools', async () => {
      try {
        console.log('IPC: mcp:list-tools called');
        return await toolRegistry.getAllTools();
      } catch (error) {
        console.error('Error listing MCP tools:', error);
        throw error;
      }
    });
    
    // Get cached tools
    ipcMain.handle('mcp:get-cached-tools', async () => {
      try {
        console.log('IPC: mcp:get-cached-tools called');
        return configManager.getAllCachedTools();
      } catch (error) {
        console.error('Error getting cached tools:', error);
        throw error;
      }
    });
    
    // Call an MCP tool
    ipcMain.handle('mcp:call-tool', async (event, toolName, args) => {
      try {
        console.log(`IPC: mcp:call-tool called with ${toolName}`, args);
        return await toolExecutor.callTool(toolName, args);
      } catch (error) {
        console.error(`Error calling MCP tool ${toolName}:`, error);
        throw error;
      }
    });
    
    // Add explicit handler for manually starting a server and discovering tools
    ipcMain.handle('mcp:start-server', async (event, serverName) => {
      try {
        console.log(`IPC: mcp:start-server called for ${serverName}`);
        
        // Start the server
        await serverManager.startServer(serverName);
        
        // Discover tools
        await toolRegistry.discoverTools(serverName);
        
        return true;
      } catch (error) {
        console.error(`Error starting MCP server ${serverName}:`, error);
        throw error;
      }
    });
  }
  
  /**
   * Get all available tools
   * @returns {Promise<Array>} Array of all available tools
   */
  async getAllTools() {
    return await toolRegistry.getAllTools();
  }
  
  /**
   * Call a tool
   * @param {string} serverName - The name of the server
   * @param {string} toolName - The name of the tool
   * @param {Object} args - The arguments to pass to the tool
   * @returns {Promise<Object>} The result of the tool execution
   */
  async callTool(serverName, toolName, args) {
    return await toolExecutor.executeToolCall(serverName, toolName, args);
  }
  
  /**
   * Clean up when the app is closing
   */
  async cleanup() {
    console.log('McpService cleanup called');
    await serverManager.cleanup();
    console.log('McpService cleanup complete');
  }
}

// Export the service
module.exports = new McpService();