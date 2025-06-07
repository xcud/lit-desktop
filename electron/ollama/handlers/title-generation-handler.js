/**
 * TitleGenerationHandler - Handles simple non-streaming requests for title generation
 * 
 * This is the only non-streaming handler, used specifically for short title generation requests
 */

class TitleGenerationHandler {
  /**
   * Create a new TitleGenerationHandler
   * @param {OllamaClient} ollamaClient - The OllamaClient instance
   * @param {MCPManager} mcpManager - The MCPManager instance
   */
  constructor(ollamaClient, mcpManager) {
    this.ollamaClient = ollamaClient;
    this.mcpManager = mcpManager;
    
    console.log('TitleGenerationHandler: Initialized for non-streaming title generation');
  }
  
  /**
   * Register the handler with IPC
   * @param {Object} ipcMain - The Electron IPC main instance
   */
  register(ipcMain) {
    ipcMain.handle('ollama:generate-title', async (event, model, messages, options) => {
      try {
        console.log('TitleGenerationHandler: Processing title generation request');
        
        // Don't add MCP tools for title generation - keep it simple and fast
        
        // Make the chat request to Ollama (non-streaming for titles)
        const response = await this.ollamaClient.chat(model, messages, options);
        
        console.log('TitleGenerationHandler: Received title generation response');
        return response;
        
      } catch (error) {
        console.error('TitleGenerationHandler: Error in title generation:', error);
        throw error;
      }
    });
  }
}

module.exports = TitleGenerationHandler;
