import { useStore } from '@nanostores/react';
import { memo, useMemo } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import {
  CodeMirrorEditor,
  type OnChangeCallback as OnEditorChange,
  type OnSaveCallback as OnEditorSave,
  type OnScrollCallback as OnEditorScroll,
  type OnWheelCallback as OnEditorWheel,
} from '~/components/editor/codemirror/CodeMirrorEditor';
import type { EditorDocument } from 'chef-agent/types';
import { PanelHeader } from '~/components/ui/PanelHeader';
import { PanelHeaderButton } from '~/components/ui/PanelHeaderButton';
import type { FileMap } from 'chef-agent/types';
import type { FileHistory } from '~/types/actions';
import { themeStore } from '~/lib/stores/theme';
import { WORK_DIR } from 'chef-agent/constants';
import { renderLogger } from 'chef-agent/utils/logger';
import { isMobile } from '~/utils/mobile';
import { FileBreadcrumb } from './FileBreadcrumb';
import { FileTree } from './FileTree';
import { DEFAULT_TERMINAL_SIZE, TerminalTabs } from './terminal/TerminalTabs';
import { workbenchStore } from '~/lib/stores/workbench.client';
import type { TerminalInitializationOptions } from '~/types/terminal';
import { CheckIcon, ResetIcon } from '@radix-ui/react-icons';

interface EditorPanelProps {
  files?: FileMap;
  unsavedFiles?: Set<string>;
  editorDocument?: EditorDocument;
  selectedFile?: string | undefined;
  isStreaming?: boolean;
  scrollToDocAppend?: boolean;
  fileHistory?: Record<string, FileHistory>;
  onEditorChange?: OnEditorChange;
  onEditorScroll?: OnEditorScroll;
  onEditorWheel?: OnEditorWheel;
  onFileSelect?: (value?: string) => void;
  onFileSave?: OnEditorSave;
  onFileReset?: () => void;
  terminalInitializationOptions?: TerminalInitializationOptions;
}

const DEFAULT_EDITOR_SIZE = 100 - DEFAULT_TERMINAL_SIZE;

export const EditorPanel = memo(function EditorPanel({
  files,
  unsavedFiles,
  editorDocument,
  selectedFile,
  isStreaming,
  scrollToDocAppend,
  fileHistory,
  onFileSelect,
  onEditorChange,
  onEditorScroll,
  onEditorWheel,
  onFileSave,
  onFileReset,
  terminalInitializationOptions,
}: EditorPanelProps) {
  renderLogger.trace('EditorPanel');

  const theme = useStore(themeStore);
  const showTerminal = useStore(workbenchStore.showTerminal);

  const activeFileSegments = useMemo(() => {
    if (!editorDocument) {
      return undefined;
    }

    return editorDocument.filePath.split('/');
  }, [editorDocument]);

  const activeFileUnsaved = useMemo(() => {
    return editorDocument !== undefined && unsavedFiles?.has(editorDocument.filePath);
  }, [editorDocument, unsavedFiles]);

  return (
    <PanelGroup direction="vertical">
      <Panel defaultSize={showTerminal ? DEFAULT_EDITOR_SIZE : 100} minSize={20}>
        <PanelGroup direction="horizontal">
          <Panel defaultSize={20} minSize={10} collapsible>
            <div className="flex h-full flex-col border-r">
              <PanelHeader>Files</PanelHeader>
              <FileTree
                className="h-full"
                files={files}
                hideRoot
                unsavedFiles={unsavedFiles}
                fileHistory={fileHistory}
                rootFolder={WORK_DIR}
                selectedFile={selectedFile}
                onFileSelect={onFileSelect}
              />
            </div>
          </Panel>
          <PanelResizeHandle />
          <Panel className="flex flex-col" defaultSize={80} minSize={20}>
            <PanelHeader className="overflow-x-auto">
              {activeFileSegments?.length && (
                <div className="flex flex-1 items-center text-sm">
                  <FileBreadcrumb pathSegments={activeFileSegments} files={files} onFileSelect={onFileSelect} />
                  {activeFileUnsaved && (
                    <div className="-mr-1.5 ml-auto flex gap-1">
                      <PanelHeaderButton onClick={onFileSave}>
                        <CheckIcon />
                        Save
                      </PanelHeaderButton>
                      <PanelHeaderButton onClick={onFileReset}>
                        <ResetIcon />
                        Reset
                      </PanelHeaderButton>
                    </div>
                  )}
                </div>
              )}
            </PanelHeader>
            <div className="h-full flex-1 overflow-hidden">
              <CodeMirrorEditor
                theme={theme}
                editable={!isStreaming && editorDocument !== undefined}
                doc={editorDocument}
                autoFocusOnDocumentChange={!isMobile()}
                scrollToDocAppend={!!scrollToDocAppend}
                onScroll={onEditorScroll}
                onWheel={onEditorWheel}
                onChange={onEditorChange}
                onSave={onFileSave}
              />
            </div>
          </Panel>
        </PanelGroup>
      </Panel>
      <PanelResizeHandle />
      <TerminalTabs {...terminalInitializationOptions} />
    </PanelGroup>
  );
});
