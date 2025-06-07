import { Component, Input, OnInit, ViewChild, ElementRef, AfterViewChecked, ChangeDetectorRef, HostListener } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

export interface ChatMessage {
  isSelf: boolean;
  content: string;
  timestamp?: string;
  model?: string;
  isError?: boolean;
  isStreaming?: boolean;
}

@Component({
  selector: 'app-chat-screen',
  templateUrl: './chat-screen.component.html',
  styleUrls: ['./chat-screen.component.scss']
})
export class ChatScreenComponent implements OnInit, AfterViewChecked {
  @ViewChild('messagesContainer') private messagesContainer: ElementRef;
  
  @Input() messages: ChatMessage[] = [];
  @Input() loading: boolean = false;
  
  // Track if auto-scrolling should be enabled
  private autoScrollEnabled = true;
  
  // Track if content has been added since last viewcheck
  private contentAdded = false;
  
  // Show the scroll to bottom button
  showScrollToBottomButton = false;
  
  // Timer for scroll event throttling
  private scrollTimer: any = null;
  
  constructor(
    private changeDetector: ChangeDetectorRef,
    private snackBar: MatSnackBar
  ) { }
  
  ngOnInit(): void {
  }
  
  ngAfterViewChecked() {
    // Only auto-scroll if enabled
    if (this.autoScrollEnabled && this.contentAdded) {
      this.scrollToBottom();
      this.contentAdded = false;
    }
    
    // Ensure changes are detected
    this.changeDetector.detectChanges();
  }
  
  // Set content added flag whenever messages change
  ngOnChanges() {
    // If new message added or streaming content updated
    if (this.messages && this.messages.length > 0) {
      this.contentAdded = true;
      
      // Check if we should auto-scroll based on scroll position
      this.checkShouldAutoScroll();
    }
  }
  
  // Handle scroll events in the messages container
  @HostListener('scroll', ['$event'])
  onScroll(event: Event) {
    // Throttle scroll events
    if (this.scrollTimer) {
      clearTimeout(this.scrollTimer);
    }
    
    this.scrollTimer = setTimeout(() => {
      this.checkShouldAutoScroll();
    }, 100);
  }
  
  // Check if we should auto-scroll based on scroll position
  checkShouldAutoScroll() {
    if (!this.messagesContainer) return;
    
    const container = this.messagesContainer.nativeElement;
    
    // Calculate how far from bottom (in pixels)
    const scrollBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    
    // If we're close to the bottom (within 50px), enable auto-scroll
    const closeToBottom = scrollBottom < 50;
    
    this.autoScrollEnabled = closeToBottom;
    this.showScrollToBottomButton = !closeToBottom;
    
    // Ensure change detection
    this.changeDetector.detectChanges();
  }
  
  scrollToBottom(): void {
    try {
      if (this.messagesContainer) {
        const container = this.messagesContainer.nativeElement;
        container.scrollTop = container.scrollHeight;
        
        // Hide scroll button when we're at the bottom
        this.showScrollToBottomButton = false;
        
        // Re-enable auto-scrolling
        this.autoScrollEnabled = true;
      }
    } catch(err) {
      console.error('Error scrolling to bottom:', err);
    }
  }
  
  formatTimestamp(timestamp: string): string {
    if (!timestamp) return '';
    
    try {
      const date = new Date(timestamp);
      return date.toLocaleString();
    } catch (err) {
      return timestamp;
    }
  }
  
  copyToClipboard(text: string): void {
    navigator.clipboard.writeText(text).then(() => {
      this.snackBar.open('Copied to clipboard!', 'Close', {
        duration: 2000,
        horizontalPosition: 'center',
        verticalPosition: 'bottom'
      });
    }).catch(err => {
      console.error('Failed to copy text:', err);
    });
  }
  
  getMessageClasses(message: ChatMessage): any {
    return {
      'message-self': message.isSelf,
      'message-other': !message.isSelf,
      'message-error': message.isError,
      'message-streaming': message.isStreaming
    };
  }
  
  // Check if there's a streaming message
  hasStreamingMessage(): boolean {
    const result = this.messages.some(message => message.isStreaming === true);
    return result;
  }
}