/**
 * ToolExecutor
 * 
 * Responsible for executing tool calls
 */

const path = require('path');
const fs = require('fs');
const configManager = require('./configuration-manager');
const serverManager = require('./server-manager');
const toolRegistry = require('./tool-registry');

class ToolExecutor {
  /**
   * Creates a new ToolExecutor
   */
  constructor() {
  }

  /**
   * Call an MCP tool by name with arguments
   * @param {string} fullToolName - The full tool name (serverName.toolName)
   * @param {Object} args - The arguments to pass to the tool
   * @returns {Promise<Object>} The result of the tool execution
   */
  async callTool(fullToolName, args) {
    try {
      // Parse the tool name to get server and tool
      const [serverName, toolName] = fullToolName.split('.');
      
      if (!serverName || !toolName) {
        throw new Error(`Invalid tool name: ${fullToolName}. Expected format: serverName.toolName`);
      }
      
      return await this.executeToolCall(serverName, toolName, args);
    } catch (error) {
      console.error(`ToolExecutor: Error calling tool ${fullToolName}:`, error);
      throw error;
    }
  }

  /**
   * Execute a tool call on a specific server
   * @param {string} serverName - The name of the server
   * @param {string} toolName - The name of the tool
   * @param {Object} args - The arguments to pass to the tool
   * @returns {Promise<Object>} The result of the tool execution
   */
  async executeToolCall(serverName, toolName, args) {
    console.log(`ToolExecutor: executeToolCall called for ${serverName}.${toolName}`);
    
    // Check if the server exists
    const serverConfig = configManager.getServerConfig(serverName);
    if (!serverConfig) {
      console.error(`ToolExecutor: Unknown MCP server: ${serverName}`);
      throw new Error(`Unknown MCP server: ${serverName}`);
    }
    
    // Handle internal services
    if (serverConfig.command === 'internal') {
      // Special handling for image-renderer
      // if (serverName === 'image-renderer') {
      //   const imageRendererService = require('../image-renderer-service');
      //   return await imageRendererService.callTool(toolName, args);
      // }
      
      // Add other internal services here as needed
      
      throw new Error(`Unsupported internal service: ${serverName}`);
    }
    
    try {
      // Start the server if it's not already running
      if (!serverManager.isServerRunning(serverName)) {
        await serverManager.startServer(serverName);
      }
      
      // If we have an MCP client for this server, use it
      if (serverManager.isClientConnected(serverName)) {
        try {
          console.log(`ToolExecutor: Using MCP client for ${serverName} to call ${toolName}`);
          
          const client = serverManager.getClient(serverName);
          const result = await client.callTool({
            name: toolName,
            arguments: args
          });
          
          console.log(`ToolExecutor: Successfully called ${serverName}.${toolName} with MCP client`);
          return result;
        } catch (error) {
          console.error(`ToolExecutor: Error calling tool ${serverName}.${toolName} with MCP client:`, error);
          // Fall back to hardcoded implementations if we have them
          console.log(`ToolExecutor: Falling back to hardcoded implementation for ${serverName}.${toolName}`);
        }
      } else {
        console.log(`ToolExecutor: No MCP client available for ${serverName}, using hardcoded implementation`);
      }
      
      // Special handling for desktop-commander
      if (serverName === 'desktop-commander') {
        console.log(`ToolExecutor: Processing desktop-commander tool: ${toolName}`);
        
        switch (toolName) {
          case 'read_file':
            if (!args.path) {
              console.error('ToolExecutor: Missing required argument: path');
              throw new Error('Missing required argument: path');
            }
            console.log(`ToolExecutor: Executing read_file with path: ${args.path}`);
            return this.handleReadFile(args.path);
          case 'write_file':
            if (!args.path || args.content === undefined) {
              console.error(`ToolExecutor: Missing required arguments for write_file. Got: ${JSON.stringify(args)}`);
              throw new Error('Missing required arguments: path and content');
            }
            console.log(`ToolExecutor: Executing write_file with path: ${args.path}`);
            return this.handleWriteFile(args.path, args.content);
          case 'list_directory':
            if (!args.path) {
              console.error('ToolExecutor: Missing required argument: path');
              throw new Error('Missing required argument: path');
            }
            console.log(`ToolExecutor: Executing list_directory with path: ${args.path}`);
            return this.handleListDirectory(args.path);
          default:
            console.error(`ToolExecutor: Unknown desktop-commander tool: ${toolName}`);
            throw new Error(`Unknown desktop-commander tool: ${toolName}`);
        }
      }
      
      // For any other servers, we don't have a fallback implementation
      console.error(`ToolExecutor: No implementation available for ${serverName}.${toolName}`);
      throw new Error(`Tool ${serverName}.${toolName} is not implemented and no MCP client is connected`);
    } catch (error) {
      console.error(`ToolExecutor: Error in executeToolCall for ${serverName}.${toolName}:`, error);
      throw error;
    }
  }

  /**
   * Handle the read_file tool
   * @param {string} filePath - The path to the file to read
   * @returns {Promise<Object>} The result of the operation
   */
  async handleReadFile(filePath) {
    try {
      console.log(`ToolExecutor: Reading file: ${filePath}`);
      
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }
      
      const content = await fs.promises.readFile(filePath, 'utf8');
      console.log(`ToolExecutor: Successfully read file: ${filePath}`);
      return {
        success: true,
        content
      };
    } catch (error) {
      console.error('ToolExecutor: Error reading file:', error);
      throw error;
    }
  }

  /**
   * Handle the write_file tool
   * @param {string} filePath - The path to the file to write
   * @param {string} content - The content to write to the file
   * @returns {Promise<Object>} The result of the operation
   */
  async handleWriteFile(filePath, content) {
    try {
      console.log(`ToolExecutor: Writing file: ${filePath}`);
      
      // Ensure the directory exists
      const dir = path.dirname(filePath);
      await fs.promises.mkdir(dir, { recursive: true });
      
      // Write the file
      await fs.promises.writeFile(filePath, content, 'utf8');
      
      console.log(`ToolExecutor: Successfully wrote file: ${filePath}`);
      return {
        success: true,
        path: filePath
      };
    } catch (error) {
      console.error('ToolExecutor: Error writing file:', error);
      throw error;
    }
  }

  /**
   * Handle the list_directory tool
   * @param {string} dirPath - The path to the directory to list
   * @returns {Promise<Object>} The result of the operation
   */
  async handleListDirectory(dirPath) {
    try {
      console.log(`ToolExecutor: Listing directory: ${dirPath}`);
      
      if (!fs.existsSync(dirPath)) {
        throw new Error(`Directory not found: ${dirPath}`);
      }
      
      const files = await fs.promises.readdir(dirPath);
      
      // Get file info for each entry
      const fileInfo = await Promise.all(files.map(async (file) => {
        const fullPath = path.join(dirPath, file);
        const stats = await fs.promises.stat(fullPath);
        
        return {
          name: file,
          path: fullPath,
          isDirectory: stats.isDirectory(),
          size: stats.size,
          modified: stats.mtime
        };
      }));
      
      console.log(`ToolExecutor: Successfully listed directory: ${dirPath} with ${fileInfo.length} entries`);
      return {
        success: true,
        path: dirPath,
        files: fileInfo
      };
    } catch (error) {
      console.error('ToolExecutor: Error listing directory:', error);
      throw error;
    }
  }
}

module.exports = new ToolExecutor();