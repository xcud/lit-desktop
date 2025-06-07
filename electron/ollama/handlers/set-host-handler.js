/**
 * SetHostHandler
 * 
 * Handles requests to change the Ollama host URL
 */

class SetHostHandler {
  /**
   * Create a new SetHostHandler
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
    ipcMain.handle('ollama:set-host', async (event, host) => {
      try {
        return this.ollamaClient.setHost(host);
      } catch (error) {
        console.error('SetHostHandler: Error setting Ollama host:', error);
        throw error;
      }
    });
  }
}

module.exports = SetHostHandler;