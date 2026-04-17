import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { editorConfig } from "@/config/editorConfig";
import { applyMapOperationToWorld, diffWorldAsOperations, type MapOperation } from "@/app/io/mapOperations";
import { deserializeWorld } from "@/app/io/mapFormat";
import type {
  MapOperationBatchAppliedMessage,
  MapOperationBatchRequest,
  MapOperationMessage,
  MapOperationRequest,
  MapSyncSnapshotMessage
} from "@/app/io/mapApi";
import type { EditorMode } from "@/editor/tools/editorTypes";
import type { OpenMapRole } from "@/ui/components/MapMenu/MapMenu";
import { useKeyboardNavigation } from "@/editor/hooks/useKeyboardNavigation";
import {
  placeOrSelectFeature,
  removeFeatureOnHex
} from "@/editor/tools/featureActions";
import {
  applyEditGestureCells,
  createEditGesture,
  getFinishedGestureWorld,
  type EditGesture,
  type EditGestureAction
} from "@/editor/tools/editGesture";
import {
  applyRiverGestureEdges,
  createRiverGesture,
  getFinishedRiverGestureWorld,
  type RiverGesture
} from "@/editor/tools/riverGesture";
import {
  applyRoadGestureCells,
  createRoadGesture,
  getFinishedRoadGestureWorld,
  type RoadGesture
} from "@/editor/tools/roadGesture";
import {
  applyFactionGestureCells,
  createFactionGesture,
  getFinishedFactionGestureWorld,
  type FactionGesture
} from "@/editor/tools/factionGesture";
import {
  featureHexIdToAxial,
  getFeatureAt,
  getFeatureById,
  updateFeature,
  featureKindLabels,
  type Feature,
  type FeatureKind
} from "@/domain/world/features";
import {
  addFaction,
  getLevelMap,
  getFactionById,
  getFactions,
  removeFaction,
  setCellHidden,
  updateFaction,
  type Faction,
  type RiverEdgeRef,
  type TerrainType,
  type World
} from "@/domain/world/world";
import { tileLabels } from "@/domain/rendering/tileVisuals";
import { useCamera } from "./useCamera";
import { useUndoRedo } from "./useUndoRedo";
import type { Axial } from "@/domain/geometry/hex";
import { buildWebSocketUrl } from "@/app/io/apiBase";
import { SOURCE_LEVEL } from "@/domain/world/constants";
import { isMapSyncDebugEnabled, logMapSync, toRoundedMs } from "@/editor/sync/mapSyncDebug";

const defaultFactionColors = [
  "#d94f3d",
  "#3668d8",
  "#2f9d5a",
  "#b76ad8",
  "#d89f2f",
  "#1fa9a3"
];
// Keep this aligned with server/index.mjs maxOperationsPerBatch.
const maxOperationsPerBatch = 500;

type UseEditorStateOptions = {
  initialWorld: World;
  mapId: string;
  role: OpenMapRole;
};

type OperationEnvelope = {
  operationId: string;
  operation: MapOperation;
  sent: boolean;
};

export function useEditorState({ initialWorld, mapId, role }: UseEditorStateOptions) {
  const maxLevels = editorConfig.maxLevels;
  const appRef = useRef<HTMLElement | null>(null);
  const { history, resetFromCurrent } = useUndoRedo<World>(() => initialWorld);
  const { changeLevelByDelta, changeVisualZoom, setCenter, view, visualZoom } = useCamera();
  const [draftWorld, setDraftWorld] = useState<World | null>(null);
  const [activeMode, setActiveMode] = useState<EditorMode>("terrain");
  const [activeType, setActiveType] = useState<TerrainType>("plain");
  const [activeFeatureKind, setActiveFeatureKind] = useState<FeatureKind>("city");
  const [activeFactionId, setActiveFactionId] = useState<string | null>(null);
  const [selectedFeatureId, setSelectedFeatureId] = useState<string | null>(null);
  const [showCoordinates, setShowCoordinates] = useState(false);
  const [hoveredHex, setHoveredHex] = useState<Axial | null>(null);
  const [syncStatus, setSyncStatus] = useState<"connecting" | "saving" | "saved" | "error">("connecting");
  const editGestureRef = useRef<EditGesture | null>(null);
  const factionGestureRef = useRef<FactionGesture | null>(null);
  const riverGestureRef = useRef<RiverGesture | null>(null);
  const roadGestureRef = useRef<RoadGesture | null>(null);
  const fogGestureRef = useRef<{ touchedKeys: Set<string>; world: World } | null>(null);
  const featureIdRef = useRef(0);
  const factionIdRef = useRef(0);
  const websocketRef = useRef<WebSocket | null>(null);
  const clientIdRef = useRef(
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? `client-${crypto.randomUUID()}`
      : `client-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  const operationCounterRef = useRef(0);
  const queuedOperationsRef = useRef<OperationEnvelope[]>([]);
  const expectedSequenceRef = useRef<number | null>(null);
  const queuedReceivedOperationsRef = useRef<Map<number, MapOperationMessage>>(new Map());

  const world = draftWorld ?? history.present;
  const canEdit = role === "gm";
  const factions = useMemo(() => getFactions(world), [world]);
  const selectedFaction = useMemo(
    () => activeFactionId ? getFactionById(world, activeFactionId) : null,
    [activeFactionId, world]
  );
  const selectedFeature = useMemo(
    () => selectedFeatureId ? getFeatureById(world, view.level, selectedFeatureId) : null,
    [selectedFeatureId, view.level, world]
  );
  const ignoreHistoryStep = useCallback(() => {
    // Local undo/redo is disabled in authoritative sync mode.
  }, []);


  const flushOperations = useCallback(() => {
    const socket = websocketRef.current;

    if (!socket || socket.readyState !== WebSocket.OPEN) {
      setSyncStatus("connecting");
      return;
    }

    if (expectedSequenceRef.current === null) {
      setSyncStatus("connecting");
      return;
    }

    if (queuedOperationsRef.current.length === 0) {
      setSyncStatus("saved");
      return;
    }

    const unsent = queuedOperationsRef.current.filter((envelope) => !envelope.sent);

    if (unsent.length === 0) {
      setSyncStatus("saving");
      return;
    }

    if (unsent.length === 1) {
      const envelope = unsent[0];
      const payload: MapOperationRequest = {
        type: "map_operation",
        operationId: envelope.operationId,
        operation: envelope.operation,
        clientId: clientIdRef.current
      };

      socket.send(JSON.stringify(payload));
      envelope.sent = true;

      logMapSync("operation_sent", {
        mapId,
        operationId: envelope.operationId,
        operationType: envelope.operation.type,
        queued: queuedOperationsRef.current.length
      });
    } else {
      const totalBatches = Math.ceil(unsent.length / maxOperationsPerBatch);

      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex += 1) {
        const start = batchIndex * maxOperationsPerBatch;
        const batchItems = unsent.slice(start, start + maxOperationsPerBatch);
        const payload: MapOperationBatchRequest = {
          type: "map_operation_batch",
          clientId: clientIdRef.current,
          operations: batchItems.map((envelope) => ({
            operationId: envelope.operationId,
            operation: envelope.operation
          }))
        };

        socket.send(JSON.stringify(payload));

        for (const envelope of batchItems) {
          envelope.sent = true;
        }

        logMapSync("operation_batch_sent", {
          mapId,
          batchIndex: batchIndex + 1,
          totalBatches,
          operations: batchItems.length,
          queued: queuedOperationsRef.current.length
        });
      }
    }

    setSyncStatus("saving");
  }, [mapId]);

  const sendOperations = useCallback((operations: MapOperation[]) => {
    let added = 0;

    for (const operation of operations) {
      operationCounterRef.current += 1;
      const operationId = `${clientIdRef.current}-${Date.now()}-${operationCounterRef.current}`;
      queuedOperationsRef.current.push({ operationId, operation, sent: false });
      added += 1;

      logMapSync("operation_created", {
        mapId,
        operationId,
        operationType: operation.type
      });
    }

    if (added > 0) {
      setSyncStatus("saving");
    }

    flushOperations();
  }, [flushOperations, mapId]);

  const sendWorldDelta = useCallback((nextWorld: World) => {
    if (nextWorld === history.present) {
      return;
    }

    const debugEnabled = isMapSyncDebugEnabled();
    const diffTimerLabel = `[MapSync] diff_world_delta:${mapId}`;

    if (debugEnabled) {
      console.time(diffTimerLabel);
    }

    const operations = diffWorldAsOperations(history.present, nextWorld);

    if (debugEnabled) {
      console.timeEnd(diffTimerLabel);
      console.info("[MapSync] diff_world_delta_summary", {
        mapId,
        operations: operations.length,
        queuedLocal: queuedOperationsRef.current.length
      });
    }

    if (operations.length === 0) {
      return;
    }

    sendOperations(operations);
  }, [history.present, mapId, sendOperations]);

  const createFeatureId = useCallback(() => {
    featureIdRef.current += 1;
    return `feature-${Date.now()}-${featureIdRef.current}`;
  }, []);

  const createFactionId = useCallback(() => {
    factionIdRef.current += 1;
    return `faction-${Date.now()}-${factionIdRef.current}`;
  }, []);

  const applyTerrainGestureCells = useCallback(
    (axials: Axial[]) => {
      const gesture = editGestureRef.current;

      if (!gesture) {
        return;
      }

      const beforeWorld = gesture.world;
      const nextWorld = applyEditGestureCells(gesture, axials);

      if (nextWorld !== beforeWorld) {
        setDraftWorld(nextWorld);
      }
    },
    []
  );

  const applyActiveGestureCells = useCallback(
    (axials: Axial[]) => {
      if (editGestureRef.current) {
        applyTerrainGestureCells(axials);
      }

      const factionGesture = factionGestureRef.current;

      if (factionGesture) {
        const beforeWorld = factionGesture.world;
        const nextWorld = applyFactionGestureCells(factionGesture, axials);

        if (nextWorld !== beforeWorld) {
          setDraftWorld(nextWorld);
        }
      }

      const roadGesture = roadGestureRef.current;

      if (roadGesture) {
        const beforeWorld = roadGesture.world;
        const nextWorld = applyRoadGestureCells(roadGesture, axials);

        if (nextWorld !== beforeWorld) {
          setDraftWorld(nextWorld);
        }
      }

      const fogGesture = fogGestureRef.current;

      if (fogGesture) {
        let nextFogWorld = fogGesture.world;
        let changed = false;

        for (const axial of axials) {
          const key = `${axial.q},${axial.r}`;

          if (fogGesture.touchedKeys.has(key)) {
            continue;
          }

          fogGesture.touchedKeys.add(key);
          const cell = getLevelMap(nextFogWorld, view.level).get(key);

          if (!cell) {
            continue;
          }

          const nextWorldForCell = setCellHidden(nextFogWorld, view.level, axial, !cell.hidden);

          if (nextWorldForCell !== nextFogWorld) {
            nextFogWorld = nextWorldForCell;
            changed = true;
          }
        }

        if (changed) {
          fogGesture.world = nextFogWorld;
          setDraftWorld(nextFogWorld);
        }
      }
    },
    [applyTerrainGestureCells, view.level]
  );

  const applyActiveRiverGestureEdges = useCallback(
    (edges: RiverEdgeRef[]) => {
      const gesture = riverGestureRef.current;

      if (!gesture) {
        return;
      }

      const beforeWorld = gesture.world;
      const nextWorld = applyRiverGestureEdges(gesture, edges);

      if (nextWorld !== beforeWorld) {
        setDraftWorld(nextWorld);
      }
    },
    []
  );

  const startEditGesture = useCallback(
    (action: EditGestureAction, axials: Axial[]) => {
      if (!canEdit) {
        return;
      }

      editGestureRef.current = null;
      factionGestureRef.current = null;
      riverGestureRef.current = null;
      roadGestureRef.current = null;
      fogGestureRef.current = null;

      if (activeMode === "feature") {
        const axial = axials[0];

        if (!axial) {
          setSelectedFeatureId(null);
          return;
        }

        const result = action === "paint"
          ? placeOrSelectFeature(history.present, view.level, axial, activeFeatureKind, createFeatureId)
          : removeFeatureOnHex(history.present, view.level, axial, selectedFeatureId);

        setSelectedFeatureId(result.selectedFeatureId);

        if (result.world !== history.present) {
          sendWorldDelta(result.world);
        }

        return;
      }

      if (activeMode === "river") {
        return;
      }

      if (activeMode === "road") {
        if (view.level !== SOURCE_LEVEL) {
          return;
        }

        roadGestureRef.current = createRoadGesture(
          action === "paint" ? "add" : "remove",
          history.present,
          view.level
        );
        applyActiveGestureCells(axials);
        return;
      }

      if (activeMode === "faction") {
        factionGestureRef.current = createFactionGesture(
          action === "paint" ? "assign" : "clear",
          history.present,
          view.level,
          activeFactionId
        );
        applyActiveGestureCells(axials);
        return;
      }

      if (activeMode === "fog") {
        if (action === "paint") {
          fogGestureRef.current = {
            touchedKeys: new Set(),
            world: history.present
          };
          applyActiveGestureCells(axials);
          return;
        }

        const axial = axials[0];

        if (!axial) {
          return;
        }

        const feature = getFeatureAt(history.present, view.level, axial);

        if (!feature) {
          return;
        }

        const nextWorld = updateFeature(history.present, view.level, feature.id, {
          hidden: !feature.hidden
        });

        if (nextWorld !== history.present) {
          sendWorldDelta(nextWorld);
        }

        return;
      }

      editGestureRef.current = createEditGesture(
        action,
        history.present,
        view.level,
        activeType,
        maxLevels
      );
      applyActiveGestureCells(axials);
    },
    [
      activeFeatureKind,
      activeFactionId,
      activeMode,
      activeType,
      applyActiveGestureCells,
      createFeatureId,
      history.present,
      maxLevels,
      canEdit,
      selectedFeatureId,
      sendWorldDelta,
      view.level
    ]
  );

  const startRiverGesture = useCallback(
    (action: EditGestureAction, edges: RiverEdgeRef[]) => {
      if (!canEdit) {
        return;
      }

      editGestureRef.current = null;
      factionGestureRef.current = null;
      roadGestureRef.current = null;
      fogGestureRef.current = null;

      if (view.level !== SOURCE_LEVEL) {
        return;
      }

      riverGestureRef.current = createRiverGesture(
        action === "paint" ? "add" : "remove",
        history.present,
        view.level
      );
      applyActiveRiverGestureEdges(edges);
    },
    [applyActiveRiverGestureEdges, canEdit, history.present, view.level]
  );

  const finishEditGesture = useCallback(() => {
    const terrainGesture = editGestureRef.current;
    const factionGesture = factionGestureRef.current;
    const riverGesture = riverGestureRef.current;
    const roadGesture = roadGestureRef.current;
    const fogGesture = fogGestureRef.current;
    editGestureRef.current = null;
    factionGestureRef.current = null;
    riverGestureRef.current = null;
    roadGestureRef.current = null;
    fogGestureRef.current = null;
    setDraftWorld(null);

    if (terrainGesture) {
      const finishedWorld = getFinishedGestureWorld(terrainGesture);

      if (finishedWorld) {
        sendWorldDelta(finishedWorld);
      }
    }

    if (factionGesture) {
      const finishedWorld = getFinishedFactionGestureWorld(factionGesture);

      if (finishedWorld) {
        sendWorldDelta(finishedWorld);
      }
    }

    if (riverGesture) {
      const finishedWorld = getFinishedRiverGestureWorld(riverGesture);

      if (finishedWorld) {
        sendWorldDelta(finishedWorld);
      }
    }

    if (roadGesture) {
      const finishedWorld = getFinishedRoadGestureWorld(roadGesture);

      if (finishedWorld) {
        sendWorldDelta(finishedWorld);
      }
    }

    if (fogGesture && fogGesture.world !== history.present) {
      sendWorldDelta(fogGesture.world);
    }
  }, [history.present, sendWorldDelta]);

  const chooseFeatureKind = useCallback((type: FeatureKind) => {
    if (!canEdit) {
      return;
    }

    setActiveFeatureKind(type);
    setActiveMode("feature");
  }, [canEdit]);

  const changeMode = useCallback((mode: EditorMode) => {
    if (!canEdit) {
      return;
    }

    setActiveMode(mode);

    if (mode !== "feature") {
      setSelectedFeatureId(null);
    }
  }, [canEdit]);

  const clearSelectedFeature = useCallback(() => {
    setSelectedFeatureId(null);
  }, []);

  const updateSelectedFeature = useCallback(
    (
      updates: Partial<
        Pick<Feature, "gmLabel" | "hidden" | "kind" | "labelRevealed" | "overrideTerrainTile" | "playerLabel">
      >
    ) => {
      if (!canEdit || !selectedFeatureId) {
        return;
      }

      const nextWorld = updateFeature(history.present, view.level, selectedFeatureId, updates);

      if (nextWorld !== history.present) {
        sendWorldDelta(nextWorld);
      }
    },
    [canEdit, history.present, selectedFeatureId, sendWorldDelta, view.level]
  );

  const deleteSelectedFeature = useCallback(() => {
    if (!canEdit) {
      return;
    }

    if (!selectedFeature) {
      return;
    }

    const nextWorld = removeFeatureOnHex(
      history.present,
      view.level,
      featureHexIdToAxial(selectedFeature.hexId),
      selectedFeatureId
    ).world;

    if (nextWorld !== history.present) {
      sendWorldDelta(nextWorld);
    }

    setSelectedFeatureId(null);
  }, [canEdit, history.present, selectedFeature, selectedFeatureId, sendWorldDelta, view.level]);

  useEffect(() => {
    if (selectedFeatureId && !selectedFeature) {
      setSelectedFeatureId(null);
    }
  }, [selectedFeature, selectedFeatureId]);

  useEffect(() => {
    if (activeFactionId && !selectedFaction) {
      setActiveFactionId(null);
    }
  }, [activeFactionId, selectedFaction]);

  const acknowledgeOperation = useCallback((operationId: string) => {
    const index = queuedOperationsRef.current.findIndex((envelope) => envelope.operationId === operationId);

    if (index >= 0) {
      queuedOperationsRef.current.splice(index, 1);
    }
  }, []);

  const applyQueuedReceivedOperations = useCallback(() => {
    const debugEnabled = isMapSyncDebugEnabled();
    const applyDispatchTimerLabel = `[MapSync] apply_queue_dispatch:${mapId}`;
    const applyQueueStartedAt = performance.now();
    let appliedCount = 0;
    let firstAppliedSequence: number | null = null;
    let lastAppliedSequence: number | null = null;

    if (debugEnabled) {
      console.time(applyDispatchTimerLabel);
    }

    // Collect all consecutive operations to apply in order
    const operationsToApply: Array<{ sequence: number; message: MapOperationMessage }> = [];
    while (expectedSequenceRef.current !== null) {
      const expectedSequence = expectedSequenceRef.current;
      const nextMessage = queuedReceivedOperationsRef.current.get(expectedSequence);
      if (!nextMessage) break;
      queuedReceivedOperationsRef.current.delete(expectedSequence);
      expectedSequenceRef.current = expectedSequence + 1;
      operationsToApply.push({ sequence: expectedSequence, message: nextMessage });
      if (nextMessage.sourceClientId === clientIdRef.current) {
        acknowledgeOperation(nextMessage.operationId);
      }
      appliedCount += 1;
      firstAppliedSequence ??= expectedSequence;
      lastAppliedSequence = expectedSequence;
    }

    if (operationsToApply.length > 0) {
      setDraftWorld(null);
      resetFromCurrent((currentWorld) => {
        let world = currentWorld;
        for (const { sequence, message } of operationsToApply) {
          const operationTimerBase = `[MapSync] apply_operation:${mapId}:${sequence}:${message.operationId}`;
          const operationDispatchStartedAt = performance.now();
          if (debugEnabled) {
            console.time(`${operationTimerBase}:applyMapOperationToWorld`);
          }
          const operationStart = performance.now();
          world = applyMapOperationToWorld(world, message.operation);
          const applyDurationMs = performance.now() - operationStart;
          if (debugEnabled) {
            console.timeEnd(`${operationTimerBase}:applyMapOperationToWorld`);
            if (applyDurationMs >= 8) {
              console.info("[MapSync] apply_operation_slow", {
                mapId,
                sequence,
                operationId: message.operationId,
                operationType: message.operation.type,
                durationMs: toRoundedMs(applyDurationMs)
              });
            }
          }
          logMapSync("operation_applied_sequence", {
            mapId,
            sequence,
            operationId: message.operationId,
            operationType: message.operation.type,
            sourceClientId: message.sourceClientId
          });
        }
        return world;
      });
    }

    if (debugEnabled) {
      console.timeEnd(applyDispatchTimerLabel);
      const applyQueueDispatchMs = performance.now() - applyQueueStartedAt;
      const bufferedSequences = Array.from(queuedReceivedOperationsRef.current.keys());
      const nextBufferedSequence = bufferedSequences.length > 0 ? Math.min(...bufferedSequences) : null;
      console.info("[MapSync] apply_queue_summary", {
        mapId,
        appliedCount,
        firstAppliedSequence,
        lastAppliedSequence,
        expectedNextSequence: expectedSequenceRef.current,
        bufferedWaiting: queuedReceivedOperationsRef.current.size,
        nextBufferedSequence,
        queuedLocal: queuedOperationsRef.current.length,
        dispatchLoopMs: toRoundedMs(applyQueueDispatchMs)
      });
      if (appliedCount > 0) {
        const queueToPaintStartedAt = performance.now();
        window.requestAnimationFrame(() => {
          console.info("[MapSync] apply_queue_to_paint_summary", {
            mapId,
            appliedCount,
            durationMs: toRoundedMs(performance.now() - applyQueueStartedAt),
            toNextPaintMs: toRoundedMs(performance.now() - queueToPaintStartedAt)
          });
        });
      }
    }

    setSyncStatus(queuedOperationsRef.current.length > 0 ? "saving" : "saved");
    flushOperations();
  }, [acknowledgeOperation, flushOperations, mapId, resetFromCurrent]);

  useEffect(() => {
    const socketUrl = buildWebSocketUrl(`/api/maps/${encodeURIComponent(mapId)}/ws`);
    let disposed = false;
    let reconnectTimer: number | null = null;
    let reconnectAttempt = 0;
    let activeSocket: WebSocket | null = null;

    const clearReconnectTimer = () => {
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    const scheduleReconnect = () => {
      if (disposed) {
        return;
      }

      const delayMs = Math.min(5000, 250 * (2 ** Math.min(reconnectAttempt, 4)));
      reconnectAttempt += 1;
      clearReconnectTimer();
      setSyncStatus("connecting");

      logMapSync("reconnect_scheduled", { mapId, socketUrl, delayMs, reconnectAttempt });

      reconnectTimer = window.setTimeout(() => {
        connect();
      }, delayMs);
    };

    const connect = () => {
      if (disposed) {
        return;
      }

      if (activeSocket && (activeSocket.readyState === WebSocket.CONNECTING || activeSocket.readyState === WebSocket.OPEN)) {
        return;
      }

      logMapSync("connecting", { mapId, socketUrl });

      const socket = new WebSocket(socketUrl);
      activeSocket = socket;
      websocketRef.current = socket;
      setSyncStatus("connecting");

      socket.onopen = () => {
        if (disposed || websocketRef.current !== socket) {
          return;
        }

        reconnectAttempt = 0;
        expectedSequenceRef.current = null;
        queuedReceivedOperationsRef.current.clear();
        queuedOperationsRef.current = queuedOperationsRef.current.map((envelope) => ({
          ...envelope,
          sent: false
        }));

        logMapSync("open", { mapId, socketUrl });
      };

      socket.onmessage = (event) => {
        if (disposed || websocketRef.current !== socket) {
          return;
        }

        let message: unknown;

        try {
          message = JSON.parse(String(event.data)) as unknown;
        } catch {
          return;
        }

        if (typeof message !== "object" || message === null || !("type" in message)) {
          return;
        }

        if ((message as { type?: string }).type === "sync_error") {
          console.error("[MapSync] sync_error", message);
          setSyncStatus("error");
          return;
        }

        if ((message as { type?: string }).type === "sync_snapshot") {
          const payload = message as MapSyncSnapshotMessage;

          if (!Number.isInteger(payload.lastSequence) || payload.lastSequence < 0) {
            console.error("[MapSync] invalid_snapshot_sequence", payload);
            setSyncStatus("error");
            return;
          }

          try {
            const snapshotWorld = deserializeWorld(payload.content);
            setDraftWorld(null);
            resetFromCurrent(() => snapshotWorld);
            expectedSequenceRef.current = payload.lastSequence + 1;
            queuedReceivedOperationsRef.current.clear();
            setSyncStatus(queuedOperationsRef.current.length > 0 ? "saving" : "saved");

            logMapSync("snapshot_loaded", {
              mapId,
              lastSequence: payload.lastSequence,
              nextExpectedSequence: expectedSequenceRef.current,
              queuedLocal: queuedOperationsRef.current.length
            });

            flushOperations();
          } catch (error) {
            console.error("[MapSync] invalid_snapshot", error);
            setSyncStatus("error");
          }

          return;
        }

        const enqueueAppliedOperation = (payload: MapOperationMessage) => {
          const operationId = payload.operationId;

          if (typeof operationId !== "string" || !operationId || !Number.isInteger(payload.sequence) || payload.sequence <= 0) {
            console.error("[MapSync] invalid_operation_id", payload);
            return;
          }

          if (expectedSequenceRef.current === null) {
            logMapSync("operation_waiting_snapshot", {
              mapId,
              operationId,
              sequence: payload.sequence,
              operationType: payload.operation.type
            });
            return;
          }

          logMapSync("operation_received", {
            mapId,
            sequence: payload.sequence,
            operationId,
            operationType: payload.operation.type,
            sourceClientId: payload.sourceClientId
          });

          if (payload.sequence < expectedSequenceRef.current) {
            if (payload.sourceClientId === clientIdRef.current) {
              acknowledgeOperation(operationId);
            }

            logMapSync("operation_ignored_past_sequence", {
              mapId,
              operationId,
              sequence: payload.sequence,
              expectedSequence: expectedSequenceRef.current,
              operationType: payload.operation.type
            });

            return;
          }

          if (!queuedReceivedOperationsRef.current.has(payload.sequence)) {
            queuedReceivedOperationsRef.current.set(payload.sequence, payload);
          }

          if (payload.sequence > expectedSequenceRef.current) {
            logMapSync("operation_gap_detected", {
              mapId,
              expectedSequence: expectedSequenceRef.current,
              receivedSequence: payload.sequence,
              bufferedWaiting: queuedReceivedOperationsRef.current.size
            });
          }
        };

        const messageType = (message as { type?: string }).type;

        if (messageType === "map_operation_applied") {
          enqueueAppliedOperation(message as MapOperationMessage);
          applyQueuedReceivedOperations();
          return;
        }

        if (messageType === "map_operation_batch_applied") {
          const batch = message as MapOperationBatchAppliedMessage;

          if (!Array.isArray(batch.operations)) {
            console.error("[MapSync] invalid_operation_batch", batch);
            return;
          }

          logMapSync("operation_batch_received", {
            mapId,
            operations: batch.operations.length
          });

          for (const operation of batch.operations) {
            enqueueAppliedOperation({ type: "map_operation_applied", ...operation });
          }

          applyQueuedReceivedOperations();
        }
      };

      socket.onerror = (event) => {
        if (disposed || websocketRef.current !== socket) {
          return;
        }

        console.error("[MapSync] error", { mapId, socketUrl, event });
      };

      socket.onclose = (event) => {
        const isCurrentSocket = websocketRef.current === socket;

        if (isCurrentSocket) {
          websocketRef.current = null;
        }

        if (activeSocket === socket) {
          activeSocket = null;
        }

        if (disposed || !isCurrentSocket) {
          logMapSync("close_intentional", {
            mapId,
            socketUrl,
            code: event.code,
            reason: event.reason,
            wasClean: event.wasClean
          });
          return;
        }

        console.warn("[MapSync] close", {
          mapId,
          socketUrl,
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean
        });

        setSyncStatus("connecting");
        scheduleReconnect();
      };
    };

    reconnectTimer = window.setTimeout(() => {
      connect();
    }, 0);

    return () => {
      disposed = true;
      clearReconnectTimer();
      expectedSequenceRef.current = null;
      queuedReceivedOperationsRef.current.clear();

      if (activeSocket && (activeSocket.readyState === WebSocket.CONNECTING || activeSocket.readyState === WebSocket.OPEN)) {
        activeSocket.close(1000, "client_cleanup");
      }

      websocketRef.current = null;
    };
  }, [acknowledgeOperation, applyQueuedReceivedOperations, flushOperations, mapId, resetFromCurrent]);

  const toggleCoordinates = useCallback(() => {
    setShowCoordinates((previous) => !previous);
  }, []);

  const createNewFaction = useCallback(() => {
    if (!canEdit) {
      return;
    }

    const factionNumber = factions.length + 1;
    const nextFaction: Faction = {
      id: createFactionId(),
      name: `Faction ${factionNumber}`,
      color: defaultFactionColors[(factionNumber - 1) % defaultFactionColors.length]
    };
    const nextWorld = addFaction(history.present, nextFaction);

    if (nextWorld !== history.present) {
      sendWorldDelta(nextWorld);
      setActiveFactionId(nextFaction.id);
      setActiveMode("faction");
    }
  }, [canEdit, createFactionId, factions.length, history.present, sendWorldDelta]);

  const renameFaction = useCallback((factionId: string, name: string) => {
    if (!canEdit) {
      return;
    }

    const trimmed = name.trim();

    if (!trimmed) {
      return;
    }

    const nextWorld = updateFaction(history.present, factionId, { name: trimmed });

    if (nextWorld !== history.present) {
      sendWorldDelta(nextWorld);
    }
  }, [canEdit, history.present, sendWorldDelta]);

  const recolorFaction = useCallback((factionId: string, color: string) => {
    if (!canEdit) {
      return;
    }

    const nextWorld = updateFaction(history.present, factionId, { color });

    if (nextWorld !== history.present) {
      sendWorldDelta(nextWorld);
    }
  }, [canEdit, history.present, sendWorldDelta]);

  const deleteFactionById = useCallback((factionId: string) => {
    if (!canEdit) {
      return;
    }

    const nextWorld = removeFaction(history.present, factionId);

    if (nextWorld !== history.present) {
      sendWorldDelta(nextWorld);
    }

    if (activeFactionId === factionId) {
      setActiveFactionId(null);
    }
  }, [activeFactionId, canEdit, history.present, sendWorldDelta]);

  useKeyboardNavigation({
    center: view.center,
    level: view.level,
    panPixelsPerSecond: editorConfig.keyboardPanPixelsPerSecond,
    rootRef: appRef,
    visualZoom,
    onCenterChange: setCenter,
    onLevelStep: changeLevelByDelta,
    onRedo: ignoreHistoryStep,
    onToggleCoordinates: toggleCoordinates,
    onUndo: ignoreHistoryStep
  });

  const interactionLabel = useMemo(() => {
    if (!canEdit) {
      return "Read-only map view.";
    }

    if (activeMode === "terrain") {
      return `Left paints ${tileLabels[activeType]}, right erases terrain, middle drag pans.`;
    }

    if (activeMode === "feature") {
      if (view.level !== SOURCE_LEVEL) {
        return `Left selects derived ${featureKindLabels[activeFeatureKind]} features, metadata edits update level ${SOURCE_LEVEL} sources.`;
      }

      return `Left places ${featureKindLabels[activeFeatureKind]} or selects an existing feature, right removes a feature, middle drag pans.`;
    }

    if (activeMode === "faction") {
      if (!activeFactionId) {
        return "Select a faction first. Left assigns hexes, right clears faction marks, middle drag pans.";
      }

      const name = selectedFaction?.name ?? "selected faction";
      return `Left assigns ${name}, right clears faction marks, middle drag pans.`;
    }

    if (activeMode === "road") {
      if (view.level !== SOURCE_LEVEL) {
        return `Roads are derived here. Use A/E to switch to level ${SOURCE_LEVEL} and edit road edges.`;
      }

      return "Left click and drag to draw roads, right click a road to remove it, middle drag pans.";
    }

    if (activeMode === "fog") {
      return "Left toggles terrain fog, right toggles feature hidden state, middle drag pans.";
    }

    if (view.level !== SOURCE_LEVEL) {
      return `Rivers are derived here. Use A/E to switch to level ${SOURCE_LEVEL} and edit river edges.`;
    }

    return "Left paints river edges, right erases river edges, middle drag pans.";
  }, [activeFactionId, activeFeatureKind, activeMode, activeType, canEdit, selectedFaction, view.level]);
  const featureVisibilityMode: "gm" | "player" = role === "player" ? "player" : "gm";

  const canvasProps = useMemo(
    () => ({
      center: view.center,
      canEdit,
      editMode: activeMode,
      featureVisibilityMode,
      fogEditingActive: role === "gm" && activeMode === "fog",
      interactionLabel,
      level: view.level,
      onCenterChange: setCenter,
      onEditGestureEnd: finishEditGesture,
      onEditGestureMove: applyActiveGestureCells,
      onEditGestureStart: startEditGesture,
      onRiverGestureEnd: finishEditGesture,
      onRiverGestureMove: applyActiveRiverGestureEdges,
      onRiverGestureStart: startRiverGesture,
      onHoveredHexChange: setHoveredHex,
      onVisualZoomChange: changeVisualZoom,
      hoveredHex,
      showCoordinates,
      visualZoom,
      world
    }),
    [
      activeMode,
      canEdit,
      featureVisibilityMode,
      applyActiveGestureCells,
      applyActiveRiverGestureEdges,
      changeVisualZoom,
      finishEditGesture,
      interactionLabel,
      setCenter,
      hoveredHex,
      showCoordinates,
      startEditGesture,
      startRiverGesture,
      view.center,
      view.level,
      visualZoom,
      world,
      role
    ]
  );

  return {
    activeFeatureKind,
    activeFactionId,
    activeMode,
    activeType,
    factions,
    hoveredHex,
    selectedFeature,
    appRef,
    canvasProps,
    chooseFeatureKind,
    clearSelectedFeature,
    deleteSelectedFeature,
    deleteFaction: deleteFactionById,
    maxLevels,
    selectedFeatureId,
    createFaction: createNewFaction,
    renameFaction,
    recolorFaction,
    selectFaction: setActiveFactionId,
    setActiveMode: changeMode,
    setActiveType,
    syncStatus,
    updateSelectedFeature,
    view,
    visualZoom
  };
}
