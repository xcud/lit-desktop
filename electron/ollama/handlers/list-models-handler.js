/**
 * ListModelsHandler
 * 
 * Handles requests to list available Ollama models
 */

class ListModelsHandler {
  /**
   * Create a new ListModelsHandler
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
    ipcMain.handle('ollama:list-models', async () => {
      try {
        return await this.ollamaClient.listModels();
      } catch (error) {
        console.error('ListModelsHandler: Error listing Ollama models:', error);
        throw error;
      }
    });
  }
}

module.exports = ListModelsHandler;