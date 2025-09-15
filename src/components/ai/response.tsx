'use client';

import * as React from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Copy, Check } from 'lucide-react';
import { useTheme } from 'next-themes';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/utils';

export interface ResponseProps {
  children: string;
  isStreaming?: boolean;
  className?: string;
  copyable?: boolean;
  showCursor?: boolean;
}

interface CodeProps {
  node?: unknown;
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
}

interface PreProps {
  children?: React.ReactNode;
}

interface CustomComponents {
  code: (props: CodeProps) => React.ReactElement;
  pre: (props: PreProps) => React.ReactElement;
}

export const Response: React.FC<ResponseProps> = ({
  children,
  isStreaming = false,
  className,
  copyable = true,
  showCursor = true,
}) => {
  const [copiedStates, setCopiedStates] = React.useState<Record<string, boolean>>({});
  const { theme } = useTheme();
  const syntaxStyle = theme === 'dark' ? oneDark : oneLight;

  const handleCopy = async (text: string, blockId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedStates((prev) => ({ ...prev, [blockId]: true }));
      setTimeout(() => {
        setCopiedStates((prev) => ({ ...prev, [blockId]: false }));
      }, 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  const customComponents: CustomComponents = {
    code: ({ inline, className, children, ...props }) => {
      const match = /language-(\w+)/.exec(className || '');
      // eslint-disable-next-line @typescript-eslint/no-base-to-string
      const codeContent = String(children).replace(/\n$/, '');
      const isInline = inline || !match;

      if (isInline) {
        return (
          <code
            className={cn(
              'relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm',
              'font-medium',
              className,
            )}
            {...(props as React.HTMLAttributes<HTMLElement>)}
          >
            {children}
          </code>
        );
      }

      const generatedId = Math.random().toString(36).substr(2, 9);
      const copied = copiedStates[generatedId] || false;
      const CopyIcon = copied ? Check : Copy;

      return (
        <div className="relative group">
          {copyable && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-2 top-2 h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => void handleCopy(codeContent, generatedId)}
            >
              <CopyIcon className="h-4 w-4" />
              <span className="sr-only">Copy code</span>
            </Button>
          )}
          <SyntaxHighlighter
            style={syntaxStyle}
            language={match ? match[1] : ''}
            PreTag="div"
            className={cn(
              'rounded-md overflow-hidden',
              theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50',
            )}
            {...props}
          >
            {codeContent}
          </SyntaxHighlighter>
        </div>
      );
    },
    pre: ({ children }) => <>{children}</>,
  };

  return (
    <div className={cn('relative', className)}>
      <div
        className={cn(
          'prose prose-sm max-w-none break-words',
          // Reset and base text inheritance
          'text-inherit [&_*]:text-inherit',
          // Headings
          'prose-headings:font-semibold prose-headings:text-inherit prose-headings:mt-4 prose-headings:mb-2',
          'prose-h1:text-xl prose-h2:text-lg prose-h3:text-base',
          // Paragraphs
          'prose-p:leading-relaxed prose-p:my-2 prose-p:text-inherit',
          // Lists - ensure proper formatting
          'prose-ul:my-2 prose-ol:my-2 prose-ul:pl-4 prose-ol:pl-4',
          'prose-ul:list-disc prose-ol:list-decimal',
          'prose-li:my-1 prose-li:text-inherit prose-li:leading-relaxed',
          'prose-li:marker:text-inherit',
          // Strong and emphasis
          'prose-strong:text-inherit prose-strong:font-semibold',
          'prose-em:text-inherit prose-em:italic',
          // Blockquotes
          'prose-blockquote:border-l-4 prose-blockquote:border-current prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:my-3',
          // Inline code
          'prose-code:text-sm prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:bg-black/10 prose-code:text-inherit prose-code:before:content-none prose-code:after:content-none',
          // Pre and code blocks
          'prose-pre:m-0 prose-pre:bg-transparent prose-pre:p-0',
          // Links
          'prose-a:text-inherit prose-a:underline prose-a:decoration-current',
          // Remove default margins on first/last elements
          '[&>*:first-child]:mt-0 [&>*:last-child]:mb-0',
          // Force list styling to show
          '[&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-4 [&_ol]:pl-4',
          '[&_li]:ml-0 [&_li]:text-inherit',
        )}
      >
        <ReactMarkdown
          components={customComponents}
          remarkRehypeOptions={{ allowDangerousHtml: true }}
        >
          {children}
        </ReactMarkdown>
      </div>

      {isStreaming && showCursor && (
        <span className="inline-block w-2 h-5 bg-current animate-pulse ml-1" />
      )}
    </div>
  );
};

export default Response;
