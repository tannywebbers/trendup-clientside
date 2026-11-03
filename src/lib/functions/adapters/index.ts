/**
 * Adapters Index
 * 
 * Export all platform adapters for easy importing.
 */

export { createDenoHandler, serve } from './deno';
export { createVercelHandler, createNetlifyHandler, createExpressHandler } from './node';
