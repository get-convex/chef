export function Loading(props: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4">
      <div className="i-ph:spinner-gap animate-spin" />
      {props.message ?? 'Loading...'}
    </div>
  );
}
