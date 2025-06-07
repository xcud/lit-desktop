import { Component, OnInit, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { SettingsService, AppSettings } from '../../services/settings.service';
import { OllamaService } from '../../services/ollama.service';

@Component({
  selector: 'app-settings-dialog',
  templateUrl: './settings-dialog.component.html',
  styleUrls: ['./settings-dialog.component.scss']
})
export class SettingsDialogComponent implements OnInit {
  settings: AppSettings;
  jsonError: string | null = null;
  
  constructor(
    private dialogRef: MatDialogRef<SettingsDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private settingsService: SettingsService,
    private ollamaService: OllamaService
  ) {
    // Deep clone settings to avoid modifying the original until save
    this.settings = JSON.parse(JSON.stringify(this.settingsService.getSettings()));
  }
  
  // Initialize component
  async ngOnInit(): Promise<void> {
    // Apply the current theme on initialization
    this.applyTheme(this.settings.theme);
    
    // Load the actual MCP config file
    await this.loadActualMcpConfig();
  }
  
  // Load the actual MCP config from the file system
  private async loadActualMcpConfig(): Promise<void> {
    try {
      const actualConfig = await this.settingsService.loadActualMcpConfig();
      this.settings.mcpConfig = actualConfig;
    } catch (error) {
      console.error('Error loading actual MCP config:', error);
    }
  }
  
  // Change theme and apply immediately
  changeTheme(theme: 'light' | 'dark' | 'system'): void {
    this.settings.theme = theme;
    
    // Apply the theme immediately
    this.applyTheme(theme);
  }
  
  // Apply theme
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
  
  // Update font size and apply immediately
  onFontSizeChange(size: number): void {
    // Apply the font size change immediately to preview it
    document.documentElement.style.setProperty('--app-font-size', `${size}px`);
  }
  
  // Update MCP Config and validate JSON
  updateMcpConfig(value: string): void {
    try {
      // Validate JSON
      JSON.parse(value);
      this.settings.mcpConfig = value;
      this.jsonError = null;
    } catch (error) {
      console.error('Invalid JSON:', error);
      this.jsonError = 'Invalid JSON: ' + error.message;
      // Still keep the value so user can fix it
      this.settings.mcpConfig = value;
    }
  }
  
  // Test Ollama connection
  async testOllamaConnection(): Promise<void> {
    try {
      // Save the original host
      const originalHost = this.ollamaService.getHost();
      
      // Try to connect with the new host
      await this.ollamaService.setHost(this.settings.ollamaHost);
      const models = await this.ollamaService.listModels();
      
      // Show success message
      alert(`Connection successful! Found ${models.length} models.`);
    } catch (error) {
      console.error('Connection test failed:', error);
      alert(`Connection failed: ${error.message}`);
    }
  }
  
  // Save settings and close dialog
  saveSettings(): void {
    // One final JSON validation before saving
    try {
      if (this.settings.mcpConfig) {
        JSON.parse(this.settings.mcpConfig);
      }
      
      // Save settings
      this.settingsService.saveSettings(this.settings);
      
      // Apply theme and font size immediately upon save
      this.applyTheme(this.settings.theme);
      document.documentElement.style.setProperty('--app-font-size', `${this.settings.fontSize}px`);
      
      this.dialogRef.close(true);
    } catch (error) {
      this.jsonError = 'Invalid JSON: ' + error.message;
    }
  }
  
  // Close without saving
  cancel(): void {
    this.dialogRef.close(false);
  }
}