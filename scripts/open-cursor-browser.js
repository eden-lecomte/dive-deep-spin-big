#!/usr/bin/env node

/**
 * Helper script to remind how to open Simple Browser in Cursor IDE
 * Since Cursor doesn't support CLI commands for Simple Browser,
 * this script provides instructions.
 */

const URL = 'http://localhost:3000';

console.log('\n📖 To open in Cursor Simple Browser:\n');
console.log('1. Press Ctrl+Shift+P (or Cmd+Shift+P on Mac)');
console.log('2. Type "Simple Browser: Show"');
console.log('3. Enter the URL:', URL);
console.log('\n💡 Tip: You can also use the Command Palette shortcut!\n');

// Try to copy URL to clipboard (optional, cross-platform)
try {
  const { execSync } = require('child_process');
  const platform = process.platform;
  
  if (platform === 'win32') {
    // Windows
    execSync(`echo ${URL} | clip`, { stdio: 'ignore' });
    console.log('✅ URL copied to clipboard!\n');
  } else if (platform === 'darwin') {
    // macOS
    execSync(`echo "${URL}" | pbcopy`, { stdio: 'ignore' });
    console.log('✅ URL copied to clipboard!\n');
  } else {
    // Linux
    try {
      execSync(`echo "${URL}" | xclip -selection clipboard`, { stdio: 'ignore' });
      console.log('✅ URL copied to clipboard!\n');
    } catch {
      // xclip not available, that's okay
    }
  }
} catch (error) {
  // Clipboard copy failed, that's okay - just continue
}
