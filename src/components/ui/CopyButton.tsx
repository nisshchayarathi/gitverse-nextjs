import React, { useState } from 'react';
import { Clipboard, Check } from 'lucide-react';

interface CopyButtonProps {
  textToCopy: string;
}

export const CopyButton: React.FC<CopyButtonProps> = ({ textToCopy }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <button
      onClick={handleCopy}
      type="button"
      className="absolute top-2 right-2 flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition border border-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      aria-label={copied ? "Copied code" : "Copy code block to clipboard"}
    >
      {copied ? (
        <>
          <Check className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-emerald-400">Copied!</span>
        </>
      ) : (
        <>
          <Clipboard className="w-3.5 h-3.5" />
          <span>Copy</span>
        </>
      )}
    </button>
  );
};

export default CopyButton;