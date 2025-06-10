# Desktop Commander Tool Instructions

You have access to desktop-commander with comprehensive file system and development capabilities.

## Direct Tool Functions Available
The desktop-commander MCP server provides these **direct function calls** (not shell commands):

### File Operations
- `read_file(path)` - Read file contents directly (preferred over cat/type)
- `write_file(path, content, mode)` - Write file contents (use mode='append' for large files)
- `list_directory(path)` - List directory contents (preferred over ls/dir)
- `move_file(source, destination)` - Move/rename files
- `search_files(path, pattern)` - Find files by name pattern
- `create_directory(path)` - Create directories
- `get_file_info(path)` - Get file metadata

### Code Operations
- `search_code(path, pattern)` - Search for code patterns in files
- `edit_block(file_path, old_string, new_string)` - Make surgical code edits

### Command Execution
- `execute_command(command, timeout_ms)` - Run shell commands when needed
- `read_output(pid)` - Read output from running processes
- `list_processes()` - List running processes
- `kill_process(pid)` - Terminate processes

## Usage Examples

### Read a file (CORRECT way):
```json
{
  "tool": "desktop-commander.read_file",
  "arguments": {
    "path": "/data/contoso/config.json"
  }
}
```

### NOT this way:
```json
{
  "tool": "desktop-commander.execute_command",
  "arguments": {
    "command": "cat /data/contoso/config.json",
    "timeout_ms": 5000
  }
}
```

### List directory contents:
```json
{
  "tool": "desktop-commander.list_directory",
  "arguments": {
    "path": "/home/user/project"
  }
}
```

### Search for files:
```json
{
  "tool": "desktop-commander.search_files",
  "arguments": {
    "path": "/home/user",
    "pattern": "*.json"
  }
}
```

## Best Practices

### File Operations
- **Always use absolute paths** for reliability (start with `/` or drive letter)
- **Use direct functions** instead of shell commands (read_file vs cat, list_directory vs ls)
- **Chunk large file writes** - write files in ≤30 line chunks using write_file with mode='append'
- **Use search_files for finding files by name**, search_code for finding code patterns

### Code Changes  
- **Surgical edits**: Use edit_block for precise changes instead of rewriting entire files
- **Include minimal context** in edit_block operations - just enough to uniquely identify the location
- **Read first, then edit**: Always read_file to understand current state before making changes

### Command Execution
- **Prefer direct functions** over shell commands when available
- **Use absolute paths in commands** to avoid current directory issues
- **For long-running processes**: Let the human run them - your read_output throughput is limited

## Common Patterns

### File Analysis Workflow
1. `list_directory("/project/root")` - Explore project structure
2. `read_file("/project/key-file.json")` - Examine key files  
3. `search_code("/project", "function_name")` - Find relevant patterns
4. Analyze and provide insights

### Code Modification Workflow  
1. `search_code("/project", "target_function")` - Find target code locations
2. `read_file("/project/file.py")` - Understand current implementation
3. `edit_block("/project/file.py", "old_code", "new_code")` - Make precise surgical changes
4. Verify changes if needed

### Project Exploration
1. `list_directory("/project")` - Start with project root
2. `read_file("/project/README.md")` - Read key files
3. `search_files("/project", "*.config")` - Find files matching patterns
4. `search_code("/project", "import|require")` - Understand code organization

## Performance Tips
- Batch related file operations together
- Use search tools to avoid reading unnecessary files  
- Prefer edit_block over full file rewrites
- Use direct functions over shell commands
- Use chunked writes for large content
