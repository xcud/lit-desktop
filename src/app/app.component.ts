import { Component, OnInit } from '@angular/core';
import { SettingsService } from './services/settings.service';

@Component({
  selector: 'app-root',
  template: `
    <div class="app-container">
      <router-outlet></router-outlet>
    </div>
  `,
  styles: [`
    .app-container {
      height: 100vh;
      display: flex;
      flex-direction: column;
    }
  `]
})
export class AppComponent implements OnInit {
  title = 'LIT Chat';
  
  constructor(private settings: SettingsService) {
    // Get settings for theme application
  }
  
  ngOnInit() {
    // Settings will be loaded automatically by the SettingsService
    // Theme and font size will be applied when settings are loaded
    
    // Listen for system theme changes if using system theme
    this.setupSystemThemeListener();
  }
  
  // Listen for system theme changes
  private setupSystemThemeListener(): void {
    if (window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      
      // Initial check
      if (this.settings.theme === 'system') {
        this.applySystemTheme(mediaQuery.matches);
      }
      
      // Add listener for changes
      mediaQuery.addEventListener('change', (e) => {
        if (this.settings.theme === 'system') {
          this.applySystemTheme(e.matches);
        }
      });
    }
  }
  
  // Apply the system theme
  private applySystemTheme(isDark: boolean): void {
    const body = document.querySelector('body');
    if (!body) return;
    
    body.classList.remove('light-theme', 'dark-theme');
    body.classList.add(isDark ? 'dark-theme' : 'light-theme');
  }
}