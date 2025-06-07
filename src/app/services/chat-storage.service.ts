import { Injectable } from '@angular/core';
import { TitleGeneratorService } from '../utils/title-generator.service';
import { EventService } from './event.service';

// Interface for chat session stored in local storage
export interface ChatSession {
  id: string;
  title: string;
  created: number;
  updated: number;
}

// Interface for chat message
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
  model?: string;
}

// Interface for stored chat history
export interface StoredChat {
  messages: ChatMessage[];
  title: string;
  created: number;
  updated: number;
}

// Milliseconds per day for date calculations
const MS_PER_DAY = 1000 * 60 * 60 * 24;

@Injectable({
  providedIn: 'root'
})
export class ChatStorageService {
  private readonly SESSIONS_KEY = 'lit-chat-sessions';
  private readonly CHAT_PREFIX = 'lit-chat-';
  
  constructor(
    private titleGenerator: TitleGeneratorService,
    private eventService: EventService
  ) {
    // Initialize storage with dummy data if empty
    if (this.getSessions().length === 0) {
      console.debug('Initializing chat storage with dummy data');
      this.createSession('New Chat');
    }
  }
  
  // Get all chat sessions
  getSessions(): ChatSession[] {
    try {
      const sessions = localStorage.getItem(this.SESSIONS_KEY);
      if (!sessions) {
        return [];
      }
      
      const parsedSessions = JSON.parse(sessions);
      console.debug('Got sessions from storage:', parsedSessions);
      return parsedSessions;
    } catch (error) {
      console.error('Error parsing sessions:', error);
      return [];
    }
  }
  
  // Save chat sessions
  saveSessions(sessions: ChatSession[]): void {
    try {
      localStorage.setItem(this.SESSIONS_KEY, JSON.stringify(sessions));
      console.debug('Saved sessions to storage:', sessions);
    } catch (error) {
      console.error('Error saving sessions:', error);
    }
  }
  
  // Create a new chat session
  createSession(title: string = 'New Chat'): ChatSession {
    const sessions = this.getSessions();
    const id = this.generateId();
    
    const newSession: ChatSession = {
      id,
      title,
      created: Date.now(),
      updated: Date.now()
    };
    
    // Create empty chat history
    this.saveChat(id, {
      messages: [],
      title,
      created: newSession.created,
      updated: newSession.updated
    });
    
    // Add to sessions list
    sessions.push(newSession);
    this.saveSessions(sessions);
    
    console.debug('Created new session:', newSession);
    return newSession;
  }

  // Create a temporary session (not persisted until first message)
  createTemporarySession(title: string = 'New Chat'): ChatSession {
    const id = this.generateId();
    
    const tempSession: ChatSession = {
      id,
      title,
      created: Date.now(),
      updated: Date.now()
    };
    
    console.debug('Created temporary session:', tempSession);
    return tempSession;
  }

  // Persist a temporary session with its first message
  persistSessionWithFirstMessage(session: ChatSession, message: ChatMessage): void {
    // Create the chat history with first message
    this.saveChat(session.id, {
      messages: [message],
      title: session.title,
      created: session.created,
      updated: Date.now()
    });
    
    // Add to sessions list
    const sessions = this.getSessions();
    sessions.push({
      ...session,
      updated: Date.now()
    });
    this.saveSessions(sessions);
    
    // Generate title if this is a user message (same logic as addMessage)
    if (message.role === 'user') {
      this.generateTitleAsync(session.id, message.content);
    }
    
    console.debug('Persisted temporary session with first message:', session.id);
  }
  
  // Delete a chat session
  deleteSession(id: string): void {
    try {
      // Remove from sessions list
      const sessions = this.getSessions().filter(session => session.id !== id);
      this.saveSessions(sessions);
      
      // Remove chat history
      localStorage.removeItem(this.CHAT_PREFIX + id);
      console.debug('Deleted session:', id);
    } catch (error) {
      console.error('Error deleting session:', error);
    }
  }
  
  // Rename a chat session
  renameSession(id: string, title: string): void {
    try {
      // Update sessions list
      const sessions = this.getSessions();
      const session = sessions.find(s => s.id === id);
      if (session) {
        session.title = title;
        session.updated = Date.now();
        this.saveSessions(sessions);
        
        // Update chat history
        const chat = this.getChat(id);
        if (chat) {
          chat.title = title;
          chat.updated = session.updated;
          this.saveChat(id, chat);
        }
        
        console.debug('Renamed session:', id, 'to', title);
        
        // Emit an event to notify subscribers that a title has been updated
        this.eventService.emitTitleUpdate(id);
      }
    } catch (error) {
      console.error('Error renaming session:', error);
    }
  }
  
  // Get chat history for a session
  getChat(id: string): StoredChat | null {
    try {
      const chat = localStorage.getItem(this.CHAT_PREFIX + id);
      if (!chat) {
        return null;
      }
      
      console.debug('Got chat from storage:', id);
      return JSON.parse(chat);
    } catch (error) {
      console.error('Error parsing chat:', error);
      return null;
    }
  }
  
  // Save chat history for a session
  saveChat(id: string, chat: StoredChat): void {
    try {
      localStorage.setItem(this.CHAT_PREFIX + id, JSON.stringify(chat));
      
      // Update the session's updated timestamp
      const sessions = this.getSessions();
      const session = sessions.find(s => s.id === id);
      if (session) {
        session.updated = Date.now();
        this.saveSessions(sessions);
      }
      
      console.debug('Saved chat to storage:', id);
    } catch (error) {
      console.error('Error saving chat:', error);
    }
  }
  
  // Add a message to chat history
  addMessage(id: string, message: ChatMessage): void {
    try {
      console.debug('Adding message to chat:', id, message);
      
      let chat = this.getChat(id);
      if (!chat) {
        // Create a new chat if it doesn't exist
        chat = {
          messages: [],
          title: 'New Chat',
          created: Date.now(),
          updated: Date.now()
        };
      }
      
      // Add message to history
      chat.messages.push(message);
      chat.updated = Date.now();
      
      // Save updated chat
      this.saveChat(id, chat);
      
      console.debug('Added message to chat:', id, 'Message count:', chat.messages.length);
      
      // If this is the first user message, generate a title asynchronously
      if (chat.messages.length === 1 && message.role === 'user') {
        this.generateTitleAsync(id, message.content);
      }
    } catch (error) {
      console.error('Error adding message:', error);
    }
  }
  
  // Group sessions by timeframe: Today, Yesterday, Previous 7 Days, etc.
  getGroupedSessions(): [string, ChatSession[]][] {
    // Get the timestamp for the start of today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = today.getTime();
    
    // Sort sessions by updated time, newest first
    const sessions = this.getSessions().sort((a, b) => b.updated - a.updated);
    
    // Helper function to determine the timeframe for a session
    const getTimeframe = (session: ChatSession): string => {
      if (session.updated >= todayTimestamp) return 'Today';
      else if (session.updated >= todayTimestamp - MS_PER_DAY) return 'Yesterday';
      else if (session.updated >= todayTimestamp - (MS_PER_DAY * 7)) return 'Previous 7 Days';
      else if (session.updated >= todayTimestamp - (MS_PER_DAY * 30)) return 'Previous 30 Days';
      return new Date(session.updated).getFullYear().toString();
    };
    
    // Group sessions by timeframe
    const groupedSessions: [string, ChatSession[]][] = [];
    const seenTimeframes = new Set<string>();
    
    sessions.forEach(session => {
      const timeframe = getTimeframe(session);
      
      if (seenTimeframes.has(timeframe)) {
        // Add to existing timeframe group
        const index = groupedSessions.findIndex(([frame]) => frame === timeframe);
        if (index !== -1) {
          groupedSessions[index][1].push(session);
        }
      } else {
        // Create a new timeframe group
        groupedSessions.push([timeframe, [session]]);
        seenTimeframes.add(timeframe);
      }
    });
    
    return groupedSessions;
  }
  
  // Generate a title asynchronously for a new chat session
  private async generateTitleAsync(id: string, firstMessage: string): Promise<void> {
    try {
      // Start with a temporary title based on the message - use more characters before truncating
      const tempTitle = firstMessage.substring(0, 60) + (firstMessage.length > 60 ? '...' : '');
      
      // Update the session with a temporary title
      this.renameSession(id, tempTitle);
      
      // Get the default model from settings or use a fallback
      const defaultModel = localStorage.getItem('defaultModel') || 'llama3:latest';
      
      // Generate a title asynchronously
      const title = await this.titleGenerator.generateTitle(firstMessage, defaultModel);
      
      // Only update if we got a reasonable title
      if (title && title.length > 0 && title.length < 100) {
        console.debug('Generated title:', title);
        this.renameSession(id, title);
      }
    } catch (error) {
      console.error('Error generating title:', error);
    }
  }
  
  // Generate a random ID for a chat session
  private generateId(): string {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }
}