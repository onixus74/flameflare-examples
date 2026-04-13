/**
 * Format a greeting message.
 * @param {string} name - The name to greet.
 * @param {string} appName - The application name.
 * @returns {string} The formatted greeting.
 */
export function formatGreeting(name, appName) {
  return `Hello, ${name}! Welcome to ${appName}.`;
}

/**
 * Get the current timestamp in ISO 8601 format.
 * @returns {string} The current UTC timestamp.
 */
export function getTimestamp() {
  return new Date().toISOString();
}
