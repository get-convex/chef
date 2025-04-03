/*
 * @ts-nocheck
 * Preventing TS checks with files presented in the video for a better presentation.
 */
import type { JSONValue, Message } from 'ai';
import React, { type RefCallback, useEffect, useState } from 'react';
import { ClientOnly } from 'remix-utils/client-only';
import { Menu } from '~/components/sidebar/Menu.client';
import { IconButton } from '~/components/ui/IconButton';
import { Workbench } from '~/components/workbench/Workbench.client';
import { classNames } from '~/utils/classNames';
import { Messages } from './Messages.client';
import { SendButton } from './SendButton.client';
import * as Tooltip from '@radix-ui/react-tooltip';

import styles from './BaseChat.module.scss';

import FilePreview from './FilePreview';
import type { ProviderInfo } from '~/types/model';
import { ScreenshotStateManager } from './ScreenshotStateManager';
import { toast } from 'react-toastify';
import type { ActionAlert } from '~/types/actions';
import ChatAlert from './ChatAlert';
import ProgressCompilation from './ProgressCompilation';
import type { ProgressAnnotation } from '~/types/context';
import type { ActionRunner } from '~/lib/runtime/action-runner';
import { ConvexConnection } from '~/components/convex/ConvexConnection';
import { FlexAuthWrapper } from './FlexAuthWrapper';
import { useFlexAuthMode } from '~/lib/stores/convex';
const TEXTAREA_MIN_HEIGHT = 76;

interface BaseChatProps {
  textareaRef?: React.RefObject<HTMLTextAreaElement> | undefined;
  messageRef?: RefCallback<HTMLDivElement> | undefined;
  scrollRef?: RefCallback<HTMLDivElement> | undefined;
  showChat?: boolean;
  chatStarted?: boolean;
  isStreaming?: boolean;
  onStreamingChange?: (streaming: boolean) => void;
  messages?: Message[];
  description?: string;
  enhancingPrompt?: boolean;
  promptEnhanced?: boolean;
  input?: string;
  model?: string;
  setModel?: (model: string) => void;
  provider?: ProviderInfo;
  setProvider?: (provider: ProviderInfo) => void;
  providerList?: ProviderInfo[];
  handleStop?: () => void;
  sendMessage?: (event: React.UIEvent, messageInput?: string) => void;
  handleInputChange?: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  enhancePrompt?: () => void;
  uploadedFiles?: File[];
  setUploadedFiles?: (files: File[]) => void;
  imageDataList?: string[];
  setImageDataList?: (dataList: string[]) => void;
  actionAlert?: ActionAlert;
  clearAlert?: () => void;
  data?: JSONValue[] | undefined;
  actionRunner?: ActionRunner;
}

export const WrappedBaseChat = (props: BaseChatProps) => {
  return <FlexAuthWrapper>{<BaseChat {...props} />}</FlexAuthWrapper>;
};

export const BaseChat = React.forwardRef<HTMLDivElement, BaseChatProps>(
  (
    {
      textareaRef,
      messageRef,
      scrollRef,
      showChat = true,
      chatStarted = false,
      isStreaming = false,
      onStreamingChange,
      providerList,
      input = '',
      enhancingPrompt,
      handleInputChange,

      // promptEnhanced,
      enhancePrompt,
      sendMessage,
      handleStop,
      uploadedFiles = [],
      setUploadedFiles,
      imageDataList = [],
      setImageDataList,
      messages,
      actionAlert,
      clearAlert,
      data,
      actionRunner,
    },
    ref,
  ) => {
    const flexAuthMode = useFlexAuthMode();
    const TEXTAREA_MAX_HEIGHT = chatStarted ? 400 : 200;
    const [progressAnnotations, setProgressAnnotations] = useState<ProgressAnnotation[]>([]);
    useEffect(() => {
      if (data) {
        const progressList = data.filter(
          (x) => typeof x === 'object' && (x as any).type === 'progress',
        ) as ProgressAnnotation[];
        setProgressAnnotations(progressList);
      }
    }, [data]);

    useEffect(() => {
      onStreamingChange?.(isStreaming);
    }, [isStreaming, onStreamingChange]);

    const handleSendMessage = (event: React.UIEvent, messageInput?: string) => {
      if (sendMessage) {
        sendMessage(event, messageInput);
      }
    };

    const handlePaste = async (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items;

      if (!items) {
        return;
      }

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();

          const file = item.getAsFile();

          if (file) {
            const reader = new FileReader();

            reader.onload = (e) => {
              const base64Image = e.target?.result as string;
              setUploadedFiles?.([...uploadedFiles, file]);
              setImageDataList?.([...imageDataList, base64Image]);
            };
            reader.readAsDataURL(file);
          }

          break;
        }
      }
    };

    const baseChat = (
      <div
        ref={ref}
        className={classNames(styles.BaseChat, 'relative flex h-full w-full overflow-hidden')}
        data-chat-visible={showChat}
      >
        <ClientOnly>{() => <Menu />}</ClientOnly>
        <div ref={scrollRef} className="flex flex-col lg:flex-row overflow-y-auto w-full h-full">
          <div className={classNames(styles.Chat, 'flex flex-col flex-grow lg:min-w-[var(--chat-min-width)] h-full')}>
            {!chatStarted && (
              <div id="intro" className="mt-[16vh] max-w-chat mx-auto text-center px-4 lg:px-0">
                <h1 className="text-4xl lg:text-6xl font-black text-bolt-elements-textPrimary mb-4 animate-fade-in font-display tracking-tight">
                  Where ideas begin
                </h1>
                <p className="text-md lg:text-2xl text-balance mb-8 text-bolt-elements-textSecondary animate-fade-in animation-delay-200 font-medium font-display">
                  Bring ideas to life in seconds or get help on existing projects.
                </p>
              </div>
            )}
            <div
              className={classNames('pt-6 px-2 sm:px-6', {
                'h-full flex flex-col': chatStarted,
              })}
              ref={scrollRef}
            >
              <ClientOnly>
                {() => {
                  return chatStarted ? (
                    <Messages
                      ref={messageRef}
                      className="flex flex-col w-full flex-1 max-w-chat pb-6 mx-auto z-1"
                      messages={messages}
                      isStreaming={isStreaming}
                    />
                  ) : null;
                }}
              </ClientOnly>
              <div
                className={classNames('flex flex-col gap-4 w-full max-w-chat mx-auto z-prompt mb-6', {
                  'sticky bottom-2': chatStarted,
                })}
              >
                <div className="bg-bolt-elements-background-depth-2">
                  {actionAlert && (
                    <ChatAlert
                      alert={actionAlert}
                      clearAlert={() => clearAlert?.()}
                      postMessage={(message) => {
                        sendMessage?.({} as any, message);
                        clearAlert?.();
                      }}
                    />
                  )}
                </div>
                {progressAnnotations && <ProgressCompilation data={progressAnnotations} />}
                <div
                  className={classNames(
                    'bg-bolt-elements-background-depth-2 rounded-lg border border-bolt-elements-borderColor relative w-full max-w-chat mx-auto z-prompt',

                    /*
                     * {
                     *   'sticky bottom-2': chatStarted,
                     * },
                     */
                  )}
                >
                  <FilePreview
                    files={uploadedFiles}
                    imageDataList={imageDataList}
                    onRemove={(index) => {
                      setUploadedFiles?.(uploadedFiles.filter((_, i) => i !== index));
                      setImageDataList?.(imageDataList.filter((_, i) => i !== index));
                    }}
                  />
                  <ClientOnly>
                    {() => (
                      <ScreenshotStateManager
                        setUploadedFiles={setUploadedFiles}
                        setImageDataList={setImageDataList}
                        uploadedFiles={uploadedFiles}
                        imageDataList={imageDataList}
                      />
                    )}
                  </ClientOnly>
                  <div>
                    <textarea
                      ref={textareaRef}
                      className={classNames(
                        'w-full pl-4 pt-4 pr-16 outline-none resize-none text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary bg-transparent text-sm',
                        'transition-all duration-200',
                        'hover:border-bolt-elements-focus',
                      )}
                      onDragEnter={(e) => {
                        e.preventDefault();
                        e.currentTarget.style.border = '2px solid #1488fc';
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.currentTarget.style.border = '2px solid #1488fc';
                      }}
                      onDragLeave={(e) => {
                        e.preventDefault();
                        e.currentTarget.style.border = '1px solid var(--bolt-elements-borderColor)';
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.currentTarget.style.border = '1px solid var(--bolt-elements-borderColor)';

                        const files = Array.from(e.dataTransfer.files);
                        files.forEach((file) => {
                          if (file.type.startsWith('image/')) {
                            const reader = new FileReader();

                            reader.onload = (e) => {
                              const base64Image = e.target?.result as string;
                              setUploadedFiles?.([...uploadedFiles, file]);
                              setImageDataList?.([...imageDataList, base64Image]);
                            };
                            reader.readAsDataURL(file);
                          }
                        });
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          if (event.shiftKey) {
                            return;
                          }

                          event.preventDefault();

                          if (isStreaming) {
                            handleStop?.();
                            return;
                          }

                          // ignore if using input method engine
                          if (event.nativeEvent.isComposing) {
                            return;
                          }

                          handleSendMessage?.(event);
                        }
                      }}
                      value={input}
                      onChange={(event) => {
                        handleInputChange?.(event);
                      }}
                      onPaste={handlePaste}
                      style={{
                        minHeight: TEXTAREA_MIN_HEIGHT,
                        maxHeight: TEXTAREA_MAX_HEIGHT,
                      }}
                      placeholder="How can Flex help you today?"
                      translate="no"
                    />
                    <ClientOnly>
                      {() => (
                        <SendButton
                          show={input.length > 0 || isStreaming || uploadedFiles.length > 0}
                          isStreaming={isStreaming}
                          disabled={!providerList || providerList.length === 0}
                          onClick={(event) => {
                            if (isStreaming) {
                              handleStop?.();
                              return;
                            }

                            if (input.length > 0 || uploadedFiles.length > 0) {
                              handleSendMessage?.(event);
                            }
                          }}
                        />
                      )}
                    </ClientOnly>
                    <div className="flex justify-between items-center text-sm p-4 pt-2">
                      <div className="flex gap-1 items-center">
                        <IconButton
                          title="Enhance prompt"
                          disabled={input.length === 0 || enhancingPrompt}
                          className={classNames('transition-all', enhancingPrompt ? 'opacity-100' : '')}
                          onClick={() => {
                            enhancePrompt?.();
                            toast.success('Prompt enhanced!');
                          }}
                        >
                          {enhancingPrompt ? (
                            <div className="i-svg-spinners:90-ring-with-bg text-bolt-elements-loader-progress text-xl animate-spin"></div>
                          ) : (
                            <div className="i-bolt:stars text-xl"></div>
                          )}
                        </IconButton>
                      </div>
                      {input.length > 3 ? (
                        <div className="text-xs text-bolt-elements-textTertiary">
                          Use <kbd className="kdb px-1.5 py-0.5 rounded bg-bolt-elements-background-depth-2">Shift</kbd>{' '}
                          + <kbd className="kdb px-1.5 py-0.5 rounded bg-bolt-elements-background-depth-2">Return</kbd>{' '}
                          a new line
                        </div>
                      ) : null}
                      <ConvexConnection size={flexAuthMode === 'InviteCode' ? 'hidden' : 'small'} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div id="suggestions" className="flex flex-col justify-center gap-5">
              {!chatStarted && <div>{/* … */}</div>}
            </div>
          </div>
          <ClientOnly>
            {() => (
              <Workbench
                actionRunner={actionRunner ?? ({} as ActionRunner)}
                chatStarted={chatStarted}
                isStreaming={isStreaming}
              />
            )}
          </ClientOnly>
        </div>
      </div>
    );

    return <Tooltip.Provider delayDuration={200}>{baseChat}</Tooltip.Provider>;
  },
);
