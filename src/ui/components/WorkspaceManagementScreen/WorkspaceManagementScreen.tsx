import { useMemo, useRef, useState, type FormEvent } from "react";
import { canOpenWorkspaceAsGM, type MapOpenMode, type UserRecord, type WorkspaceInviteSummary, type WorkspaceMember } from "@/core/auth/authTypes";
import type { WorkspaceMapSummary, WorkspaceSummary } from "@/app/api/workspaceApi";

type WorkspaceManagementScreenProps = {
  currentUser: UserRecord;
  errorMessage: string | null;
  isBusy: boolean;
  invites: WorkspaceInviteSummary[];
  maps: WorkspaceMapSummary[];
  members: WorkspaceMember[];
  onAddMember: (workspaceId: string, username: string, role: "gm" | "player") => Promise<void>;
  onBackToWorkspaces: () => void;
  onCreateInvite: (workspaceId: string, expiresInDays: number, maxUses: number) => Promise<string>;
  onCreateMap: (workspaceId: string, name: string) => Promise<void>;
  onDeleteMap: (workspaceId: string, mapId: string) => Promise<void>;
  onExportMap: (mapId: string) => Promise<void>;
  onImportMap: (workspaceId: string, file: File) => Promise<void>;
  onOpenMapAs: (mapId: string, mode: MapOpenMode) => Promise<void>;
  onRefresh: (workspaceId: string) => Promise<void>;
  onRemoveMember: (workspaceId: string, userId: string) => Promise<void>;
  onRevokeInvite: (workspaceId: string, inviteId: string) => Promise<void>;
  onUpdateRole: (workspaceId: string, userId: string, role: "gm" | "player") => Promise<void>;
  workspace: WorkspaceSummary;
};

function formatUpdatedAt(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

export function WorkspaceManagementScreen({
  currentUser,
  errorMessage,
  isBusy,
  invites,
  maps,
  members,
  onAddMember,
  onBackToWorkspaces,
  onCreateInvite,
  onCreateMap,
  onDeleteMap,
  onExportMap,
  onImportMap,
  onOpenMapAs,
  onRefresh,
  onRemoveMember,
  onRevokeInvite,
  onUpdateRole,
  workspace
}: WorkspaceManagementScreenProps) {
  const [usernameToAdd, setUsernameToAdd] = useState("");
  const [roleToAdd, setRoleToAdd] = useState<"gm" | "player">("player");
  const [newMapName, setNewMapName] = useState("");
  const [inviteExpiresInDays, setInviteExpiresInDays] = useState("");
  const [inviteMaxUses, setInviteMaxUses] = useState("");
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const canManageMembers = workspace.currentUserRole === "owner";
  const canManageInvites = workspace.currentUserRole === "owner";
  const canManageMapsAsGm = canOpenWorkspaceAsGM(workspace);

  const sortedMembers = useMemo(() => {
    return [...members].sort((left, right) => {
      if (left.role !== right.role) {
        if (left.role === "owner") {
          return -1;
        }

        if (right.role === "owner") {
          return 1;
        }
      }

      if (left.role !== right.role) {
        if (left.role === "gm") {
          return -1;
        }

        if (right.role === "gm") {
          return 1;
        }
      }

      return left.username.localeCompare(right.username);
    });
  }, [members]);

  const sortedMaps = useMemo(() => {
    return [...maps].sort((left, right) => {
      const leftTime = new Date(left.updatedAt).getTime();
      const rightTime = new Date(right.updatedAt).getTime();

      if (!Number.isNaN(leftTime) && !Number.isNaN(rightTime) && leftTime !== rightTime) {
        return rightTime - leftTime;
      }

      return left.name.localeCompare(right.name);
    });
  }, [maps]);

  const submitAddMember = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedUsername = usernameToAdd.trim();

    if (!trimmedUsername || !canManageMembers) {
      return;
    }

    await onAddMember(workspace.id, trimmedUsername, roleToAdd);
    setUsernameToAdd("");
    setRoleToAdd("player");
  };

  const submitCreateMap = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canManageMapsAsGm) {
      return;
    }

    await onCreateMap(workspace.id, newMapName);
    setNewMapName("");
  };

  const openImportPicker = () => {
    importInputRef.current?.click();
  };

  const mapCountLabel = sortedMaps.length === 1 ? "1 map" : `${sortedMaps.length} maps`;
  const memberCountLabel = sortedMembers.length === 1 ? "1 member" : `${sortedMembers.length} members`;
  const inviteCountLabel = invites.length === 1 ? "1 invite" : `${invites.length} invites`;
  const isInviteExpiresInDaysValid = /^[0-9]+$/.test(inviteExpiresInDays.trim());
  const isInviteMaxUsesValid = /^[0-9]+$/.test(inviteMaxUses.trim());

  const submitCreateInvite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canManageInvites) {
      return;
    }

    if (!isInviteExpiresInDaysValid || !isInviteMaxUsesValid) {
      return;
    }

    const maxUses = Number.parseInt(inviteMaxUses, 10);
    const expiresInDays = Number.parseInt(inviteExpiresInDays, 10);

    const inviteUrl = await onCreateInvite(workspace.id, expiresInDays, maxUses);
    setInviteExpiresInDays("");
    setInviteMaxUses("");
    setLastInviteUrl(inviteUrl);
  };

  return (
    <main className="map-menu" aria-label="Workspace management">
      <section className="map-menu-panel workspace-management-panel">
        <header className="map-menu-header">
          <span className="eyebrow">WORKSPACE MANAGEMENT</span>
          <h1>{workspace.name}</h1>
          <p>Maps and permissions are managed here.</p>
          <div className="map-menu-profile">
            <span>Signed in as {currentUser.username}</span>
            <button type="button" className="compact-button" onClick={onBackToWorkspaces} disabled={isBusy}>
              Back to workspaces
            </button>
          </div>
        </header>

        <section className="map-menu-actions" aria-label="Workspace management actions">
          <button
            type="button"
            className="compact-button"
            onClick={() => void onRefresh(workspace.id)}
            disabled={isBusy}
          >
            Refresh workspace
          </button>
          <span className="workspace-role-chip">Your role: {workspace.currentUserRole.toUpperCase()}</span>
        </section>

        {errorMessage ? <p className="map-menu-error">{errorMessage}</p> : null}

        <div className={canManageMembers ? "workspace-management-columns" : "workspace-management-columns is-single"}>
          <section className="map-list-panel workspace-panel-column" aria-label="Workspace maps">
            <div className="workspace-panel-header">
              <h2>Maps</h2>
              <span className="map-list-date">{mapCountLabel}</span>
            </div>

            {canManageMapsAsGm ? (
              <form className="map-create-form workspace-inline-form" onSubmit={submitCreateMap}>
                <label htmlFor="workspace-map-name">Create or import map</label>
                <div className="map-create-row workspace-inline-row">
                  <input
                    id="workspace-map-name"
                    type="text"
                    value={newMapName}
                    placeholder="Map name"
                    onChange={(event) => setNewMapName(event.currentTarget.value)}
                    disabled={isBusy}
                  />
                  <button
                    type="submit"
                    className="compact-button"
                    disabled={isBusy}
                  >
                    Create
                  </button>
                  <button
                    type="button"
                    className="compact-button"
                    onClick={openImportPicker}
                    disabled={isBusy}
                  >
                    Import JSON
                  </button>
                  <input
                    ref={importInputRef}
                    type="file"
                    accept="application/json,.json"
                    style={{ display: "none" }}
                    onChange={(event) => {
                      const file = event.currentTarget.files?.[0] ?? null;
                      event.currentTarget.value = "";

                      if (!file) {
                        return;
                      }

                      void onImportMap(workspace.id, file);
                    }}
                  />
                </div>
              </form>
            ) : (
              <p className="map-list-panel-text">
                You can open maps as player, but only owner and GM can create, import, or delete maps.
              </p>
            )}

            {sortedMaps.length === 0 ? (
              <p>No map in this workspace yet.</p>
            ) : (
              <ul className="map-list">
                {sortedMaps.map((map) => (
                  <li key={map.id} className="map-list-item workspace-row-item">
                    <div className="workspace-row-primary">
                      <strong className="workspace-row-title">{map.name}</strong>
                      <span className="map-list-date">Updated {formatUpdatedAt(map.updatedAt)}</span>
                    </div>
                    <div className="workspace-row-actions">
                      {canManageMapsAsGm ? (
                        <button
                          type="button"
                          className="compact-button"
                          onClick={() => void onOpenMapAs(map.id, "gm")}
                          disabled={isBusy}
                        >
                          Open as GM
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="compact-button"
                        onClick={() => void onOpenMapAs(map.id, "player")}
                        disabled={isBusy}
                      >
                        Open {canManageMapsAsGm ? "as Player" : ""}
                      </button>
                      
                      {canManageMapsAsGm ? (
                        <>
                        <button
                        type="button"
                        className="compact-button"
                        onClick={() => void onExportMap(map.id)}
                        disabled={isBusy}
                      >
                        Export
                      </button>
                        <button
                          type="button"
                          className="danger-button"
                          onClick={() => {
                            const confirmed = window.confirm(`Remove map \"${map.name}\"? This cannot be undone.`);

                            if (!confirmed) {
                              return;
                            }

                            void onDeleteMap(workspace.id, map.id);
                          }}
                          disabled={isBusy}
                        >
                          Delete
                        </button>
                        </>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {canManageMembers ? (
            <section className="map-list-panel workspace-panel-column" aria-label="Workspace members">
              <div className="workspace-panel-header">
                <h2>Members</h2>
                <span className="map-list-date">{memberCountLabel}</span>
              </div>

              <form className="map-create-form workspace-inline-form" onSubmit={submitAddMember}>
                <label htmlFor="workspace-member-username">Invite existing user</label>
                <div className="map-create-row workspace-inline-row workspace-members-row">
                  <input
                    id="workspace-member-username"
                    type="text"
                    value={usernameToAdd}
                    placeholder="Username"
                    onChange={(event) => setUsernameToAdd(event.currentTarget.value)}
                    disabled={isBusy}
                  />
                  <select
                    value={roleToAdd}
                    onChange={(event) => setRoleToAdd(event.currentTarget.value === "gm" ? "gm" : "player")}
                    disabled={isBusy}
                  >
                    <option value="player">Player</option>
                    <option value="gm">GM</option>
                  </select>
                  <button
                    type="submit"
                    className="compact-button"
                    disabled={isBusy || usernameToAdd.trim().length === 0}
                  >
                    Add
                  </button>
                </div>
              </form>

              {sortedMembers.length === 0 ? (
                <p>No member found in this workspace.</p>
              ) : (
                <ul className="map-list">
                  {sortedMembers.map((member) => {
                    const canEditRole = member.role !== "owner";
                    const canRemoveMember = member.role !== "owner";

                    return (
                      <li key={member.userId} className="map-list-item workspace-row-item">
                        <div className="workspace-row-primary">
                          <strong className="workspace-row-title">{member.username}</strong>
                          <div className="workspace-row-subline">
                            <span className="workspace-role-chip">{member.role.toUpperCase()}</span>
                            {member.userId === currentUser.id ? <span className="workspace-inline-note">You</span> : null}
                          </div>
                        </div>

                        <div className="workspace-row-actions">
                          {canEditRole ? (
                            <select
                              value={member.role}
                              onChange={(event) => {
                                const role = event.currentTarget.value === "gm" ? "gm" : "player";
                                void onUpdateRole(workspace.id, member.userId, role);
                              }}
                              disabled={isBusy}
                            >
                              <option value="player">Player</option>
                              <option value="gm">GM</option>
                            </select>
                          ) : null}

                          {canRemoveMember ? (
                            <button
                              type="button"
                              className="danger-button"
                              onClick={() => void onRemoveMember(workspace.id, member.userId)}
                              disabled={isBusy}
                            >
                              Remove
                            </button>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          ) : null}
        </div>

        {canManageInvites ? (
          <section className="map-list-panel" aria-label="Workspace invite links">
            <div className="workspace-panel-header">
              <h2>Invite links</h2>
              <span className="map-list-date">{inviteCountLabel}</span>
            </div>

            <form className="map-create-form workspace-inline-form" onSubmit={submitCreateInvite}>
              <label htmlFor="workspace-invite-expiration">Create player invite link</label>
              <div className="map-create-row workspace-inline-row workspace-members-row workspace-invite-create-row">
                <input
                  id="workspace-invite-expiration"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={inviteExpiresInDays}
                  placeholder="Days before expiration (recommended: 7)"
                  onChange={(event) => setInviteExpiresInDays(event.currentTarget.value)}
                  disabled={isBusy}
                />
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={inviteMaxUses}
                  placeholder="Number of uses (recommended: 1)"
                  onChange={(event) => setInviteMaxUses(event.currentTarget.value)}
                  disabled={isBusy}
                />
                <button
                  type="submit"
                  className="compact-button"
                  disabled={isBusy || !isInviteExpiresInDaysValid || !isInviteMaxUsesValid}
                >
                  Create invite
                </button>
              </div>
            </form>

            {lastInviteUrl ? (
              <div className="map-create-form workspace-inline-form workspace-invite-link-block">
                <label htmlFor="workspace-invite-link">Last created link</label>
                <input
                  id="workspace-invite-link"
                  type="text"
                  readOnly
                  value={lastInviteUrl}
                />
              </div>
            ) : null}

            {invites.length === 0 ? (
              <p>No invite link yet.</p>
            ) : (
              <ul className="map-list">
                {invites.map((invite) => (
                  <li key={invite.id} className="map-list-item workspace-row-item">
                    <div className="workspace-row-primary">
                      <strong className="workspace-row-title">
                        Player invite · {invite.usedCount}/{invite.maxUses} uses
                      </strong>
                      <span className="map-list-date">Expires {formatUpdatedAt(invite.expiresAt)}</span>
                    </div>
                    <div className="workspace-row-actions">
                      {invite.revokedAt ? (
                        <span className="workspace-inline-note">Revoked</span>
                      ) : (
                        <button
                          type="button"
                          className="danger-button"
                          onClick={() => void onRevokeInvite(workspace.id, invite.id)}
                          disabled={isBusy}
                        >
                          Revoke
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}
      </section>
    </main>
  );
}
