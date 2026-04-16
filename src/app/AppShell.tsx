import { type PropsWithChildren, type RefObject } from "react";

type AppShellProps = PropsWithChildren<{
  appRef: RefObject<HTMLElement | null>;
  inspectorOpen?: boolean;
}>;

export function AppShell({ appRef, children, inspectorOpen = false }: AppShellProps) {
  return (
    <main
      ref={appRef}
      className={inspectorOpen ? "app-shell has-inspector" : "app-shell"}
      tabIndex={-1}
    >
      {children}
    </main>
  );
}
