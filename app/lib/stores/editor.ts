import { atom, computed, map, type MapStore, type WritableAtom } from 'nanostores';
import type { EditorDocument, ScrollPosition } from '~/components/editor/codemirror/CodeMirrorEditor';
import type { AbsolutePath, FileMap, FilesStore } from './files';

type EditorDocuments = Record<string, EditorDocument>;

type SelectedFile = WritableAtom<string | undefined>;

export class EditorStore {
  #filesStore: FilesStore;

  selectedFile: SelectedFile = import.meta.hot?.data.selectedFile ?? atom<AbsolutePath | undefined>();
  documents: MapStore<EditorDocuments> = import.meta.hot?.data.documents ?? map({});
  followingStreamedCode = atom<boolean>(true);

  currentDocument = computed([this.documents, this.selectedFile], (documents, selectedFile) => {
    if (!selectedFile) {
      return undefined;
    }

    return documents[selectedFile];
  });

  constructor(filesStore: FilesStore) {
    this.#filesStore = filesStore;

    if (import.meta.hot) {
      import.meta.hot.data.documents = this.documents;
      import.meta.hot.data.selectedFile = this.selectedFile;
    }
  }

  setDocuments(files: FileMap) {
    const previousDocuments = this.documents.value;

    this.documents.set(
      Object.fromEntries<EditorDocument>(
        Object.entries(files)
          .map(([filePath, dirent]) => {
            if (dirent === undefined || dirent.type === 'folder') {
              return undefined;
            }

            const previousDocument = previousDocuments?.[filePath];

            return [
              filePath,
              {
                value: dirent.content,
                filePath,
                scroll: previousDocument?.scroll,
              },
            ] as [string, EditorDocument];
          })
          .filter(Boolean) as Array<[string, EditorDocument]>,
      ),
    );
  }

  setSelectedFile(filePath: AbsolutePath | undefined) {
    this.selectedFile.set(filePath);
  }

  updateScrollPosition(filePath: string, position: ScrollPosition) {
    const documents = this.documents.get();
    const documentState = documents[filePath];

    if (!documentState) {
      return;
    }

    this.documents.setKey(filePath, {
      ...documentState,
      scroll: position,
    });
  }

  updateFile(filePath: string, newContent: string) {
    const documents = this.documents.get();
    const documentState = documents[filePath];

    if (!documentState) {
      return;
    }

    const currentContent = documentState.value;
    const contentChanged = currentContent !== newContent;

    if (contentChanged) {
      this.documents.setKey(filePath, {
        ...documentState,
        value: newContent,
      });
    }
  }
}
