import { Injectable, NgZone } from '@angular/core';
import { SettingsService } from './settings.service';

// Interface for chat messages
export interface ChatMessage {
  isSelf: boolean;
  content: string;
  timestamp?: string;
  model?: string;
  isError?: boolean;
  isStreaming?: boolean;
}

// Interface for available models
export interface ModelInfo {
  name: string;
  model: string;
  icon?: string;
}

@Injectable({
  providedIn: 'root'
})
export class OllamaService {
  constructor(private ngZone: NgZone, private settingsService: SettingsService) {
    console.debug('OllamaService initialized');
    // Log available models on init for debugging
    this.listModels().then(models => {
      console.debug('Available models:', models);
    }).catch(err => {
      console.error('Error listing models on init:', err);
    });
  }
  
  // Get the current Ollama host
  getHost(): string {
    return this.settingsService.ollamaHost;
  }
  
  // Set the Ollama host
  async setHost(host: string): Promise<void> {
    if (typeof window !== 'undefined' && window.electron) {
      try {
        await window.electron.ollamaApi.setHost(host);
        this.settingsService.ollamaHost = host;
      } catch (error) {
        console.error('Error setting Ollama host:', error);
        throw error;
      }
    } else {
      // Just update settings in development mode
      this.settingsService.ollamaHost = host;
    }
  }

  // List available models - return dummy data if Electron API not available
  async listModels(): Promise<ModelInfo[]> {
    try {
      if (typeof window !== 'undefined' && window.electron) {
        console.debug('Using Electron API to list models');
        const models = await window.electron.ollamaApi.listModels();
        console.debug('Models from Ollama:', models);
        
        // Format models for UI
        return models.map(model => {
          const modelName = model.model;
          
          // Determine icon based on model name
          let icon = 'smart_toy'; // Default icon
          if (modelName.toLowerCase().includes('llama')) {
            icon = 'pets';
          } else if (modelName.toLowerCase().includes('mistral')) {
            icon = 'air';
          } else if (modelName.toLowerCase().includes('qwen')) {
            icon = 'language';
          } else if (modelName.toLowerCase().includes('deepseek')) {
            icon = 'psychology';
          }
          
          // Create a readable name from model name
          const nameParts = modelName.split(':');
          let displayName = nameParts[0].charAt(0).toUpperCase() + nameParts[0].slice(1);
          if (nameParts.length > 1 && nameParts[1] !== 'latest') {
            displayName += ' ' + nameParts[1];
          }
          
          return {
            model: modelName,
            name: displayName,
            icon
          };
        });
      } else {
        // Return dummy data for development
        console.warn('Electron API not available, returning dummy models');
        return [
          { model: 'llama3:latest', name: 'Llama 3', icon: 'pets' },
          { model: 'mistral:latest', name: 'Mistral', icon: 'air' },
          { model: 'deepseek:latest', name: 'Deepseek', icon: 'psychology' }
        ];
      }
    } catch (error) {
      console.error('Error listing models:', error);
      // Return dummy data on error
      return [
        { model: 'llama3:latest', name: 'Llama 3', icon: 'pets' },
        { model: 'mistral:latest', name: 'Mistral', icon: 'air' }
      ];
    }
  }

  // Generate titles (non-streaming, for short requests only)
  async generateTitle(model: string, messages: any[], options = {}): Promise<any> {
    try {
      console.debug('Generating title with model:', model);
      console.debug('Messages:', messages);
      
      if (typeof window !== 'undefined' && window.electron) {
        console.debug('Using Electron API to generate title');
        return await window.electron.ollamaApi.generateTitle(model, messages, options);
      } else {
        // Return dummy response for development
        console.warn('Electron API not available, returning dummy title');
        
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 500));
        
        return {
          message: {
            content: 'Generated Title'
          }
        };
      }
    } catch (error) {
      console.error('Error generating title:', error);
      throw error;
    }
  }

  // Stream a chat response
  streamChat(model: string, messages: any[], options = {}, callback: (chunk: any) => void): () => void {
    try {
      if (typeof window !== 'undefined' && window.electron) {
        // Wrap the callback in ngZone.run() to ensure Angular change detection is triggered
        const zonedCallback = (chunk: any) => {
          this.ngZone.run(() => {
            console.debug('Stream chunk received (in ngZone):', chunk);
            callback(chunk);
          });
        };
        
        // This returns a cancel function
        const cancelFn = window.electron.ollamaApi.streamChat(model, messages, options, zonedCallback);
        
        // Wrap the cancel function in ngZone.run() as well
        return () => {
          this.ngZone.run(() => {
            cancelFn();
          });
        };
      } else {
        // Simulate streaming for development
        console.warn('Electron API not available, simulating streaming response');
        
        const userMessage = messages[messages.length - 1]?.content || '';
        const response = `This is a simulated streaming response to: "${userMessage}". Electron integration is not available in this environment.`;
        
        let index = 0;
        const interval = setInterval(() => {
          if (index < response.length) {
            // Stream a few characters at a time
            const chunk = response.substring(index, index + 5);
            callback({ content: chunk, done: false });
            index += 5;
          } else {
            // Signal completion
            callback({ done: true });
            clearInterval(interval);
          }
        }, 100);
        
        // Return a cancel function
        return () => clearInterval(interval);
      }
    } catch (error) {
      console.error('Error setting up stream:', error);
      // Return a no-op function
      return () => {};
    }
  }

  // Pull a model
  async pullModel(model: string): Promise<any> {
    try {
      if (typeof window !== 'undefined' && window.electron) {
        return await window.electron.ollamaApi.pullModel(model);
      } else {
        // Simulate model pull for development
        console.warn('Electron API not available, simulating model pull');
        
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        return {
          success: true,
          model,
          completed: 100,
          total: 100
        };
      }
    } catch (error) {
      console.error('Error pulling model:', error);
      throw error;
    }
  }
  
  // Get available MCP tools
  async getMcpTools(): Promise<any[]> {
    try {
      if (typeof window !== 'undefined' && window.electron) {
        return await window.electron.mcpApi.listTools();
      } else {
        // Return dummy data for development
        console.warn('Electron API not available, returning dummy MCP tools');
        return [
          {
            name: 'desktop-commander.read_file',
            description: 'Read the contents of a file from the file system',
            parameters: {
              path: {
                type: 'string',
                description: 'The path to the file to read'
              }
            }
          },
          {
            name: 'desktop-commander.write_file',
            description: 'Write content to a file in the file system',
            parameters: {
              path: {
                type: 'string',
                description: 'The path to the file to write'
              },
              content: {
                type: 'string',
                description: 'The content to write to the file'
              }
            }
          }
        ];
      }
    } catch (error) {
      console.error('Error getting MCP tools:', error);
      return [];
    }
  }
  
  // Call an MCP tool
  async callMcpTool(toolName: string, args: any): Promise<any> {
    try {
      if (typeof window !== 'undefined' && window.electron) {
        return await window.electron.mcpApi.callTool(toolName, args);
      } else {
        // Return dummy response for development
        console.warn('Electron API not available, returning dummy MCP tool response');
        return {
          success: true,
          result: `Simulated response from MCP tool ${toolName}`
        };
      }
    } catch (error) {
      console.error('Error calling MCP tool:', error);
      throw error;
    }
  }
}