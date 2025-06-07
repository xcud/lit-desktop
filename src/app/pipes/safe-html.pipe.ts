import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Pipe({
  name: 'safeHtml'
})
export class SafeHtmlPipe implements PipeTransform {
  constructor(private sanitizer: DomSanitizer) {}

  transform(value: string): SafeHtml {
    if (!value) return this.sanitizer.bypassSecurityTrustHtml('');
    
    // Add basic markdown-like formatting for code blocks in streaming messages
    let formattedValue = value;
    
    // Handle code blocks with language specification (```python, ```javascript, etc.)
    formattedValue = formattedValue.replace(/```([a-zA-Z]*)([\s\S]*?)```/g, (match, language, code) => {
      return `<pre><code class="language-${language || 'plaintext'}">${this.escapeHtml(code.trim())}</code></pre>`;
    });
    
    // Handle inline code with backticks
    formattedValue = formattedValue.replace(/`([^`]+)`/g, (match, code) => {
      return `<code>${this.escapeHtml(code)}</code>`;
    });
    
    // Replace remaining newlines with <br> tags
    formattedValue = formattedValue.replace(/\n/g, '<br>');
    
    return this.sanitizer.bypassSecurityTrustHtml(formattedValue);
  }
  
  private escapeHtml(unsafe: string): string {
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}