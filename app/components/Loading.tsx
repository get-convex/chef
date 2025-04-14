import { Spinner } from '~/components/ui/Spinner';

export function Loading(props: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-bolt-elements-textSecondary">
      <div>
        <Spinner />
      </div>
      {props.message ?? 'Loading...'}
    </div>
  );
}
