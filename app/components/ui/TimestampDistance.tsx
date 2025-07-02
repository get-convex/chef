import { formatDistanceToNow } from 'date-fns';
import { cn } from '@ui/cn';
import { Tooltip } from '@ui/Tooltip';

export function TimestampDistance({
  prefix = '',
  date,
  className = '',
}: {
  prefix?: string;

  date: Date;
  className?: string;
}) {
  return (
    <Tooltip tip={date.toLocaleString()}>
      <div className={cn('text-xs text-content-secondary', className)}>
        {`${prefix} ${formatDistanceToNow(date, {
          addSuffix: true,
        }).replace('about ', '')}`}
      </div>
    </Tooltip>
  );
}
