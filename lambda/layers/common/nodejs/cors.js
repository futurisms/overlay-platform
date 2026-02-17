/**
 * Shared CORS utility for all Lambda handlers
 * Ensures consistent CORS headers across all API endpoints
 */

const ALLOWED_ORIGINS = [
  'https://overlay.futurisms.ai', // Production custom domain
  'https://overlay-platform.vercel.app', // Vercel production
  'https://overlay-platform-git-master-satnams-projects-7193fd93.vercel.app', // Vercel git branch
  'http://localhost:3000', // Local development
  'http://localhost:3002', // Local development (alternate port)
];

/**
 * Get CORS headers for Lambda response
 * @param {Object} event - Lambda event object with headers
 * @returns {Object} Headers object with CORS configuration
 */
function getCorsHeaders(event) {
  const origin = event?.headers?.origin || event?.headers?.Origin || '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Credentials': 'true',
    'Content-Type': 'application/json',
  };
}

/**
 * Create a standardized error response with CORS headers
 * @param {number} statusCode - HTTP status code
 * @param {string} message - Error message
 * @param {Object} event - Lambda event object
 * @returns {Object} Lambda response object
 */
function errorResponse(statusCode, message, event) {
  return {
    statusCode,
    headers: getCorsHeaders(event),
    body: JSON.stringify({ error: message }),
  };
}

/**
 * Create a standardized success response with CORS headers
 * @param {number} statusCode - HTTP status code (default 200)
 * @param {Object} data - Response data
 * @param {Object} event - Lambda event object
 * @param {Object} additionalHeaders - Additional headers to merge
 * @returns {Object} Lambda response object
 */
function successResponse(statusCode = 200, data, event, additionalHeaders = {}) {
  return {
    statusCode,
    headers: {
      ...getCorsHeaders(event),
      ...additionalHeaders,
    },
    body: JSON.stringify(data),
  };
}

module.exports = {
  getCorsHeaders,
  errorResponse,
  successResponse,
  ALLOWED_ORIGINS,
};
