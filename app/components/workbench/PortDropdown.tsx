import { memo, useEffect, useRef } from 'react';
import { IconButton } from '~/components/ui/IconButton';
import type { PreviewInfo } from '~/lib/stores/previews';
import { Link2Icon } from '@radix-ui/react-icons';

interface PortDropdownProps {
  activePreviewIndex: number;
  setActivePreviewIndex: (index: number) => void;
  isDropdownOpen: boolean;
  setIsDropdownOpen: (value: boolean) => void;
  setHasSelectedPreview: (value: boolean) => void;
  previews: PreviewInfo[];
}

export const PortDropdown = memo(function PortDropdown({
  activePreviewIndex,
  setActivePreviewIndex,
  isDropdownOpen,
  setIsDropdownOpen,
  setHasSelectedPreview,
  previews,
}: PortDropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);

  // sort previews, preserving original index
  const sortedPreviews = previews
    .map((previewInfo, index) => ({ ...previewInfo, index }))
    .sort((a, b) => a.port - b.port);

  // close dropdown if user clicks outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    if (!isDropdownOpen) {
      return undefined;
    }

    window.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen, setIsDropdownOpen]);

  return (
    <div className="z-port-dropdown relative" ref={dropdownRef}>
      <IconButton icon={<Link2Icon />} onClick={() => setIsDropdownOpen(!isDropdownOpen)} />
      {isDropdownOpen && (
        <div className="dropdown-animation absolute right-0 mt-2 min-w-[140px] rounded border bg-bolt-elements-background-depth-2 shadow-sm">
          <div className="border-b px-4 py-2 text-sm font-semibold text-content-primary">Ports</div>
          {sortedPreviews.map((preview) => (
            <div
              key={preview.port}
              className="flex cursor-pointer items-center px-4 py-2 hover:bg-bolt-elements-item-backgroundActive"
              onClick={() => {
                setActivePreviewIndex(preview.index);
                setIsDropdownOpen(false);
                setHasSelectedPreview(true);
              }}
            >
              <span
                className={
                  activePreviewIndex === preview.index
                    ? 'text-bolt-elements-item-contentAccent'
                    : 'text-bolt-elements-item-contentDefault group-hover:text-bolt-elements-item-contentActive'
                }
              >
                {preview.port}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});
