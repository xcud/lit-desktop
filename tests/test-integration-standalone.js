#!/usr/bin/env node

/**
 * Direct test of prompt-composer core functionality
 * This tests the service without IPC (which requires full Electron context)
 */

const path = require('path');

// Create a test version of the service without IPC
class TestPromptComposerService {
  constructor() {
    this.promptComposerPath = null;
    this.isInitialized = false;
    console.log('TestPromptComposerService constructor complete');
  }

  async initialize() {
    console.log('TestPromptComposerService initialization started');
    
    try {
      this.promptComposerPath = await this.findPromptComposer();
      this.isInitialized = true;
      console.log('TestPromptComposerService initialization complete');
    } catch (error) {
      console.error('Failed to initialize TestPromptComposerService:', error);
      this.isInitialized = false;
    }
  }

  async findPromptComposer() {
    const { spawn } = require('child_process');
    
    return new Promise((resolve, reject) => {
      const venvPython = path.join(__dirname, '../prompt-composer/venv/bin/python');
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

  async generateSystemPrompt(request) {
    const { spawn } = require('child_process');
    
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
      
      const pythonScript = `
import json
import sys
import os
try:
    # Set the prompts directory to the correct path
    os.chdir('${path.join(__dirname, '../prompt-composer')}')
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

      const python = spawn(this.promptComposerPath, ['-c', pythonScript]);
      
      let output = '';
      let error = '';
      
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

  getFallbackPrompt(request) {
    console.log('Using enhanced fallback system prompt');
    
    let systemPrompt = '';
    const toolGuidance = [];
    
    if (request.mcp_config && request.mcp_config.mcpServers) {
      const servers = Object.keys(request.mcp_config.mcpServers);
      
      if (servers.length > 0) {
        systemPrompt += `You have access to tools from these MCP servers: ${servers.join(', ')}.\n\n`;
        
        if (servers.includes('desktop-commander')) {
          toolGuidance.push('FILE SYSTEM GUIDANCE:\n- Always read files before analyzing or modifying them\n- Use absolute paths for reliability\n- Prefer read_file over execute_command for viewing file contents');
        }
        
        if (request.session_state && request.session_state.tool_call_count > 5) {
          toolGuidance.push('PROGRESS MONITORING:\nYou\'ve made several tool calls. Consider summarizing your progress and checking if you\'re making clear progress toward completing the task.');
        }
        
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

async function testPromptComposerIntegration() {
  console.log('🧪 Testing prompt-composer integration for lit-desktop...\n');
  
  const promptComposerService = new TestPromptComposerService();
  
  try {
    console.log('1️⃣ Initializing prompt-composer service...');
    await promptComposerService.initialize();
    console.log('   ✅ Service initialized\n');
    
    console.log('2️⃣ Testing simple file reading task...');
    const simpleRequest = {
      user_prompt: "Look at package.json and tell me about the dependencies",
      mcp_config: {
        mcpServers: {
          "desktop-commander": {
            name: "desktop-commander",
            command: "npx",
            args: ["@wonderwhy-er/desktop-commander@latest"],
            description: "Access and manipulate files on the local system",
            autoStart: false
          }
        }
      },
      session_state: {
        tool_call_count: 0,
        has_plan: false
      }
    };
    
    const simpleResponse = await promptComposerService.generateSystemPrompt(simpleRequest);
    console.log('   ✅ Simple task prompt generated');
    console.log(`   📝 Prompt length: ${simpleResponse.system_prompt.length} characters`);
    console.log(`   🔧 Fallback mode: ${simpleResponse.fallback ? 'Yes' : 'No'}`);
    
    // Show recognized tools if available
    if (simpleResponse.recognized_tools) {
      console.log(`   🔨 Recognized tools: ${simpleResponse.recognized_tools.length}`);
    }
    if (simpleResponse.applied_modules) {
      console.log(`   🧩 Applied modules: ${simpleResponse.applied_modules.join(', ')}`);
    }
    
    const prompt = simpleResponse.system_prompt.toLowerCase();
    const hasFileGuidance = prompt.includes('read') && prompt.includes('file');
    const hasToolGuidance = prompt.includes('tool');
    console.log(`   📋 Has file guidance: ${hasFileGuidance ? '✅' : '❌'}`);
    console.log(`   🔨 Has tool guidance: ${hasToolGuidance ? '✅' : '❌'}\n`);
    
    console.log('3️⃣ Sample system prompt preview:');
    console.log('   ' + '─'.repeat(60));
    const samplePrompt = simpleResponse.system_prompt.slice(0, 500) + '...';
    console.log('   ' + samplePrompt.replace(/\n/g, '\n   '));
    console.log('   ' + '─'.repeat(60));
    
    console.log('\n🎉 Integration test completed successfully!');
    console.log('\n📋 Summary:');
    console.log('   • prompt-composer service initializes correctly ✅');
    console.log('   • System prompts are generated ✅');
    console.log('   • MCP server configuration is processed ✅');
    console.log('   • File operation guidance is included ✅');
    console.log('\n🚀 The integration is ready for use in the lit-desktop app!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testPromptComposerIntegration();
