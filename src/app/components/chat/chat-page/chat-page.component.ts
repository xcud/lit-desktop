import { Component, OnInit, NgZone, ChangeDetectorRef, HostListener, ViewChild, OnDestroy } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { OllamaService, ModelInfo, ChatMessage } from '../../../services/ollama.service';
import { ChatStorageService, ChatSession } from '../../../services/chat-storage.service';
import { SettingsService } from '../../../services/settings.service';
import { EventService } from '../../../services/event.service';
import { ChatCommandsService } from '../../../services/chat-commands.service';
import { PromptComposerService } from '../../../services/prompt-composer.service';
import { SettingsDialogComponent } from '../../../components/settings/settings-dialog.component';
import { SplitComponent } from 'angular-split';
import { Subscription } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import { ChatScreenComponent } from '../chat-screen/chat-screen.component';

@Component({
  selector: 'app-chat-page',
  templateUrl: './chat-page.component.html',
  styleUrls: ['./chat-page.component.scss']
})
export class ChatPageComponent implements OnInit, OnDestroy {
  @ViewChild('split') splitComponent: SplitComponent;
  @ViewChild(ChatScreenComponent) chatScreen: ChatScreenComponent;
  @ViewChild('chatInput') chatInput: any;
  
  availableModels: ModelInfo[] = [];
  selectedModel: string = 'llama3:latest'; // Default value
  messages: ChatMessage[] = [];
  currentInput: string = '';
  isLoading: boolean = false;
  
  // Set to true by default to show the sidebar initially
  sidebarOpen: boolean = true;
  sidebarSize: number = 220; // Default sidebar size in pixels
  
  currentSessionId: string;
  sessions: [string, ChatSession[]][] = [];
  
  // Track if current session is temporary (not yet persisted)
  private isCurrentSessionTemporary: boolean = false;
  private currentTemporarySession: ChatSession | null = null;
  
  // Multi-select conversation properties
  public selectionMode: boolean = false;
  public selectedSessions: Set<string> = new Set();
  private lastSelectedIndex: number = -1;
  private longPressTimer: any = null;
  
  // Store the cancel function for the current stream
  private _cancelCurrentStream: (() => void) | null = null;
  
  // Subscription for title updates
  private titleSubscription: Subscription;
  
  constructor(
    private ollamaService: OllamaService,
    private chatStorage: ChatStorageService,
    private settings: SettingsService,
    private changeDetector: ChangeDetectorRef,
    private dialog: MatDialog,
    private eventService: EventService,
    private chatCommandsService: ChatCommandsService,
    private promptComposerService: PromptComposerService,
    private ngZone: NgZone
  ) {
    // Initialize with a default value that will be overridden once settings load
    this.selectedModel = 'llama3:latest';
    
    // Subscribe to title updates
    this.titleSubscription = this.eventService.titleUpdated$.subscribe(sessionId => {
      console.debug('Title updated for session:', sessionId);
      // Refresh the sessions list to show the new title
      this.refreshSessions();
    });
  }
  
  async ngOnInit() {
    // Initialize sidebar size from storage or use default
    const savedSidebarSize = localStorage.getItem('sidebarSize');
    if (savedSidebarSize) {
      const saved = parseInt(savedSidebarSize, 10);
      // If saved size is too wide (old default was 280), reset to new default
      this.sidebarSize = saved > 250 ? 220 : saved;
    }
    
    // Set model from settings - safely handle the case where settings aren't loaded yet
    try {
      this.selectedModel = this.settings.defaultModel;
    } catch (error) {
      console.error('Error loading default model from settings:', error);
      // Keep using the default we set in the constructor
    }
    
    // Load available models
    await this.loadModels();
    
    // Load chat sessions
    try {
      this.sessions = this.chatStorage.getGroupedSessions();
      
      // Load last session or create a temporary one
      if (this.getAllSessions().length === 0) {
        // No existing sessions - create a temporary session (like server behavior)
        const tempSession = this.chatStorage.createTemporarySession();
        this.currentSessionId = tempSession.id;
        this.currentTemporarySession = tempSession;
        this.isCurrentSessionTemporary = true;
        this.messages = [];
        // Don't refresh sessions yet - temporary session shouldn't appear in list
      } else {
        // Get the most recent session
        const mostRecent = this.getAllSessions().sort((a, b) => b.updated - a.updated)[0];
        this.currentSessionId = mostRecent.id;
        this.isCurrentSessionTemporary = false;
        this.currentTemporarySession = null;
        
        // Load messages
        const chat = this.chatStorage.getChat(this.currentSessionId);
        if (chat) {
          this.messages = chat.messages.map(msg => ({
            isSelf: msg.role === 'user',
            content: msg.content,
            timestamp: msg.timestamp,
            model: msg.model
          }));
        }
      }
    } catch (error) {
      console.error('Error loading chat sessions:', error);
      // Create a temporary session as fallback
      try {
        const tempSession = this.chatStorage.createTemporarySession();
        this.currentSessionId = tempSession.id;
        this.currentTemporarySession = tempSession;
        this.isCurrentSessionTemporary = true;
        this.messages = [];
      } catch (e) {
        console.error('Fatal error initializing chat session:', e);
      }
    }
    
    // Set up window resize listener to update title truncation
    window.addEventListener('resize', this.handleResize.bind(this));
    
    // Initialize title truncation
    setTimeout(() => this.updateTitleTruncation(), 100);
  }
  
  // Handle window resize
  handleResize(): void {
    this.updateTitleTruncation();
  }
  
  // Clean up event listeners
  ngOnDestroy(): void {
    window.removeEventListener('resize', this.handleResize.bind(this));
    
    // Cancel any active streams
    if (this._cancelCurrentStream) {
      this._cancelCurrentStream();
      this._cancelCurrentStream = null;
    }
    
    // Clear any long press timer
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
    
    // Unsubscribe from title updates to prevent memory leaks
    if (this.titleSubscription) {
      this.titleSubscription.unsubscribe();
    }
  }

  // Multi-select conversation helper methods
  public get hasSelectedSessions(): boolean {
    return this.selectedSessions.size > 0;
  }

  public get selectedSessionsCount(): number {
    return this.selectedSessions.size;
  }

  public isSessionSelected(session: ChatSession): boolean {
    return this.selectedSessions.has(this.getSessionId(session));
  }

  public isActiveSession(session: ChatSession): boolean {
    return this.currentSessionId === this.getSessionId(session);
  }

  private getSessionId(session: ChatSession): string {
    return session.id;
  }

  private getFlatSessionsList(): ChatSession[] {
    const flatList: ChatSession[] = [];
    this.sessions.forEach(([timeframe, sessions]) => {
      flatList.push(...sessions);
    });
    return flatList;
  }

  @HostListener('keydown', ['$event'])
  onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape' && this.selectionMode) {
      this.exitSelectionMode();
    }
  }

  public get hasActiveSession(): boolean {
    return !!this.currentSessionId && this.findSessionByUuid(this.currentSessionId) !== null;
  }
  
  // Add a method to refresh sessions
  refreshSessions(): void {
    console.debug('Refreshing sessions...');
    this.sessions = this.chatStorage.getGroupedSessions();
    this.changeDetector.detectChanges();
  }
  
  // Adjust chat-list width when sidebar size changes
  onSplitDragEnd(event: any): void {
    if (this.sidebarOpen) {
      // Save the sidebar size
      this.sidebarSize = event.sizes[0];
      localStorage.setItem('sidebarSize', this.sidebarSize.toString());
      
      // Trigger recalculation of title truncation
      this.updateTitleTruncation();
    }
  }
  
  // Helper method to update title truncation based on sidebar width
  updateTitleTruncation(): void {
    // We'll use CSS variables to control the truncation dynamically
    const root = document.documentElement;
    
    // Get the current sidebar width in pixels
    const sidebarEl = document.querySelector('.sidebar');
    if (sidebarEl) {
      const sidebarWidth = sidebarEl.clientWidth;
      
      // Add some margin for the button (24px) and padding (16px)
      const availableWidth = sidebarWidth - 40;
      
      // Set the CSS variable for max-width of chat titles
      root.style.setProperty('--chat-title-max-width', `${availableWidth}px`);
    }
  }
  
  // Toggle sidebar visibility
  toggleSidebar(): void {
    console.debug('Toggle sidebar from', this.sidebarOpen, 'to', !this.sidebarOpen);
    
    if (this.sidebarOpen) {
      // Save current sidebar size before closing
      localStorage.setItem('sidebarSize', this.sidebarSize.toString());
      this.sidebarOpen = false;
    } else {
      // Restore sidebar size when opening
      const savedSize = localStorage.getItem('sidebarSize');
      if (savedSize) {
        this.sidebarSize = parseInt(savedSize, 10);
      } else {
        this.sidebarSize = 280; // Default size
      }
      this.sidebarOpen = true;
    }
    
    // Force the split component to update
    setTimeout(() => {
      if (this.splitComponent) {
        this.changeDetector.detectChanges();
        // Force recalculation
        window.dispatchEvent(new Event('resize'));
      }
      
      // Update title truncation after sidebar opens
      if (this.sidebarOpen) {
        setTimeout(() => this.updateTitleTruncation(), 300);
      }
    }, 100);
  }
  
  // Get model icon
  getModelIcon(modelId: string): string {
    const model = this.availableModels.find(m => m.model === modelId);
    return model?.icon || 'smart_toy';
  }
  
  // Get model name
  getModelName(modelId: string): string {
    const model = this.availableModels.find(m => m.model === modelId);
    return model?.name || modelId;
  }

  // Debug method for input issues
  onInputChange(event: any) {
    // Run in Angular zone to ensure change detection works
    this.ngZone.run(() => {
      this.currentInput = event.target.value;
      this.changeDetector.detectChanges();
    });
  }

  onInputFocus() {
    // Input focused
  }

  onInputBlur() {
    // Input blurred
  }

  // Check if send button should be disabled
  isDisabled(): boolean {
    return !this.currentInput || this.currentInput.trim().length === 0 || this.isLoading;
  }
  
  // Send a message
  async sendMessage() {
    console.log('🚀 START: sendMessage called, isDisabled:', this.isDisabled());
    
    if (this.isDisabled()) return;
    
    const userMessage = this.currentInput.trim();
    console.log('📝 User message captured:', userMessage);
    this.currentInput = '';
    
    // Check if it's a special command
    try {
      console.log('🔍 Checking for special commands...');
      const commandResponse = await firstValueFrom(this.chatCommandsService.processCommand(userMessage));
      
      if (commandResponse) {
        // It's a command, add user message to UI
        this.messages.push({
          isSelf: true,
          content: userMessage,
          timestamp: new Date().toISOString()
        });
        
        // Add command response to UI
        this.messages.push({
          isSelf: false,
          content: commandResponse.content,
          timestamp: new Date().toISOString(),
          model: 'system'
        });
        
        // Handle temporary session persistence for commands
        if (this.isCurrentSessionTemporary && this.currentTemporarySession) {
          // First message in temporary session - persist the session with this message
          console.debug('Persisting temporary session with command');
          this.chatStorage.persistSessionWithFirstMessage(this.currentTemporarySession, {
            role: 'user',
            content: userMessage,
            timestamp: new Date().toISOString()
          });
          
          // Add the response to the now-persisted session
          this.chatStorage.addMessage(this.currentSessionId, {
            role: 'assistant',
            content: commandResponse.content,
            timestamp: new Date().toISOString(),
            model: 'system'
          });
          
          // Clear temporary session state
          this.isCurrentSessionTemporary = false;
          this.currentTemporarySession = null;
          
          // Refresh sessions to show the newly persisted session
          this.refreshSessions();
        } else {
          // Regular command handling for existing sessions
          this.chatStorage.addMessage(this.currentSessionId, {
            role: 'user',
            content: userMessage,
            timestamp: new Date().toISOString()
          });
          
          this.chatStorage.addMessage(this.currentSessionId, {
            role: 'assistant',
            content: commandResponse.content,
            timestamp: new Date().toISOString(),
            model: 'system'
          });
        }
        
        // Force change detection to trigger scrolling
        this.changeDetector.detectChanges();
        
        // Give the UI a moment to render, then scroll to bottom
        setTimeout(() => {
          if (this.chatScreen) {
            console.debug('Manually scrolling to bottom after command execution');
            this.chatScreen.scrollToBottom();
            this.changeDetector.detectChanges();
          }
        }, 100);
        
        return;
      }
    } catch (error) {
      console.error('Error processing command:', error);
    }
    
    console.log('✅ Not a command, proceeding with normal chat flow...');
    
    // Not a command, process normally
    
    // Add user message to UI
    this.messages.push({
      isSelf: true,
      content: userMessage,
      timestamp: new Date().toISOString()
    });
    
    // Handle temporary session persistence (like the server)
    if (this.isCurrentSessionTemporary && this.currentTemporarySession) {
      // First message in temporary session - persist the session with this message
      console.debug('Persisting temporary session with first message');
      this.chatStorage.persistSessionWithFirstMessage(this.currentTemporarySession, {
        role: 'user',
        content: userMessage,
        timestamp: new Date().toISOString()
      });
      
      // Clear temporary session state
      this.isCurrentSessionTemporary = false;
      this.currentTemporarySession = null;
      
      // Refresh sessions to show the newly persisted session
      this.refreshSessions();
    } else {
      // Regular message addition for existing sessions
      this.chatStorage.addMessage(this.currentSessionId, {
        role: 'user',
        content: userMessage,
        timestamp: new Date().toISOString()
      });
    }
    
    // Check if this is the first message in a chat - this will trigger title generation
    const chat = this.chatStorage.getChat(this.currentSessionId);
    const isFirstMessage = chat && chat.messages.length === 1;
    if (isFirstMessage) {
      console.debug('First message detected - title generation will occur');
      // Schedule a refresh to ensure the UI updates when the title is generated
      setTimeout(() => this.refreshSessions(), 1000); // First refresh for temp title
      setTimeout(() => this.refreshSessions(), 5000); // Later refresh for AI-generated title
    }
    
    // Set loading state
    console.log('🚀 Starting sendMessage flow...');
    this.isLoading = true;
    
    try {
      console.log('🔧 Getting session state and MCP config...');
      // Get current session state
      const sessionState = this.chatStorage.getSessionState(this.currentSessionId);
      
      // Get MCP configuration
      const mcpConfigStr = await window.electron?.app?.readMcpConfig?.() || '{}';
      let mcpConfig;
      try {
        mcpConfig = JSON.parse(mcpConfigStr);
      } catch (e) {
        console.warn('Failed to parse MCP config, using empty config:', e);
        mcpConfig = { mcpServers: {} };
      }
      
      // Create session state for prompt composer
      const promptSessionState = this.promptComposerService.createSessionState(
        this.messages,
        sessionState?.tool_call_count || 0,
        sessionState?.original_task
      );
      
      // Detect domain hints from user message
      const domainHints = this.promptComposerService.detectDomainHints(userMessage);
      
      // Generate system prompt using prompt-composer
      console.log('🧠 About to call prompt-composer with request:', {
        user_prompt: userMessage,
        mcp_config_keys: Object.keys(mcpConfig.mcpServers || {}),
        session_state: promptSessionState
      });
      
      const promptResponse = await this.promptComposerService.generateSystemPrompt({
        user_prompt: userMessage,
        mcp_config: mcpConfig,
        session_state: promptSessionState,
        domain_hints: domainHints
      });
      
      console.log('🎯 Prompt-composer response:', {
        system_prompt_length: promptResponse.system_prompt?.length || 0,
        fallback: promptResponse.fallback || false,
        recognized_tools_count: (promptResponse as any).recognized_tools?.length || 0,
        applied_modules: (promptResponse as any).applied_modules || [],
        has_complexity: !!(promptResponse as any).complexity_assessment
      });
      
      // Prepare messages for Ollama
      const ollamaMessages = this.messages.map(msg => ({
        role: msg.isSelf ? 'user' : 'assistant',
        content: msg.content
      }));
      
      // Add system prompt as the first message if we got one
      if (promptResponse.system_prompt && promptResponse.system_prompt.trim()) {
        console.log('✅ Injecting system prompt into ollamaMessages (length:', promptResponse.system_prompt.length, 'chars)');
        ollamaMessages.unshift({
          role: 'system',
          content: promptResponse.system_prompt
        });
      } else {
        console.log('⚠️ No system prompt to inject');
      }
      
      console.log('📤 Final ollamaMessages being sent to Ollama:', {
        message_count: ollamaMessages.length,
        has_system_message: ollamaMessages[0]?.role === 'system',
        system_prompt_preview: ollamaMessages[0]?.role === 'system' ? 
          ollamaMessages[0].content.substring(0, 100) + '...' : 'none'
      });
      
      // Create a streaming message to show progress
      this.messages.push({
        isSelf: false,
        content: '',
        timestamp: new Date().toISOString(),
        model: this.selectedModel,
        isStreaming: true
      });
      
      // Use streaming to show real-time updates
      let fullContent = '';
      const streamingMsgIndex = this.messages.length - 1;
      
      // Force scroll to bottom when adding the streaming message
      setTimeout(() => {
        if (this.chatScreen) {
          console.debug('Scrolling to bottom after adding streaming message');
          this.chatScreen.scrollToBottom();
          this.changeDetector.detectChanges();
        }
      }, 50);
      
      // Use a function to update the messages in a way that triggers change detection
      const updateStreamingMessage = (content: string, done = false) => {
        console.debug(`Updating streaming message, content length: ${content.length}, done: ${done}`);
        
        if (this.messages[streamingMsgIndex]) {
          this.messages[streamingMsgIndex].content = content;
          if (done) {
            this.messages[streamingMsgIndex].isStreaming = false;
          }
          
          // Create a new array reference to trigger change detection
          this.messages = [...this.messages];
          
          // Force change detection
          this.changeDetector.detectChanges();
          console.debug('Change detection triggered');
        } else {
          console.error('streamingMsgIndex is out of bounds:', streamingMsgIndex, 'array length:', this.messages.length);
        }
      };
      
      // Store the cancel function for later use in cancelGeneration
      this._cancelCurrentStream = this.ollamaService.streamChat(
        this.selectedModel, 
        ollamaMessages,
        { temperature: 0.0 },
        (chunk) => {
          console.debug("Received chunk:", chunk);
          if (!chunk.done) {
            console.debug(`Adding chunk content, length: ${chunk.content?.length || 0}`);
            // Update the streaming message with new content
            fullContent += chunk.content || '';
            updateStreamingMessage(fullContent);
          } else {
            console.debug('Stream complete, finalizing message');
            // Streaming is complete
            updateStreamingMessage(fullContent, true);
            
            // Add the final message to storage
            this.chatStorage.addMessage(this.currentSessionId, {
              role: 'assistant',
              content: fullContent,
              timestamp: new Date().toISOString(),
              model: this.selectedModel
            });
            
            this.isLoading = false;
            this._cancelCurrentStream = null;
          }
        }
      );
      
    } catch (error) {
      console.error('Error sending message:', error);
      
      // Remove streaming message if it exists
      if (this.messages[this.messages.length - 1].isStreaming) {
        this.messages.pop();
      }
      
      // Add error message
      this.messages.push({
        isSelf: false,
        content: 'An error occurred: ' + (error.message || 'Please try again.'),
        isError: true,
        timestamp: new Date().toISOString()
      });
      
      this.isLoading = false;
      this._cancelCurrentStream = null;
    }
  }
  
  // Cancel the ongoing chat generation
  cancelGeneration(): void {
    console.debug('Canceling chat generation');
    
    // First cancel the stream if it exists
    if (this._cancelCurrentStream) {
      console.debug('Canceling active stream');
      this._cancelCurrentStream();
      this._cancelCurrentStream = null;
    }
    
    if (this.isLoading && this.messages.length > 0) {
      // Get the last message which should be the streaming one
      const lastMsg = this.messages[this.messages.length - 1];
      if (lastMsg.isStreaming) {
        // Instead of removing the message, keep its content but mark it as no longer streaming
        const preservedContent = lastMsg.content;
        
        if (preservedContent && preservedContent.trim().length > 0) {
          // Keep the message but mark it as no longer streaming and append a note
          lastMsg.isStreaming = false;
          lastMsg.content = preservedContent + '\n\n_(Generation was cancelled)_';
          
          // Add the message to storage to persist it
          this.chatStorage.addMessage(this.currentSessionId, {
            role: 'assistant',
            content: lastMsg.content,
            timestamp: lastMsg.timestamp || new Date().toISOString(),
            model: lastMsg.model
          });
          
          // Force update to trigger change detection
          this.messages = [...this.messages];
        } else {
          // If there's no content yet, just remove the message
          this.messages.pop();
        }
      }
      this.isLoading = false;
    }
  }
  
  // Create a new chat session (temporary, like the server)
  newChat() {
    // Create a temporary session that won't appear in sessions list until first message
    const tempSession = this.chatStorage.createTemporarySession();
    this.currentSessionId = tempSession.id;
    this.currentTemporarySession = tempSession;
    this.isCurrentSessionTemporary = true;
    this.messages = [];
    
    console.debug('Created temporary session:', tempSession.id);
    // Note: Don't refresh sessions yet - temporary session shouldn't appear in list
  }
  
  // Helper method removed - keep it simple like the server
  
  // Select an existing chat session
  selectChat(sessionId: string) {
    // Clear temporary session state when switching to a persisted session
    this.isCurrentSessionTemporary = false;
    this.currentTemporarySession = null;
    
    this.currentSessionId = sessionId;
    const chat = this.chatStorage.getChat(sessionId);
    if (chat) {
      this.messages = chat.messages.map(msg => ({
        isSelf: msg.role === 'user',
        content: msg.content,
        timestamp: msg.timestamp,
        model: msg.model
      }));
    } else {
      this.messages = [];
    }
  }
  
  // Delete a chat session
  deleteChat(sessionId: string, event: Event) {
    event.stopPropagation();
    
    this.chatStorage.deleteSession(sessionId);
    this.sessions = this.chatStorage.getGroupedSessions();
    
    // If we deleted the current session, select another one
    if (sessionId === this.currentSessionId) {
      const allSessions = this.getAllSessions();
      if (allSessions.length > 0) {
        this.selectChat(allSessions[0].id);
      } else {
        // If no sessions left, create a new one
        const newSession = this.chatStorage.createSession();
        this.currentSessionId = newSession.id;
        this.sessions = this.chatStorage.getGroupedSessions();
        this.messages = [];
      }
    }
  }
  
  // Rename a chat session
  async renameChat(sessionId: string, event: Event) {
    event.stopPropagation();
    
    // Find the session in any of the timeframe groups
    let session: ChatSession | undefined;
    for (const [_, groupSessions] of this.sessions) {
      const foundSession = groupSessions.find(s => s.id === sessionId);
      if (foundSession) {
        session = foundSession;
        break;
      }
    }
    
    if (!session) return;
    
    // Use Electron-safe rename dialog
    const newTitle = await this.showRenameDialog(session.title);
    
    if (newTitle && newTitle.trim()) {
      this.chatStorage.renameSession(sessionId, newTitle.trim());
      this.sessions = this.chatStorage.getGroupedSessions();
    }
  }
  
  // Simple rename dialog for Electron environment
  private showRenameDialog(currentTitle: string): Promise<string | null> {
    return new Promise((resolve) => {
      const userInput = document.createElement('input');
      userInput.type = 'text';
      userInput.value = currentTitle;
      userInput.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        z-index: 10000;
        padding: 8px 12px;
        border: 2px solid #1976d2;
        border-radius: 4px;
        font-size: 14px;
        background: white;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      `;
      
      document.body.appendChild(userInput);
      userInput.focus();
      userInput.select();
      
      const cleanup = () => {
        document.body.removeChild(userInput);
      };
      
      userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          cleanup();
          resolve(userInput.value.trim() || null);
        } else if (e.key === 'Escape') {
          cleanup();
          resolve(null);
        }
      });
      
      userInput.addEventListener('blur', () => {
        cleanup();
        resolve(userInput.value.trim() || null);
      });
    });
  }
  
  // Change the model
  changeModel(model: string) {
    this.selectedModel = model;
    try {
      this.settings.defaultModel = model;
    } catch (error) {
      console.error('Error saving default model to settings:', error);
    }
  }
  
  // Window control methods
  minimizeWindow() {
    if (typeof window !== 'undefined' && window.electron) {
      window.electron.app.minimize();
    }
  }
  
  maximizeWindow() {
    if (typeof window !== 'undefined' && window.electron) {
      window.electron.app.maximize();
    }
  }
  
  closeWindow() {
    if (typeof window !== 'undefined' && window.electron) {
      window.electron.app.close();
    }
  }
  
  // Load available models
  private async loadModels(): Promise<void> {
    try {
      this.availableModels = await this.ollamaService.listModels();
      console.debug('Available models:', this.availableModels);
    } catch (error) {
      console.error('Error loading models:', error);
      // Set up some default models as fallback
      this.availableModels = [
        { model: 'llama3:latest', name: 'Llama 3', icon: 'pets' },
        { model: 'mistral:latest', name: 'Mistral', icon: 'air' }
      ];
    }
  }
  
  // Handle keydown for chat input
  handleKeydown(event: KeyboardEvent) {
    console.debug('⌨️ Keydown event:', event.key, 'shiftKey:', event.shiftKey);
    
    if (event.key === 'Enter' && !event.shiftKey) {
      console.debug('🎯 Enter key pressed, calling sendMessage...');
      event.preventDefault();
      this.sendMessage();
    }
  }
  
  // Open settings dialog
  openSettings(): void {
    const dialogRef = this.dialog.open(SettingsDialogComponent, {
      width: '600px',
      disableClose: false
    });
    
    dialogRef.afterClosed().subscribe(result => {
      if (result === true) {
        // Settings were saved, reload models
        this.loadModels();
      }
    });
  }
  
  // Get all sessions from the grouped structure
  private getAllSessions(): ChatSession[] {
    return this.sessions.reduce((allSessions, [_, groupSessions]) => {
      return allSessions.concat(groupSessions);
    }, [] as ChatSession[]);
  }

  // Selection mode management methods
  public enterSelectionMode(): void {
    if (!this.selectionMode) {
      this.selectionMode = true;
      this.clearTextSelection();
    }
  }

  public exitSelectionMode(): void {
    this.selectionMode = false;
    this.selectedSessions.clear();
    this.lastSelectedIndex = -1;
    this.clearTextSelection();
  }

  private clearTextSelection(): void {
    if (window.getSelection) {
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
      }
    }
  }

  public toggleSessionSelection(session: ChatSession): void {
    const sessionId = this.getSessionId(session);
    if (this.selectedSessions.has(sessionId)) {
      this.selectedSessions.delete(sessionId);
    } else {
      this.selectedSessions.add(sessionId);
    }

    // Update last selected index for potential shift-click operations
    const flatSessions = this.getFlatSessionsList();
    this.lastSelectedIndex = flatSessions.findIndex(s => this.getSessionId(s) === sessionId);
  }

  public selectSession(session: ChatSession): void {
    const sessionId = this.getSessionId(session);
    this.selectedSessions.add(sessionId);

    const flatSessions = this.getFlatSessionsList();
    this.lastSelectedIndex = flatSessions.findIndex(s => this.getSessionId(s) === sessionId);
  }

  public selectRangeFromTo(startSession: ChatSession, endSession: ChatSession): void {
    const flatSessions = this.getFlatSessionsList();
    const startIndex = flatSessions.findIndex(s => this.getSessionId(s) === this.getSessionId(startSession));
    const endIndex = flatSessions.findIndex(s => this.getSessionId(s) === this.getSessionId(endSession));

    if (startIndex >= 0 && endIndex >= 0) {
      const start = Math.min(startIndex, endIndex);
      const end = Math.max(startIndex, endIndex);

      for (let i = start; i <= end; i++) {
        this.selectedSessions.add(this.getSessionId(flatSessions[i]));
      }

      this.lastSelectedIndex = endIndex;
    } else {
      // Fallback if we can't find both sessions
      this.selectSession(endSession);
    }
  }

  private findSessionByUuid(uuid: string): ChatSession | null {
    const flatSessions = this.getFlatSessionsList();
    return flatSessions.find(session => this.getSessionId(session) === uuid) || null;
  }

  // Bulk action methods
  public bulkDeleteSessions(): void {
    if (this.selectedSessions.size === 0) return;

    const confirmMessage = `Delete ${this.selectedSessions.size} conversation${this.selectedSessions.size > 1 ? 's' : ''}?`;
    if (!confirm(confirmMessage)) return;

    // Delete each selected session
    this.selectedSessions.forEach(sessionId => {
      this.chatStorage.deleteSession(sessionId);
    });

    // Refresh sessions list
    this.sessions = this.chatStorage.getGroupedSessions();

    // Clear selection and exit selection mode
    this.selectedSessions.clear();
    this.exitSelectionMode();

    // If current chat was deleted, create a new one
    if (this.selectedSessions.has(this.currentSessionId)) {
      this.newChat();
    }
  }

  public selectAllSessions(): void {
    const flatSessions = this.getFlatSessionsList();
    flatSessions.forEach(session => {
      this.selectedSessions.add(this.getSessionId(session));
    });
  }

  public clearSelection(): void {
    this.selectedSessions.clear();
    this.lastSelectedIndex = -1;
  }

  // Individual session action methods
  public deleteActiveSession(): void {
    if (!this.hasActiveSession) return;

    const confirmMessage = `Delete this conversation?`;
    if (!confirm(confirmMessage)) return;

    this.deleteChat(this.currentSessionId, new Event('click'));
  }

  public renameActiveSession(): void {
    if (!this.hasActiveSession) return;

    const activeSession = this.findSessionByUuid(this.currentSessionId);
    if (activeSession) {
      this.renameChat(activeSession.id, new Event('click'));
    }
  }

  // Enhanced conversation interaction methods
  public onConversationClick(session: ChatSession, event: MouseEvent): void {
    if (event.ctrlKey || event.metaKey) {
      // Ctrl+click entry - selection already prevented in mousedown
      this.enterSelectionMode();

      // Select the currently active session if it exists
      if (this.currentSessionId) {
        const currentSession = this.findSessionByUuid(this.currentSessionId);
        if (currentSession) {
          this.selectSession(currentSession);
        }
      }

      // Toggle the clicked session
      this.toggleSessionSelection(session);
    } else if (event.shiftKey) {
      // Shift+click entry - selection already prevented in mousedown
      this.enterSelectionMode();

      // If we have a current session, select range from current to clicked
      if (this.currentSessionId) {
        const currentSession = this.findSessionByUuid(this.currentSessionId);
        if (currentSession) {
          this.selectRangeFromTo(currentSession, session);
        } else {
          // Fallback to just selecting the clicked session
          this.selectSession(session);
        }
      } else {
        // No current session, just select the clicked one
        this.selectSession(session);
      }
    } else if (!this.selectionMode) {
      // Normal single click - load conversation
      this.selectChat(session.id);
    } else {
      // Regular click in selection mode - toggle selection
      this.toggleSessionSelection(session);
    }
  }

  public onMouseDown(session: ChatSession, event: MouseEvent): void {
    // Prevent text selection for any special key combinations
    if (event.shiftKey || event.ctrlKey || event.metaKey) {
      event.preventDefault();
      event.stopPropagation();
      this.clearTextSelection();
      return; // Don't start long press timer for special clicks
    }

    // Handle long press for normal clicks only (left button, not in selection mode, no special keys)
    if (event.button === 0 && !this.selectionMode) {
      this.longPressTimer = setTimeout(() => {
        this.enterSelectionMode();
        this.selectSession(session);
        this.longPressTimer = null;
      }, 500);
    }
  }

  public onMouseUp(event: MouseEvent): void {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  }

  public onMouseLeave(event: MouseEvent): void {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  }

  public onMainChatAreaClick(event: MouseEvent): void {
    if (this.selectionMode) {
      // Only exit if clicking on the main chat area itself, not on child elements
      const target = event.target as HTMLElement;
      if (target.classList.contains('main-content') ||
          target.closest('.main-content') === event.currentTarget) {
        this.exitSelectionMode();
      }
    }
  }
}