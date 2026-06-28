type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
};

export function PageHeader({ eyebrow, title, description, action }: PageHeaderProps) {
  return (
    <header className="hidden flex-col gap-4 pb-5 sm:flex sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow ? <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-accent">{eyebrow}</p> : null}
        <h1 className="text-3xl font-black leading-tight text-white sm:text-5xl">{title}</h1>
        {description ? <p className="mt-2 max-w-2xl text-sm leading-6 text-muted sm:text-base">{description}</p> : null}
      </div>
      {action}
    </header>
  );
}
