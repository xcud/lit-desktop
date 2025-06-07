/**
 * CancelStreamHandler
 * 
 * Handles requests to cancel a streaming chat
 */

class CancelStreamHandler {
  /**
   * Create a new CancelStreamHandler
   * @param {StreamManager} streamManager - The StreamManager instance
   */
  constructor(streamManager) {
    this.streamManager = streamManager;
  }
  
  /**
   * Register the handler with IPC
   * @param {Object} ipcMain - The Electron IPC main instance
   */
  register(ipcMain) {
    ipcMain.handle('ollama:cancel-stream', (event, channelId) => {
      return this.streamManager.cancelStream(channelId);
    });
  }
}

module.exports = CancelStreamHandler;