import { type PropsWithChildren, type RefObject } from "react";

type AppShellProps = PropsWithChildren<{
  appRef: RefObject<HTMLElement | null>;
  playerMode?: boolean;
  rightPanelOpen?: boolean;
}>;

export function AppShell({
  appRef,
  children,
  playerMode = false,
  rightPanelOpen = false,
}: AppShellProps) {
  const className = [
    "app-shell",
    playerMode ? "is-player-mode" : "",
    rightPanelOpen ? "has-right-panel" : "",
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
