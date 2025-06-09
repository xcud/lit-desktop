import { Injectable } from '@angular/core';

export interface SessionState {
  tool_call_count: number;
  has_plan: boolean;
  original_task?: string;
  task_complexity?: 'simple' | 'complex';
  domain_hints?: string[];
}

export interface PromptRequest {
  user_prompt: string;
  mcp_config: any;
  session_state: SessionState;
  domain_hints?: string[];
  task_complexity?: string;
}

export interface PromptResponse {
  system_prompt: string;
  fallback?: boolean;
  error?: string;
  recognized_tools?: string[];
  applied_modules?: string[];
  complexity_assessment?: string;
}

@Injectable({
  providedIn: 'root'
})
export class PromptComposerService {
  private isAvailable: boolean = false;

  constructor() {
    this.checkAvailability();
  }

  /**
   * Check if prompt composer is available
   */
  private async checkAvailability(): Promise<void> {
    try {
      if (typeof window !== 'undefined' && window.electron) {
        this.isAvailable = await window.electron.promptComposer.isAvailable();
        console.log('Prompt Composer availability:', this.isAvailable);
      }
    } catch (error) {
      console.error('Error checking prompt composer availability:', error);
      this.isAvailable = false;
    }
  }

  /**
   * Generate system prompt using prompt-composer
   */
  async generateSystemPrompt(request: PromptRequest): Promise<PromptResponse> {
    try {
      if (typeof window !== 'undefined' && window.electron) {
        console.log('Generating system prompt with request:', request);
        
        const response = await window.electron.promptComposer.generate(request);
        
        if (response.fallback) {
          console.log('Using fallback system prompt');
        } else {
          console.log('Generated system prompt successfully');
        }
        
        return response;
      } else {
        // Development fallback
        console.warn('Electron API not available, using development fallback');
        return this.getDevFallbackPrompt(request);
      }
    } catch (error) {
      console.error('Error generating system prompt:', error);
      return this.getDevFallbackPrompt(request);
    }
  }

  /**
   * Create session state from chat messages and current context
   */
  createSessionState(
    messages: any[], 
    toolCallCount: number = 0,
    originalTask?: string
  ): SessionState {
    // Simple heuristic for task complexity based on message content
    const lastUserMessage = messages
      .filter(msg => msg.isSelf)
      .slice(-1)[0]?.content || '';
    
    const complexityKeywords = [
      'analyze', 'create', 'build', 'refactor', 'implement', 
      'comprehensive', 'detailed', 'strategy', 'plan', 'design'
    ];
    
    const isComplex = complexityKeywords.some(keyword => 
      lastUserMessage.toLowerCase().includes(keyword)
    );

    // Check if user mentioned creating a plan
    const hasPlanKeywords = ['plan', 'strategy', 'roadmap', 'approach'];
    const hasPlan = messages.some(msg => 
      hasPlanKeywords.some(keyword => 
        msg.content.toLowerCase().includes(keyword)
      )
    );

    return {
      tool_call_count: toolCallCount,
      has_plan: hasPlan,
      original_task: originalTask || lastUserMessage,
      task_complexity: isComplex ? 'complex' : 'simple'
    };
  }

  /**
   * Detect domain hints from user message
   */
  detectDomainHints(userPrompt: string): string[] {
    const hints: string[] = [];
    const prompt = userPrompt.toLowerCase();

    // Programming related
    if (prompt.match(/\b(code|program|function|class|script|debug|refactor|implement)\b/)) {
      hints.push('programming');
    }

    // File system related  
    if (prompt.match(/\b(file|folder|directory|path|read|write|save|delete)\b/)) {
      hints.push('filesystem');
    }

    // Analysis related
    if (prompt.match(/\b(analyze|data|csv|excel|chart|graph|statistics|trends)\b/)) {
      hints.push('analysis');
    }

    // System administration
    if (prompt.match(/\b(server|deploy|config|install|setup|service|process)\b/)) {
      hints.push('system');
    }

    return hints;
  }

  /**
   * Development fallback prompt when Electron API is not available
   */
  private getDevFallbackPrompt(request: PromptRequest): PromptResponse {
    return {
      system_prompt: 'You are a helpful AI assistant. Use available tools to help the user.',
      fallback: true
    };
  }

  /**
   * Check if prompt composer is available
   */
  get available(): boolean {
    return this.isAvailable;
  }
}
