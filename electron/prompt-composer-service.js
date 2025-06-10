/**
 * Prompt Composer Service - Electron Main Process
 * 
 * MODIFIED TO USE PIP-INSTALLED PROMPT-COMPOSER
 * Production Python: /tmp/prompt_composer_production_test/bin/python
 */

const { spawn } = require('child_process');
const path = require('path');
const { ipcMain } = require('electron');

class PromptComposerService {
  constructor() {
    // Use the production venv Python with pip-installed prompt-composer
    this.promptComposerPath = '/tmp/prompt_composer_production_test/bin/python';
    this.isInitialized = false;
    console.log('PromptComposerService constructor - using production venv');
  }

  async initialize() {
    console.log('PromptComposerService initialization with production venv');
    
    try {
      // Test that prompt-composer is available in the production venv
      await this.testPromptComposer();
      this.isInitialized = true;
      
      // Setup IPC handlers
      this.setupIpcHandlers();
      
      console.log('PromptComposerService initialization complete - production venv working');
    } catch (error) {
      console.error('Failed to initialize PromptComposerService with production venv:', error);
      this.isInitialized = false;
      
      // Still setup IPC handlers for fallback behavior
      this.setupIpcHandlers();
    }
  }

  async testPromptComposer() {
    return new Promise((resolve, reject) => {
      const python = spawn(this.promptComposerPath, ['-c', 'import prompt_composer; print("OK")']);
      
      let output = '';
      let error = '';
      
      python.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      python.stderr.on('data', (data) => {
        error += data.toString();
      });
      
      python.on('close', (code) => {
        if (code === 0 && output.trim() === 'OK') {
          console.log('✅ prompt-composer available in production venv');
          resolve();
        } else {
          console.error('❌ prompt-composer not available in production venv:', error);
          reject(new Error(`prompt-composer not available: ${error}`));
        }
      });
    });
  }

  setupIpcHandlers() {
    console.log('Setting up PromptComposer IPC handlers for production venv');

    // Generate system prompt
    ipcMain.handle('prompt-composer:generate', async (event, request) => {
      try {
        console.log('IPC: prompt-composer:generate called (production venv)');
        return await this.generateSystemPrompt(request);
      } catch (error) {
        console.error('Error generating system prompt:', error);
        // Return fallback prompt instead of throwing
        return this.getFallbackPrompt(request);
      }
    });

    // Check if prompt composer is available
    ipcMain.handle('prompt-composer:is-available', () => {
      return this.isInitialized;
    });
  }

  async generateSystemPrompt(request) {
    if (!this.isInitialized) {
      console.log('PromptComposer not initialized, using fallback');
      return this.getFallbackPrompt(request);
    }

    return new Promise((resolve, reject) => {
      console.log('Generating system prompt with production venv prompt-composer');
      
      // Ensure MCP config has the required 'name' field for each server
      if (request.mcp_config && request.mcp_config.mcpServers) {
        for (const [serverName, serverConfig] of Object.entries(request.mcp_config.mcpServers)) {
          if (!serverConfig.name) {
            serverConfig.name = serverName;
          }
        }
      }
      
      // Use the pip-installed prompt-composer (no directory changes needed!)
      const pythonScript = `
import json
import sys

try:
    # Import the pip-installed prompt-composer
    import prompt_composer
    
    # Read request from stdin
    request_json = sys.stdin.read()
    request = json.loads(request_json)
    
    # Generate system prompt using the package API
    response_json = prompt_composer.compose_system_prompt(json.dumps(request))
    response = json.loads(response_json)
    
    # Output result
    print(json.dumps(response))
    
except Exception as e:
    error_response = {
        "error": str(e),
        "system_prompt": ""
    }
    print(json.dumps(error_response))
`;

      const python = spawn(this.promptComposerPath, ['-c', pythonScript]);
      
      let output = '';
      let error = '';
      
      // Send request to Python process
      python.stdin.write(JSON.stringify(request));
      python.stdin.end();
      
      python.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      python.stderr.on('data', (data) => {
        error += data.toString();
      });
      
      python.on('close', (code) => {
        try {
          if (code === 0) {
            const response = JSON.parse(output.trim());
            if (response.error) {
              console.error('Prompt composer error:', response.error);
              resolve(this.getFallbackPrompt(request));
            } else {
              console.log('✅ System prompt generated successfully with production venv');
              resolve(response);
            }
          } else {
            console.error('Python process failed:', error);
            resolve(this.getFallbackPrompt(request));
          }
        } catch (parseError) {
          console.error('Failed to parse prompt composer response:', parseError);
          resolve(this.getFallbackPrompt(request));
        }
      });
    });
  }

  getFallbackPrompt(request) {
    console.log('Using enhanced fallback system prompt');
    
    let systemPrompt = '';
    const toolGuidance = [];
    
    // Extract available tools from MCP config
    if (request.mcp_config && request.mcp_config.mcpServers) {
      const servers = Object.keys(request.mcp_config.mcpServers);
      
      if (servers.length > 0) {
        systemPrompt += `You have access to tools from these MCP servers: ${servers.join(', ')}.\n\n`;
        
        // Add specific guidance based on available servers
        if (servers.includes('desktop-commander')) {
          toolGuidance.push('FILE SYSTEM GUIDANCE:\n- Always read files before analyzing or modifying them\n- Use absolute paths for reliability\n- Prefer read_file over execute_command for viewing file contents');
        }
        
        // Add progress monitoring if we have session state
        if (request.session_state && request.session_state.tool_call_count > 5) {
          toolGuidance.push('PROGRESS MONITORING:\nYou\'ve made several tool calls. Consider summarizing your progress and checking if you\'re making clear progress toward completing the task.');
        }
        
        // Add planning guidance for complex tasks
        if (request.session_state && request.session_state.task_complexity === 'complex' && !request.session_state.has_plan) {
          toolGuidance.push('COMPLEX TASK PLANNING:\nThis appears to be a substantial task. Consider creating a detailed plan first and breaking down the work into concrete steps.');
        }
        
        if (toolGuidance.length > 0) {
          systemPrompt += toolGuidance.join('\n\n') + '\n\n';
        }
        
        systemPrompt += 'Use the available tools to help the user with their request.';
      }
    }
    
    if (!systemPrompt) {
      systemPrompt = 'You are a helpful AI assistant.';
    }
    
    return {
      system_prompt: systemPrompt,
      fallback: true
    };
  }
}

module.exports = new PromptComposerService();
