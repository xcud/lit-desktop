# Programming Best Practices

Guidelines for code development, modification, and maintenance tasks.

## Code Understanding First

- **Read and understand existing code before making changes**
- **Examine the overall architecture and patterns in use**
- **Identify dependencies and potential impact of changes**
- **Look for existing tests and documentation**

## Change Strategy

- **Make surgical, targeted edits rather than large rewrites**
- **Preserve existing code style and patterns**
- **Consider backwards compatibility implications**
- **Test changes incrementally when possible**

## File Operations for Code

- **Use edit_block for small, focused changes**
- **Use write_file only for completely new files**
- **Maintain proper indentation and formatting**
- **Follow the existing project's coding standards**

## Quality Assurance

- **Review changes for potential side effects**
- **Consider error handling and edge cases**
- **Document significant changes appropriately**
- **Verify that changes don't break existing functionality**

## Refactoring Guidelines

- **Plan refactoring in small, manageable steps**
- **Preserve functionality while improving structure**
- **Update related documentation and tests**
- **Consider the impact on other team members and systems**
