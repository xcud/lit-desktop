import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class EventService {
  // Subject for chat session title updates
  private titleUpdated = new Subject<string>();
  
  // Observable that components can subscribe to
  titleUpdated$ = this.titleUpdated.asObservable();
  
  constructor() { }
  
  // Emit a title update event with the session ID
  emitTitleUpdate(sessionId: string): void {
    this.titleUpdated.next(sessionId);
  }
}
