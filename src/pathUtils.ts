/**
 * Utility functions for working with file paths
 */

/**
 * Converts an absolute path to a relative path from the current working directory.
 * If the path is not under the current working directory, returns the original path.
 * 
 * @param absolutePath - The absolute file path to convert
 * @returns The relative path or the original path if not under cwd
 * 
 * @example
 * // If cwd is /Users/user/project
 * toRelativePath('/Users/user/project/src/file.ts') // Returns 'src/file.ts'
 * toRelativePath('/other/path/file.ts') // Returns '/other/path/file.ts'
 */
export function toRelativePath(absolutePath: string): string {
  const cwd = process.cwd();
  if (absolutePath.startsWith(cwd)) {
    const relative = absolutePath.slice(cwd.length);
    // Remove leading slash if present
    return relative.startsWith('/') ? relative.slice(1) : relative;
  }
  return absolutePath;
}

/**
 * Escapes special regex characters in a string to make it safe for use in a RegExp.
 * 
 * @param str - The string to escape
 * @returns The escaped string safe for RegExp
 * 
 * @example
 * escapeRegex('/path/to/file') // Returns '\\/path\\/to\\/file'
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Converts all absolute paths in stack traces and error messages to relative paths.
 * This makes error messages more portable and easier to read.
 * 
 * @param text - The text containing absolute paths (e.g., stack trace)
 * @returns The text with absolute paths replaced with relative paths (using '.' as the base)
 * 
 * @example
 * // If cwd is /Users/user/project
 * const stack = 'Error at /Users/user/project/src/file.ts:10:5'
 * convertStackTraceToRelativePaths(stack) // Returns 'Error at ./src/file.ts:10:5'
 */
export function convertStackTraceToRelativePaths(text: string): string {
  const cwd = process.cwd();
  const escapedCwd = escapeRegex(cwd);
  return text.replace(new RegExp(escapedCwd, 'g'), '.');
}
