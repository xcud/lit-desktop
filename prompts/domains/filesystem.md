# File System Operations Guidance

When working with file system tools, follow these best practices to ensure reliable, efficient operations:

## Core Principles

- **Always read files before analyzing or modifying them**
- **Use absolute paths for reliability** (starting with '/' or drive letters like 'C:\')
- **Prefer dedicated file tools over shell commands** for viewing file contents
- **Make surgical, targeted edits rather than large rewrites**
- **Handle potential file access errors gracefully**

## Writing Best Practices

- **Use chunked writing for large files** (25-30 lines max per write operation)
- **Prefer edit_block for small changes, write_file only for new files**
- **Maintain existing file structure and formatting when possible**

## Path Handling

- **Absolute paths prevent working directory confusion**
- **Validate file paths before operations**
- **Handle different operating system path formats appropriately**

## Error Prevention

- **Check file permissions before attempting operations**
- **Verify file existence before reading**
- **Create parent directories when needed for new files**
- **Back up important files before major modifications**

## Performance Considerations

- **Batch related file operations when possible**
- **Use appropriate tools for the task** (search_files vs list_directory vs read_file)
- **Avoid unnecessary file reads in loops**
