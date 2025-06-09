/**
 * Prompt Composer Service - Electron Main Process
 * 
 * Provides intelligent system prompt generation based on MCP tools and session state
 */

const { spawn } = require('child_process');
const path = require('path');
const { ipcMain } = require('electron');

class PromptComposerService {
  constructor() {
    this.promptComposerPath = null;
    this.isInitialized = false;
    console.log('PromptComposerService constructor complete');
  }

  /**
   * Initialize the prompt composer service
   */
  async initialize() {
    console.log('PromptComposerService initialization started');
    
    try {
      // Try to find prompt-composer Python package
      this.promptComposerPath = await this.findPromptComposer();
      this.isInitialized = true;
      
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

  /**
   * Find the prompt-composer Python package
   */
  async findPromptComposer() {
    return new Promise((resolve, reject) => {
      // Check for venv Python first - correct path
      const venvPython = path.join(__dirname, '../../prompt-composer/venv/bin/python');
      const python = spawn(venvPython, ['-c', 'import prompt_composer; print("OK")']);
      
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
          console.log('Found prompt-composer in venv');
          resolve(venvPython);
        } else {
          console.error('prompt-composer not found in venv:', error);
          reject(new Error(`prompt-composer not available: ${error}`));
        }
      });
    });
  }

  /**
   * Setup IPC handlers for renderer process communication
   */
  setupIpcHandlers() {
    console.log('Setting up PromptComposer IPC handlers');

    // Generate system prompt
    ipcMain.handle('prompt-composer:generate', async (event, request) => {
      try {
        console.log('IPC: prompt-composer:generate called');
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

  /**
   * Generate system prompt using prompt-composer
   * @param {Object} request - Request object with user_prompt, mcp_config, session_state
   * @returns {Promise<Object>} Response with system_prompt
   */
  async generateSystemPrompt(request) {
    if (!this.isInitialized) {
      console.log('PromptComposer not initialized, using fallback');
      return this.getFallbackPrompt(request);
    }

    return new Promise((resolve, reject) => {
      console.log('Generating system prompt with prompt-composer');
      
      // Ensure MCP config has the required 'name' field for each server
      if (request.mcp_config && request.mcp_config.mcpServers) {
        for (const [serverName, serverConfig] of Object.entries(request.mcp_config.mcpServers)) {
          if (!serverConfig.name) {
            serverConfig.name = serverName;
          }
        }
      }
      
      // Create the Python script to call prompt-composer from the venv
      const venvPython = path.join(__dirname, '../../prompt-composer/venv/bin/python');
      const pythonScript = `
import json
import sys
import os
try:
    # Set the prompts directory to the correct path
    os.chdir('${path.join(__dirname, '../../prompt-composer')}')
    from prompt_composer import compose_system_prompt
    
    # Read request from stdin
    request_json = sys.stdin.read()
    request = json.loads(request_json)
    
    # Generate system prompt
    response_json = compose_system_prompt(json.dumps(request))
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

      const python = spawn(venvPython, ['-c', pythonScript]);
      
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
              console.log('System prompt generated successfully');
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

  /**
   * Generate a smart fallback prompt when prompt-composer is unavailable
   * @param {Object} request - Request object
   * @returns {Object} Response with enhanced system prompt
   */
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
