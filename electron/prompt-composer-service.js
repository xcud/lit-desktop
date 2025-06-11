/**
 * Prompt Composer Service - Electron Main Process
 * 
 * Uses system-prompt-composer npm package (native NAPI-RS bindings)
 */

const { ipcMain } = require('electron');
const { composeSystemPrompt, composeSystemPromptWithCustomDir, getStatus } = require('system-prompt-composer');
const path = require('path');

class PromptComposerService {
  constructor() {
    this.isInitialized = false;
    this.status = null;
  }

  async initialize() {
    console.log('PromptComposerService initialization started');
    
    try {
      // Get status from the npm package
      this.status = await getStatus();
      this.isInitialized = true;
      
      if (this.status.available) {
        console.log('✅ prompt-composer available - enhanced prompts enabled');
        console.log(`   Domains: ${this.status.domains.join(', ')}`);
        console.log(`   Behaviors: ${this.status.behaviors.join(', ')}`);
      } else {
        console.log('⚠️  prompt-composer not available - using fallback prompts');
        console.log('   Install with: pip install prompt-composer');
      }
      
      // Setup IPC handlers
      this.setupIpcHandlers();
      
      console.log('PromptComposerService initialization complete');
    } catch (error) {
      console.error('Failed to initialize PromptComposerService:', error);
      this.isInitialized = false;
      
      // Still setup IPC handlers for fallback behavior
      this.setupIpcHandlers();
    }
  }

  setupIpcHandlers() {
    // Only setup IPC handlers if we're in an Electron environment
    if (!ipcMain || typeof ipcMain.handle !== 'function') {
      return;
    }

    // Generate system prompt
    ipcMain.handle('prompt-composer:generate', async (event, request) => {
      try {
        // Ensure MCP config has the required fields for each server
        if (request.mcp_config?.mcpServers) {
          for (const [serverName, serverConfig] of Object.entries(request.mcp_config.mcpServers)) {
            // Ensure all required fields are present
            if (!serverConfig.name) {
              serverConfig.name = serverName;
            }
            if (!serverConfig.command) {
              serverConfig.command = serverConfig.command || 'unknown';
            }
            if (!serverConfig.args) {
              serverConfig.args = serverConfig.args || [];
            }
          }
        }
        
        // Use local prompts directory if it exists, otherwise fall back to built-in
        const localPromptsDir = path.join(__dirname, '../prompts');
        const fs = require('fs');
        
        let response;
        if (fs.existsSync(localPromptsDir)) {
          console.log('📁 Using local prompts directory:', localPromptsDir);
          // Use native function directly with JSON string
          const requestJson = JSON.stringify(request);
          const responseJson = composeSystemPromptWithCustomDir(requestJson, localPromptsDir);
          response = JSON.parse(responseJson);
        } else {
          console.log('📦 Using built-in prompts');
          response = await composeSystemPrompt(request);
        }
        
        if (response.fallback) {
          console.log('Using fallback prompt - consider installing prompt-composer');
        } else {
          console.log(`✅ Generated ${response.system_prompt.length} character enhanced prompt`);
        }
        
        return response;
      } catch (error) {
        console.error('Error generating system prompt:', error);
        
        // Return a basic fallback if the npm package fails
        return {
          system_prompt: 'You are a helpful AI assistant.',
          source: 'error',
          error: true,
          message: error.message
        };
      }
    });

    // Check if prompt composer is available
    ipcMain.handle('prompt-composer:is-available', () => {
      return this.status?.available || false;
    });

    // Get detailed status
    ipcMain.handle('prompt-composer:get-status', () => {
      return {
        initialized: this.isInitialized,
        ...this.status
      };
    });
  }
}

module.exports = new PromptComposerService();
