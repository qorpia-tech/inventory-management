import type { ReactNode } from "react";

/**
 * Primary actions. On phones the bar is fixed above the tab bar and the safe area, with a
 * spacer in the flow so content is never hidden behind it. From tablet up it sits inline.
 */
export function ActionBar({ children, note }: { children: ReactNode; note?: ReactNode }) {
  return (
    <>
      <div className="h-24 md:hidden" aria-hidden />
      <div
        className="fixed inset-x-0 z-30 border-t border-ivory-300 bg-ivory-50/95 px-4 py-3 backdrop-blur md:static md:z-auto md:mt-6 md:rounded-2xl md:border md:bg-white md:px-4"
        style={{ bottom: "calc(var(--tabbar-h) + var(--safe-bottom))" }}
      >
        <div className="mx-auto flex max-w-3xl flex-col gap-2">
          {note && <div className="caption-4 text-ink-600">{note}</div>}
          <div className="flex gap-2 [&>*]:min-w-0 [&>*]:flex-1">{children}</div>
        </div>
      </div>
    </>
  );
}
