import { useState } from "react";
import { Check, Copy } from "lucide-react";

interface CopyToClipboardProps {
  text: string;
  className?: string;
}

export const CopyToClipboard = ({
  text,
  className = "",
}: CopyToClipboardProps) => {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = async () => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className={`p-1.5 rounded-md text-muted-foreground hover:text-foreground bg-secondary-800/80 border border-secondary-700/50 hover:bg-secondary-700 hover:border-secondary-600 transition-all focus:outline-none focus:ring-1 focus:ring-primary backdrop-blur-sm ${className}`}
      title="Copy to clipboard"
      aria-label="Copy code block"
    >
      {isCopied ? (
        <Check className="h-3.5 w-3.5 text-green-500 animate-in fade-in zoom-in-50 duration-200" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </button>
  );
};
