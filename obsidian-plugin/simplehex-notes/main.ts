import {
  App,
  MarkdownView,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  TFile,
  normalizePath,
} from "obsidian";

type SimpleHexNoteRevision = {
  operationId: string | null;
  sourceClientId: string | null;
  updatedAt: string | null;
};

type SimpleHexNoteSnapshot = {
  mapId: string;
  mapName: string;
  note: {
    gmTitle: string | null;
    markdown: string | null;
    playerTitle: string | null;
    q: number;
    r: number;
  };
  noteFilePath: string;
  revision: SimpleHexNoteRevision;
  workspaceName: string;
};

type SimpleHexPluginSettings = {
  apiBaseUrlsByMapId: Record<string, string>;
  clientId: string;
  pollIntervalMs: number;
  rootFolder: string;
  tokensByMapId: Record<string, string>;
};

type TrackedNoteState = {
  file: TFile;
  mapId: string;
  q: number;
  r: number;
  revision: SimpleHexNoteRevision;
  isApplyingRemote: boolean;
  lastSyncedText: string;
};

const DEFAULT_SETTINGS: SimpleHexPluginSettings = {
  apiBaseUrlsByMapId: {},
  clientId:
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? `obsidian-${crypto.randomUUID()}`
      : `obsidian-${Date.now()}`,
  pollIntervalMs: 4000,
  rootFolder: "",
  tokensByMapId: {},
};

function renderSnapshot(snapshot: SimpleHexNoteSnapshot): string {
  const frontmatter = [
    "---",
    `simplehex-map-id: ${snapshot.mapId}`,
    `simplehex-map-name: ${JSON.stringify(snapshot.mapName)}`,
    `simplehex-workspace-name: ${JSON.stringify(snapshot.workspaceName)}`,
    `simplehex-q: ${snapshot.note.q}`,
    `simplehex-r: ${snapshot.note.r}`,
    `simplehex-revision-operation-id: ${JSON.stringify(snapshot.revision.operationId)}`,
    `simplehex-revision-updated-at: ${JSON.stringify(snapshot.revision.updatedAt)}`,
    `gm-title: ${JSON.stringify(snapshot.note.gmTitle ?? "")}`,
    `player-title: ${JSON.stringify(snapshot.note.playerTitle ?? "")}`,
    "---",
    "",
  ];
  const body = snapshot.note.markdown ?? "";
  return `${frontmatter.join("\n")}${body}`;
}

function parseFrontmatterValue(line: string): string {
  const [, rawValue = ""] = line.split(":", 2);
  return rawValue.trim();
}

function unquoteYamlValue(value: string): string {
  if (!value) {
    return "";
  }

  try {
    return JSON.parse(value);
  } catch {
    return value.replace(/^['"]|['"]$/g, "");
  }
}

function parseSnapshotDraft(text: string): {
  gmTitle: string | null;
  markdown: string | null;
  playerTitle: string | null;
  revision: SimpleHexNoteRevision;
} {
  const lines = text.split("\n");

  if (lines[0] !== "---") {
    return {
      gmTitle: null,
      markdown: text.trim() ? text : null,
      playerTitle: null,
      revision: { operationId: null, sourceClientId: null, updatedAt: null },
    };
  }

  let endIndex = -1;

  for (let lineIndex = 1; lineIndex < lines.length; lineIndex += 1) {
    if (lines[lineIndex] === "---") {
      endIndex = lineIndex;
      break;
    }
  }

  if (endIndex < 0) {
    return {
      gmTitle: null,
      markdown: text.trim() ? text : null,
      playerTitle: null,
      revision: { operationId: null, sourceClientId: null, updatedAt: null },
    };
  }

  const metadata = new Map<string, string>();

  for (const line of lines.slice(1, endIndex)) {
    const [key] = line.split(":", 1);

    if (!key) {
      continue;
    }

    metadata.set(key.trim(), parseFrontmatterValue(line));
  }

  const markdown = lines.slice(endIndex + 1).join("\n");
  const gmTitle = unquoteYamlValue(metadata.get("gm-title") ?? "").trim();
  const playerTitle = unquoteYamlValue(metadata.get("player-title") ?? "").trim();

  return {
    gmTitle: gmTitle ? gmTitle : null,
    markdown: markdown.trim() ? markdown : null,
    playerTitle: playerTitle ? playerTitle : null,
    revision: {
      operationId: unquoteYamlValue(
        metadata.get("simplehex-revision-operation-id") ?? "",
      ) || null,
      sourceClientId: null,
      updatedAt:
        unquoteYamlValue(metadata.get("simplehex-revision-updated-at") ?? "") ||
        null,
    },
  };
}

function trackedNoteKey(mapId: string, q: number, r: number): string {
  return `${mapId}:${q}:${r}`;
}

export default class SimpleHexNotesPlugin extends Plugin {
  settings: SimpleHexPluginSettings = DEFAULT_SETTINGS;
  trackedNotes = new Map<string, TrackedNoteState>();

  async onload(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    this.addSettingTab(new SimpleHexNotesSettingTab(this.app, this));

    this.registerObsidianProtocolHandler("simplehex-note", (params) => {
      void this.handleProtocolOpen(params);
    });

    this.registerEvent(
      this.app.vault.on("modify", (file) => {
        void this.handleFileModify(file);
      }),
    );

    this.registerInterval(
      window.setInterval(() => {
        void this.pollTrackedNotes();
      }, this.settings.pollIntervalMs),
    );
  }

  async savePluginSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  buildNoteApiUrl(mapId: string, q: number, r: number, apiBaseUrl?: string): string {
    const baseUrl = apiBaseUrl ?? "";
    return `${baseUrl.replace(/\/$/, "")}/api/obsidian/maps/${encodeURIComponent(
      mapId,
    )}/notes/${q}/${r}`;
  }

  async fetchSnapshot(
    apiBaseUrl: string,
    mapId: string,
    q: number,
    r: number,
  ): Promise<SimpleHexNoteSnapshot> {
    const token = this.settings.tokensByMapId[mapId];

    if (!token) {
      throw new Error(`Missing SimpleHex token for map ${mapId}.`);
    }

    const response = await fetch(this.buildNoteApiUrl(mapId, q, r, apiBaseUrl), {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      method: "GET",
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      throw new Error(payload.error ?? `SimpleHex request failed with ${response.status}.`);
    }

    return (await response.json()) as SimpleHexNoteSnapshot;
  }

  resolveVaultPath(snapshot: SimpleHexNoteSnapshot): string {
    const basePath = this.settings.rootFolder.trim();
    return normalizePath(
      basePath
        ? `${basePath}/${snapshot.noteFilePath}`
        : snapshot.noteFilePath,
    );
  }

  async ensureNoteFile(snapshot: SimpleHexNoteSnapshot): Promise<TFile> {
    const targetPath = this.resolveVaultPath(snapshot);
    const existing = this.app.vault.getAbstractFileByPath(targetPath);

    if (existing instanceof TFile) {
      return existing;
    }

    const segments = targetPath.split("/");
    let folderPath = "";

    for (const segment of segments.slice(0, -1)) {
      folderPath = folderPath ? `${folderPath}/${segment}` : segment;

      if (!this.app.vault.getAbstractFileByPath(folderPath)) {
        await this.app.vault.createFolder(folderPath);
      }
    }

    return this.app.vault.create(targetPath, renderSnapshot(snapshot));
  }

  async openOrFocusFile(file: TFile): Promise<void> {
    const existingLeaf = this.app.workspace
      .getLeavesOfType("markdown")
      .find((leaf) => leaf.view instanceof MarkdownView && leaf.view.file?.path === file.path);
    const leaf = existingLeaf ?? this.app.workspace.getLeaf(true);
    await leaf.openFile(file, { active: true });
  }

  async applyRemoteSnapshot(snapshot: SimpleHexNoteSnapshot): Promise<void> {
    const file = await this.ensureNoteFile(snapshot);
    const key = trackedNoteKey(snapshot.mapId, snapshot.note.q, snapshot.note.r);
    const nextText = renderSnapshot(snapshot);
    const currentText = await this.app.vault.read(file);
    const tracked = this.trackedNotes.get(key);

    if (tracked && currentText !== tracked.lastSyncedText && currentText !== nextText) {
      const conflictPath = normalizePath(
        file.path.replace(/\.md$/i, `.conflict-${Date.now()}.md`),
      );
      await this.app.vault.create(conflictPath, currentText);
      new Notice(`SimpleHex note conflict saved to ${conflictPath}`);
    }

    const nextState: TrackedNoteState = {
      file,
      isApplyingRemote: true,
      lastSyncedText: nextText,
      mapId: snapshot.mapId,
      q: snapshot.note.q,
      r: snapshot.note.r,
      revision: snapshot.revision,
    };
    this.trackedNotes.set(key, nextState);
    await this.app.vault.modify(file, nextText);
    nextState.isApplyingRemote = false;
    await this.openOrFocusFile(file);
  }

  async handleProtocolOpen(params: Record<string, string>): Promise<void> {
    const apiBaseUrl = params.apiBaseUrl;
    const mapId = params.mapId;
    const token = params.token;
    const q = Number.parseInt(params.q ?? "", 10);
    const r = Number.parseInt(params.r ?? "", 10);

    if (!apiBaseUrl || !mapId || !token || Number.isNaN(q) || Number.isNaN(r)) {
      new Notice("Invalid SimpleHex launch URL.");
      return;
    }

    this.settings.tokensByMapId[mapId] = token;
    this.settings.apiBaseUrlsByMapId[mapId] = apiBaseUrl;
    await this.savePluginSettings();

    try {
      await this.applyRemoteSnapshot(await this.fetchSnapshot(apiBaseUrl, mapId, q, r));
      new Notice(`SimpleHex note opened for hex ${q}, ${r}.`);
    } catch (error) {
      new Notice(error instanceof Error ? error.message : "Could not open SimpleHex note.");
    }
  }

  async syncFileToServer(state: TrackedNoteState): Promise<void> {
    const text = await this.app.vault.read(state.file);

    if (text === state.lastSyncedText) {
      return;
    }

    const token = this.settings.tokensByMapId[state.mapId];

    if (!token) {
      new Notice(`Missing SimpleHex token for map ${state.mapId}.`);
      return;
    }

    const apiBaseUrl = this.settings.apiBaseUrlsByMapId[state.mapId];

    if (!apiBaseUrl) {
      new Notice(`Missing SimpleHex API base URL for map ${state.mapId}.`);
      return;
    }

    const draft = parseSnapshotDraft(text);
    const response = await fetch(
      this.buildNoteApiUrl(state.mapId, state.q, state.r, apiBaseUrl),
      {
        body: JSON.stringify({
          baseRevision: state.revision,
          clientId: this.settings.clientId,
          note: {
            gmTitle: draft.gmTitle,
            markdown: draft.markdown,
            playerTitle: draft.playerTitle,
          },
          operationId: `${this.settings.clientId}-${Date.now()}`,
        }),
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        method: "PUT",
      },
    );

    if (response.status === 409) {
      const payload = (await response.json()) as { current?: SimpleHexNoteSnapshot; error?: string };

      if (payload.current) {
        await this.applyRemoteSnapshot(payload.current);
      }

      new Notice(payload.error ?? "SimpleHex note conflict detected.");
      return;
    }

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      new Notice(payload.error ?? `SimpleHex sync failed with ${response.status}.`);
      return;
    }

    await this.applyRemoteSnapshot((await response.json()) as SimpleHexNoteSnapshot);
  }

  async handleFileModify(file: TFile): Promise<void> {
    const tracked = Array.from(this.trackedNotes.values()).find(
      (state) => state.file.path === file.path,
    );

    if (!tracked || tracked.isApplyingRemote) {
      return;
    }

    await this.syncFileToServer(tracked);
  }

  async pollTrackedNotes(): Promise<void> {
    const trackedStates = Array.from(this.trackedNotes.values());

    for (const state of trackedStates) {
      const token = this.settings.tokensByMapId[state.mapId];

      if (!token) {
        continue;
      }

      const apiBaseUrl = this.settings.apiBaseUrlsByMapId[state.mapId];

      if (!apiBaseUrl) {
        continue;
      }

      try {
        const snapshot = await this.fetchSnapshot(
          apiBaseUrl,
          state.mapId,
          state.q,
          state.r,
        );

        if (snapshot.revision.operationId === state.revision.operationId) {
          continue;
        }

        await this.applyRemoteSnapshot(snapshot);
      } catch (error) {
        console.error("SimpleHex note poll failed", error);
      }
    }
  }
}

class SimpleHexNotesSettingTab extends PluginSettingTab {
  plugin: SimpleHexNotesPlugin;

  constructor(app: App, plugin: SimpleHexNotesPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "SimpleHex Notes" });

    new Setting(containerEl)
      .setName("Root folder")
      .setDesc("Optional vault folder prefix for synchronized SimpleHex notes.")
      .addText((text) =>
        text
          .setPlaceholder("SimpleHex")
          .setValue(this.plugin.settings.rootFolder)
          .onChange(async (value) => {
            this.plugin.settings.rootFolder = value.trim();
            await this.plugin.savePluginSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Poll interval (ms)")
      .setDesc("How often the plugin refreshes open SimpleHex notes from the server.")
      .addText((text) =>
        text
          .setValue(String(this.plugin.settings.pollIntervalMs))
          .onChange(async (value) => {
            const parsed = Number.parseInt(value, 10);
            this.plugin.settings.pollIntervalMs = Number.isInteger(parsed) && parsed > 0
              ? parsed
              : DEFAULT_SETTINGS.pollIntervalMs;
            await this.plugin.savePluginSettings();
          }),
      );
  }
}
