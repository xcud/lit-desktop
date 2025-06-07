import { Injectable } from '@angular/core';
import { Observable, of, from } from 'rxjs';
import { SettingsService } from './settings.service';
import { McpService, McpTool } from './mcp.service';
import { OllamaService } from './ollama.service';
import { map, catchError, tap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class ChatCommandsService {
  constructor(
    private settingsService: SettingsService,
    private mcpService: McpService,
    private ollamaService: OllamaService
  ) {
    // When the service is initialized, sync the cached tools from the MCP service to the settings
    this.syncCachedTools();
  }

  // Sync cached tools from MCP service to settings
  private syncCachedTools(): void {
    // We now rely directly on the electron-store sync mechanism
    // The MCP service updates the electron store directly
    console.debug('Tools will be synced through electron-store');
  }

  /**
   * Process chat commands prefixed with "/"
   * @param message The message to process
   * @returns An observable with the response message if it's a command, or null if not a command
   */
  processCommand(message: string): Observable<{role: string, content: string} | null> {
    if (!message.startsWith('/')) {
      return of(null);
    }

    const parts = message.trim().split(' ');
    const command = parts[0].substring(1).toLowerCase(); // Remove the leading '/' and lowercase

    switch (command) {
      case 'tools':
        return this.handleToolsCommand(parts.slice(1));
      
      case 'settings':
        return this.handleSettingsCommand(parts.slice(1));
        
      default:
        return of(null); // Not a recognized command
    }
  }

  /**
   * Handle the /tools command
   */
  private handleToolsCommand(args: string[]): Observable<{role: string, content: string}> {
    console.debug('Handling /tools command');
    
    // First get all available tools using the existing, working API
    return from(this.mcpService.refreshTools()).pipe(
      map(tools => {
        console.debug(`Got ${tools.length} tools from MCP service`);
        
        // Group the tools by server name
        const toolsByServer: {[serverName: string]: McpTool[]} = {};
        
        tools.forEach(tool => {
          const nameParts = tool.name.split('.');
          if (nameParts.length === 2) {
            const serverName = nameParts[0];
            const toolName = nameParts[1];
            
            if (!toolsByServer[serverName]) {
              toolsByServer[serverName] = [];
            }
            
            // Add the tool to the appropriate server group
            toolsByServer[serverName].push({
              name: toolName,
              description: tool.description,
              parameters: tool.parameters
            });
          }
        });
        
        console.debug(`Grouped tools by server: ${Object.keys(toolsByServer).join(', ')}`);
        
        // Format the response
        const responseLines = ['### Available Tools\n'];
        
        if (Object.keys(toolsByServer).length === 0) {
          responseLines.push('No tools have been discovered yet.');
        } else {
          // Process built-in/internal tools first
          const internalServers = []; // ['image-renderer']; // Add more internal servers here as they are developed
          const regularServers = Object.keys(toolsByServer).filter(name => !internalServers.includes(name));
          
          // Show internal tools first with special formatting
          internalServers.forEach(serverName => {
            if (toolsByServer[serverName]) {
              responseLines.push(`#### ⭐ ${serverName} (Built-In, ${toolsByServer[serverName].length} tools)\n`);
              
              toolsByServer[serverName].forEach((tool: McpTool) => {
                responseLines.push(`**${tool.name}**: ${tool.description || 'No description'}`);
                
                if (tool.parameters && Object.keys(tool.parameters).length > 0) {
                  responseLines.push('Parameters:');
                  for (const [paramName, paramInfo] of Object.entries(tool.parameters)) {
                    const description = paramInfo && typeof paramInfo === 'object' 
                      ? (paramInfo.description || paramInfo.type || 'No description')
                      : 'No description';
                    
                    const paramType = paramInfo && typeof paramInfo === 'object' && paramInfo.type 
                      ? `(${paramInfo.type})` 
                      : '';
                      
                    responseLines.push(`- \`${paramName}\` ${paramType}: ${description}`);
                  }
                }
                
                // Example usage for image tools
//                 if (serverName === 'image-renderer') {
//                   if (tool.name === 'render_image') {
//                     responseLines.push('\nExample usage:');
//                     responseLines.push('```json');
//                     responseLines.push(`{
//   "tool": "image-renderer.render_image",
//   "arguments": {
//     "data": "[base64-encoded-image-data]",
//     "mimeType": "image/png",
//     "altText": "Description of the image"
//   }
// }`);
//                     responseLines.push('```');
//                   } else if (tool.name === 'render_svg') {
//                     responseLines.push('\nExample usage:');
//                     responseLines.push('```json');
//                     responseLines.push(`{
//   "tool": "image-renderer.render_svg",
//   "arguments": {
//     "svg": "<svg width='400' height='300' xmlns='http://www.w3.org/2000/svg'><rect width='100%' height='100%' fill='#f0f0f0'/><text x='50%' y='50%' font-family='Arial' font-size='24' text-anchor='middle'>SVG Example</text></svg>",
//     "altText": "SVG Visualization"
//   }
// }`);
//                     responseLines.push('```');
//                   }
//                 }
                
                responseLines.push(''); // Empty line between tools
              });
            }
          });
          
          // Then show regular tools
          regularServers.forEach(serverName => {
            if (toolsByServer[serverName]) {
              responseLines.push(`#### ${serverName} (${toolsByServer[serverName].length} tools)\n`);
              
              toolsByServer[serverName].forEach((tool: McpTool) => {
                responseLines.push(`**${tool.name}**: ${tool.description || 'No description'}`);
                
                if (tool.parameters && Object.keys(tool.parameters).length > 0) {
                  responseLines.push('Parameters:');
                  for (const [paramName, paramInfo] of Object.entries(tool.parameters)) {
                    const description = paramInfo && typeof paramInfo === 'object' 
                      ? (paramInfo.description || paramInfo.type || 'No description')
                      : 'No description';
                    
                    const paramType = paramInfo && typeof paramInfo === 'object' && paramInfo.type 
                      ? `(${paramInfo.type})` 
                      : '';
                    
                    responseLines.push(`- \`${paramName}\` ${paramType}: ${description}`);
                  }
                }
                
                responseLines.push(''); // Empty line between tools
              });
            }
          });
        }
        
        // Add a help message for how to call tools
        responseLines.push('### How to Call Tools');
        responseLines.push('Tools can be called by the AI as needed to perform actions on your system.');
        responseLines.push('For example, to read a file, the AI will use a command like:');
        responseLines.push('```json');
        responseLines.push('{');
        responseLines.push('  "tool": "desktop-commander.read_file",');
        responseLines.push('  "arguments": {');
        responseLines.push('    "path": "/path/to/file"');
        responseLines.push('  }');
        responseLines.push('}');
        responseLines.push('```');
        
        return {
          role: 'assistant',
          content: responseLines.join('\n')
        };
      }),
      catchError(error => {
        console.error('Error getting tools:', error);
        
        // Fall back to cached tools from settings
        console.debug('Falling back to cached tools from settings');
        const cachedTools = this.settingsService.cachedTools;
        
        // Format the response for cached tools
        const responseLines = ['### Cached Tools (Fallback)\n'];
        
        if (!cachedTools || Object.keys(cachedTools).length === 0) {
          responseLines.push('No cached tools available.');
        } else {
          for (const [serverName, tools] of Object.entries(cachedTools)) {
            responseLines.push(`#### ${serverName} (${tools.length} tools)\n`);
            
            tools.forEach((tool: McpTool) => {
              responseLines.push(`**${tool.name}**: ${tool.description || 'No description'}`);
              
              if (tool.parameters && Object.keys(tool.parameters).length > 0) {
                responseLines.push('Parameters:');
                for (const [paramName, paramInfo] of Object.entries(tool.parameters)) {
                  const description = paramInfo && typeof paramInfo === 'object' 
                    ? (paramInfo.description || paramInfo.type || 'No description')
                    : 'No description';
                  responseLines.push(`- \`${paramName}\`: ${description}`);
                }
              }
              
              responseLines.push(''); // Empty line between tools
            });
          }
        }
        
        return of({
          role: 'assistant',
          content: responseLines.join('\n') + '\n\nNote: Error getting latest tools. Showing cached tools instead.'
        });
      })
    );
  }

  /**
   * Handle the /settings command
   */
  private handleSettingsCommand(args: string[]): Observable<{role: string, content: string}> {
    if (args.length === 0) {
      // Show all settings with a more user-friendly format
      const settings = this.settingsService.getSettings();
      
      const responseLines = [
        '### Current Settings\n',
        '**Ollama Connection**',
        `- Host URL: \`${settings.ollamaHost}\`\n`,
        '**Appearance**',
        `- Theme: \`${settings.theme}\` (light, dark, or system)`,
        `- Font Size: \`${settings.fontSize}px\`\n`,
        '**MCP Configuration**',
        `- MCP Enabled: \`${settings.mcpEnabled}\``,
        '- MCP Servers: See JSON configuration below\n',
        '```json',
        JSON.stringify(settings, null, 2),
        '```\n',
        'Use `/settings get [key]` to view a specific setting, or `/settings set [key] [value]` to update a setting.',
        'Example: `/settings set theme "dark"` or `/settings set fontSize 16`'
      ];
      
      return of({
        role: 'assistant',
        content: responseLines.join('\n')
      });
    }
    
    const subCommand = args[0].toLowerCase();
    
    if (subCommand === 'get' && args.length > 1) {
      // Get a specific setting
      const key = args[1];
      const settings = this.settingsService.getSettings();
      
      // Use dot notation to access nested properties
      const value = this.getNestedProperty(settings, key);
      
      if (value === undefined) {
        return of({
          role: 'assistant',
          content: `Setting \`${key}\` not found.`
        });
      }
      
      // Format specific settings with more details
      if (key === 'theme') {
        return of({
          role: 'assistant',
          content: `### Theme Setting\n\nCurrent theme: \`${value}\`\n\nOptions:\n- \`light\`: Light theme\n- \`dark\`: Dark theme\n- \`system\`: Follow system preference\n\nTo change: \`/settings set theme "light"\``
        });
      } else if (key === 'fontSize') {
        return of({
          role: 'assistant',
          content: `### Font Size Setting\n\nCurrent font size: \`${value}px\`\n\nRecommended range: 10px - 24px\n\nTo change: \`/settings set fontSize 16\``
        });
      } else if (key === 'ollamaHost') {
        return of({
          role: 'assistant',
          content: `### Ollama Host Setting\n\nCurrent Ollama host: \`${value}\`\n\nDefault: \`http://localhost:11434\`\n\nTo change: \`/settings set ollamaHost "http://localhost:11434"\`\n\nNote: You may need to restart the application after changing this.`
        });
      } else if (key === 'mcpEnabled') {
        return of({
          role: 'assistant',
          content: `### MCP Enabled Setting\n\nMCP Tools are currently: \`${value ? 'Enabled' : 'Disabled'}\`\n\nTo change: \`/settings set mcpEnabled true\` or \`/settings set mcpEnabled false\``
        });
      }
      
      return of({
        role: 'assistant',
        content: `### Setting: ${key}\n\n\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\``
      });
    }
    
    if (subCommand === 'set' && args.length > 2) {
      // Set a specific setting
      const key = args[1];
      const valueStr = args.slice(2).join(' ');
      
      try {
        let value: any;
        try {
          // Try to parse as JSON first
          value = JSON.parse(valueStr);
        } catch (e) {
          // For simple string values, try without quotes (user-friendly)
          if (['theme', 'ollamaHost'].includes(key)) {
            value = valueStr;
          } else if (key === 'fontSize') {
            // Convert to number for fontSize
            value = parseInt(valueStr, 10);
            if (isNaN(value)) {
              throw new Error(`Font size must be a number between 10 and 24`);
            }
            if (value < 10 || value > 24) {
              throw new Error(`Font size must be between 10 and 24`);
            }
          } else if (key === 'mcpEnabled') {
            // Handle boolean values in a user-friendly way
            if (['true', 'yes', 'on', '1'].includes(valueStr.toLowerCase())) {
              value = true;
            } else if (['false', 'no', 'off', '0'].includes(valueStr.toLowerCase())) {
              value = false;
            } else {
              throw new Error(`Invalid value for mcpEnabled. Use 'true' or 'false'`);
            }
          } else {
            // For other values, require valid JSON
            throw new Error(`Invalid JSON value. Make sure to use proper JSON format (e.g., strings with quotes, arrays with brackets, etc.)`);
          }
        }
        
        // Validate specific settings
        if (key === 'theme' && !['light', 'dark', 'system'].includes(value)) {
          throw new Error(`Invalid theme value. Must be one of: 'light', 'dark', 'system'`);
        }
        
        if (key === 'mcpConfig') {
          // Validate MCP config is valid JSON
          try {
            if (typeof value === 'string') {
              JSON.parse(value);
            }
          } catch (e) {
            throw new Error(`Invalid MCP configuration JSON: ${e.message}`);
          }
        }
        
        const settings = this.settingsService.getSettings();
        
        // Use dot notation to set nested properties
        this.setNestedProperty(settings, key, value);
        
        // Save the updated settings
        this.settingsService.saveSettings(settings);
        
        // Apply immediate changes for specific settings
        if (key === 'theme') {
          this.applyTheme(value);
          return of({
            role: 'assistant',
            content: `Theme set to \`${value}\`. The new theme has been applied.`
          });
        } else if (key === 'fontSize') {
          this.applyFontSize(value);
          return of({
            role: 'assistant',
            content: `Font size set to \`${value}px\`. The new font size has been applied.`
          });
        }
        
        return of({
          role: 'assistant',
          content: `Setting \`${key}\` updated to: \`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\``
        });
      } catch (error) {
        return of({
          role: 'assistant',
          content: `Error updating setting: ${error.message}. Please ensure you're using the correct format.`
        });
      }
    }
    
    if (subCommand === 'test-ollama') {
      // Test Ollama connection
      return from(this.testOllamaConnection()).pipe(
        map(result => ({
          role: 'assistant',
          content: result
        }))
      );
    }
    
    return of({
      role: 'assistant',
      content: `Available settings commands:
- \`/settings\` - View all settings
- \`/settings get [key]\` - Get a specific setting (e.g., \`theme\`, \`fontSize\`, \`ollamaHost\`, \`mcpEnabled\`, \`mcpConfig\`)
- \`/settings set [key] [value]\` - Update a setting (e.g., \`/settings set theme "dark"\` or \`/settings set fontSize 16\`)
- \`/settings test-ollama\` - Test the Ollama connection`
    });
  }
  
  /**
   * Test the Ollama connection
   */
  private async testOllamaConnection(): Promise<string> {
    try {
      const settings = this.settingsService.getSettings();
      
      // Save the original host
      const originalHost = this.ollamaService.getHost();
      
      // Try to connect with the configured host
      await this.ollamaService.setHost(settings.ollamaHost);
      const models = await this.ollamaService.listModels();
      
      // Restore the original host if different (shouldn't be needed in most cases)
      if (originalHost !== settings.ollamaHost) {
        await this.ollamaService.setHost(originalHost);
      }
      
      return `Ollama connection test to ${settings.ollamaHost} successful! Found ${models.length} models: ${models.map(m => m.name).join(', ')}`;
    } catch (error) {
      return `Ollama connection test failed: ${error.message || 'Unknown error'}`;
    }
  }
  
  /**
   * Apply theme setting immediately
   */
  private applyTheme(theme: 'light' | 'dark' | 'system'): void {
    const body = document.querySelector('body');
    if (!body) return;
    
    // Remove existing theme classes
    body.classList.remove('light-theme', 'dark-theme');
    
    // Apply the selected theme
    if (theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      body.classList.add('dark-theme');
    } else {
      body.classList.add('light-theme');
    }
  }
  
  /**
   * Apply font size setting immediately
   */
  private applyFontSize(size: number): void {
    document.documentElement.style.setProperty('--app-font-size', `${size}px`);
  }

  /**
   * Helper function to get a nested property using dot notation
   */
  private getNestedProperty(obj: any, path: string): any {
    const keys = path.split('.');
    return keys.reduce((o, k) => (o || {})[k], obj);
  }

  /**
   * Helper function to set a nested property using dot notation
   */
  private setNestedProperty(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    const lastKey = keys.pop();
    
    if (!lastKey) return;
    
    const nestedObj = keys.reduce((o, k) => {
      if (!o[k]) o[k] = {};
      return o[k];
    }, obj);
    
    nestedObj[lastKey] = value;
  }
}
