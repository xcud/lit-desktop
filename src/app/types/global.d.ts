import { McpTool } from '../services/mcp.service';

declare global {
  interface Window {
    electron: {
      // MCP API
      mcpApi: {
        listTools: () => Promise<McpTool[]>;
        getCachedTools: () => Promise<{ [serverName: string]: McpTool[] }>;
        callTool: (toolName: string, args: any) => Promise<any>;
      };

      // Ollama API
      ollamaApi: {
        listModels: () => Promise<any[]>;
        setHost: (host: string) => Promise<string>;
        generateTitle: (model: string, messages: any[], options: any) => Promise<any>; // For title generation only
        streamChat: (model: string, messages: any[], options: any, callback: (chunk: any) => void) => () => void;
        pullModel: (model: string) => Promise<any>;
      };

      // Prompt Composer API
      promptComposer: {
        generate: (request: any) => Promise<any>;
        isAvailable: () => Promise<boolean>;
      };

      // App Control API
      app: {
        minimize: () => Promise<void>;
        maximize: () => Promise<void>;
        close: () => Promise<void>;
        getSettings: () => Promise<any>;
        saveSettings: (settings: any) => Promise<void>;
        readMcpConfig: () => Promise<string>;
        getDiscoveredTools: () => Promise<{ [serverName: string]: McpTool[] }>;
      };
    };
  }
}

// This export is necessary to make this a module
export {};
