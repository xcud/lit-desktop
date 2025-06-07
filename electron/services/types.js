/**
 * Common types and interfaces for the MCP service architecture
 */

/**
 * @typedef {Object} McpTool
 * @property {string} name - The name of the tool
 * @property {string} [description] - Description of what the tool does
 * @property {Object.<string, Object>} [parameters] - Tool parameters
 */

/**
 * @typedef {Object} McpServerConfig
 * @property {string} command - The command to run the server
 * @property {string[]} [args] - Arguments to pass to the command
 * @property {string} [description] - Description of the server
 * @property {boolean} [autoStart] - Whether to auto-start the server
 * @property {McpTool[]} [cached_tools] - Cached tools for the server
 * @property {'internal'|string} [command] - Special value 'internal' for internal services
 */

/**
 * @typedef {Object} McpConfig
 * @property {Object.<string, McpServerConfig>} mcpServers - Map of server names to configs
 */

/**
 * @typedef {Object} ProtocolSettings
 * @property {'stdio'|'sse'} type - The protocol type
 * @property {Object} [env] - Environment variables for stdio protocol
 * @property {string} [url] - URL for SSE protocol
 */

module.exports = {};