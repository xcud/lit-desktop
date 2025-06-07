import { Injectable } from '@angular/core';
import { Observable, from, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

// Interface for MCP Tool
export interface McpTool {
  name: string;
  description?: string;
  parameters?: {
    [key: string]: {
      type?: string;
      description?: string;
    }
  };
}

// Interface for MCP Server
export interface McpServer {
  name: string;
  description: string;
  tools: McpTool[];
}

@Injectable({
  providedIn: 'root'
})
export class McpService {
  private availableTools: McpTool[] = [];
  
  constructor() { 
    // Initialize by loading available tools
    this.loadTools();
  }
  
  private async loadTools(): Promise<void> {
    try {
      this.availableTools = await window.electron.mcpApi.listTools();
    } catch (error) {
      console.error('Error loading MCP tools:', error);
      this.availableTools = [];
    }
  }
  
  // Get all available tools
  getTools(): McpTool[] {
    return this.availableTools;
  }
  
  // Get cached tools discovered during initialization
  getCachedTools(): Observable<{[serverName: string]: McpTool[]}> {
    if (typeof window !== 'undefined' && window.electron && window.electron.mcpApi && window.electron.mcpApi.getCachedTools) {
      return from(window.electron.mcpApi.getCachedTools()).pipe(
        catchError(error => {
          console.error('Error getting cached tools from Electron IPC:', error);
          console.log('Using default cached tools as fallback');
          
          // Return default desktop-commander tools as fallback
          return of({
            'desktop-commander': [
              {
                name: 'read_file',
                description: 'Read the contents of a file from the file system',
                parameters: {
                  path: {
                    type: 'string',
                    description: 'The path to the file to read'
                  }
                }
              },
              {
                name: 'write_file',
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
              },
              {
                name: 'list_directory',
                description: 'List the contents of a directory',
                parameters: {
                  path: {
                    type: 'string',
                    description: 'The path to the directory to list'
                  }
                }
              }
            ]
          });
        })
      );
    }
    
    console.warn('getCachedTools function not available in electron API, using fallback');
    // Return default tools if the API isn't available
    return of({
      'desktop-commander': [
        {
          name: 'read_file',
          description: 'Read the contents of a file from the file system',
          parameters: {
            path: {
              type: 'string',
              description: 'The path to the file to read'
            }
          }
        },
        {
          name: 'write_file',
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
        },
        {
          name: 'list_directory',
          description: 'List the contents of a directory',
          parameters: {
            path: {
              type: 'string',
              description: 'The path to the directory to list'
            }
          }
        }
      ]
    });
  }
  
  // Call an MCP tool
  async callTool(toolName: string, args: any): Promise<any> {
    try {
      return await window.electron.mcpApi.callTool(toolName, args);
    } catch (error) {
      console.error(`Error calling MCP tool ${toolName}:`, error);
      throw error;
    }
  }
  
  // Refresh the list of available tools
  async refreshTools(): Promise<McpTool[]> {
    console.log('Refreshing MCP tools...');
    try {
      await this.loadTools();
      console.log(`Refreshed tools: ${this.availableTools.length} tools found`);
      console.log('Tools:', this.availableTools.map(t => t.name).join(', '));
      return this.availableTools;
    } catch (error) {
      console.error('Error refreshing tools:', error);
      return this.availableTools || [];
    }
  }
}