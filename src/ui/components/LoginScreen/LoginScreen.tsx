import { useState, type FormEvent } from "react";
import type { WorkspaceInviteSummary } from "@/core/auth/authTypes";

type LoginScreenProps = {
  errorMessage: string | null;
  invite: WorkspaceInviteSummary | null;
  isBusy: boolean;
  onLogin: (username: string, password: string) => Promise<void>;
  onSignup: (username: string, password: string) => Promise<void>;
};

export function LoginScreen({
  errorMessage,
  invite,
  isBusy,
  onLogin,
  onSignup
}: LoginScreenProps) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedUsername = username.trim();

    if (!trimmedUsername || password.length < 8) {
      return;
    }

    if (mode === "login") {
      await onLogin(trimmedUsername, password);
    } else {
      await onSignup(trimmedUsername, password);
    }

    setPassword("");
  };

  return (
    <main className="map-menu" aria-label="Account login">
      <section className="map-menu-panel login-panel">
        <header className="map-menu-header">
          <span className="eyebrow">OSR CARTOGRAPHY</span>
          <h1>Simple Hex</h1>
          <p>Sign in to open maps, edit as GM, and keep player tokens tied to your account.</p>
          {invite ? (
            <p>
              Invite ready for <strong>{invite.workspaceName}</strong>. Sign in or create an account to join as player.
            </p>
          ) : null}
        </header>

        <div className="auth-mode-tabs" role="tablist" aria-label="Authentication mode">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "login"}
            className={mode === "login" ? "tab-button is-active" : "tab-button"}
            onClick={() => setMode("login")}
          >
            Login
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "signup"}
            className={mode === "signup" ? "tab-button is-active" : "tab-button"}
            onClick={() => setMode("signup")}
          >
            Sign up
          </button>
        </div>

        <form className="map-create-form" onSubmit={submit}>
          <label htmlFor="auth-username">Username</label>
          <input
            id="auth-username"
            type="text"
            autoComplete="username"
            value={username}
            placeholder="Username"
            onChange={(event) => setUsername(event.currentTarget.value)}
          />

          <label htmlFor="auth-password">Password</label>
          <input
            id="auth-password"
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            value={password}
            placeholder="At least 8 characters"
            onChange={(event) => setPassword(event.currentTarget.value)}
          />

          <button
            type="submit"
            className="compact-button"
            disabled={isBusy || !username.trim() || password.length < 8}
          >
            {mode === "login" ? "Login" : "Create account"}
          </button>
        </form>

        {errorMessage ? <p className="map-menu-error">{errorMessage}</p> : null}
      </section>
    </main>
  );
}
