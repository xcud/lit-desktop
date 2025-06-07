/**
 * Test the new MCP service architecture
 */

const mcpService = require('./mcp-service-new');

async function testMcpService() {
  console.log('Starting MCP service test');
  
  try {
    // Initialize the service
    mcpService.initialize({
      mcpServers: {
        'desktop-commander': {
          command: 'npx',
          args: ['@wonderwhy-er/desktop-commander@latest'],
          description: 'Access and manipulate files on the local system',
          autoStart: true
        }
      }
    });
    
    // Wait for initialization to complete
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Get all tools
    console.log('Getting all tools...');
    const tools = await mcpService.getAllTools();
    console.log(`Found ${tools.length} tools:`, tools.map(t => t.name).join(', '));
    
    // Test a tool call
    console.log('Testing tool call...');
    const currentDir = process.cwd();
    const result = await mcpService.callTool('desktop-commander', 'list_directory', { path: currentDir });
    console.log('Tool call result:', JSON.stringify(result, null, 2));
    
    // Clean up
    console.log('Cleaning up...');
    await mcpService.cleanup();
    
    console.log('MCP service test completed successfully');
  } catch (error) {
    console.error('Error testing MCP service:', error);
  }
}

// Run the test
testMcpService();