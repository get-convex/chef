import { Cross2Icon } from '@radix-ui/react-icons';
import React from 'react';

interface FilePreviewProps {
  files: File[];
  imageDataList: string[];
  onRemove: (index: number) => void;
}

const FilePreview: React.FC<FilePreviewProps> = ({ files, imageDataList, onRemove }) => {
  if (!files || files.length === 0) {
    return null;
  }

  return (
    <div className="-mt-2 flex flex-row overflow-x-auto">
      {files.map((file, index) => (
        <div key={file.name + file.size} className="relative mr-2">
          {imageDataList[index] && (
            <div className="relative pr-4 pt-4">
              <img src={imageDataList[index]} alt={file.name} className="max-h-20" />
              <button
                onClick={() => onRemove(index)}
                className="absolute right-1 top-1 z-10 flex size-5 items-center justify-center rounded-full bg-black text-gray-200 shadow-md transition-colors hover:bg-gray-900"
              >
                <Cross2Icon />
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default FilePreview;
