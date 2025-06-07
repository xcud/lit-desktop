import { Injectable } from '@angular/core';

// Interface for application settings
export interface AppSettings {
  ollamaHost: string;
  defaultModel: string;
  theme: 'light' | 'dark' | 'system';
  fontSize: number;
  mcpEnabled: boolean;
  mcpServers: {
    [name: string]: {
      command: string;
      args: string[];
      description: string;
      autoStart?: boolean;
    }
  };
  mcpConfig: string; // Serialized JSON for /etc/lit/mcp.json
  cachedTools: { [serverName: string]: any[] }; // Equivalent to /etc/lit/cached_tools.json
}

// Default settings
const DEFAULT_SETTINGS: AppSettings = {
  ollamaHost: 'http://localhost:11434',
  defaultModel: 'llama3:latest',
  theme: 'system',
  fontSize: 14,
  mcpEnabled: true,
  mcpServers: { },
  mcpConfig: JSON.stringify({
    mcpServers: { }
  }, null, 2),
  cachedTools: {}
};

@Injectable({
  providedIn: 'root'
})
export class SettingsService {
  private settings: AppSettings;
  private initialized: boolean = false;
  
  constructor() {
    // Initialize with default settings
    this.settings = { ...DEFAULT_SETTINGS };
    // Try to load settings from Electron or localStorage
    this.loadSettings();
  }
  
  private async loadSettings(): Promise<void> {
    try {
      // Try Electron first
      if (typeof window !== 'undefined' && window.electron) {
        const savedSettings = await window.electron.app.getSettings();
        this.settings = { ...DEFAULT_SETTINGS, ...savedSettings };
      } else {
        // Fall back to localStorage
        const savedSettingsStr = localStorage.getItem('lit-chat-settings');
        if (savedSettingsStr) {
          const savedSettings = JSON.parse(savedSettingsStr);
          this.settings = { ...DEFAULT_SETTINGS, ...savedSettings };
        }
      }
      
      // Apply font size setting
      this.applyFontSize(this.settings.fontSize);
      
      // Apply theme setting
      this.applyTheme(this.settings.theme);
      
      this.initialized = true;
    } catch (error) {
      console.error('Error loading settings:', error);
      // Ensure we have default settings at minimum
      this.settings = { ...DEFAULT_SETTINGS };
      this.initialized = true;
    }
  }
  
  // Apply font size to the document
  private applyFontSize(size: number): void {
    document.documentElement.style.setProperty('--app-font-size', `${size}px`);
  }
  
  // Get all settings
  getSettings(): AppSettings {
    // Ensure we always return something valid
    return { ...DEFAULT_SETTINGS, ...this.settings };
  }
  
  // Save all settings
  async saveSettings(settings: AppSettings): Promise<void> {
    this.settings = { ...settings };
    try {
      if (typeof window !== 'undefined' && window.electron) {
        await window.electron.app.saveSettings(this.settings);
      } else {
        // Fall back to localStorage
        localStorage.setItem('lit-chat-settings', JSON.stringify(this.settings));
      }
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  }
  
  // Helper methods for specific settings
  
  get ollamaHost(): string {
    return this.settings.ollamaHost || DEFAULT_SETTINGS.ollamaHost;
  }
  
  set ollamaHost(value: string) {
    this.settings.ollamaHost = value;
    this.saveSettings(this.settings);
  }
  
  get defaultModel(): string {
    return this.settings.defaultModel || DEFAULT_SETTINGS.defaultModel;
  }
  
  set defaultModel(value: string) {
    this.settings.defaultModel = value;
    this.saveSettings(this.settings);
  }
  
  get theme(): 'light' | 'dark' | 'system' {
    return this.settings.theme || DEFAULT_SETTINGS.theme;
  }
  
  set theme(value: 'light' | 'dark' | 'system') {
    this.settings.theme = value;
    this.saveSettings(this.settings);
    
    // Apply the theme
    this.applyTheme(value);
  }
  
  // Apply theme to the document
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
  
  get fontSize(): number {
    return this.settings.fontSize || DEFAULT_SETTINGS.fontSize;
  }
  
  set fontSize(value: number) {
    this.settings.fontSize = value;
    this.saveSettings(this.settings);
    
    // Apply the font size to the document
    this.applyFontSize(value);
  }
  
  get mcpEnabled(): boolean {
    return this.settings.mcpEnabled !== undefined ? this.settings.mcpEnabled : DEFAULT_SETTINGS.mcpEnabled;
  }
  
  set mcpEnabled(value: boolean) {
    this.settings.mcpEnabled = value;
    this.saveSettings(this.settings);
  }
  
  get mcpServers(): {[name: string]: any} {
    return this.settings.mcpServers || DEFAULT_SETTINGS.mcpServers;
  }
  
  get mcpConfig(): string {
    return this.settings.mcpConfig || DEFAULT_SETTINGS.mcpConfig;
  }
  
  // Load the actual mcp.json file used by MCPManager
  async loadActualMcpConfig(): Promise<string> {
    if (typeof window !== 'undefined' && window.electron) {
      try {
        const actualConfig = await window.electron.app.readMcpConfig();
        // Update our cached copy
        this.settings.mcpConfig = actualConfig;
        return actualConfig;
      } catch (error) {
        console.error('Error reading actual mcp.json file:', error);
        return this.settings.mcpConfig || DEFAULT_SETTINGS.mcpConfig;
      }
    }
    return this.settings.mcpConfig || DEFAULT_SETTINGS.mcpConfig;
  }
  
  set mcpConfig(value: string) {
    this.settings.mcpConfig = value;
    
    // When mcpConfig is updated, also update mcpServers for backward compatibility
    try {
      const config = JSON.parse(value);
      if (config.mcpServers) {
        this.settings.mcpServers = config.mcpServers;
      }
    } catch (error) {
      console.error('Error parsing MCP config:', error);
    }
    
    this.saveSettings(this.settings);
  }
  
  get cachedTools(): {[serverName: string]: any[]} {
    return this.settings.cachedTools || DEFAULT_SETTINGS.cachedTools;
  }
  
  set cachedTools(value: {[serverName: string]: any[]}) {
    this.settings.cachedTools = value;
    this.saveSettings(this.settings);
  }
  
  // Update cached tools for a specific server
  updateCachedTools(serverName: string, tools: any[]): void {
    if (!this.settings.cachedTools) {
      this.settings.cachedTools = {};
    }
    this.settings.cachedTools[serverName] = tools;
    this.saveSettings(this.settings);
  }
  
  addMcpServer(name: string, config: any): void {
    if (!this.settings.mcpServers) {
      this.settings.mcpServers = {};
    }
    this.settings.mcpServers[name] = config;
    this.saveSettings(this.settings);
  }
  
  removeMcpServer(name: string): void {
    if (this.settings.mcpServers && this.settings.mcpServers[name]) {
      delete this.settings.mcpServers[name];
      this.saveSettings(this.settings);
    }
  }
}