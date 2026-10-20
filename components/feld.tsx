export function Feld({
  label,
  name,
  hinweis,
  ...rest
}: { label: string; name: string; hinweis?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={name} className="beschriftung">
        {label}
      </label>
      <input id={name} name={name} className="eingabe" {...rest} />
      {hinweis && <p className="mt-1 text-xs text-slate-500">{hinweis}</p>}
    </div>
  );
}

export function Checkbox({
  label,
  name,
  hinweis,
  ...rest
}: { label: React.ReactNode; name: string; hinweis?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex items-start gap-3 text-sm">
      <input type="checkbox" name={name} className="mt-0.5 size-5 shrink-0 accent-marke-700" {...rest} />
      <span>
        {label}
        {hinweis && <span className="block text-xs text-slate-500">{hinweis}</span>}
      </span>
    </label>
  );
}
