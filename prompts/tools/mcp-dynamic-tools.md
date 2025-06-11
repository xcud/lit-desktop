# MCP Dynamic Tools Instructions

You have access to mcp-dynamic-tools for creating and managing custom tools dynamically.

## Dynamic Tool Creation Capability

When users ask to "create an MCP tool" or request custom tools, you can create new Python-based tools that instantly become available in the system.

## Tool Creation Process

### Create New Tools
Use mcp-dynamic-tools.write_tool to create new Python-based tools:

```json
{
  "tool": "mcp-dynamic-tools.write_tool",
  "arguments": {
    "name": "toolname",
    "content": "def invoke(arguments):\n    \"\"\"Tool description here.\n    \n    Parameters:\n    - param_name: Description (type)\n    \"\"\"\n    try:\n        value = arguments.get('param_name', 'default')\n        return f\"Result: {value}\"\n    except Exception as e:\n        return f\"Error: {str(e)}\""
  }
}
```

### Use the New Tool
After creation, the tool becomes available as `mcp-dynamic-tools.toolname`:

```json
{
  "tool": "mcp-dynamic-tools.toolname",
  "arguments": {
    "param_name": "value"
  }
}
```

## Tool Template Structure

Every MCP tool must follow this structure:

```python
def invoke(arguments):
    """Brief description of what the tool does.
    
    Parameters:
    - parameter1: Description of first parameter (type)
    - parameter2: Description of second parameter (type, optional)
    """
    try:
        # Extract parameters from arguments dictionary
        param1 = arguments.get('parameter1')
        param2 = arguments.get('parameter2', 'default_value')
        
        # Validate required parameters
        if not param1:
            return "Error: parameter1 is required"
        
        # Tool logic here
        result = f"Processed {param1} with {param2}"
        
        return result
    except Exception as e:
        return f"Error: {str(e)}"
```

## Parameter Type Handling

MCP can pass parameters as their native Python types (bool, int, str) or as strings. Always handle both cases defensively:

### Boolean Parameters
```python
# CORRECT: Handle both bool and string inputs
def to_bool(value, default=True):
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.lower() in ('true', '1', 'yes', 'on')
    return default

include_flag = to_bool(arguments.get('include_flag', True))
```

### Integer Parameters
```python
# CORRECT: Handle both int and string inputs
def to_int(value, default=0):
    if isinstance(value, int):
        return value
    if isinstance(value, str):
        try:
            return int(value)
        except ValueError:
            return default
    return default

length = to_int(arguments.get('length', 12))
```

### String Parameters
```python
# String parameters are usually safe, but convert to string to be sure
text = str(arguments.get('text', ''))
```

## Best Practices for Tool Creation

### Parameter Handling
- Always use `arguments.get('param_name', default)` for safe parameter extraction
- **CRITICAL**: Handle mixed parameter types defensively - MCP can pass bool, int, or string types
- Use helper functions like `to_bool()` and `to_int()` for type-safe conversion
- Validate required parameters and return helpful error messages
- Provide sensible defaults for optional parameters

### Error Handling
- Wrap tool logic in try/except blocks
- Return descriptive error messages that help users understand what went wrong
- Include parameter validation with clear error messages

### Tool Implementation
- Keep tools focused on a single responsibility
- Import libraries at the top of the file when needed
- Return string results for consistent output
- Use f-strings for readable string formatting

## Critical Notes

1. **Tool Creation**: Use `mcp-dynamic-tools.write_tool` with name and content parameters
2. **Function Name**: Every tool MUST have an `invoke(arguments)` function
3. **Parameter Format**: Arguments come as a dictionary, use `.get()` for safe access
4. **Type Safety**: Parameters can be bool, int, or string types - never assume strings! Use defensive type checking
5. **Common Mistake**: NEVER use `.lower()` directly on parameters - check type first with `isinstance(value, str)`
6. **Return Type**: Always return strings for consistent output
7. **Error Handling**: Include try/except blocks and return error messages as strings
8. **Immediate Availability**: After creation, tools are immediately available as `mcp-dynamic-tools.toolname`
