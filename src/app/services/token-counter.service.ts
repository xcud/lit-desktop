import { Injectable } from '@angular/core';
import { ChatMessage } from './ollama.service';

@Injectable({
  providedIn: 'root'
})
export class TokenCounterService {

  constructor() { }

  /**
   * Count tokens in a single text string using approximation
   * Based on the rule: 1 token ≈ 0.75 words ≈ 4 characters
   */
  countTokens(text: string): number {
    if (!text || text.trim().length === 0) {
      return 0;
    }
    
    // Simple but effective approximation
    // Method 1: Character count / 4 (common rule of thumb)
    const charCount = text.length;
    const charBasedTokens = Math.ceil(charCount / 4);
    
    // Method 2: Word count / 0.75 (another common approximation)
    const words = text.trim().split(/\s+/).length;
    const wordBasedTokens = Math.ceil(words / 0.75);
    
    // Use average of both methods for better accuracy
    return Math.round((charBasedTokens + wordBasedTokens) / 2);
  }

  /**
   * Count tokens in an entire conversation
   */
  countConversationTokens(messages: ChatMessage[]): number {
    if (!messages || messages.length === 0) {
      return 0;
    }

    let totalTokens = 0;
    
    for (const message of messages) {
      // Count message content
      totalTokens += this.countTokens(message.content);
      
      // Add small overhead for message structure/metadata
      // (role, timestamp, etc. - roughly 5-10 tokens per message)
      totalTokens += 8;
    }

    return totalTokens;
  }

  /**
   * Get display string for token count
   */
  formatTokenCount(conversationTokens: number, draftTokens: number = 0): string {
    if (draftTokens > 0) {
      const newTotal = conversationTokens + draftTokens;
      return `~${conversationTokens.toLocaleString()} tokens (${newTotal.toLocaleString()} if sent)`;
    } else {
      return `~${conversationTokens.toLocaleString()} tokens`;
    }
  }
}
