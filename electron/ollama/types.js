/**
 * Shared types for the Ollama service
 */

/**
 * @typedef {Object} Message
 * @property {string} role - Role of the message (system, user, assistant)
 * @property {string} content - Content of the message
 */

/**
 * @typedef {Object} ChatOptions
 * @property {number} [temperature] - Temperature setting for generation
 * @property {number} [top_p] - Top-p setting for generation
 * @property {number} [top_k] - Top-k setting for generation
 * @property {number} [num_predict] - Maximum number of tokens to predict
 */

/**
 * @typedef {Object} ToolCall
 * @property {string} server - The server to call
 * @property {string} tool - The tool to call
 * @property {Object} arguments - The arguments to pass to the tool
 */

/**
 * @typedef {Object} StreamInfo
 * @property {AbortController} abortController - Controller for aborting the stream
 * @property {number} timestamp - Creation timestamp
 */

/**
 * @typedef {Object} ModelInfo
 * @property {string} name - Name of the model
 * @property {string} model - Model identifier
 * @property {string[]} tags - Tags associated with the model
 */

module.exports = {
  // Empty export, TypeScript-style definitions are for documentation only
};