/**
 * Prompt Composer Service - Electron Main Process
 * 
 * Uses system-prompt-composer npm package (native NAPI-RS bindings)
 */

const { ipcMain } = require('electron');
const path = require('path');

// Optional import - will be loaded dynamically
let systemPromptComposer = null;

class PromptComposerService {
  constructor() {
    this.isInitialized = false;
    this.status = null;
  }

  async initialize() {
    console.log('PromptComposerService initialization started');
    
    try {
      // Try to dynamically import system-prompt-composer
      try {
        systemPromptComposer = require('system-prompt-composer');
        console.log('✅ system-prompt-composer package loaded successfully');
      } catch (importError) {
        console.log('📦 system-prompt-composer package not available - using fallback mode');
        console.log('   To enable enhanced prompts: npm install system-prompt-composer');
        systemPromptComposer = null;
      }
      
      if (systemPromptComposer) {
        // Get status from the npm package
        this.status = await systemPromptComposer.getStatus();
        this.isInitialized = true;
        
        if (this.status.available) {
          console.log('✅ prompt-composer available - enhanced prompts enabled');
          console.log(`   Domains: ${this.status.domains.join(', ')}`);
          console.log(`   Behaviors: ${this.status.behaviors.join(', ')}`);
        } else {
          console.log('⚠️  prompt-composer not available - using fallback prompts');
          console.log('   Install with: pip install prompt-composer');
        }
      } else {
        // Package not available - set up fallback status
        this.status = {
          available: false,
          domains: [],
          behaviors: [],
          version: 'fallback'
        };
        this.isInitialized = true;
        console.log('📝 Using basic fallback prompts');
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
        if (systemPromptComposer && fs.existsSync(localPromptsDir)) {
          console.log('📁 Using local prompts directory:', localPromptsDir);
          // Use native function directly with JSON string
          const requestJson = JSON.stringify(request);
          const responseJson = systemPromptComposer.composeSystemPromptWithCustomDir(requestJson, localPromptsDir);
          response = JSON.parse(responseJson);
        } else if (systemPromptComposer) {
          console.log('📦 Using built-in prompts');
          response = await systemPromptComposer.composeSystemPrompt(request);
        } else {
          console.log('📝 Using basic fallback prompt (system-prompt-composer not available)');
          response = {
            system_prompt: this.generateBasicFallbackPrompt(request),
            source: 'fallback',
            fallback: true,
            version: '1.0.0-fallback'
          };
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

  generateBasicFallbackPrompt(request) {
    // Generate a basic but useful prompt when system-prompt-composer isn't available
    let prompt = 'You are a helpful AI assistant.';
    
    // Add MCP tool awareness if tools are available
    if (request.mcp_config?.mcpServers) {
      const servers = Object.keys(request.mcp_config.mcpServers);
      if (servers.length > 0) {
        prompt += `\n\nYou have access to the following tools: ${servers.join(', ')}.`;
        prompt += ' Use these tools when they would help accomplish the user\'s request.';
      }
    }
    
    // Add basic domain guidance based on user prompt
    const userPrompt = request.user_prompt?.toLowerCase() || '';
    if (userPrompt.includes('code') || userPrompt.includes('program')) {
      prompt += '\n\nFor coding tasks, write clear, well-commented code and explain your approach.';
    }
    if (userPrompt.includes('file') || userPrompt.includes('directory')) {
      prompt += '\n\nFor file operations, use absolute paths and confirm actions before making changes.';
    }
    if (userPrompt.includes('analyze') || userPrompt.includes('data')) {
      prompt += '\n\nFor analysis tasks, be thorough and provide clear insights with supporting evidence.';
    }
    
    return prompt;
  }
}

module.exports = new PromptComposerService();
