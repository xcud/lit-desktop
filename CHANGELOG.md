# Changelog

All notable changes to LIT Desktop will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

# Changelog

All notable changes to LIT Desktop will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1] - 2025-06-11 - "Recursive Agent"

### ✨ Enhanced Features
- **Recursive Tool Calling**: AI can now execute sequential tool calls (up to 20 per conversation)
- **Multi-Step Workflows**: Handle complex tasks requiring multiple tool executions
- **Intelligent Self-Monitoring**: AI assesses progress between tool executions
- **Conversation Continuity**: Maintains context across tool execution cycles

### 🔧 Technical Improvements
- **New ToolCallProcessor**: Clean separation of tool processing from streaming logic
- **Enhanced Error Recovery**: Better handling of tool failures during multi-step operations
- **Circuit Breaker Protection**: Prevents infinite loops with configurable limits
- **Progress Tracking**: Meaningful updates during long-running operations

### 🎯 Use Cases Now Supported
- Complex file analysis workflows ("analyze all files in directory X")
- Multi-step development tasks ("refactor code and update documentation") 
- System administration sequences ("backup strategy creation")
- Investigative code exploration ("find all uses of X and explain patterns")

### 🏗️ Implementation Notes
- Ported proven recursive tool calling logic from lit-server
- Preserved existing single-tool functionality as fallback
- Maintained full backward compatibility
- Added comprehensive logging and debugging support

*Development time: ~2 hours across 2 sessions with AI-pair-programming*