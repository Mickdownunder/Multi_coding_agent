import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface PasswordDisplayProps {
  password: string;
}

/**
 * PasswordDisplay component provides a read-only view of a generated password
 * and a button to copy the password to the clipboard.
 */
const PasswordDisplay: React.FC<PasswordDisplayProps> = ({ password }) => {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    if (!password) return;
    
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      
      // Reset the "Copied" state after 2 seconds
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (err) {
      console.error('Failed to copy password: ', err);
    }
  };

  return (
    <div className="flex flex-col space-y-2">
      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
        Generated Password
      </label>
      <div className="relative flex items-center">
        <input
          type="text"
          readOnly
          value={password}
          placeholder="Your password will appear here"
          className="w-full px-4 py-3 bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500 font-mono"
        />
        <button
          onClick={copyToClipboard}
          disabled={!password}
          className="absolute right-2 p-2 text-gray-500 hover:text-blue-600 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="Copy to clipboard"
        >
          {copied ? (
            <Check className="w-5 h-5 text-green-500" />
          ) : (
            <Copy className="w-5 h-5" />
          )}
        </button>
      </div>
      {copied && (
        <p className="text-xs text-green-600 dark:text-green-400 mt-1 animate-pulse">
          Copied to clipboard!
        </p>
      )}
    </div>
  );
};

export default PasswordDisplay;