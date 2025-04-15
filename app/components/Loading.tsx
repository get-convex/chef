import { Spinner } from '@ui/Spinner';

export function Loading(props: { message?: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 text-content-secondary">
      <div>
        <Spinner />
      </div>
      {props.message ?? 'Loading...'}
    </div>
  );
}
