import { type PropsWithChildren, type RefObject } from "react";

type AppShellProps = PropsWithChildren<{
  appRef: RefObject<HTMLElement | null>;
  inspectorOpen?: boolean;
  playerMode?: boolean;
}>;

export function AppShell({ appRef, children, inspectorOpen = false, playerMode = false }: AppShellProps) {
  const className = [
    "app-shell",
    inspectorOpen ? "has-inspector" : "",
    playerMode ? "is-player-mode" : ""
  ].filter(Boolean).join(" ");

  return (
    <main
      ref={appRef}
      className={className}
      tabIndex={-1}
    >
      {children}
    </main>
  );
}
