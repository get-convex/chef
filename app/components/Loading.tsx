import { Spinner } from '~/components/ui/Spinner';

export function Loading(props: { message?: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 text-bolt-elements-textSecondary">
      <div>
        <Spinner />
      </div>
      {props.message ?? 'Loading...'}
    </div>
  );
}
