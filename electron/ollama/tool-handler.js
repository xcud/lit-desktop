/**
 * ToolHandler
 * 
 * Responsible for detecting, extracting, and executing tool calls
 */

const mcpService = require('../mcp-service');

class ToolHandler {
  /**
   * Create a new ToolHandler
   */
  constructor() {
    console.log('ToolHandler: Initialized');
  }
  
  /**
   * Extract a tool call from text
   * @param {string} text - The text to extract a tool call from
   * @returns {Object|null} The extracted tool call or null if none found
   */
  extractToolCall(text) {
    try {
      // if (text.length > 1000) {
      //   console.log(`ToolHandler: Attempting to extract tool call from text (length: ${text.length} characters)`);
      // } else {
      //   console.log('ToolHandler: Attempting to extract tool call from text:', text);
      // }
      
      // Regular JSON processing
      let cleanedText = this.extractJsonFromText(text);
      
      // Ensure the text is a complete JSON object
      if (typeof cleanedText !== 'string' || !cleanedText.trim().startsWith('{') || !cleanedText.trim().endsWith('}')) {
        console.log('ToolHandler: Invalid tool call format - not a valid JSON string', text);
        return null;
      }
      
      // Fix common JSON issues
      cleanedText = this.fixJsonIssues(cleanedText);
      
      // Try to parse the JSON
      let data;
      try {
        data = JSON.parse(cleanedText);
        console.log('ToolHandler: Successfully parsed JSON data');
      } catch (parseError) {
        console.error('ToolHandler: Error parsing JSON:', parseError.message, cleanedText);
        return null;
      }
      
      // Check if it has the required fields
      const toolName = data.tool || data.name || data.function || data.toolName;
      const toolArgs = data.arguments || data.args || data.params || data.parameters || {};
      
      if (!toolName) {
        console.log('ToolHandler: Missing required field: tool name');
        return null;
      }
      
      console.log(`ToolHandler: Found tool name: ${toolName}`);
      
      // Extract server and tool names
      let serverName, actualToolName;
      if (toolName.includes('.')) {
        [serverName, actualToolName] = toolName.split('.', 2);
      } else {
        // Default to desktop-commander if no server specified
        serverName = 'desktop-commander';
        actualToolName = toolName;
      }
      
      console.log(`ToolHandler: Extracted server: ${serverName}, tool: ${actualToolName}`);
      
      // Handle parameter name differences for desktop-commander
      const processedArgs = this.normalizeArguments(serverName, actualToolName, toolArgs);
      
      const result = {
        server: serverName,
        tool: actualToolName,
        arguments: processedArgs
      };
      
      console.log(`ToolHandler: Final tool call object: ${serverName}.${actualToolName}`);
      return result;
    } catch (error) {
      console.error('ToolHandler: Error extracting tool call:', error);
      return null;
    }
  }
  
  /**
   * Extract JSON from text, handling markdown code blocks
   * @param {string} text - The text containing JSON
   * @returns {string} The extracted JSON
   */
  extractJsonFromText(text) {
    let cleanedText = text;
    
    // Handle markdown code blocks
    if (text.includes('```json')) {
      const jsonStart = text.indexOf('```json') + '```json'.length;
      const jsonEnd = text.indexOf('```', jsonStart);
      if (jsonEnd > jsonStart) {
        cleanedText = text.substring(jsonStart, jsonEnd).trim();
        console.log(`ToolHandler: Extracted JSON from markdown code block (length: ${cleanedText.length} characters)`);
      }
    } else if (text.includes('```')) {
      const jsonStart = text.indexOf('```') + '```'.length;
      const jsonEnd = text.indexOf('```', jsonStart);
      if (jsonEnd > jsonStart) {
        cleanedText = text.substring(jsonStart, jsonEnd).trim();
        console.log(`ToolHandler: Extracted potential JSON from generic code block (length: ${cleanedText.length} characters)`);
      }
    }
    
    // Ensure we have a properly formatted JSON object
    // Find the first { and the last }
    const firstBrace = cleanedText.indexOf('{');
    const lastBrace = cleanedText.lastIndexOf('}');
    
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      cleanedText = cleanedText.substring(firstBrace, lastBrace + 1);
      console.log(`ToolHandler: Extracted JSON object (length: ${cleanedText.length} characters)`);
    }
    
    return cleanedText;
  }
  
  /**
   * Fix common issues in JSON strings
   * @param {string} jsonString - The JSON string to fix
   * @returns {string} The fixed JSON string
   */
  fixJsonIssues(jsonString) {
    if (!jsonString) return jsonString;
    
    console.log('ToolHandler: Fixing common JSON issues...');
    
    // Fix doubled quotes (e.g., ""key"": ""value"")
    let fixed = jsonString.replace(/""+([^"]+)""+\s*:\s*""+([^"]+)""+/g, '"$1":"$2"');
    
    // Remove unnecessary spaces in property names and values
    fixed = fixed.replace(/"\s+([^"]+)\s+"/g, '"$1"');
    
    // Special handling for incomplete JSON (fix missing closing braces)
    if (!fixed.trim().endsWith('}') && fixed.indexOf('{') !== -1) {
      const openBraces = (fixed.match(/\{/g) || []).length;
      const closeBraces = (fixed.match(/\}/g) || []).length;
      
      if (openBraces > closeBraces) {
        console.log(`ToolHandler: Fixing missing closing braces (${openBraces} open, ${closeBraces} close)`);
        fixed = fixed + '}'.repeat(openBraces - closeBraces);
      }
    }
    
    return fixed;
  }
  
  /**
   * Normalize argument names for consistent handling
   * @param {string} serverName - The server name
   * @param {string} toolName - The tool name
   * @param {Object} args - The arguments
   * @returns {Object} Normalized arguments
   */
  normalizeArguments(serverName, toolName, args) {
    const processedArgs = { ...args };
    
    if (serverName === 'desktop-commander') {
      // Map known parameter name variations
      const parameterMappings = {
        'read_file': { 'file_path': 'path', 'filepath': 'path', 'filename': 'path', 'file': 'path' },
        'write_file': { 'file_path': 'path', 'filepath': 'path', 'filename': 'path', 'file': 'path', 'text': 'content', 'data': 'content' },
        'list_directory': { 'directory': 'path', 'dir': 'path', 'folder': 'path' }
      };
      
      // Apply mappings if available for this tool
      if (parameterMappings[toolName]) {
        for (const [altName, standardName] of Object.entries(parameterMappings[toolName])) {
          if (processedArgs[altName] !== undefined && processedArgs[standardName] === undefined) {
            console.log(`ToolHandler: Mapping parameter ${altName} to ${standardName}`);
            processedArgs[standardName] = processedArgs[altName];
            delete processedArgs[altName];
          }
        }
      }
    }
    
    return processedArgs;
  }
  
  /**
   * Check if a string contains a complete and valid JSON object
   * @param {string} str - The string to check
   * @returns {boolean} True if the string contains a complete JSON object
   */
  isCompleteJson(str) {
    try {
      // Clean up the string to extract just the JSON part
      const jsonStr = this.extractJsonFromText(str);
      
      // For image-renderer with base64, simplify validation by checking structure not content
      // if (jsonStr.includes('image-renderer') && jsonStr.includes('"data"')) {
      //   // Extract structure without the big base64 string to make validation easier
      //   const toolMatch = jsonStr.match(/"tool"\s*:\s*"([^"]+)"/i);
      //   const hasArguments = jsonStr.includes('"arguments"');
      //   const hasMimeType = jsonStr.includes('"mimeType"');
      //   const hasData = jsonStr.includes('"data"');
        
      //   // If it has the basic structure of a valid image-renderer call, consider it complete
      //   if (toolMatch && hasArguments && hasMimeType && hasData) {
      //     console.log('ToolHandler: Image renderer JSON structure appears valid');
      //     return true;
      //   }
      // }
      
      // Try parsing the JSON
      JSON.parse(jsonStr);
      return true;
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Execute a tool call
   * @param {Object} toolCall - The tool call to execute
   * @returns {Promise<Object>} The result of the tool execution
   */
  async executeTool(toolCall) {
    console.log(`ToolHandler: Executing tool ${toolCall.server}.${toolCall.tool} with args:`, toolCall.arguments);
    
    try {
      const result = await mcpService.callTool(toolCall.server, toolCall.tool, toolCall.arguments);
      console.log(`ToolHandler: Tool execution successful:`, result);
      return result;
    } catch (error) {
      console.error(`ToolHandler: Error executing tool:`, error);
      throw error;
    }
  }
  
  /**
   * Format a tool result for display
   * @param {Object} toolResult - The tool execution result
   * @returns {string} Formatted tool result
   */
  formatToolResult(toolResult) {
    console.log('ToolHandler: Formatting tool result of type:', typeof toolResult);
    
    // Handle null or undefined
    if (!toolResult) {
      return '\n\n<strong>Tool Result:</strong>\n<pre>No result returned</pre>\n\n';
    }
    
    // Check if this is an image result
    if (toolResult.type === 'image' || 
        (toolResult.imageData && (toolResult.imageData.startsWith('data:image/') || 
                                  toolResult.imageData.startsWith('data:image/')))) {
      console.log('ToolHandler: Formatting image result');
      
      // Format image HTML with proper styling and alt text
      return `\n\n<div class="image-container">
  <img src="${toolResult.imageData}" alt="${toolResult.altText || 'Generated image'}" class="tool-generated-image">
  ${toolResult.altText ? `<div class="image-caption">${toolResult.altText}</div>` : ''}
</div>\n\n`;
    } 
    
    // Check for SVG result
    if (toolResult.type === 'svg' || 
        (toolResult.svgContent && typeof toolResult.svgContent === 'string')) {
      console.log('ToolHandler: Formatting SVG result');
      
      // Format SVG embedding
      return `\n\n<div class="svg-container">
  ${toolResult.svgContent || ''}
  ${toolResult.altText ? `<div class="svg-caption">${toolResult.altText}</div>` : ''}
</div>\n\n`;
    }
    
    // Handle content array from read_file
    if (Array.isArray(toolResult.content)) {
      console.log('ToolHandler: Formatting content array result');
      let formattedContent = '';
      
      for (const item of toolResult.content) {
        if (item.type === 'text') {
          formattedContent += `<pre>${item.text}</pre>`;
        } else if (item.type === 'image') {
          formattedContent += `<div class="image-container">
  <img src="${item.data}" alt="${item.altText || 'Image'}" class="tool-generated-image">
</div>`;
        }
      }
      
      return `\n\n<strong>Tool Result:</strong>\n${formattedContent}\n\n`;
    }
    
    // Format other results
    console.log('ToolHandler: Formatting standard tool result');
    
    // Normal formatting for non-image results
    try {
      const formattedResult = JSON.stringify(toolResult, null, 2)
        .replace(/\\n/g, '\n')  // Fix escaped newlines
        .replace(/^\{\n/, '')   // Remove leading {
        .replace(/\n\}$/, '');  // Remove trailing }
      
      return `\n\n<strong>Tool Result:</strong>\n<pre>${formattedResult}</pre>\n\n`;
    } catch (error) {
      console.error('ToolHandler: Error formatting result:', error);
      return `\n\n<strong>Tool Result:</strong>\n<pre>${String(toolResult)}</pre>\n\n`;
    }
  }
}

module.exports = ToolHandler;