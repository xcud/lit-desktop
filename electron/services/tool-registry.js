/**
 * ToolRegistry
 * 
 * Responsible for discovering, caching, and retrieving tools
 */

const configManager = require('./configuration-manager');
const serverManager = require('./server-manager');

class ToolRegistry {
  /**
   * Creates a new ToolRegistry
   */
  constructor() {
  }

  /**
   * Get all available tools across all servers
   * @returns {Promise<Array>} Array of all available tools
   */
  async getAllTools() {
    console.log('ToolRegistry: getAllTools called');
    const allTools = [];
    
    try {
      // Get all server configs
      const serverConfigs = configManager.getAllServerConfigs();
      
      // Add tools from all servers
      for (const [serverName, serverConfig] of Object.entries(serverConfigs)) {
        console.log(`ToolRegistry: Processing tools for server: ${serverName}`);
        
        // Get tools for this server (uses cache if available)
        const serverTools = await this.getToolsForServer(serverName);
        
        // Format tools with server prefix
        const formattedTools = serverTools.map(tool => ({
          name: `${serverName}.${tool.name}`,
          description: tool.description || `Tool provided by ${serverName}`,
          parameters: tool.inputSchema || tool.parameters || {}
        }));
        
        allTools.push(...formattedTools);
        console.log(`ToolRegistry: Added ${formattedTools.length} tools for ${serverName}`);
      }
      
      console.log(`ToolRegistry: getAllTools returning ${allTools.length} total tools:`, allTools.map(t => t.name).join(', '));
      return allTools;
    } catch (error) {
      console.error('ToolRegistry: Error in getAllTools:', error);
      throw error;
    }
  }

  /**
   * Get tools for a specific server
   * @param {string} serverName - The name of the server
   * @returns {Promise<Array>} Array of tools for the server
   */
  async getToolsForServer(serverName) {
    console.log(`ToolRegistry: getToolsForServer called for ${serverName}`);
    
    // First check if we have cached tools for this server
    const cachedTools = configManager.getCachedToolsForServer(serverName);
    if (cachedTools && cachedTools.length > 0) {
      console.log(`ToolRegistry: Using ${cachedTools.length} cached tools for ${serverName}`);
      return cachedTools;
    }
    
    // If no cached tools, try to discover them
    try {
      const discoveredTools = await this.discoverTools(serverName);
      return discoveredTools;
    } catch (error) {
      console.error(`ToolRegistry: Error getting tools for ${serverName}:`, error);
      return [];
    }
  }

  /**
   * Discover tools for a server
   * @param {string} serverName - The name of the server
   * @returns {Promise<Array>} Array of discovered tools
   */
  async discoverTools(serverName) {
    console.log(`ToolRegistry: discoverTools called for ${serverName}`);
    
    try {
      const serverConfig = configManager.getServerConfig(serverName);
      if (!serverConfig) {
        console.error(`ToolRegistry: Unknown server: ${serverName}`);
        return [];
      }
      
      // Handle internal services specifically
      if (serverConfig.command === 'internal') {
        console.log(`ToolRegistry: Discovering tools for internal service: ${serverName}`);
        
        // if (serverName === 'image-renderer') {
        //   const imageRendererService = require('../image-renderer-service');
        //   const tools = imageRendererService.getAllTools();
          
        //   // Cache the tools
        //   configManager.updateCachedToolsForServer(serverName, tools);
          
        //   return tools;
        // }
        
        // Add other internal services here as needed
        
        console.log(`ToolRegistry: Unknown internal service: ${serverName}, no tools discovered`);
        return [];
      }
      
      // If server isn't running, start it now
      if (!serverManager.isServerRunning(serverName)) {
        console.log(`ToolRegistry: Server ${serverName} not running, starting it for tool discovery`);
        await serverManager.startServer(serverName);
      }
      
      // If we have a client, use it to get tools
      if (serverManager.isClientConnected(serverName)) {
        try {
          console.log(`ToolRegistry: Discovering tools for ${serverName} using MCP client`);
          const client = serverManager.getClient(serverName);
          const tools = await client.getAllTools();
          
          if (tools && tools.length > 0) {
            console.log(`ToolRegistry: Discovered ${tools.length} tools for ${serverName}:`, tools.map(t => t.name).join(', '));
            
            // Cache the tools
            configManager.updateCachedToolsForServer(serverName, tools);
            
            return tools;
          } else {
            console.log(`ToolRegistry: No tools discovered for ${serverName} using MCP client`);
          }
        } catch (error) {
          console.error(`ToolRegistry: Error discovering tools for ${serverName}:`, error);
        }
      } else {
        console.log(`ToolRegistry: No MCP client available for ${serverName}`);
      }
      
      // Fall back to cached tools if we have them
      const cachedTools = configManager.getCachedToolsForServer(serverName);
      if (cachedTools && cachedTools.length > 0) {
        console.log(`ToolRegistry: Using ${cachedTools.length} cached tools for ${serverName}`);
        return cachedTools;
      }
      
      // Then check if the server has cached tools in its config
      if (serverConfig.cached_tools) {
        console.log(`ToolRegistry: Using ${serverConfig.cached_tools.length} server cached tools for ${serverName}`);
        
        // Cache the tools
        configManager.updateCachedToolsForServer(serverName, serverConfig.cached_tools);
        
        return serverConfig.cached_tools;
      }
      
      console.log(`ToolRegistry: No tools discovered for ${serverName}`);
      return [];
    } catch (error) {
      console.error(`ToolRegistry: Error in discoverTools for ${serverName}:`, error);
      
      // Fall back to cached tools if we have them
      const cachedTools = configManager.getCachedToolsForServer(serverName);
      if (cachedTools && cachedTools.length > 0) {
        console.log(`ToolRegistry: Using ${cachedTools.length} cached tools for ${serverName} after error`);
        return cachedTools;
      }
      
      return [];
    }
  }

  /**
   * Discover tools for all servers
   * @returns {Promise<Object>} Map of server names to discovered tools
   */
  async discoverAllTools() {
    console.log(`ToolRegistry: discoverAllTools called`);
    
    try {
      const serverConfigs = configManager.getAllServerConfigs();
      const allTools = {};
      
      // Process each server
      for (const [serverName, serverConfig] of Object.entries(serverConfigs)) {
        console.log(`ToolRegistry: Discovering tools for ${serverName}`);
        
        try {
          const tools = await this.discoverTools(serverName);
          allTools[serverName] = tools;
        } catch (error) {
          console.error(`ToolRegistry: Error discovering tools for ${serverName}:`, error);
          
          // Use cached tools if available after error
          const cachedTools = configManager.getCachedToolsForServer(serverName);
          if (cachedTools && cachedTools.length > 0) {
            console.log(`ToolRegistry: Using cached tools for ${serverName} after error`);
            allTools[serverName] = cachedTools;
          } else {
            allTools[serverName] = [];
          }
        }
      }
      
      console.log(`ToolRegistry: discoverAllTools complete`);
      return allTools;
    } catch (error) {
      console.error('ToolRegistry: General error in discoverAllTools:', error);
      throw error;
    }
  }
  
  /**
   * Force refresh tools for a specific server by clearing cache
   * @param {string} serverName - The name of the server  
   * @returns {Promise<Array>} Array of refreshed tools
   */
  async forceRefreshServer(serverName) {
    console.log(`ToolRegistry: Force refreshing tools for ${serverName}`);
    
    // Clear cached tools for this server
    configManager.setCachedToolsForServer(serverName, []);
    
    // Discover fresh tools
    try {
      const discoveredTools = await this.discoverTools(serverName);
      console.log(`ToolRegistry: Force refresh discovered ${discoveredTools.length} tools for ${serverName}`);
      return discoveredTools;
    } catch (error) {
      console.error(`ToolRegistry: Error force refreshing ${serverName}:`, error);
      return [];
    }
  }
}

module.exports = new ToolRegistry();