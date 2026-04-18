import { useMemo, useState, type FormEvent } from "react";
import type { ProfileRecord } from "@/core/profile/profileTypes";

type LoginScreenProps = {
  errorMessage: string | null;
  isBusy: boolean;
  profiles: ProfileRecord[];
  storedProfileId: string | null;
  onCreateProfile: (username: string) => Promise<void>;
  onSelectProfile: (profile: ProfileRecord) => Promise<void>;
};

function formatProfileDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

export function LoginScreen({
  errorMessage,
  isBusy,
  profiles,
  storedProfileId,
  onCreateProfile,
  onSelectProfile
}: LoginScreenProps) {
  const [username, setUsername] = useState("");
  const sortedProfiles = useMemo(() => {
    return [...profiles].sort((left, right) => {
      if (left.id === storedProfileId) {
        return -1;
      }

      if (right.id === storedProfileId) {
        return 1;
      }

      return left.username.localeCompare(right.username);
    });
  }, [profiles, storedProfileId]);

  const submitCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = username.trim();

    if (!trimmed) {
      return;
    }

    await onCreateProfile(trimmed);
    setUsername("");
  };

  return (
    <main className="map-menu" aria-label="Profile login">
      <section className="map-menu-panel login-panel">
        <header className="map-menu-header">
          <span className="eyebrow">OSR CARTOGRAPHY</span>
          <h1>Simple Hex</h1>
          <p>Select your player profile before opening maps.</p>
        </header>

        <form className="map-create-form" onSubmit={submitCreate}>
          <label htmlFor="new-profile-name">New player</label>
          <div className="map-create-row">
            <input
              id="new-profile-name"
              type="text"
              value={username}
              placeholder="Player name"
              onChange={(event) => setUsername(event.currentTarget.value)}
            />
            <button type="submit" className="compact-button" disabled={isBusy || !username.trim()}>
              Create
            </button>
          </div>
        </form>

        {errorMessage ? <p className="map-menu-error">{errorMessage}</p> : null}

        <section className="map-list-panel" aria-label="Available profiles">
          {sortedProfiles.length === 0 ? (
            <p>No players yet. Create one to continue.</p>
          ) : (
            <ul className="profile-list">
              {sortedProfiles.map((profile) => {
                const isStored = profile.id === storedProfileId;

                return (
                  <li key={profile.id} className="profile-list-item">
                    <button
                      type="button"
                      className="profile-select-button"
                      onClick={() => void onSelectProfile(profile)}
                      disabled={isBusy}
                    >
                      <span>
                        <strong>{profile.username}</strong>
                        {isStored ? <em>Last used</em> : null}
                      </span>
                      <small>{formatProfileDate(profile.updatedAt)}</small>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </section>
    </main>
  );
}
