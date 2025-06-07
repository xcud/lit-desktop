/**
 * Test script for the new MCPManager class
 */

const MCPManager = require('../electron/mcp-manager');

async function testMCPManager() {
  console.log('=== Testing MCPManager ===');
  
  try {
    // Create an instance
    const mcpManager = new MCPManager();
    
    // Wait a bit for initialization
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Test getting tool info for prompt
    console.log('\n=== Testing getToolInfoForPrompt ===');
    const toolInfo = mcpManager.getToolInfoForPrompt('testuser', 'desktop');
    console.log(`Got ${toolInfo.length} tools:`);
    for (const tool of toolInfo) {
      console.log(`- ${tool.name}: ${tool.description}`);
      console.log(`  Parameters: ${JSON.stringify(tool.parameters, null, 2)}`);
    }
    
    // Test ensuring user MCP clients
    console.log('\n=== Testing ensureUserMcpClients ===');
    await mcpManager.ensureUserMcpClients('desktop', 'testuser');
    
    // Test getting tool info again after client initialization
    console.log('\n=== Testing getToolInfoForPrompt after client init ===');
    const toolInfo2 = mcpManager.getToolInfoForPrompt('testuser', 'desktop');
    console.log(`Got ${toolInfo2.length} tools after client init`);
    
    console.log('\n=== MCPManager test completed successfully ===');
    
  } catch (error) {
    console.error('MCPManager test failed:', error);
  }
}

// Run the test
testMCPManager();
