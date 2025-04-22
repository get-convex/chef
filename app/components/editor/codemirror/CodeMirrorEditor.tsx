import { acceptCompletion, autocompletion, closeBrackets } from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { bracketMatching, foldGutter, indentOnInput, indentUnit } from '@codemirror/language';
import { searchKeymap } from '@codemirror/search';
import type { EditorSelection } from '@codemirror/state';
import { Compartment, EditorState, StateEffect, StateField, type Extension } from '@codemirror/state';
import {
  drawSelection,
  dropCursor,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
  scrollPastEnd,
  showTooltip,
  tooltips,
  type Tooltip,
} from '@codemirror/view';
import { memo, useEffect, useRef, useState, type MutableRefObject } from 'react';
import type { Theme } from '~/types/theme';
import { classNames } from '~/utils/classNames';
import { debounce } from '~/utils/debounce';
import { createScopedLogger, renderLogger } from 'chef-agent/utils/logger';
import { BinaryContent } from './BinaryContent';
import { getTheme, reconfigureTheme } from './cm-theme';
import { indentKeyBinding } from './indent';
import { getLanguage } from './languages';
import type { EditorDocument } from 'chef-agent/types';
import type { ScrollPosition } from 'chef-agent/types';
const logger = createScopedLogger('CodeMirrorEditor');

export interface EditorSettings {
  fontSize?: string;
  gutterFontSize?: string;
  tabSize?: number;
}

type TextEditorDocument = EditorDocument & {
  value: string;
};

interface EditorUpdate {
  selection: EditorSelection;
  content: string;
  // This isn't a change, it's just to avoid updating the wrong file since
  // by the time this debounced onChange callback runs the current file may
  // have changed.
  filePath: string;
}

export type OnChangeCallback = (update: EditorUpdate) => void;
export type OnScrollCallback = (position: ScrollPosition) => void;
export type OnWheelCallback = () => void;
export type OnSaveCallback = () => void;

interface Props {
  theme: Theme;
  id?: unknown;
  doc?: EditorDocument;
  scrollToDocAppend: boolean;
  editable?: boolean;
  autoFocusOnDocumentChange?: boolean;
  onChange?: OnChangeCallback;
  onScroll?: OnScrollCallback;
  onWheel?: OnWheelCallback;
  onSave?: OnSaveCallback;
  className?: string;
}

type EditorStates = Map<string, EditorState>;

const readOnlyTooltipStateEffect = StateEffect.define<boolean>();

const editableTooltipField = StateField.define<readonly Tooltip[]>({
  create: () => [],
  update(_tooltips, transaction) {
    if (!transaction.state.readOnly) {
      return [];
    }

    for (const effect of transaction.effects) {
      if (effect.is(readOnlyTooltipStateEffect) && effect.value) {
        return getReadOnlyTooltip(transaction.state);
      }
    }

    return [];
  },
  provide: (field) => {
    return showTooltip.computeN([field], (state) => state.field(field));
  },
});

const editableStateEffect = StateEffect.define<boolean>();

const editableStateField = StateField.define<boolean>({
  create() {
    return true;
  },
  update(value, transaction) {
    for (const effect of transaction.effects) {
      if (effect.is(editableStateEffect)) {
        return effect.value;
      }
    }

    return value;
  },
});

const DEBOUNCE_CHANGE = 150;
const DEBOUNCE_SCROLL = 100;

export const CodeMirrorEditor = memo(
  ({
    id,
    doc,
    autoFocusOnDocumentChange = false,
    editable = true,
    onScroll,
    onChange,
    onWheel,
    onSave,
    scrollToDocAppend,
    theme,
    className = '',
  }: Props) => {
    renderLogger.trace('CodeMirrorEditor');

    const [languageCompartment] = useState(() => new Compartment());

    const containerRef = useRef<HTMLDivElement | null>(null);
    const viewRef = useRef<EditorView>();
    const themeRef = useRef<Theme>();
    const docRef = useRef<EditorDocument>();
    const editorStatesRef = useRef<EditorStates>();
    const onScrollRef = useRef(onScroll);
    const onWheelRef = useRef(onWheel);
    const onChangeRef = useRef(onChange);
    const onSaveRef = useRef(onSave);

    /**
     * This effect is used to avoid side effects directly in the render function
     * and instead the refs are updated after each render.
     */
    useEffect(() => {
      onScrollRef.current = onScroll;
      onWheelRef.current = onWheel;
      onChangeRef.current = onChange;
      onSaveRef.current = onSave;
      docRef.current = doc;
      themeRef.current = theme;
    });

    useEffect(() => {
      const onUpdate = debounce((update: EditorUpdate) => {
        onChangeRef.current?.(update);
      }, DEBOUNCE_CHANGE);

      const view = new EditorView({
        parent: containerRef.current!,
        dispatchTransactions(transactions) {
          const previousSelection = view.state.selection;

          view.update(transactions);

          const newSelection = view.state.selection;

          const selectionChanged =
            newSelection !== previousSelection &&
            (newSelection === undefined || previousSelection === undefined || !newSelection.eq(previousSelection));

          if (docRef.current && (transactions.some((transaction) => transaction.docChanged) || selectionChanged)) {
            onUpdate({
              selection: view.state.selection,
              content: view.state.doc.toString(),
              filePath: docRef.current.filePath,
            });

            editorStatesRef.current!.set(docRef.current.filePath, view.state);
          }
        },
      });

      viewRef.current = view;

      return () => {
        viewRef.current?.destroy();
        viewRef.current = undefined;
      };
    }, []);

    useEffect(() => {
      if (!viewRef.current) {
        return;
      }

      viewRef.current.dispatch({
        effects: [reconfigureTheme(theme)],
      });
    }, [theme]);

    useEffect(() => {
      editorStatesRef.current = new Map<string, EditorState>();
    }, [id]);

    useEffect(() => {
      const editorStates = editorStatesRef.current!;
      const view = viewRef.current!;
      const theme = themeRef.current!;

      const settings: EditorSettings = { tabSize: 2 };

      if (!doc) {
        const state = newEditorState('', theme, settings, onScrollRef, onWheelRef, onSaveRef, [
          languageCompartment.of([]),
        ]);

        view.setState(state);

        setNoDocument(view);

        return;
      }

      if (doc.isBinary) {
        return;
      }

      if (doc.filePath === '') {
        logger.warn('File path should not be empty');
      }

      let state = editorStates.get(doc.filePath);

      if (!state) {
        state = newEditorState(doc.value, theme, settings, onScrollRef, onWheelRef, onSaveRef, [
          languageCompartment.of([]),
        ]);

        editorStates.set(doc.filePath, state);
      }

      // Heuristic for "should we use restore the scroll position,"
      const simpleAppend = doc.value.startsWith(view.state.doc.toString());
      const empty = doc.value.length < 50;
      const isFileChange = empty || !simpleAppend;

      if (isFileChange) {
        view.setState(state);
      }

      setEditorDocument(
        view,
        theme,
        editable,
        languageCompartment,
        autoFocusOnDocumentChange,
        doc,
        isFileChange,
        scrollToDocAppend && simpleAppend,
      );
      // We don’t want this to run when `doc` changes without a change in isBinary/filePath/value
      // (i.e. a change when only `scroll` changes). While `setEditorDocument` uses the scroll
      // position, it only needs it when `isFileChange` is set to true.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
      doc?.isBinary,
      doc?.value,
      doc?.filePath,
      editable,
      autoFocusOnDocumentChange,
      scrollToDocAppend,
      languageCompartment,
    ]);

    return (
      <div className={classNames('relative h-full', className)}>
        {doc?.isBinary && <BinaryContent />}
        <div className="h-full overflow-hidden" ref={containerRef} />
      </div>
    );
  },
);

CodeMirrorEditor.displayName = 'CodeMirrorEditor';

function newEditorState(
  content: string,
  theme: Theme,
  settings: EditorSettings | undefined,
  onScrollRef: MutableRefObject<OnScrollCallback | undefined>,
  onWheelRef: MutableRefObject<OnWheelCallback | undefined>,
  onFileSaveRef: MutableRefObject<OnSaveCallback | undefined>,
  extensions: Extension[],
) {
  return EditorState.create({
    doc: content,
    extensions: [
      EditorView.domEventHandlers({
        scroll: debounce((event, view) => {
          if (event.target !== view.scrollDOM) {
            return;
          }

          onScrollRef.current?.({ left: view.scrollDOM.scrollLeft, top: view.scrollDOM.scrollTop });
        }, DEBOUNCE_SCROLL),
        wheel: () => {
          // Wheel is not debounced! So don't do anything intensive.
          // 'wheel' events are probably being captured somewhere, they don't bubble up to scrollDOM.
          // Just accept anything.
          onWheelRef.current?.();
        },
        keydown: (event, view) => {
          if (view.state.readOnly) {
            view.dispatch({
              effects: [readOnlyTooltipStateEffect.of(event.key !== 'Escape')],
            });

            return true;
          }

          return false;
        },
      }),
      getTheme(theme, settings),
      history(),
      keymap.of([
        ...defaultKeymap,
        ...historyKeymap,
        ...searchKeymap,
        { key: 'Tab', run: acceptCompletion },
        {
          key: 'Mod-s',
          preventDefault: true,
          run: () => {
            onFileSaveRef.current?.();
            return true;
          },
        },
        indentKeyBinding,
      ]),
      indentUnit.of('\t'),
      autocompletion({
        closeOnBlur: false,
      }),
      tooltips({
        position: 'absolute',
        parent: document.body,
        tooltipSpace: (view) => {
          const rect = view.dom.getBoundingClientRect();

          return {
            top: rect.top - 50,
            left: rect.left,
            bottom: rect.bottom,
            right: rect.right + 10,
          };
        },
      }),
      closeBrackets(),
      lineNumbers(),
      scrollPastEnd(),
      dropCursor(),
      drawSelection(),
      bracketMatching(),
      EditorState.tabSize.of(settings?.tabSize ?? 2),
      indentOnInput(),
      editableTooltipField,
      editableStateField,
      EditorState.readOnly.from(editableStateField, (editable) => !editable),
      highlightActiveLineGutter(),
      highlightActiveLine(),
      foldGutter({}),
      ...extensions,
    ],
  });
}

function setNoDocument(view: EditorView) {
  view.dispatch({
    selection: { anchor: 0 },
    changes: {
      from: 0,
      to: view.state.doc.length,
      insert: '',
    },
  });

  view.scrollDOM.scrollTo(0, 0);
}

function setEditorDocument(
  view: EditorView,
  theme: Theme,
  editable: boolean,
  languageCompartment: Compartment,
  autoFocus: boolean,
  doc: TextEditorDocument,
  isFileChange: boolean,
  scrollToBottom: boolean,
) {
  if (doc.value !== view.state.doc.toString()) {
    view.dispatch({
      selection: { anchor: 0 },
      changes: {
        from: 0,
        to: view.state.doc.length,
        insert: doc.value,
      },
    });
  }

  view.dispatch({
    effects: [editableStateEffect.of(editable && !doc.isBinary)],
  });

  getLanguage(doc.filePath).then((languageSupport) => {
    if (!languageSupport) {
      return;
    }

    view.dispatch({
      effects: [languageCompartment.reconfigure([languageSupport]), reconfigureTheme(theme)],
    });

    if (isFileChange) {
      requestAnimationFrame(() => {
        const currentLeft = view.scrollDOM.scrollLeft;
        const currentTop = view.scrollDOM.scrollTop;
        const newLeft = doc.scroll?.left ?? 0;
        const newTop = doc.scroll?.top ?? 0;

        const needsScrolling = currentLeft !== newLeft || currentTop !== newTop;

        if (autoFocus && editable) {
          if (needsScrolling) {
            // we have to wait until the scroll position was changed before we can set the focus
            view.scrollDOM.addEventListener('scroll', () => view.focus(), { once: true });
          } else {
            // if the scroll position is still the same we can focus immediately
            view.focus();
          }
        }

        view.scrollDOM.scrollTo(newLeft, newTop);
      });
    }
    if (scrollToBottom) {
      requestAnimationFrame(() => {
        const currentScrollTop = view.scrollDOM.scrollTop;
        const pagesOffscreen =
          (view.scrollDOM.scrollHeight - currentScrollTop - view.scrollDOM.offsetHeight) / view.scrollDOM.offsetHeight;

        // There's ~.97 of a viewport of blank space in the document below the last line from the scrollPastEnd() extension.
        if (pagesOffscreen > 0.9) {
          const desiredPagesOffscreen = 0.5;
          view.scrollDOM.scrollTo(
            0,
            view.scrollDOM.scrollHeight - view.scrollDOM.offsetHeight * (desiredPagesOffscreen + 1),
          );
        }
      });
    }
  });
}

function getReadOnlyTooltip(state: EditorState) {
  if (!state.readOnly) {
    return [];
  }

  return state.selection.ranges
    .filter((range) => {
      return range.empty;
    })
    .map((range) => {
      return {
        pos: range.head,
        above: true,
        strictSide: true,
        arrow: true,
        create: () => {
          const divElement = document.createElement('div');
          divElement.className = 'cm-readonly-tooltip';
          divElement.textContent = 'Cannot edit file while AI response is being generated';

          return { dom: divElement };
        },
      };
    });
}
