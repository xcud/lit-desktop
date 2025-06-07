/**
 * MCPManager - JavaScript port of Python MCPManager class
 * 
 * Manages all MCP (Model Context Protocol) integration for the desktop chat service.
 * This is a direct port of the working lit-server MCPManager.
 */

const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

class MCPManager {
  /**
   * Initialize the MCP manager.
   */
  constructor() {
    // Initialize MCP clients dictionary to store tool connections
    this.mcpClients = {};
    
    // Load MCP configuration
    this.mcpConfig = null;
    this.mcpServers = [];
    
    console.log('MCPManager: Initializing...');
    this.initialize();
  }
  
  /**
   * Async initialization method
   */
  async initialize() {
    try {
      // Load MCP configuration
      this.mcpConfig = await this._loadMcpConfig();
      
      // Set up MCP tools
      await this._setupMcpTools();
      
      console.log('MCPManager: Initialization complete');
    } catch (error) {
      console.error('MCPManager: Error during initialization:', error);
    }
  }
  
  /**
   * Load MCP server configuration from a JSON file.
   * Uses the same schema as Claude Desktop for compatibility.
   */
  async _loadMcpConfig() {
    // For desktop app, use a different config path than server
    const configFile = path.join(os.homedir(), '.config', 'lit-chat', 'mcp.json');
    const cachedToolsFile = path.join(os.homedir(), '.config', 'lit-chat', 'cached_tools.json');
    
    // Default empty configuration
    const defaultConfig = { mcpServers: {} };
    
    try {
      // Try to read the config file
      const configExists = await fs.access(configFile).then(() => true).catch(() => false);
      
      if (configExists) {
        const configData = await fs.readFile(configFile, 'utf8');
        let config = JSON.parse(configData);
        console.log(`MCPManager: Loaded MCP configuration from ${configFile}`);
        
        // Convert from old format if needed
        if (config.servers && !config.mcpServers) {
          // Convert from array format to object format
          const mcpServers = {};
          for (const server of config.servers) {
            const serverName = server.name || `server_${Object.keys(mcpServers).length}`;
            delete server.name;
            mcpServers[serverName] = server;
          }
          
          config = { mcpServers };
          // Save the converted format
          await fs.mkdir(path.dirname(configFile), { recursive: true });
          await fs.writeFile(configFile, JSON.stringify(config, null, 2));
          console.log('MCPManager: Converted configuration to Claude Desktop format');
        }
        
        // Load cached tools if available
        const cachedToolsExists = await fs.access(cachedToolsFile).then(() => true).catch(() => false);
        if (cachedToolsExists) {
          try {
            const cachedToolsData = await fs.readFile(cachedToolsFile, 'utf8');
            const cachedTools = JSON.parse(cachedToolsData);
            console.log(`MCPManager: Loaded cached tools from ${cachedToolsFile}`);
            
            // Add cached tools to each server in the config
            if (config.mcpServers) {
              for (const [serverName, serverConfig] of Object.entries(config.mcpServers)) {
                if (cachedTools[serverName]) {
                  serverConfig.cached_tools = cachedTools[serverName];
                }
              }
            }
          } catch (error) {
            console.warn(`MCPManager: Error reading cached tools file: ${error.message}`);
          }
        }
        
        return config;
      } else {
        // Config file doesn't exist, use default
        console.warn(`MCPManager: Config file ${configFile} not found, using default configuration`);
        return defaultConfig;
      }
    } catch (error) {
      console.error(`MCPManager: Error loading MCP config: ${error.message}`);
      return defaultConfig;
    }
  }
  
  /**
   * Set up MCP tools by connecting to available MCP servers.
   */
  async _setupMcpTools() {
    // Get servers from configuration in Claude Desktop format
    const mcpServersDict = this.mcpConfig.mcpServers || {};
    
    // Convert to our internal format (list with name field)
    this.mcpServers = [];
    for (const [serverName, serverConfig] of Object.entries(mcpServersDict)) {
      const server = { ...serverConfig };
      server.name = serverName;
      this.mcpServers.push(server);
    }
    
    // Discover any automatically detectable MCP servers
    await this._discoverMcpServers();
    
    if (this.mcpServers.length === 0) {
      console.warn('MCPManager: No MCP servers configured or discovered');
    }
    
    console.log(`MCPManager: Setting up ${this.mcpServers.length} MCP servers from configuration`);
    console.log(`MCPManager: Found ${this.mcpServers.length} MCP servers in configuration - will initialize per-user as needed`);
  }
  
  /**
   * Ensure MCP clients are initialized for a specific user and team.
   * Only initializes clients for servers that are already configured - no hardcoded injection.
   */
  async ensureUserMcpClients(team = 'desktop', username = 'user') {
    // Don't inject any hardcoded servers - only use what's in configuration
    // This follows the lit-server approach of only using properly configured servers
    
    if (this.mcpServers.length === 0) {
      console.warn('MCPManager: No MCP servers available in configuration');
      return;
    }
    
    console.log(`MCPManager: Initializing MCP clients for ${this.mcpServers.length} configured servers (user: ${username}, team: ${team})`);
    for (const server of this.mcpServers) {
      try {
        await this._getMcpClient(server.name, username);
      } catch (error) {
        console.error(`MCPManager: Could not initialize MCP client for ${server.name} (user: ${username}, team: ${team}):`, error);
      }
    }
  }
  
  /**
   * Refresh the tools for the lit-platform MCP server to pick up newly created tools.
   */
  async refreshLitPlatformTools(username = 'user') {
    try {
      const clientKey = `lit-platform:${username}`;
      if (this.mcpClients[clientKey]) {
        console.log(`MCPManager: Refreshing lit-platform tools for user: ${username}`);
        
        // Get the client info
        const clientInfo = this.mcpClients[clientKey];
        
        if (clientInfo.process) {
          // For now, we'll implement a simple refresh by re-discovering tools
          // This is a simplified version - full implementation would involve MCP protocol
          await this._discoverServerTools('lit-platform', 
            this.mcpServers.find(s => s.name === 'lit-platform'), username);
          console.log(`MCPManager: Refreshed tools for lit-platform`);
        } else {
          console.warn('MCPManager: No process found for lit-platform client');
        }
      } else {
        console.warn(`MCPManager: lit-platform client not found for user: ${username}`);
      }
    } catch (error) {
      console.error(`MCPManager: Error refreshing lit-platform tools: ${error.message}`);
    }
  }
  
  /**
   * Refresh the tools for the mcp-dynamic-tools server to pick up newly created tools.
   */
  async refreshMcpDynamicTools(username = 'user') {
    try {
      console.log(`MCPManager: Refreshing mcp-dynamic-tools for user: ${username}`);
      
      // Use the ToolRegistry to force refresh this server
      const toolRegistry = require('./services/tool-registry');
      await toolRegistry.forceRefreshServer('mcp-dynamic-tools');
      
      console.log(`MCPManager: Refreshed tools for mcp-dynamic-tools`);
    } catch (error) {
      console.error(`MCPManager: Error refreshing mcp-dynamic-tools: ${error.message}`);
    }
  }
  
  /**
   * Discover MCP servers available on the local machine.
   * 
   * This method should only discover servers from existing configuration,
   * not add hardcoded servers. Following lit-server approach.
   */
  async _discoverMcpServers() {
    // The lit-server doesn't add hardcoded servers in discovery
    // It only loads from configuration, so we should do the same
    console.log(`MCPManager: Server discovery complete. Using only configured servers.`);
    
    // No hardcoded server addition - only use what's in configuration
    // This matches the lit-server approach which relies on proper configuration
  }
  
  /**
   * Get or create an MCP client for the specified server.
   * PHASE 1 REFACTOR: Let _discoverServerTools handle client creation entirely
   */
  async _getMcpClient(serverName, username = 'user') {
    // Create a unique key for server + user combination
    const clientKey = `${serverName}:${username}`;
    
    if (!this.mcpClients[clientKey]) {
      // Get server config
      const serverConfig = this.mcpServers.find(s => s.name === serverName);
      if (!serverConfig) {
        throw new Error(`Unknown MCP server: ${serverName}`);
      }
      
      console.log(`MCPManager: Creating MCP client for: ${serverName}`);
      
      // Let _discoverServerTools handle the entire client creation and storage
      await this._discoverServerTools(serverName, serverConfig, username);
    }
    
    return this.mcpClients[clientKey];
  }
  
  /**
   * Discover the tools available on an MCP server and update the configuration.
   * PHASE 1 REFACTOR: Keep MCP clients alive instead of closing them immediately
   */
  async _discoverServerTools(serverName, serverConfig, username = 'user') {
    try {
      const clientKey = `${serverName}:${username}`;
      
      console.log(`MCPManager: Starting REAL MCP tool discovery for ${serverName}`);
      
      // Import MCP client
      const { MCPClient } = require('mcp-client');
      
      // Create real MCP client and connect
      let mcpClient;
      let tools = [];
      
      try {
        console.log(`MCPManager: Creating MCP client for ${serverName} with command: ${serverConfig.command} ${serverConfig.args ? serverConfig.args.join(' ') : ''}`);
        
        // Create MCP client with correct API (like original desktop app)
        mcpClient = new MCPClient({
          name: `lit-desktop-${serverName}`,
          version: '1.0.0',
        });
        
        // Connect to the MCP server using stdio protocol
        console.log(`MCPManager: Connecting to ${serverName}...`);
        await mcpClient.connect({
          type: 'stdio',
          command: serverConfig.command,
          args: serverConfig.args || [],
          env: { 
            ...process.env,
            MCP_ENABLED: 'true' // Some servers need this
          },
          cwd: process.cwd()
        });
        
        // Call the real MCP getAllTools method (like original desktop app)
        console.log(`MCPManager: Calling getAllTools for ${serverName}...`);
        const toolsResult = await mcpClient.getAllTools();
        
        // Convert MCP tool objects to our format (like lit-server)
        if (toolsResult && Array.isArray(toolsResult)) {
          tools = toolsResult.map(tool => ({
            name: tool.name,
            description: tool.description || `Tool provided by ${serverName}`,
            parameters: tool.inputSchema ? tool.inputSchema.properties || {} : {}
          }));
        } else if (toolsResult && toolsResult.tools) {
          tools = toolsResult.tools.map(tool => ({
            name: tool.name,
            description: tool.description || `Tool provided by ${serverName}`,
            parameters: tool.inputSchema ? tool.inputSchema.properties || {} : {}
          }));
        }
        
        console.log(`MCPManager: Successfully discovered ${tools.length} REAL tools for ${serverName}:`, tools.map(t => t.name));
        
        // PHASE 1 CHANGE: Store the ACTIVE client instead of closing it
        this.mcpClients[clientKey] = {
          client: mcpClient,           // ✅ Store actual client
          tools: tools,
          serverConfig: serverConfig,
          discoveredTools: tools,      // For prompt enhancement
          username: username           // Store username for debugging
        };
        
        console.log(`MCPManager: Stored ACTIVE MCP client for ${serverName} (user: ${username})`);
        
      } catch (mcpError) {
        console.error(`MCPManager: Error during MCP protocol communication for ${serverName}:`, mcpError);
        
        // If we can't connect, clean up and fall back to cached tools
        if (mcpClient) {
          try {
            await mcpClient.close();
          } catch (disconnectError) {
            console.warn(`MCPManager: Error closing failed connection to ${serverName}:`, disconnectError);
          }
        }
        
        console.log(`MCPManager: Falling back to cached tools for ${serverName}`);
        tools = [];
        
        // Store empty client info on failure
        this.mcpClients[clientKey] = {
          client: null,
          tools: tools,
          serverConfig: serverConfig,
          discoveredTools: tools,
          username: username,
          error: mcpError.message
        };
      }
      
      // Update cached tools if we have any
      if (tools.length > 0) {
        await this._updateCachedTools(serverName, tools);
        console.log(`MCPManager: Discovered ${tools.length} tools for ${serverName}: ${tools.map(t => t.name).join(', ')}`);
      } else {
        console.warn(`MCPManager: No tools discovered for ${serverName}`);
      }
      
    } catch (error) {
      console.error(`MCPManager: Error discovering tools for ${serverName}:`, error);
    }
  }
  
  /**
   * Update cached tools for a server
   */
  async _updateCachedTools(serverName, tools) {
    try {
      const cachedToolsFile = path.join(os.homedir(), '.config', 'lit-chat', 'cached_tools.json');
      
      let cachedTools = {};
      
      // Try to load existing cached tools
      try {
        const cachedToolsExists = await fs.access(cachedToolsFile).then(() => true).catch(() => false);
        if (cachedToolsExists) {
          const cachedToolsData = await fs.readFile(cachedToolsFile, 'utf8');
          cachedTools = JSON.parse(cachedToolsData);
        }
      } catch (error) {
        console.warn(`MCPManager: Error reading cached tools file: ${error.message}`);
      }
      
      // Convert tool objects to configuration format
      const toolConfigs = tools.map(tool => ({
        name: tool.name,
        description: tool.description || `Tool provided by ${serverName}`,
        parameters: tool.parameters || {}
      }));
      
      // Update the cached tools for this server
      cachedTools[serverName] = toolConfigs;
      
      // Save the updated cached tools
      await fs.mkdir(path.dirname(cachedToolsFile), { recursive: true });
      await fs.writeFile(cachedToolsFile, JSON.stringify(cachedTools, null, 2));
      
      console.log(`MCPManager: Updated cached tools with ${toolConfigs.length} tools for ${serverName}`);
      
      // Also store in server_config for this session
      const serverConfig = this.mcpServers.find(s => s.name === serverName);
      if (serverConfig) {
        serverConfig.cached_tools = toolConfigs;
      }
      
    } catch (error) {
      console.error(`MCPManager: Error updating cached tools: ${error.message}`);
    }
  }
  
  /**
   * Save the current MCP configuration to the config file.
   */
  async _saveMcpConfig() {
    const configFile = path.join(os.homedir(), '.config', 'lit-chat', 'mcp.json');
    const cachedToolsFile = path.join(os.homedir(), '.config', 'lit-chat', 'cached_tools.json');
    
    try {
      // Ensure directory exists
      await fs.mkdir(path.dirname(configFile), { recursive: true });
      
      // Create a copy of the config without cached_tools
      const cleanConfig = { ...this.mcpConfig };
      const cachedTools = {};
      
      // Extract cached_tools from each server
      if (cleanConfig.mcpServers) {
        for (const [serverName, serverConfig] of Object.entries(cleanConfig.mcpServers)) {
          if (serverConfig.cached_tools) {
            // Store cached tools in separate structure
            cachedTools[serverName] = serverConfig.cached_tools;
            delete serverConfig.cached_tools;
          }
        }
      }
      
      // Save the clean configuration
      await fs.writeFile(configFile, JSON.stringify(cleanConfig, null, 2));
      console.log(`MCPManager: Saved MCP configuration to ${configFile}`);
      
      // Save cached tools to separate file
      await fs.writeFile(cachedToolsFile, JSON.stringify(cachedTools, null, 2));
      console.log(`MCPManager: Saved cached tools to ${cachedToolsFile}`);
      
    } catch (error) {
      console.error(`MCPManager: Error saving MCP configuration: ${error.message}`);
      console.warn('MCPManager: Configuration changes will not persist across restarts');
    }
  }
  
  /**
   * Call an MCP tool and return the result.
   * PHASE 1 REFACTOR: Generic MCP tool calling using stored active clients
   */
  async callTool(serverName, toolName, args, username = 'user') {
    try {
      const clientKey = `${serverName}:${username}`;
      const clientInfo = this.mcpClients[clientKey];
      
      console.log(`MCPManager: Calling MCP tool ${serverName}.${toolName} as user '${username}' with arguments:`, args);
      
      if (!clientInfo || !clientInfo.client) {
        throw new Error(`No active MCP client for ${serverName}`);
      }
      
      // Use the stored active client to call the tool
      const result = await clientInfo.client.callTool({
        name: toolName,
        arguments: args
      });
      
      console.log(`MCPManager: Raw MCP result:`, result);
      
      // Extract text content from MCP result format
      if (result?.content?.[0]?.text) {
        return result.content[0].text;
      } else if (result?.content && Array.isArray(result.content)) {
        // Handle multiple content items
        const textContent = result.content
          .filter(item => item.type === 'text')
          .map(item => item.text)
          .join('\n');
        return textContent || JSON.stringify(result);
      } else if (typeof result === 'string') {
        return result;
      } else {
        return JSON.stringify(result);
      }
      
    } catch (error) {
      console.error(`MCPManager: Error calling MCP tool ${serverName}.${toolName}:`, error);
      
      // Make error messages more LLM-friendly (similar to Python version)
      const errorStr = error.message.toLowerCase();
      const originalError = error.message;
      
      // Handle common file operation errors
      if (errorStr.includes('no such file or directory') || errorStr.includes('file not found')) {
        const filePath = args.path || 'unknown file';
        return `File not found: ${filePath}. The file does not exist. You may need to create it first or check the path.`;
      }
      
      if (errorStr.includes('permission denied') || errorStr.includes('access denied')) {
        const filePath = args.path || 'unknown file';
        return `Permission denied: Cannot access ${filePath}. Check file permissions.`;
      }
      
      if (errorStr.includes('directory not found') || errorStr.includes('no such directory')) {
        const filePath = args.path || 'unknown directory';
        return `Directory not found: ${filePath}. The directory does not exist. You may need to create it first.`;
      }
      
      if (errorStr.includes('is a directory')) {
        const filePath = args.path || 'unknown path';
        return `Path error: ${filePath} is a directory, not a file. Use list_directory to see its contents.`;
      }
      
      // Generic fallback
      return `Error calling tool '${toolName}': ${originalError}`;
    }
  }
  
  /**
   * Get tool descriptions for inclusion in prompts.
   * This is the critical method that replaces PromptMaster.enhanceWithTools()
   */
  async getToolInfoForPrompt(username = 'user', team = 'desktop') {
    const toolDescriptions = [];
    
    console.log(`MCPManager: Getting tool info for prompt (username: ${username}, team: ${team})`);
    
    // SMART REFRESH: Only refresh dynamic servers, cache static ones
    for (const server of this.mcpServers) {
      const serverName = server.name || 'unknown';
      const clientKey = `${serverName}:${username}`;
      
      // Only refresh mcp-dynamic-tools (dynamic server), cache others  
      if (serverName === 'mcp-dynamic-tools') {
        console.log(`MCPManager: Refreshing dynamic server: ${serverName}`);
        try {
          const serverConfig = this.mcpServers.find(s => s.name === serverName);
          if (serverConfig) {
            await this._discoverServerTools(serverName, serverConfig, username);
          }
        } catch (error) {
          console.error(`MCPManager: Error refreshing ${serverName}:`, error);
        }
      } else {
        // For static servers like desktop-commander, only discover if not already cached
        if (!this.mcpClients[clientKey] || !this.mcpClients[clientKey].discoveredTools) {
          console.log(`MCPManager: Initial discovery for static server: ${serverName}`);
          try {
            const serverConfig = this.mcpServers.find(s => s.name === serverName);
            if (serverConfig) {
              await this._discoverServerTools(serverName, serverConfig, username);
            }
          } catch (error) {
            console.error(`MCPManager: Error discovering ${serverName}:`, error);
          }
        } else {
          console.log(`MCPManager: Using cached tools for static server: ${serverName}`);
        }
      }
      
      // Use discovered tools from the active client
      if (this.mcpClients[clientKey] && this.mcpClients[clientKey].discoveredTools) {
        const discoveredTools = this.mcpClients[clientKey].discoveredTools;
        console.log(`MCPManager: Found ${discoveredTools.length} discovered tools for ${serverName}`);
        
        for (const tool of discoveredTools) {
          const toolName = `${serverName}.${tool.name}`;
          // console.log(`MCPManager: Adding discovered tool: ${toolName}`);
          toolDescriptions.push({
            name: toolName,
            description: tool.description || `Tool provided by ${serverName}`,
            parameters: tool.parameters || {}
          });
        }
      } else {
        console.warn(`MCPManager: No tools found for server ${serverName} (clientKey: ${clientKey})`);
      }
    }
    
    // If no tools were found, add fallback tools
    if (toolDescriptions.length === 0) {
      console.warn('MCPManager: No tools found in configuration or discovery, using fallback tools');
      toolDescriptions.push(
        {
          name: 'desktop-commander.read_file',
          description: 'Read the contents of a file from the file system',
          parameters: {
            path: {
              type: 'string',
              description: 'The path to the file to read'
            }
          }
        },
        {
          name: 'desktop-commander.write_file',
          description: 'Write content to a file in the file system',
          parameters: {
            path: {
              type: 'string',
              description: 'The path to the file to write'
            },
            content: {
              type: 'string',
              description: 'The content to write to the file'
            }
          }
        },
        {
          name: 'desktop-commander.list_directory',
          description: 'List the contents of a directory',
          parameters: {
            path: {
              type: 'string',
              description: 'The path to the directory to list'
            }
          }
        }
      );
    }
    
    console.log(`MCPManager: Final tool descriptions for prompt: ${toolDescriptions.length} tools`);
    // for (const toolDesc of toolDescriptions) {
    //   console.log(`MCPManager: Tool in prompt: ${toolDesc.name}`);
    // }
    
    return toolDescriptions;
  }
  
  /**
   * Cleanup method to properly close connections
   * PHASE 1 REFACTOR: Clean up stored active clients
   */
  async cleanup() {
    try {
      console.log('MCPManager: Closing all active MCP client connections');
      
      for (const [clientKey, clientInfo] of Object.entries(this.mcpClients)) {
        if (clientInfo.client) {
          console.log(`MCPManager: Closing client: ${clientKey}`);
          try {
            await clientInfo.client.close();
          } catch (error) {
            console.warn(`MCPManager: Error closing client ${clientKey}:`, error);
          }
        }
      }
      
      // Clear the clients dictionary
      this.mcpClients = {};
      
      console.log('MCPManager: All clients closed');
    } catch (error) {
      console.error('MCPManager: Error during cleanup:', error);
    }
  }
}

module.exports = MCPManager;
