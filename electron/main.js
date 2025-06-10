const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const url = require('url');
const Store = require('electron-store');
const ollamaService = require('./ollama-service');
const mcpService = require('./mcp-service');
const promptComposerService = require('./prompt-composer-service');

// Keep a global reference of the window object
let mainWindow;

// Initialize settings store
const store = new Store({
  defaults: {
    ollamaHost: 'http://localhost:11434',
    defaultModel: 'llama3:latest',
    theme: 'system',
    fontSize: 14,
    mcpEnabled: true,
    mcpServers: { },
    windowBounds: { width: 1200, height: 800 }
  }
});

// Enable more verbose logging
function enableVerboseLogging() {
  // Override console.log to include timestamps
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;
  
  console.log = function() {
    const args = Array.from(arguments);
    originalLog.apply(console, [`[${new Date().toISOString()}] [LOG]`, ...args]);
  };
  
  console.error = function() {
    const args = Array.from(arguments);
    originalError.apply(console, [`[${new Date().toISOString()}] [ERROR]`, ...args]);
  };
  
  console.warn = function() {
    const args = Array.from(arguments);
    originalWarn.apply(console, [`[${new Date().toISOString()}] [WARN]`, ...args]);
  };
  
  console.log('Verbose logging enabled');
}

function createWindow() {
  // Get saved window dimensions
  const { width, height } = store.get('windowBounds') || { width: 1200, height: 800 };
  
  console.log(`Creating window with dimensions: ${width}x${height}`);
  
  // Create the browser window
  mainWindow = new BrowserWindow({
    width,
    height,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
      // Temporarily remove sandbox disabling to test
    },
    // webSecurity: false, // Temporarily comment out
    titleBarStyle: 'hidden', // Hidden title bar for custom styling
    frame: false, // Frameless window
    icon: path.join(__dirname, '..', 'src', 'assets', 'flame.png'),
    backgroundColor: '#ffffff' // Prevent white flash when app loads
  });

  // Load the index.html of the app
  let indexPath;
  
  if (process.env.NODE_ENV === 'development') {
    // In development, use the local development server
    indexPath = 'http://localhost:4201';
    console.log(`Loading app from development server: ${indexPath}`);
  } else {
    // In production, use the built files
    indexPath = url.format({
      pathname: path.join(__dirname, '../dist/index.html'),
      protocol: 'file:',
      slashes: true
    });
    console.log(`Loading app from: ${indexPath}`);
  }
  
  mainWindow.loadURL(indexPath);

  // Handle reload in development mode
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.on('did-fail-load', () => {
      console.log('Failed to load, attempting to reload...');
      setTimeout(() => {
        mainWindow.reload();
      }, 1000);
    });
  }

  // Open DevTools only in development mode or when explicitly enabled
  if (process.env.NODE_ENV === 'development' || process.env.OPEN_DEVTOOLS === 'true') {
    mainWindow.webContents.openDevTools();
    console.log('DevTools opened for debugging');
  }

  // Save window size on resize
  mainWindow.on('resize', () => {
    const { width, height } = mainWindow.getBounds();
    store.set('windowBounds', { width, height });
    // console.log(`Window resized to: ${width}x${height}`);
  });

  // Emitted when the window is closed
  mainWindow.on('closed', function() {
    console.log('Window closed');
    mainWindow = null;
  });
}

// Temporarily disable sandbox flags for testing
// app.commandLine.appendSwitch('--no-sandbox');
// app.commandLine.appendSwitch('--disable-dev-shm-usage');

// This method will be called when Electron has finished
// initialization and is ready to create browser windows
app.whenReady().then(async () => {
  try {
    // Enable verbose logging
    enableVerboseLogging();
    
    console.log('App ready, initializing services');
    
    // Initialize services
    const settings = store.store;
    console.log('Settings loaded:', settings);
    
    // Configure Ollama service
    console.log(`Setting Ollama host to: ${settings.ollamaHost}`);
    ollamaService.setHost(settings.ollamaHost);
    
    // Initialize MCP service - DISABLED for new MCPManager integration
    console.log('OLD MCP service disabled - using new MCPManager instead');
    // mcpService.initialize(settings);
    
    // Initialize Prompt Composer service
    console.log('Initializing Prompt Composer service');
    await promptComposerService.initialize();
    
    // Set up app control IPC handlers
    console.log('Setting up IPC handlers');
    setupAppHandlers();
    
    // Set up MCP compatibility handlers for new MCPManager
    console.log('Setting up MCP compatibility handlers');
    setupMCPCompatibilityHandlers();
    
    // Create the main window
    createWindow();
  } catch (error) {
    console.error('Error during initialization:', error);
  }
});

// Setup app control IPC handlers
function setupAppHandlers() {
  // App window controls
  ipcMain.handle('app:minimize', () => {
    if (mainWindow) mainWindow.minimize();
    return true;
  });
  
  ipcMain.handle('app:maximize', () => {
    if (mainWindow) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
    }
    return true;
  });
  
  ipcMain.handle('app:close', () => {
    if (mainWindow) mainWindow.close();
    return true;
  });
  
  // Settings management
  ipcMain.handle('app:get-settings', () => {
    const settings = store.store;
    return settings;
  });
  
  ipcMain.handle('app:save-settings', (event, settings) => {
    try {
      // Update Ollama host if changed
      if (settings.ollamaHost !== store.get('ollamaHost')) {
        ollamaService.setHost(settings.ollamaHost);
      }
      
      // Handle MCP changes - DISABLED for new MCPManager integration
      if (settings.mcpEnabled !== store.get('mcpEnabled')) {
        console.log('OLD MCP service change ignored - using new MCPManager instead');
      }
      
      // Save all settings
      store.set(settings);
      return true;
    } catch (error) {
      console.error('Error saving settings:', error);
      return false;
    }
  });
  
  // Read the actual MCP config file used by MCPManager
  ipcMain.handle('app:read-mcp-config', () => {
    try {
      const fs = require('fs');
      const path = require('path');
      const os = require('os');
      
      const configFile = path.join(os.homedir(), '.config', 'lit-desktop', 'mcp.json');
      
      if (fs.existsSync(configFile)) {
        const configContent = fs.readFileSync(configFile, 'utf8');
        return configContent;
      } else {
        // Return default config if file doesn't exist
        const defaultConfig = {
          mcpServers: {}
        };
        return JSON.stringify(defaultConfig, null, 2);
      }
    } catch (error) {
      console.error('Error reading mcp.json file:', error);
      // Return default config on error
      const defaultConfig = {
        mcpServers: {}
      };
      return JSON.stringify(defaultConfig, null, 2);
    }
  });
  
  // Get the discovered MCP tools directly
  ipcMain.handle('app:get-discovered-tools', () => {
    try {
      const allTools = mcpService.getAllTools();
      
      // Group tools by server
      const toolsByServer = {};
      
      allTools.forEach(tool => {
        const nameParts = tool.name.split('.');
        if (nameParts.length === 2) {
          const serverName = nameParts[0];
          const toolName = nameParts[1];
          
          if (!toolsByServer[serverName]) {
            toolsByServer[serverName] = [];
          }
          
          toolsByServer[serverName].push({
            name: toolName,
            description: tool.description,
            parameters: tool.parameters
          });
        }
      });
      
      return toolsByServer;
    } catch (error) {
      console.error('Error getting discovered tools:', error);
      return {};
    }
  });
}

// Quit when all windows are closed
app.on('window-all-closed', function() {
  console.log('All windows closed');
  
  // Clean up services
  console.log('Cleaning up MCP service');
  mcpService.cleanup();
  
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    console.log('Quitting app');
    app.quit();
  }
});

app.on('activate', function() {
  console.log('App activated');
  
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open
  if (mainWindow === null) {
    console.log('Creating new window on activate');
    createWindow();
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

// Periodic cleanup - less frequent to avoid interfering with active streams
setInterval(() => {
  if (ollamaService.cleanupExpiredStreams) {
    ollamaService.cleanupExpiredStreams();
  }
}, 5 * 60 * 1000); // Every 5 minutes (increased from 1)
// Setup MCP compatibility handlers for new MCPManager integration
function setupMCPCompatibilityHandlers() {
  console.log('Setting up MCP compatibility handlers for MCPManager');
  
  // Handle mcp:list-tools - route to MCPManager
  ipcMain.handle('mcp:list-tools', async () => {
    try {
      console.log('MCP Compatibility: mcp:list-tools called');
      
      // Get MCPManager from ollamaService
      const mcpManager = ollamaService.getMCPManager();
      if (!mcpManager) {
        console.error('MCP Compatibility: MCPManager not available');
        return [];
      }
      
      // Ensure clients are initialized
      await mcpManager.ensureUserMcpClients('desktop', 'user');
      
      // Get tool info and convert to expected format
      const toolInfo = mcpManager.getToolInfoForPrompt('user', 'desktop');
      
      console.log(`MCP Compatibility: Returning ${toolInfo.length} tools from MCPManager`);
      return toolInfo;
      
    } catch (error) {
      console.error('MCP Compatibility: Error in mcp:list-tools:', error);
      return [];
    }
  });
  
  // Handle mcp:get-cached-tools - route to MCPManager  
  ipcMain.handle('mcp:get-cached-tools', async () => {
    try {
      console.log('MCP Compatibility: mcp:get-cached-tools called');
      
      // Get MCPManager from ollamaService
      const mcpManager = ollamaService.getMCPManager();
      if (!mcpManager) {
        console.error('MCP Compatibility: MCPManager not available');
        return {};
      }
      
      // Get tool info and group by server
      const toolInfo = mcpManager.getToolInfoForPrompt('user', 'desktop');
      const toolsByServer = {};
      
      for (const tool of toolInfo) {
        const [serverName, toolName] = tool.name.split('.');
        if (!toolsByServer[serverName]) {
          toolsByServer[serverName] = [];
        }
        toolsByServer[serverName].push({
          name: toolName,
          description: tool.description,
          parameters: tool.parameters
        });
      }
      
      console.log(`MCP Compatibility: Returning tools grouped by server:`, Object.keys(toolsByServer));
      return toolsByServer;
      
    } catch (error) {
      console.error('MCP Compatibility: Error in mcp:get-cached-tools:', error);
      return {};
    }
  });
  
  console.log('MCP compatibility handlers registered');
}
