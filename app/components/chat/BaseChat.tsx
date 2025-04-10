import type { Message } from 'ai';
import React, { type RefCallback, useCallback, useState } from 'react';
import { Menu } from '~/components/sidebar/Menu.client';
import { Workbench } from '~/components/workbench/Workbench.client';
import { classNames } from '~/utils/classNames';
import { Messages } from './Messages.client';
import { SendButton } from './SendButton.client';
import * as Tooltip from '@radix-ui/react-tooltip';
import styles from './BaseChat.module.scss';
import FilePreview from './FilePreview';
import { ScreenshotStateManager } from './ScreenshotStateManager';
import type { ActionAlert } from '~/types/actions';
import ChatAlert from './ChatAlert';
import { ConvexConnection } from '~/components/convex/ConvexConnection';
import { SuggestionButtons } from './SuggestionButtons';
import { KeyboardShortcut } from '~/components/ui/KeyboardShortcut';
import StreamingIndicator from './StreamingIndicator';
import type { ToolStatus } from '~/lib/common/types';
import { TeamSelector } from '~/components/convex/TeamSelector';
import type { TerminalInitializationOptions } from '~/types/terminal';
import { useConvexSessionIdOrNullOrLoading } from '~/lib/stores/sessionId';
import { useChefAuth } from './ChefAuthWrapper';
import { setSelectedTeamSlug, useSelectedTeamSlug } from '~/lib/stores/convexTeams';
import { openSignInWindow } from '~/components/ChefSignInPage';

const TEXTAREA_MIN_HEIGHT = 76;

interface BaseChatProps {
  // Refs
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  messageRef: RefCallback<HTMLDivElement> | undefined;
  scrollRef: RefCallback<HTMLDivElement> | undefined;

  // Top-level chat props
  showChat: boolean;
  chatStarted: boolean;
  description: string | undefined;

  // Current input props
  input: string;
  uploadedFiles: File[];
  setUploadedFiles: (files: File[]) => void;
  imageDataList: string[];
  setImageDataList: (dataList: string[]) => void;

  // Chat user interactions
  handleInputChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  handleStop: () => void;
  sendMessage: (event: React.UIEvent, messageInput?: string) => Promise<void>;
  sendMessageInProgress: boolean;

  // Current chat history props
  streamStatus: 'streaming' | 'submitted' | 'ready' | 'error';
  currentError: Error | undefined;
  toolStatus: ToolStatus;
  messages: Message[];
  terminalInitializationOptions: TerminalInitializationOptions | undefined;
  disableChatMessage: string | null;

  // Alert related props
  actionAlert: ActionAlert | undefined;
  clearAlert: () => void;
}

export const BaseChat = React.forwardRef<HTMLDivElement, BaseChatProps>(
  (
    {
      textareaRef,
      messageRef,
      scrollRef,
      showChat = true,
      chatStarted = false,
      streamStatus = 'ready',
      input = '',
      currentError,
      handleInputChange,
      sendMessage,
      sendMessageInProgress,
      handleStop,
      uploadedFiles = [],
      setUploadedFiles,
      imageDataList = [],
      setImageDataList,
      messages,
      actionAlert,
      clearAlert,
      toolStatus,
      terminalInitializationOptions,
      disableChatMessage,
    },
    ref,
  ) => {
    const TEXTAREA_MAX_HEIGHT = chatStarted ? 400 : 200;

    const isStreaming = streamStatus === 'streaming' || streamStatus === 'submitted';

    const handleSendMessage = (event: React.UIEvent, messageInput?: string) => {
      if (sendMessage) {
        sendMessage(event, messageInput).then(() => {
          handleInputChange?.({ target: { value: '' } } as React.ChangeEvent<HTMLTextAreaElement>);
        });
      }
    };
    const sessionId = useConvexSessionIdOrNullOrLoading();
    const chefAuthState = useChefAuth();

    const selectedTeamSlug = useSelectedTeamSlug();

    const baseChat = (
      <div
        ref={ref}
        className={classNames(styles.BaseChat, 'relative flex h-full w-full overflow-hidden')}
        data-chat-visible={showChat}
      >
        <Menu />
        <div ref={scrollRef} className="flex flex-col lg:flex-row overflow-y-auto w-full h-full">
          <div className={classNames(styles.Chat, 'flex flex-col flex-grow lg:min-w-[var(--chat-min-width)] h-full')}>
            {!chatStarted && (
              <div id="intro" className="mt-[16vh] max-w-chat mx-auto text-center px-4 lg:px-0">
                <h1 className="text-4xl lg:text-6xl font-black text-bolt-elements-textPrimary mb-4 animate-fade-in font-display tracking-tight">
                  Now you’re cooking
                </h1>
                <p className="text-md lg:text-2xl text-balance mb-8 text-bolt-elements-textSecondary animate-fade-in animation-delay-200 font-medium font-display">
                  Generate and launch realtime full‑stack apps you never thought possible
                </p>
              </div>
            )}
            {!chatStarted && (
              <div className="max-w-chat mx-auto px-4 lg:px-0">
                <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded relative mb-8 animate-fade-in animation-delay-400">
                  <p className="font-bold">VIP access only (you can be a VIP too!)</p>
                  <p className="text-sm">
                    Chef is currently only enabled for builders with existing Convex accounts. We'll be removing this
                    restriction later today but if you want to start using Chef early, sign up at{' '}
                    <a href="https://dashboard.convex.dev" className="text-yellow-800 hover:text-yellow-900 underline">
                      dashboard.convex.dev
                    </a>{' '}
                    first and come on back!
                  </p>
                </div>
              </div>
            )}
            <div
              className={classNames('pt-6 px-2 sm:px-6', {
                'h-full flex flex-col': chatStarted,
              })}
              ref={scrollRef}
            >
              {chatStarted ? (
                <Messages
                  ref={messageRef}
                  className="flex flex-col w-full flex-1 max-w-chat pb-6 mx-auto z-1"
                  messages={messages}
                  isStreaming={isStreaming}
                />
              ) : null}
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
                        handleSendMessage?.({} as any, message);
                        clearAlert?.();
                      }}
                    />
                  )}
                </div>
                {
                  <StreamingIndicator
                    streamStatus={streamStatus}
                    numMessages={messages?.length ?? 0}
                    toolStatus={toolStatus}
                    currentError={currentError}
                  />
                }
                <div className="bg-bolt-elements-background-depth-2 rounded-lg border border-bolt-elements-borderColor relative w-full max-w-chat mx-auto z-prompt">
                  <FilePreview
                    files={uploadedFiles}
                    imageDataList={imageDataList}
                    onRemove={(index) => {
                      setUploadedFiles?.(uploadedFiles.filter((_, i) => i !== index));
                      setImageDataList?.(imageDataList.filter((_, i) => i !== index));
                    }}
                  />
                  <ScreenshotStateManager
                    setUploadedFiles={setUploadedFiles}
                    setImageDataList={setImageDataList}
                    uploadedFiles={uploadedFiles}
                    imageDataList={imageDataList}
                  />
                  <div>
                    <textarea
                      ref={textareaRef}
                      className={classNames(
                        'w-full pl-4 pt-4 pr-16 outline-none resize-none text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary bg-transparent text-sm',
                        'transition-all duration-200',
                        'hover:border-bolt-elements-focus',
                        'disabled:opacity-50 disabled:cursor-not-allowed',
                      )}
                      disabled={disableChatMessage !== null}
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
                      style={{
                        minHeight: TEXTAREA_MIN_HEIGHT,
                        maxHeight: TEXTAREA_MAX_HEIGHT,
                      }}
                      placeholder={
                        disableChatMessage
                          ? disableChatMessage
                          : chatStarted
                            ? 'Request changes by sending another message...'
                            : 'What app do you want to serve?'
                      }
                      translate="no"
                    />
                    <SendButton
                      show={input.length > 0 || isStreaming || uploadedFiles.length > 0 || sendMessageInProgress}
                      isStreaming={isStreaming}
                      disabled={chefAuthState.kind === 'loading' || sendMessageInProgress}
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
                    <div className="flex justify-end gap-4 items-center text-sm p-4 pt-2">
                      {input.length > 3 ? (
                        <div className="text-xs text-bolt-elements-textTertiary">
                          <KeyboardShortcut
                            value={['Shift', 'Return']}
                            className="font-bold text-bolt-elements-textSecondary mr-0.5"
                          />{' '}
                          for new line
                        </div>
                      ) : null}
                      {chatStarted && <ConvexConnection />}
                      {chefAuthState.kind === 'unauthenticated' && <SignInButton />}
                      {!chatStarted && sessionId && (
                        <TeamSelector
                          description="Your project will be created in this Convex team"
                          selectedTeamSlug={selectedTeamSlug}
                          setSelectedTeamSlug={setSelectedTeamSlug}
                        />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <SuggestionButtons
              disabled={disableChatMessage !== null}
              chatStarted={chatStarted}
              onSuggestionClick={(suggestion) => {
                handleInputChange?.({ target: { value: suggestion } } as React.ChangeEvent<HTMLTextAreaElement>);
              }}
            />
          </div>
          <Workbench
            chatStarted={chatStarted}
            isStreaming={isStreaming}
            terminalInitializationOptions={terminalInitializationOptions}
          />
        </div>
        {!chatStarted && (
          <div className="absolute bottom-4 right-6 text-lg font-display font-medium text-bolt-elements-textTertiary flex gap-3">
            <p className="flex items-center">
              Made by{' '}
              <a
                href="https://www.convex.dev"
                className="hover:text-bolt-elements-textPrimary transition-colors"
                aria-label="Convex"
              >
                <svg
                  width="223"
                  height="37"
                  viewBox="0 0 223 37"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-[.7em] ml-1.5 w-auto mt-[0.13em]"
                >
                  <path
                    d="M5.29382 31.6648C1.95422 28.6785 0.284424 24.2644 0.284424 18.434C0.284424 12.6036 1.98662 8.18965 5.39652 5.20335C8.80092 2.21695 13.4591 0.720947 19.3655 0.720947C21.8188 0.720947 23.9858 0.897345 25.8717 1.26134C27.7577 1.61974 29.5626 2.22835 31.2864 3.09295V12.5524C28.6061 11.2157 25.5637 10.5445 22.1593 10.5445C19.1601 10.5445 16.9446 11.1417 15.5179 12.3363C14.0859 13.5308 13.3726 15.5615 13.3726 18.434C13.3726 21.2099 14.0751 23.2178 15.4855 24.4578C16.8905 25.7035 19.1169 26.3235 22.1647 26.3235C25.3908 26.3235 28.4548 25.5329 31.3621 23.9573V33.8547C28.136 35.3849 24.1155 36.1471 19.3006 36.1471C13.2969 36.1471 8.63342 34.6511 5.29382 31.6648Z"
                    fill="currentColor"
                  />
                  <path
                    d="M34.2698 18.4278C34.2698 12.6429 35.8369 8.24604 38.9711 5.23124C42.1054 2.21654 46.8284 0.714844 53.145 0.714844C59.506 0.714844 64.261 2.22224 67.422 5.23124C70.578 8.24034 72.156 12.6429 72.156 18.4278C72.156 30.2366 65.818 36.1409 53.145 36.1409C40.5599 36.1466 34.2698 30.2422 34.2698 18.4278ZM57.679 24.4573C58.609 23.2116 59.074 21.2037 59.074 18.4335C59.074 15.7089 58.609 13.7123 57.679 12.4439C56.75 11.1754 55.237 10.544 53.145 10.544C51.103 10.544 49.6222 11.1811 48.7143 12.4439C47.8065 13.7123 47.3525 15.7089 47.3525 18.4335C47.3525 21.2094 47.8065 23.2173 48.7143 24.4573C49.6222 25.7031 51.097 26.3231 53.145 26.3231C55.237 26.3231 56.744 25.6974 57.679 24.4573Z"
                    fill="currentColor"
                  />
                  <path
                    d="M75.1379 1.43154H87.1289L87.4699 4.01394C88.7879 3.05834 90.4689 2.26774 92.5109 1.64764C94.5539 1.02764 96.6669 0.714844 98.8499 0.714844C102.892 0.714844 105.843 1.76714 107.707 3.87174C109.571 5.97644 110.501 9.22434 110.501 13.627V35.4299H97.6939V14.9865C97.6939 13.4564 97.3639 12.3585 96.7049 11.6873C96.0459 11.0161 94.9429 10.6862 93.3979 10.6862C92.4469 10.6862 91.4679 10.9137 90.4689 11.3688C89.4689 11.8238 88.6309 12.4097 87.9449 13.1264V35.4299H75.1379V1.43154Z"
                    fill="currentColor"
                  />
                  <path
                    d="M110.538 1.43164H123.891L130.024 21.3688L136.158 1.43164H149.511L136.768 35.43H123.275L110.538 1.43164Z"
                    fill="currentColor"
                  />
                  <path
                    d="M153.543 32.5061C149.695 29.4686 147.896 24.1957 147.896 18.5018C147.896 12.9558 149.328 8.38824 152.597 5.23124C155.866 2.07434 160.849 0.714844 167.139 0.714844C172.926 0.714844 177.476 2.12554 180.8 4.94684C184.118 7.76824 185.782 11.6191 185.782 16.4939V22.4494H161.427C162.032 24.2184 162.799 25.4983 164.685 26.2889C166.571 27.0796 169.203 27.4721 172.57 27.4721C174.58 27.4721 176.633 27.3071 178.719 26.9715C179.454 26.8521 180.665 26.6644 181.302 26.5222V34.7871C178.119 35.6972 173.877 36.1523 169.095 36.1523C162.659 36.1466 157.39 35.5436 153.543 32.5061ZM172.326 15.1344C172.326 13.4507 170.484 9.82734 166.782 9.82734C163.442 9.82734 161.238 13.3938 161.238 15.1344H172.326Z"
                    fill="currentColor"
                  />
                  <path
                    d="M195.838 18.1435L183.846 1.43164H197.745L222.273 35.43H208.24L202.787 27.8249L197.335 35.43H183.365L195.838 18.1435Z"
                    fill="currentColor"
                  />
                  <path
                    d="M207.931 1.43164H221.765L211.147 16.3176L204.122 6.77854L207.931 1.43164Z"
                    fill="currentColor"
                  />
                </svg>
              </a>
            </p>
            <hr className="w-0.5 h-8 bg-bolt-elements-textTertiary opacity-20" />
            <p className="flex items-center">
              Powered by{' '}
              <a href="https://bolt.new" className="hover:text-bolt-elements-textPrimary transition-colors contents">
                <span className="i-bolt:logo-text?mask w-[4ch] inline-block ml-1">Bolt</span>
              </a>
            </p>
          </div>
        )}
      </div>
    );

    return <Tooltip.Provider delayDuration={200}>{baseChat}</Tooltip.Provider>;
  },
);
BaseChat.displayName = 'BaseChat';

function SignInButton() {
  const [started, setStarted] = useState(false);
  const signIn = useCallback(() => {
    setStarted(true);
    openSignInWindow();
  }, [setStarted]);
  return (
    <button
      className="flex border border-bolt-elements-borderColor rounded-md overflow-hidden text-sm text-bolt-elements-textPrimary bg-bolt-elements-button-secondary-background hover:bg-bolt-elements-item-backgroundAccent/90"
      onClick={signIn}
    >
      <div className="flex items-center gap-2 p-1.5 w-full">
        {!started && (
          <>
            <img className="w-4 h-4" height="16" width="16" src="/icons/Convex.svg" alt="Convex" />
            <span>Sign in</span>
          </>
        )}
        {started && (
          <>
            <div className="i-ph:spinner-gap animate-spin" />
            Signing in...
          </>
        )}
      </div>
    </button>
  );
}
