export function NotFound() {
  return (
    <div className="flex h-full justify-center items-center text-center flex-col p-8">
      <h1 className="text-4xl font-bold mb-4 font-display font-600 tracking-tight text-bolt-elements-textPrimary">
        Not found
      </h1>
      <p className="text-bolt-elements-textSecondary mb-4 text-balance">
        The Chef project you’re looking for can’t be found. Maybe it was deleted or created with another account?
      </p>
      <a
        href="/"
        className="inline-flex gap-2 items-center bg-bolt-elements-button-primary-background hover:bg-bolt-elements-button-primary-backgroundHover text-bolt-elements-button-primary-text hover:text-bolt-elements-button-primary-textHover rounded-lg px-4 py-2 transition-colors"
      >
        <span className="text-sm font-medium">Return home</span>
      </a>
    </div>
  );
}
