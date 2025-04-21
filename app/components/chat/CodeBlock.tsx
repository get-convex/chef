import { memo, useEffect, useState } from 'react';
import { bundledLanguages, codeToHtml, isSpecialLang, type BundledLanguage, type SpecialLanguage } from 'shiki';
import { classNames } from '~/utils/classNames';
import { createScopedLogger } from 'chef-agent/utils/logger';
import { CheckIcon, ClipboardIcon } from '@radix-ui/react-icons';
import { Button } from '@ui/Button';

const logger = createScopedLogger('CodeBlock');

interface CodeBlockProps {
  className?: string;
  code: string;
  language?: BundledLanguage | SpecialLanguage;
  theme?: 'light-plus' | 'dark-plus';
  disableCopy?: boolean;
}

export const CodeBlock = memo(function CodeBlock({
  className,
  code,
  language = 'plaintext',
  theme = 'dark-plus',
  disableCopy = false,
}: CodeBlockProps) {
  const [html, setHTML] = useState<string | undefined>(undefined);
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    if (copied) {
      return;
    }

    navigator.clipboard.writeText(code);

    setCopied(true);

    setTimeout(() => {
      setCopied(false);
    }, 1000);
  };

  useEffect(() => {
    if (language && !isSpecialLang(language) && !(language in bundledLanguages)) {
      logger.warn(`Unsupported language '${language}'`);
    }

    logger.trace(`Language = ${language}`);

    const processCode = async () => {
      setHTML(await codeToHtml(code, { lang: language, theme }));
    };

    processCode();
  }, [code, language, theme]);

  return (
    <div className={classNames('relative group', className)}>
      <div
        className={classNames('absolute top-2 right-2 opacity-0 group-hover:opacity-100', {
          'opacity-100': copied,
        })}
      >
        {!disableCopy && (
          <Button
            variant="neutral"
            icon={copied ? <CheckIcon className="text-util-success" /> : <ClipboardIcon />}
            onClick={() => copyToClipboard()}
            tip="Copy Code"
            tipSide="top"
          />
        )}
      </div>
      <div dangerouslySetInnerHTML={{ __html: html ?? '' }}></div>
    </div>
  );
});
