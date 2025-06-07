const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
  'electron', {
    // API for communicating with the main process
    ollamaApi: {
      // List available models
      listModels: () => ipcRenderer.invoke('ollama:list-models'),
      
      // Set the Ollama host
      setHost: (host) => ipcRenderer.invoke('ollama:set-host', host),
      
      // Generate titles (non-streaming, for short requests only)
      generateTitle: (model, messages, options) => ipcRenderer.invoke('ollama:generate-title', model, messages, options),
      
      // Stream chat responses
      streamChat: (model, messages, options, callback) => {
        // Create a unique channel id for this streaming request
        const channelId = Date.now().toString();
        
        // Set up the listener for stream responses
        const streamListener = (event, responseChunk) => {
          if (responseChunk.done) {
            ipcRenderer.removeListener(`ollama:stream-response:${channelId}`, streamListener);
            callback({ done: true });
          } else {
            callback(responseChunk);
          }
        };
        
        // Register the listener
        ipcRenderer.on(`ollama:stream-response:${channelId}`, streamListener);
        
        // Start the stream
        ipcRenderer.invoke('ollama:stream-chat', channelId, model, messages, options);
        
        // Return a function to cancel the stream
        return () => {
          ipcRenderer.invoke('ollama:cancel-stream', channelId);
          ipcRenderer.removeListener(`ollama:stream-response:${channelId}`, streamListener);
        };
      },
      
      // Pull a model
      pullModel: (model) => ipcRenderer.invoke('ollama:pull-model', model)
    },
    
    // MCP API will be added here
    mcpApi: {
      // List available MCP tools
      listTools: () => {
        console.debug('Renderer: Calling MCP listTools');
        return ipcRenderer.invoke('mcp:list-tools')
          .then(result => {
            console.debug('Renderer: MCP listTools result:', result);
            return result;
          })
          .catch(error => {
            console.error('Renderer: MCP listTools error:', error);
            throw error;
          });
      },
      
      // Get cached tools discovered during initialization
      getCachedTools: () => {
        console.debug('Renderer: Getting cached MCP tools');
        return ipcRenderer.invoke('mcp:get-cached-tools')
          .then(result => {
            console.debug('Renderer: Cached MCP tools:', result);
            return result;
          })
          .catch(error => {
            console.error('Renderer: Error getting cached MCP tools:', error);
            throw error;
          });
      },
      
      // Call an MCP tool
      callTool: (toolName, args) => {
        console.debug(`Renderer: Calling MCP tool ${toolName} with args:`, args);
        return ipcRenderer.invoke('mcp:call-tool', toolName, args)
          .then(result => {
            console.debug(`Renderer: MCP tool ${toolName} result:`, result);
            return result;
          })
          .catch(error => {
            console.error(`Renderer: MCP tool ${toolName} error:`, error);
            throw error;
          });
      }
    },
    
    // App control
    app: {
      minimize: () => ipcRenderer.invoke('app:minimize'),
      maximize: () => ipcRenderer.invoke('app:maximize'),
      close: () => ipcRenderer.invoke('app:close'),
      // Settings management
      getSettings: () => ipcRenderer.invoke('app:get-settings'),
      saveSettings: (settings) => ipcRenderer.invoke('app:save-settings', settings),
      // MCP config management
      readMcpConfig: () => ipcRenderer.invoke('app:read-mcp-config'),
      // Get all discovered tools
      getDiscoveredTools: () => ipcRenderer.invoke('app:get-discovered-tools')
    }
  }
);