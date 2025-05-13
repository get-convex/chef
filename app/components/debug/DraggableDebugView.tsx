import { useState, useEffect } from 'react';
import { IconButton } from '~/components/ui/IconButton';
import { Cross2Icon, DragHandleDots2Icon } from '@radix-ui/react-icons';

interface DraggableDebugViewProps {
  title: string;
  isVisible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export function DraggableDebugView({ title, isVisible, onClose, children }: DraggableDebugViewProps) {
  const [position, setPosition] = useState({ x: 20, y: 20 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // eslint-disable-next-line consistent-return
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDragging]);

  if (!isVisible) {
    return null;
  }

  return (
    <div
      className="fixed z-50 w-80 rounded-lg border bg-white shadow-lg dark:bg-gray-800"
      style={{
        left: position.x,
        top: position.y,
      }}
    >
      <div
        className="flex cursor-grab items-center justify-between border-b bg-gray-50 px-4 py-2 dark:bg-gray-700"
        onMouseDown={handleMouseDown}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      >
        <div className="flex items-center gap-2">
          <DragHandleDots2Icon className="size-4 text-gray-500" />
          <h3 className="text-sm font-medium">{title}</h3>
        </div>
        <IconButton icon={<Cross2Icon className="size-4" />} onClick={onClose} size="sm" />
      </div>

      <div className="p-4">{children}</div>
    </div>
  );
}
