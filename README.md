# LIT Desktop

A lightweight, modern desktop chat interface for Ollama with advanced MCP (Model Context Protocol) integration. Built with Electron and Angular for cross-platform compatibility.

![LIT Desktop](src/assets/flame.png)

## Features

### 🚀 **Core Functionality**
- **Local AI Chat**: Direct integration with Ollama for private, local LLM conversations
- **Multi-Model Support**: Switch between different Ollama models seamlessly
- **Streaming Responses**: Real-time streaming chat for responsive interactions
- **Session Management**: Persistent chat sessions with automatic saving
- **Smart Titles**: AI-generated conversation titles with emoji enhancement

### 🔧 **MCP Tool Integration**
- **Dynamic Tool Discovery**: Automatic detection and integration of MCP servers
- **Desktop Commander**: Built-in file system operations and command execution
- **Custom Tools**: Support for team-specific and custom MCP tools
- **Real-time Tool Execution**: Seamless tool calling during conversations

### 🎨 **User Experience**
- **Dark/Light Themes**: System-aware theme switching with manual override
- **Responsive Design**: Split-pane interface with resizable sidebar
- **Keyboard Shortcuts**: Efficient navigation and interaction
- **Cross-Platform**: Native desktop experience on Windows, macOS, and Linux

### ⚙️ **Advanced Features**
- **Prompt Composer**: Enhanced system prompts with intelligent tool guidance
- **Conversation Export**: Save and share chat sessions
- **Multi-Selection**: Bulk operations on chat sessions
- **Configurable Settings**: Customizable Ollama host, models, and MCP servers

## Installation

### Quick Start (Recommended)

1. **Download the latest release** from the [Releases page](../../releases)
2. **Install Ollama** on your system:
   ```bash
   # macOS
   brew install ollama
   
   # Linux
   curl -fsSL https://ollama.ai/install.sh | sh
   
   # Windows
   # Download from https://ollama.ai/
   ```

3. **Start Ollama** and pull a model:
   ```bash
   ollama serve
   ollama pull llama3:latest
   ```

4. **Run LIT Desktop**:
   ```bash
   # Linux AppImage
   chmod +x lit-desktop-*.AppImage
   ./lit-desktop-*.AppImage
   
   # Windows
   # Run the installer .exe
   
   # macOS
   # Open the .dmg and drag to Applications
   ```

### Enhanced Experience (Optional)

For enhanced system prompts and better tool integration (optional):

```bash
npm install system-prompt-composer
```

> **Note**: The app works without system-prompt-composer, but installing it provides enhanced AI prompts that adapt based on available tools and task complexity.

## Development Setup

### Prerequisites
- **Node.js** (v16 or later)
- **npm** or **yarn**
- **Angular CLI**: `npm install -g @angular/cli`
- **Ollama** running locally

### Building from Source

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd lit-desktop
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Development mode**:
   ```bash
   # Start Angular dev server + Electron
   npm run electron:dev
   
   # With DevTools open
   npm run electron:dev:devtools
   ```

4. **Build for production**:
   ```bash
   # Build for current platform
   npm run electron:build
   
   # Platform-specific builds
   npm run electron:build:windows
   npm run electron:build:mac
   npm run electron:build:linux
   ```

## Configuration

### Ollama Setup

LIT Desktop connects to Ollama on `http://localhost:11434` by default. To use a different host:

1. Open **Settings** (gear icon or `Ctrl/Cmd + ,`)
2. Update the **Ollama Host** field
3. Click **Save Settings**

### MCP Configuration

MCP servers are configured via a JSON file at `~/.config/lit-desktop/mcp.json`:

```json
{
  "mcpServers": {
    "desktop-commander": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-everything"],
      "name": "desktop-commander"
    },
    "weather": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-weather"],
      "name": "weather"
    }
  }
}
```

## Usage

### Basic Chat
1. Select a model from the dropdown
2. Type your message in the input field
3. Press `Enter` or click send
4. Watch as the AI responds in real-time

### Using Tools
LIT Desktop automatically detects when the AI wants to use tools:

```
You: "What files are in my current directory?"
AI: Let me check that for you.
[Automatically calls desktop-commander.list_directory]
AI: Here are the files in your directory: ...
```

### Managing Sessions
- **New Chat**: Click the "+" button or use `Ctrl/Cmd + N`
- **Switch Sessions**: Click on any session in the sidebar
- **Delete Sessions**: Right-click → Delete or use multi-select mode
- **Export Chat**: Right-click → Export to save as JSON

### Keyboard Shortcuts
- `Ctrl/Cmd + N` - New chat session
- `Ctrl/Cmd + ,` - Open settings
- `Ctrl/Cmd + Enter` - Send message
- `Escape` - Cancel current response
- `Ctrl/Cmd + Shift + D` - Toggle DevTools (development)

## Architecture

### Technology Stack
- **Frontend**: Angular 16 with Angular Material
- **Desktop**: Electron 36 for cross-platform native experience
- **Styling**: SCSS with theme system
- **State Management**: RxJS with persistent storage

### Key Components
- **Chat Engine**: Streaming Ollama integration with tool call detection
- **MCP Manager**: Dynamic tool discovery and execution
- **Session Storage**: Persistent chat history with indexing
- **Theme System**: Responsive dark/light mode switching

## Contributing

### Development Guidelines
1. **Code Style**: Follow Angular and TypeScript best practices
2. **Testing**: Add tests for new functionality
3. **Documentation**: Update README for new features
4. **Commits**: Use conventional commit messages

### Building and Testing
```bash
# Install dependencies
npm install

# Run in development mode
npm run electron:dev

# Run tests
npm test

# Build for production
npm run electron:build
```

### Project Structure
```
lit-desktop/
├── src/app/              # Angular application
│   ├── components/       # UI components
│   ├── services/         # Angular services
│   └── utils/           # Utility functions
├── electron/            # Electron main process
│   ├── services/        # Backend services
│   └── ollama/          # Ollama integration
└── build/               # Build configuration
```

## Troubleshooting

### Common Issues

**"Cannot connect to Ollama"**
- Ensure Ollama is running: `ollama serve`
- Check the host setting in Settings
- Verify firewall settings

**"No models available"**
- Pull a model: `ollama pull llama3:latest`
- Restart LIT Desktop after pulling models

**"Tools not working"**
- Check MCP configuration in `~/.config/lit-desktop/mcp.json`
- Ensure MCP servers are properly installed
- Check the Settings → Tools tab for server status

**"Chat sessions not saving"**
- Check write permissions in user data directory
- Clear application data and restart if corrupted

### Debug Mode
For detailed logging, start with:
```bash
# Set debug environment
NODE_ENV=development ./lit-desktop-*.AppImage

# Or enable DevTools in settings
```

### Getting Help
- Check existing [Issues](../../issues)
- Create a new issue with:
  - Operating system and version
  - LIT Desktop version
  - Ollama version
  - Steps to reproduce
  - Error logs (if any)

## License

MIT License - see [LICENSE](LICENSE) for details.

## Acknowledgments

- **Ollama** - Local LLM inference engine
- **Model Context Protocol** - Tool integration standard
- **Angular** and **Electron** - Application framework
- **Anthropic** - MCP protocol development

---

**Built with ❤️ for the local AI community**
