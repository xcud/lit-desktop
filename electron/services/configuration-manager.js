/**
 * ConfigurationManager
 * 
 * Responsible for loading, saving, and managing MCP configuration
 */

const path = require('path');
const fs = require('fs');
const Store = require('electron-store');

class ConfigurationManager {
  /**
   * Creates a new ConfigurationManager
   */
  constructor() {
    this.store = new Store();
    this.cachedTools = {};
    this.config = { mcpServers: {} };
  }

  /**
   * Initialize the configuration
   * @param {Object} [initialConfig] - Optional initial configuration to use
   * @returns {Object} The loaded configuration
   */
  initialize(initialConfig = null) {
    console.log('ConfigurationManager: initialization started');
    
    // First try to load from the stored MCP config
    const mcpConfig = this.loadStoredConfig();
    
    // If we have valid MCP config, use it
    if (mcpConfig && mcpConfig.mcpServers) {
      this.config = mcpConfig;
      console.log('ConfigurationManager: Loaded MCP servers from config:', Object.keys(this.config.mcpServers));
    } 
    // Otherwise, fall back to the passed config
    else if (initialConfig && initialConfig.mcpServers) {
      this.config = { 
        mcpServers: initialConfig.mcpServers 
      };
      console.log('ConfigurationManager: Using provided MCP servers config:', Object.keys(this.config.mcpServers));
    } else {
      console.log('ConfigurationManager: No MCP servers configured, adding default desktop-commander');
      // Add a default desktop-commander config
      this.config = {
        mcpServers: {
          'desktop-commander': {
            command: 'npx',
            args: ['@wonderwhy-er/desktop-commander@latest'],
            description: 'Access and manipulate files on the local system',
            autoStart: false
          }
        }
      };
    }
    
    // Load built-in services from built-in.json
    this.loadBuiltInServices();
    
    // Make sure desktop-commander is always available
    this.ensureDesktopCommanderAvailable();
    
    // Load cached tools
    this.loadCachedTools();
    
    console.log('ConfigurationManager: initialization complete');
    return this.config;
  }

  /**
   * Load the stored MCP configuration from Electron Store
   * @returns {Object|null} The loaded configuration or null if not found
   */
  loadStoredConfig() {
    console.log('ConfigurationManager: Loading MCP configuration from Electron Store');
    
    // Get MCP config from settings
    let mcpConfig = this.store.get('mcpConfig');
    
    try {
      // Try to parse the config if it's a string
      if (typeof mcpConfig === 'string') {
        mcpConfig = JSON.parse(mcpConfig);
        console.log('ConfigurationManager: Parsed MCP config from JSON string');
      }
      
      // Fallback to looking for file if no config in store
      if (!mcpConfig) {
        // Try to read the LIT config file as fallback
        const configFile = '/etc/lit/mcp.json';
        if (fs.existsSync(configFile)) {
          console.log(`ConfigurationManager: Falling back to MCP config file: ${configFile}`);
          const configData = fs.readFileSync(configFile, 'utf8');
          mcpConfig = JSON.parse(configData);
          
          // Save to Electron Store for next time
          this.store.set('mcpConfig', JSON.stringify(mcpConfig, null, 2));
        }
      }
      
      if (mcpConfig) {
        console.log('ConfigurationManager: Successfully loaded MCP config');
        return mcpConfig;
      } else {
        console.warn('ConfigurationManager: No MCP config found, will use default');
        return null;
      }
    } catch (error) {
      console.error(`ConfigurationManager: Error loading MCP config: ${error}`);
      return null;
    }
  }

  /**
   * Load built-in services from the built-in.json file
   */
  loadBuiltInServices() {
    const builtInConfigPath = path.join(__dirname, '..', 'built-in.json');
    if (fs.existsSync(builtInConfigPath)) {
      try {
        const builtInConfig = JSON.parse(fs.readFileSync(builtInConfigPath, 'utf8'));
        if (builtInConfig.builtInServices) {
          console.log('ConfigurationManager: Loading built-in MCP services:', Object.keys(builtInConfig.builtInServices));
          
          // Merge built-in services with user-configured services
          for (const [name, service] of Object.entries(builtInConfig.builtInServices)) {
            if (!this.config.mcpServers[name]) {
              this.config.mcpServers[name] = service;
              console.log(`ConfigurationManager: Added built-in service: ${name}`);
            }
          }
        }
      } catch (error) {
        console.error('ConfigurationManager: Error loading built-in services:', error);
      }
    } else {
      console.log('ConfigurationManager: No built-in.json file found');
    }
  }

  /**
   * Ensure the desktop-commander server is always available
   */
  ensureDesktopCommanderAvailable() {
    if (!this.config.mcpServers['desktop-commander']) {
      console.log('ConfigurationManager: Adding default desktop-commander configuration');
      this.config.mcpServers['desktop-commander'] = {
        command: 'npx',
        args: ['@wonderwhy-er/desktop-commander@latest'],
        description: 'Access and manipulate files on the local system',
        autoStart: false
      };
    }
  }

  /**
   * Load cached tools from Electron Store
   */
  loadCachedTools() {
    const cachedTools = this.store.get('cachedTools', {});
    
    // Assign to our cached tools object
    this.cachedTools = cachedTools;
    
    // Add cached tools to server configs
    for (const [serverName, serverConfig] of Object.entries(this.config.mcpServers)) {
      if (cachedTools[serverName]) {
        console.log(`ConfigurationManager: Found ${cachedTools[serverName].length} cached tools for ${serverName}`);
        serverConfig.cached_tools = cachedTools[serverName];
      } else {
        console.log(`ConfigurationManager: No cached tools found for ${serverName}`);
      }
    }
  }

  /**
   * Save cached tools to Electron Store
   * @param {Object} tools - The tools to save
   */
  saveCachedTools(tools) {
    try {
      console.log(`ConfigurationManager: Saving cached tools to Electron Store`);
      
      // Store the tools
      this.cachedTools = tools;
      this.store.set('cachedTools', tools);
      
      // Also update MCP settings
      const settings = this.store.get();
      settings.cachedTools = tools;
      this.store.set(settings);
      
      console.log('ConfigurationManager: Saved cached tools to Electron Store');
    } catch (error) {
      console.error('ConfigurationManager: Error saving cached tools:', error);
    }
  }

  /**
   * Get the configuration for a specific server
   * @param {string} serverName - The name of the server
   * @returns {Object|null} The server configuration or null if not found
   */
  getServerConfig(serverName) {
    return this.config.mcpServers[serverName] || null;
  }

  /**
   * Get all server configs
   * @returns {Object} Map of server names to configurations
   */
  getAllServerConfigs() {
    return this.config.mcpServers;
  }

  /**
   * Get the cached tools for a specific server
   * @param {string} serverName - The name of the server
   * @returns {Array} Array of cached tools
   */
  getCachedToolsForServer(serverName) {
    return this.cachedTools[serverName] || [];
  }

  /**
   * Get all cached tools
   * @returns {Object} Map of server names to cached tools
   */
  getAllCachedTools() {
    return this.cachedTools;
  }

  /**
   * Update cached tools for a server
   * @param {string} serverName - The name of the server
   * @param {Array} tools - The tools to cache
   */
  updateCachedToolsForServer(serverName, tools) {
    this.cachedTools[serverName] = tools;
    this.saveCachedTools(this.cachedTools);
  }
}

module.exports = new ConfigurationManager();