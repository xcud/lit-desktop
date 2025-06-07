// Title generator service for chat sessions
const { ipcMain } = require('electron');
const ollama = require('ollama');

class TitleGeneratorService {
  constructor() {
    this.client = null;
    this.host = 'http://localhost:11434';
    this.setupIpcHandlers();
  }
  
  setHost(host) {
    this.host = host;
    this.client = new ollama.Ollama({ host });
    return this.host;
  }
  
  getClient() {
    if (!this.client) {
      this.client = new ollama.Ollama({ host: this.host });
    }
    return this.client;
  }
  
  setupIpcHandlers() {
    // Generate a title for a chat session
    ipcMain.handle('title:generate', async (event, message, model) => {
      return this.generateTitle(message, model);
    });
  }
  
  async generateTitle(message, model = 'llama3:latest') {
    try {
      console.log(`Generating title for message: ${message.substring(0, 50)}...`);
      
      const client = this.getClient();
      
      // Get response from LLM with title generation prompt
      const response = await client.chat({
        model: model,
        messages: [
          {
            role: 'system',
            content: 'Create a short, descriptive title (2-5 words) for the following message. Do NOT include any emoji. Do NOT include any preface text like "Here is the title". Respond ONLY with the title.'
          },
          {
            role: 'user',
            content: message.substring(0, 500) // Limit to 500 chars for speed
          }
        ],
        options: {
          temperature: 0.0
        }
      });
      
      // Extract the title
      let title = response.message.content.trim();
      console.log(`Raw generated title: "${title}"`);
      
      // Clean up the title (remove quotes, etc.)
      title = title.replace(/^["']|["']$/g, '').trim();
      
      // Add an emoji based on keywords
      const titleWithEmoji = this.addEmojiToTitle(title, message);
      
      console.log(`Final title with emoji: "${titleWithEmoji}"`);
      
      return {
        success: true,
        title: titleWithEmoji
      };
    } catch (error) {
      console.error('Error generating title:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  addEmojiToTitle(title, message) {
    // Map of keywords to emojis
    const topicEmojiMap = {
      'sky': '🌤️',
      'blue': '🔵',
      'water': '💧',
      'ocean': '🌊',
      'weather': '🌦️',
      'space': '🌌',
      'star': '⭐',
      'galaxy': '✨',
      'sun': '☀️',
      'moon': '🌙',
      'planet': '🪐',
      'earth': '🌍',
      'rain': '🌧️',
      'snow': '❄️',
      'wind': '💨',
      'cloud': '☁️',
      'thunder': '⚡',
      'lightning': '🌩️',
      'rainbow': '🌈',
      'mountain': '⛰️',
      'forest': '🌲',
      'desert': '🏜️',
      'beach': '🏖️',
      'tree': '🌳',
      'flower': '🌸',
      'garden': '🌷',
      'animal': '🐾',
      'dog': '🐕',
      'cat': '🐈',
      'bird': '🐦',
      'fish': '🐠',
      'food': '🍽️',
      'fruit': '🍎',
      'vegetable': '🥦',
      'meat': '🥩',
      'drink': '🥤',
      'coffee': '☕',
      'tea': '🍵',
      'beer': '🍺',
      'wine': '🍷',
      'house': '🏠',
      'building': '🏢',
      'city': '🏙️',
      'car': '🚗',
      'bike': '🚲',
      'plane': '✈️',
      'train': '🚆',
      'ship': '🚢',
      'computer': '💻',
      'phone': '📱',
      'book': '📚',
      'music': '🎵',
      'movie': '🎬',
      'game': '🎮',
      'sport': '⚽',
      'ball': '🏀',
      'run': '🏃',
      'swim': '🏊',
      'health': '❤️',
      'medicine': '💊',
      'money': '💰',
      'time': '⏰',
      'light': '💡',
      'fire': '🔥',
      'water': '💧',
      'science': '🔬',
      'math': '🧮',
      'school': '🏫',
      'work': '💼',
      'happy': '😊',
      'sad': '😢',
      'love': '❤️',
      'sleep': '😴',
      'talk': '💬',
      'idea': '💡',
      'question': '❓',
      'answer': '📝',
      'color': '🎨',
      'joke': '😂',
      'funny': '🤣',
      'covid': '🦠',
      'virus': '🦠',
      'cake': '🍰',
      'party': '🎉',
      'gift': '🎁',
      'holiday': '🎄',
      'travel': '🧳',
      'camera': '📷',
      'photo': '📸',
      'video': '📹',
      'mail': '📧',
      'email': '📨',
      'phone': '📱',
      'call': '📞',
      'calendar': '📅',
      'clock': '🕒',
      'map': '🗺️',
      'location': '📍',
      'chart': '📊',
      'rocket': '🚀',
      'robot': '🤖',
      'alien': '👽',
      'ghost': '👻',
      'monster': '👾',
      'zombie': '🧟',
      'vampire': '🧛',
      'wizard': '🧙',
      'fairy': '🧚',
      'mermaid': '🧜',
      'unicorn': '🦄',
      'dragon': '🐉',
      'dinosaur': '🦖',
      'panda': '🐼',
      'lion': '🦁',
      'tiger': '🐯',
      'wolf': '🐺',
      'fox': '🦊',
      'bear': '🐻',
      'monkey': '🐒',
      'elephant': '🐘',
      'giraffe': '🦒',
      'zebra': '🦓',
      'country': '🌎',
      'file': '📄',
      'folder': '📁',
      'data': '📊',
      'config': '⚙️',
      'code': '👨‍💻',
      'programming': '💻',
      'error': '❌',
      'success': '✅',
      'json': '📋',
      'xml': '📑',
      'database': '🗄️',
      'sql': '🔍',
      'server': '🖥️',
      'client': '📱',
      'api': '🔌',
      'web': '🌐',
      'app': '📲',
      'night': '🌃'
    };
    
    // Try to match keywords in the title
    let titleWithEmoji = title;
    let addedEmoji = false;
    
    // Look for keywords in the title
    const titleLower = title.toLowerCase();
    for (const [keyword, emoji] of Object.entries(topicEmojiMap)) {
      if (titleLower.includes(keyword) && !addedEmoji) {
        titleWithEmoji = `${title} ${emoji}`;
        addedEmoji = true;
        console.log(`Added ${emoji} emoji based on keyword '${keyword}' in title`);
        break;
      }
    }
    
    // If no emoji added from title, try with the message content
    if (!addedEmoji) {
      const messageLower = message.toLowerCase();
      for (const [keyword, emoji] of Object.entries(topicEmojiMap)) {
        if (messageLower.includes(keyword) && !addedEmoji) {
          titleWithEmoji = `${title} ${emoji}`;
          addedEmoji = true;
          console.log(`Added ${emoji} emoji based on keyword '${keyword}' in message`);
          break;
        }
      }
    }
    
    return titleWithEmoji;
  }
}

// Export a singleton instance
module.exports = new TitleGeneratorService();