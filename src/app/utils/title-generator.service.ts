import { Injectable } from '@angular/core';
import { OllamaService } from '../services/ollama.service';

@Injectable({
  providedIn: 'root'
})
export class TitleGeneratorService {
  // Map of topics to emojis
  private topicEmojiMap: Record<string, string> = {
    "sky": "🌤️",
    "blue": "🔵",
    "water": "💧",
    "ocean": "🌊",
    "weather": "🌦️",
    "space": "🌌",
    "star": "⭐",
    "galaxy": "✨",
    "sun": "☀️",
    "moon": "🌙",
    "planet": "🪐",
    "earth": "🌍",
    "rain": "🌧️",
    "snow": "❄️",
    "wind": "💨",
    "cloud": "☁️",
    "thunder": "⚡",
    "lightning": "🌩️",
    "rainbow": "🌈",
    "mountain": "⛰️",
    "forest": "🌲",
    "desert": "🏜️",
    "beach": "🏖️",
    "tree": "🌳",
    "flower": "🌸",
    "garden": "🌷",
    "animal": "🐾",
    "dog": "🐕",
    "cat": "🐈",
    "bird": "🐦",
    "fish": "🐠",
    "food": "🍽️",
    "fruit": "🍎",
    "vegetable": "🥦",
    "meat": "🥩",
    "drink": "🥤",
    "coffee": "☕",
    "tea": "🍵",
    "beer": "🍺",
    "wine": "🍷",
    "house": "🏠",
    "building": "🏢",
    "city": "🏙️",
    "car": "🚗",
    "bike": "🚲",
    "plane": "✈️",
    "train": "🚆",
    "ship": "🚢",
    "computer": "💻",
    "phone": "📱",
    "book": "📚",
    "music": "🎵",
    "movie": "🎬",
    "game": "🎮",
    "sport": "⚽",
    "ball": "🏀",
    "run": "🏃",
    "swim": "🏊",
    "health": "❤️",
    "medicine": "💊",
    "money": "💰",
    "time": "⏰",
    "light": "💡",
    "fire": "🔥",
    "science": "🔬",
    "math": "🧮",
    "school": "🏫",
    "work": "💼",
    "happy": "😊",
    "sad": "😢",
    "love": "❤️",
    "sleep": "😴",
    "talk": "💬",
    "idea": "💡",
    "question": "❓",
    "answer": "📝",
    "color": "🎨",
    "joke": "😂",
    "funny": "🤣",
    "cake": "🍰",
    "party": "🎉",
    "gift": "🎁",
    "holiday": "🎄",
    "travel": "🧳",
    "camera": "📷",
    "photo": "📸",
    "video": "📹",
    "mail": "📧",
    "email": "📨",
    "call": "📞",
    "calendar": "📅",
    "clock": "🕒",
    "map": "🗺️",
    "location": "📍",
    "chart": "📊",
    "rocket": "🚀",
    "robot": "🤖",
    "alien": "👽",
    "ghost": "👻",
    "monster": "👾",
    "zombie": "🧟",
    "vampire": "🧛",
    "wizard": "🧙",
    "fairy": "🧚",
    "mermaid": "🧜",
    "unicorn": "🦄",
    "dragon": "🐉",
    "dinosaur": "🦖",
    "panda": "🐼",
    "lion": "🦁",
    "tiger": "🐯",
    "wolf": "🐺",
    "fox": "🦊",
    "bear": "🐻",
    "monkey": "🐒",
    "elephant": "🐘",
    "giraffe": "🦒",
    "zebra": "🦓",
    "country": "🌎",
    "night": "🌃",
    "file": "📄",
    "folder": "📁",
    "code": "💻",
    "programming": "👨‍💻",
    "bug": "🐛",
    "database": "🗄️",
    "config": "⚙️",
    "json": "📊",
    "tool": "🔧",
    "command": "🖥️",
    "read": "📖",
    "write": "✍️",
    "path": "🛣️",
    "system": "🖥️"
  };

  constructor(private ollamaService: OllamaService) { }

  /**
   * Generate a title for a chat session based on the first message
   * @param message The first message in the chat
   * @param model The model to use for title generation
   * @returns Promise resolving to the generated title
   */
  async generateTitle(message: string, model: string): Promise<string> {
    // Limit message to 500 chars for faster processing
    const limitedMessage = message.substring(0, 500);
    
    try {
      // Create a system prompt for title generation
      const systemPrompt = {
        role: 'system',
        content: 'Create a descriptive title (4-12 words) for the following message. The title should capture the main topic or question. Do NOT include any emoji. Respond ONLY with the title.'
      };
      
      // User message with the content
      const userMessage = {
        role: 'user',
        content: limitedMessage
      };
      
      // Chat with the LLM to generate a title (non-streaming)
      const response = await this.ollamaService.generateTitle(model, [systemPrompt, userMessage], {
        temperature: 0.0,
        // Limit the output length, but allow for longer titles
        num_predict: 100
      });
      
      if (response && response.message && response.message.content) {
        // Extract and clean up the generated title
        let title = response.message.content.trim();
        
        // Remove quotes if present
        title = title.replace(/^["'](.*)["']$/, '$1').trim();
        
        // Add an emoji based on keyword matching
        let addedEmoji = false;
        let titleWithEmoji = title;
        
        // First try to find keywords in the title
        for (const [keyword, emoji] of Object.entries(this.topicEmojiMap)) {
          if (title.toLowerCase().includes(keyword) && !addedEmoji) {
            titleWithEmoji = `${title} ${emoji}`;
            addedEmoji = true;
            break;
          }
        }
        
        // If no emoji added from title, try with the message content
        if (!addedEmoji) {
          const messageLower = message.toLowerCase();
          for (const [keyword, emoji] of Object.entries(this.topicEmojiMap)) {
            if (messageLower.includes(keyword) && !addedEmoji) {
              titleWithEmoji = `${title} ${emoji}`;
              addedEmoji = true;
              break;
            }
          }
        }
        
        // Use the title with emoji if one was added
        return addedEmoji ? titleWithEmoji : title;
      }
      
      // Fallback title if generation failed
      return 'New Chat';
    } catch (error) {
      console.error('Error generating title:', error);
      return 'New Chat';
    }
  }
}
