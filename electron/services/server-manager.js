/**
 * ServerManager
 * 
 * Responsible for starting, stopping, and managing MCP servers and clients
 */

const { spawn } = require('child_process');
const { MCPClient } = require('mcp-client');
const configManager = require('./configuration-manager');

class ServerManager {
  /**
   * Creates a new ServerManager
   */
  constructor() {
    this.mcpProcesses = {};
    this.mcpClients = {};
  }

  /**
   * Start an MCP server and connect client
   * @param {string} serverName - The name of the server to start
   * @returns {Promise<boolean>} True if successful, false otherwise
   */
  async startServer(serverName) {
    console.log(`ServerManager: startServer called for ${serverName}`);
    
    const serverConfig = configManager.getServerConfig(serverName);
    if (!serverConfig) {
      console.error(`ServerManager: Unknown MCP server: ${serverName}`);
      return false;
    }
    
    // Skip if this is an internal service
    if (serverConfig.command === 'internal') {
      console.log(`ServerManager: ${serverName} is an internal service, skipping server start`);
      return true;
    }
    
    if (this.mcpProcesses[serverName]) {
      console.log(`ServerManager: MCP server ${serverName} is already running`);
      return true;
    }
    
    try {
      console.log(`ServerManager: Starting MCP server: ${serverName} with command:`, serverConfig.command, serverConfig.args || []);
      
      // For desktop-commander, we need to add the MCP_ENABLED env var
      // Create a new environment object based on current environment
      const envVars = { ...process.env };
      
      if (serverName === 'desktop-commander' || 
          (serverConfig.command === 'npx' && (serverConfig.args || []).some(arg => arg.includes('desktop-commander')))) {
        console.log(`ServerManager: Setting MCP_ENABLED=true for desktop-commander`);
        envVars.MCP_ENABLED = 'true';
      }
      
      // Start the server process
      const spawnedProcess = spawn(serverConfig.command, serverConfig.args || [], {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true,
        env: envVars
      });
      
      this.mcpProcesses[serverName] = spawnedProcess;
      
      console.log(`ServerManager: Started MCP server: ${serverName} with PID: ${spawnedProcess.pid}`);
      
      // Handle process events
      spawnedProcess.on('error', (error) => {
        console.error(`ServerManager: Error starting MCP server ${serverName}:`, error);
        delete this.mcpProcesses[serverName];
      });
      
      spawnedProcess.on('exit', (code) => {
        console.log(`ServerManager: MCP server ${serverName} exited with code ${code}`);
        delete this.mcpProcesses[serverName];
        
        // Also clean up the client
        if (this.mcpClients[serverName]) {
          this.mcpClients[serverName].close().catch(err => {
            console.error(`ServerManager: Error closing client for ${serverName}:`, err);
          });
          delete this.mcpClients[serverName];
        }
      });
      
      // Log server output
      spawnedProcess.stdout.on('data', (data) => {
        console.log(`[${serverName}] ${data.toString().trim()}`);
      });
      
      spawnedProcess.stderr.on('data', (data) => {
        console.error(`[${serverName}] ${data.toString().trim()}`);
      });
      
      // Wait a bit for the server to start
      console.log(`ServerManager: Waiting for server ${serverName} to initialize...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Try to connect MCP client
      console.log(`ServerManager: Attempting to connect MCP client for ${serverName}`);
      const connected = await this.connectClient(serverName);
      
      if (connected) {
        console.log(`ServerManager: Successfully connected MCP client for ${serverName}`);
      } else {
        console.log(`ServerManager: Failed to connect MCP client for ${serverName}`);
      }
      
      return true;
    } catch (error) {
      console.error(`ServerManager: Error starting MCP server ${serverName}:`, error);
      return false;
    }
  }

  /**
   * Connect an MCP client for a server
   * @param {string} serverName - The name of the server to connect to
   * @returns {Promise<boolean>} True if successful, false otherwise
   */
  async connectClient(serverName) {
    console.log(`ServerManager: connectClient called for ${serverName}`);
    
    const serverConfig = configManager.getServerConfig(serverName);
    if (!serverConfig) {
      console.error(`ServerManager: Server ${serverName} not found`);
      return false;
    }
    
    // Skip for internal services
    if (serverConfig.command === 'internal') {
      console.log(`ServerManager: ${serverName} is an internal service, skipping client connection`);
      return true;
    }
    
    try {
      // Infer protocol settings from the server configuration
      const protocol = this.inferProtocolSettings(serverName, serverConfig);
      
      // Create a new MCP client
      console.log(`ServerManager: Creating new MCP client for ${serverName}`);
      const client = new MCPClient({
        name: `lit-desktop-${serverName}`,
        version: '1.0.0',
      });
      
      console.log(`ServerManager: Connecting to ${serverName} using ${protocol.type} protocol`);
      
      // Connect based on protocol type
      if (protocol.type === 'stdio') {
        console.log(`ServerManager: Connecting to ${serverName} using stdio with command:`, serverConfig.command, serverConfig.args);
        await client.connect({
          type: 'stdio',
          command: serverConfig.command,
          args: serverConfig.args || [],
          env: { ...(protocol.env || {}), MCP_ENABLED: 'true' },
          cwd: process.cwd(),
        });
        console.log(`ServerManager: Stdio connection established for ${serverName}`);
      } else if (protocol.type === 'sse') {
        console.log(`ServerManager: Connecting to ${serverName} using SSE at URL: ${protocol.url}`);
        await client.connect({
          type: 'sse',
          url: protocol.url,
        });
        console.log(`ServerManager: SSE connection established for ${serverName}`);
      } else {
        console.error(`ServerManager: Unknown protocol type: ${protocol.type}`);
        return false;
      }
      
      // Test connection with a timeout
      try {
        console.log(`ServerManager: Pinging ${serverName} to test connection...`);
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Ping timeout')), 5000);
        });
        
        const pingPromise = client.ping();
        
        await Promise.race([pingPromise, timeoutPromise]);
        console.log(`ServerManager: Successfully pinged MCP server: ${serverName}`);
      } catch (error) {
        console.error(`ServerManager: Error pinging MCP server ${serverName}:`, error);
        console.log(`ServerManager: Closing failed client connection for ${serverName}`);
        try {
          await client.close();
        } catch (closeError) {
          console.error(`ServerManager: Error closing client for ${serverName}:`, closeError);
        }
        return false;
      }
      
      // Store the client
      this.mcpClients[serverName] = client;
      
      // Set up logging event handler
      client.on('loggingMessage', (message) => {
        console.log(`[${serverName}] ${JSON.stringify(message)}`);
      });
      
      return true;
    } catch (error) {
      console.error(`ServerManager: Error connecting to MCP server ${serverName}:`, error);
      return false;
    }
  }

  /**
   * Infer protocol type and settings from the server config
   * @param {string} serverName - The name of the server
   * @param {Object} serverConfig - The server configuration
   * @returns {Object} The protocol settings
   */
  inferProtocolSettings(serverName, serverConfig) {
    console.log(`ServerManager: Inferring protocol settings for ${serverName}`);
    
    // Default to assuming most servers use stdio
    let protocol = {
      type: 'stdio',
      env: {}
    };
    
    const command = serverConfig.command || '';
    const args = serverConfig.args || [];
    
    console.log(`ServerManager: Server command: ${command}, args:`, args);
    
    // For desktop-commander
    if (serverName === 'desktop-commander' || (command === 'npx' && args.some(arg => arg.includes('desktop-commander')))) {
      console.log(`ServerManager: Detected desktop-commander, using stdio protocol with MCP_ENABLED=true`);
      protocol = {
        type: 'stdio',
        env: { MCP_ENABLED: 'true' }
      };
    }
    // For Python-based servers, default to stdio unless --port is specified
    else if (command === 'python' || command === 'python3' || command === 'uv') {
      const portIndex = args.indexOf('--port');
      if (portIndex !== -1 && portIndex < args.length - 1) {
        // Only use SSE if --port is explicitly specified
        const port = args[portIndex + 1];
        console.log(`ServerManager: Detected Python server with --port, using SSE protocol with port ${port}`);
        protocol = {
          type: 'sse',
          url: `http://localhost:${port}/sse`
        };
      } else {
        // Default to stdio for Python servers
        console.log(`ServerManager: Detected Python server, using stdio protocol`);
        protocol = {
          type: 'stdio',
          env: {}
        };
      }
    }
    
    console.log(`ServerManager: Inferred protocol for ${serverName}:`, protocol);
    return protocol;
  }

  /**
   * Stop an MCP server
   * @param {string} serverName - The name of the server to stop
   * @returns {Promise<boolean>} True if successful, false otherwise
   */
  async stopServer(serverName) {
    console.log(`ServerManager: stopServer called for ${serverName}`);
    
    const serverConfig = configManager.getServerConfig(serverName);
    
    // Skip for internal services
    if (serverConfig && serverConfig.command === 'internal') {
      console.log(`ServerManager: ${serverName} is an internal service, no need to stop`);
      return true;
    }
    
    // Close the MCP client if it exists
    if (this.mcpClients[serverName]) {
      try {
        console.log(`ServerManager: Closing MCP client for ${serverName}`);
        await this.mcpClients[serverName].close();
        delete this.mcpClients[serverName];
        console.log(`ServerManager: Closed MCP client for ${serverName}`);
      } catch (error) {
        console.error(`ServerManager: Error closing MCP client for ${serverName}:`, error);
      }
    }
    
    // Stop the process
    const serverProcess = this.mcpProcesses[serverName];
    if (!serverProcess) {
      console.log(`ServerManager: MCP server ${serverName} is not running`);
      return false;
    }
    
    try {
      console.log(`ServerManager: Killing MCP server process for ${serverName}`);
      serverProcess.kill();
      delete this.mcpProcesses[serverName];
      console.log(`ServerManager: Stopped MCP server: ${serverName}`);
      return true;
    } catch (error) {
      console.error(`ServerManager: Error stopping MCP server ${serverName}:`, error);
      return false;
    }
  }
  
  /**
   * Check if a server is running
   * @param {string} serverName - The name of the server to check
   * @returns {boolean} True if the server is running, false otherwise
   */
  isServerRunning(serverName) {
    return !!this.mcpProcesses[serverName];
  }
  
  /**
   * Check if a client is connected for a server
   * @param {string} serverName - The name of the server to check
   * @returns {boolean} True if the client is connected, false otherwise
   */
  isClientConnected(serverName) {
    return !!this.mcpClients[serverName];
  }
  
  /**
   * Get the MCP client for a server
   * @param {string} serverName - The name of the server
   * @returns {Object|null} The MCP client or null if not found
   */
  getClient(serverName) {
    return this.mcpClients[serverName] || null;
  }
  
  /**
   * Start all servers that have autoStart set to true
   */
  async startAutoStartServers() {
    const serverConfigs = configManager.getAllServerConfigs();
    
    for (const [serverName, serverConfig] of Object.entries(serverConfigs)) {
      if (serverConfig.autoStart && serverConfig.command !== 'internal') {
        console.log(`ServerManager: Auto-starting server: ${serverName}`);
        await this.startServer(serverName);
      }
    }
  }
  
  /**
   * Clean up all servers and clients
   */
  async cleanup() {
    console.log('ServerManager: cleanup called');
    
    // Close all MCP clients
    for (const [serverName, client] of Object.entries(this.mcpClients)) {
      try {
        console.log(`ServerManager: Closing MCP client for ${serverName}`);
        await client.close();
        console.log(`ServerManager: Closed MCP client for ${serverName}`);
      } catch (error) {
        console.error(`ServerManager: Error closing MCP client for ${serverName}:`, error);
      }
    }
    
    // Stop all running MCP servers
    for (const serverName of Object.keys(this.mcpProcesses)) {
      console.log(`ServerManager: Stopping MCP server: ${serverName}`);
      await this.stopServer(serverName);
    }
    
    console.log('ServerManager: cleanup complete');
  }
}

module.exports = new ServerManager();