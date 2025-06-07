/**
 * PullModelHandler
 * 
 * Handles requests to pull an Ollama model
 */

class PullModelHandler {
  /**
   * Create a new PullModelHandler
   * @param {OllamaClient} ollamaClient - The OllamaClient instance
   */
  constructor(ollamaClient) {
    this.ollamaClient = ollamaClient;
  }
  
  /**
   * Register the handler with IPC
   * @param {Object} ipcMain - The Electron IPC main instance
   */
  register(ipcMain) {
    ipcMain.handle('ollama:pull-model', async (event, model) => {
      try {
        // Get the progress stream
        const progress = await this.ollamaClient.pullModel(model);
        
        // Track pull progress
        let lastProgress = { completed: 0, total: 1 };
        const sender = event.sender;
        
        // Process pull progress
        for await (const chunk of progress) {
          lastProgress = chunk;
          
          // Calculate progress percentage
          const percentage = chunk.total > 0 ? 
            Math.floor((chunk.completed / chunk.total) * 100) : 0;
            
          // Send progress update
          if (!sender.isDestroyed()) {
            sender.send('ollama:pull-progress', {
              model,
              progress: percentage,
              ...chunk
            });
          } else {
            break; // Window was closed
          }
        }
        
        return {
          success: true,
          model,
          ...lastProgress
        };
      } catch (error) {
        console.error('PullModelHandler: Error pulling Ollama model:', error);
        throw error;
      }
    });
  }
}

module.exports = PullModelHandler;