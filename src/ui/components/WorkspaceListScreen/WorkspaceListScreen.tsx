import { useState, type FormEvent, type KeyboardEvent } from "react";
import type { UserRecord } from "@/core/auth/authTypes";
import type { WorkspaceSummary } from "@/app/api/workspaceApi";

type WorkspaceListScreenProps = {
  errorMessage: string | null;
  isBusy: boolean;
  onCreateWorkspace: (name: string) => Promise<void>;
  onDeleteWorkspace: (workspaceId: string) => Promise<void>;
  onLogout: () => void;
  onManageWorkspace: (workspaceId: string) => void;
  onRefresh: () => Promise<void>;
  onRenameWorkspace: (workspaceId: string, name: string) => Promise<void>;
  onSelectWorkspace: (workspaceId: string) => void;
  selectedWorkspaceId: string | null;
  user: UserRecord;
  workspaces: WorkspaceSummary[];
};

function formatUpdatedAt(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

export function WorkspaceListScreen({
  errorMessage,
  isBusy,
  onCreateWorkspace,
  onDeleteWorkspace,
  onLogout,
  onManageWorkspace,
  onRefresh,
  onRenameWorkspace,
  onSelectWorkspace,
  selectedWorkspaceId,
  user,
  workspaces
}: WorkspaceListScreenProps) {
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [editingWorkspaceId, setEditingWorkspaceId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const selectedWorkspace = selectedWorkspaceId
    ? workspaces.find((workspace) => workspace.id === selectedWorkspaceId) ?? null
    : null;
  const canManageSelectedWorkspace = Boolean(selectedWorkspace && selectedWorkspace.currentUserRole === "owner");

  const submitCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onCreateWorkspace(newWorkspaceName);
    setNewWorkspaceName("");
  };

  const beginRename = (workspace: WorkspaceSummary) => {
    onSelectWorkspace(workspace.id);
    setEditingWorkspaceId(workspace.id);
    setEditingName(workspace.name);
  };

  const cancelRename = () => {
    setEditingWorkspaceId(null);
    setEditingName("");
  };

  const commitRename = async (workspace: WorkspaceSummary) => {
    const trimmedName = editingName.trim();

    if (!trimmedName || trimmedName === workspace.name) {
      cancelRename();
      return;
    }

    await onRenameWorkspace(workspace.id, trimmedName);
    cancelRename();
  };

  const removeSelectedWorkspace = async () => {
    if (!selectedWorkspace) {
      return;
    }

    const confirmed = window.confirm(`Remove workspace \"${selectedWorkspace.name}\"? This cannot be undone.`);

    if (!confirmed) {
      return;
    }

    await onDeleteWorkspace(selectedWorkspace.id);

    if (editingWorkspaceId === selectedWorkspace.id) {
      cancelRename();
    }
  };

  const onRenameKeyDown = (event: KeyboardEvent<HTMLInputElement>, workspace: WorkspaceSummary) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void commitRename(workspace);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      cancelRename();
    }
  };

  return (
    <main className="map-menu" aria-label="Workspace browser">
      <section className="map-menu-panel">
        <header className="map-menu-header">
          <span className="eyebrow">OSR CARTOGRAPHY</span>
          <h1>Workspaces</h1>
          <p>Select a workspace, then open management to browse maps, members, and map import/export tools.</p>
          <div className="map-menu-profile">
            <span>Account: {user.username}</span>
            <button type="button" className="compact-button" onClick={onLogout} disabled={isBusy}>
              Logout
            </button>
          </div>
        </header>

        <form className="map-create-form" onSubmit={submitCreate}>
          <label htmlFor="new-workspace-name">New workspace</label>
          <div className="map-create-row">
            <input
              id="new-workspace-name"
              type="text"
              value={newWorkspaceName}
              placeholder="Workspace name"
              onChange={(event) => setNewWorkspaceName(event.currentTarget.value)}
            />
            <button type="submit" className="compact-button" disabled={isBusy}>
              Create
            </button>
          </div>
        </form>

        <section className="map-menu-actions" aria-label="Workspace actions">
          <button type="button" className="compact-button" onClick={() => void onRefresh()} disabled={isBusy}>
            Refresh
          </button>

          <button
            type="button"
            className="compact-button"
            onClick={() => selectedWorkspace ? onManageWorkspace(selectedWorkspace.id) : undefined}
            disabled={isBusy || !selectedWorkspace}
          >
            Open workspace
          </button>

          <button
            type="button"
            className="danger-button"
            onClick={() => void removeSelectedWorkspace()}
            disabled={isBusy || !selectedWorkspace || !canManageSelectedWorkspace}
          >
            Remove selected
          </button>
        </section>

        {errorMessage ? <p className="map-menu-error">{errorMessage}</p> : null}

        <section className="map-list-panel" aria-label="Accessible workspaces">
          {workspaces.length === 0 ? (
            <p>No workspace yet. Create one to start.</p>
          ) : (
            <ul className="map-list">
              {workspaces.map((workspace) => {
                const isSelected = selectedWorkspaceId === workspace.id;
                const isRenaming = editingWorkspaceId === workspace.id;

                return (
                  <li
                    key={workspace.id}
                    className={isSelected ? "map-list-item is-selected" : "map-list-item"}
                    onClick={() => onSelectWorkspace(workspace.id)}
                  >
                    <div className="map-list-main">
                      <input
                        className="map-list-select"
                        type="radio"
                        name="selected-workspace"
                        checked={isSelected}
                        onChange={() => onSelectWorkspace(workspace.id)}
                      />
                      {isRenaming ? (
                        <input
                          className="map-name-input"
                          type="text"
                          value={editingName}
                          autoFocus
                          onClick={(event) => event.stopPropagation()}
                          onChange={(event) => setEditingName(event.currentTarget.value)}
                          onBlur={() => {
                            void commitRename(workspace);
                          }}
                          onKeyDown={(event) => onRenameKeyDown(event, workspace)}
                          disabled={isBusy}
                        />
                      ) : (
                        <button
                          type="button"
                          className="map-name-button"
                          onClick={(event) => {
                            event.stopPropagation();
                            beginRename(workspace);
                          }}
                          disabled={isBusy}
                        >
                          {workspace.name}
                        </button>
                      )}
                    </div>
                    <div className="workspace-meta">
                      <span className="workspace-role-chip">{workspace.currentUserRole.toUpperCase()}</span>
                      <span className="map-list-date">{formatUpdatedAt(workspace.updatedAt)}</span>
                    </div>
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
