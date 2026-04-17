import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { editorConfig } from "@/config/editorConfig";
import { applyMapOperationToWorld, diffWorldAsOperations, type MapOperation } from "@/app/io/mapOperations";
import type { MapOperationMessage, MapOperationRequest } from "@/app/io/mapApi";
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

const defaultFactionColors = [
  "#d94f3d",
  "#3668d8",
  "#2f9d5a",
  "#b76ad8",
  "#d89f2f",
  "#1fa9a3"
];

type UseEditorStateOptions = {
  initialWorld: World;
  mapId: string;
  role: OpenMapRole;
};

type OperationEnvelope = {
  operationId: string;
  operation: MapOperation;
};

const maxRememberedOperationIds = 5000;

export function useEditorState({ initialWorld, mapId, role }: UseEditorStateOptions) {
  const maxLevels = editorConfig.maxLevels;
  const appRef = useRef<HTMLElement | null>(null);
  const { history, record, redo, resetFromCurrent, undo } = useUndoRedo<World>(() => initialWorld);
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
  const inFlightOperationsRef = useRef<Map<string, OperationEnvelope>>(new Map());
  const suppressNextOutboundSyncRef = useRef(false);
  const knownOperationIdsRef = useRef<Set<string>>(new Set());
  const knownOperationOrderRef = useRef<string[]>([]);
  const previousPresentRef = useRef(history.present);

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

  const rememberOperationId = useCallback((operationId: string): boolean => {
    if (knownOperationIdsRef.current.has(operationId)) {
      return false;
    }

    knownOperationIdsRef.current.add(operationId);
    knownOperationOrderRef.current.push(operationId);

    if (knownOperationOrderRef.current.length > maxRememberedOperationIds) {
      const removed = knownOperationOrderRef.current.shift();

      if (removed) {
        knownOperationIdsRef.current.delete(removed);
      }
    }

    return true;
  }, []);

  const flushOperations = useCallback(() => {
    const socket = websocketRef.current;

    if (!socket || socket.readyState !== WebSocket.OPEN) {
      setSyncStatus("connecting");
      return;
    }

    if (queuedOperationsRef.current.length === 0) {
      setSyncStatus(inFlightOperationsRef.current.size > 0 ? "saving" : "saved");
      return;
    }

    while (queuedOperationsRef.current.length > 0) {
      const envelope = queuedOperationsRef.current.shift();

      if (!envelope) {
        break;
      }

      const payload: MapOperationRequest = {
        type: "map_operation",
        operationId: envelope.operationId,
        operation: envelope.operation,
        clientId: clientIdRef.current
      };

      socket.send(JSON.stringify(payload));
      inFlightOperationsRef.current.set(envelope.operationId, envelope);

      if (import.meta.env.DEV) {
        console.info("[MapSync] operation_sent", {
          mapId,
          operationId: envelope.operationId,
          operationType: envelope.operation.type,
          inFlight: inFlightOperationsRef.current.size,
          queued: queuedOperationsRef.current.length
        });
      }
    }

    setSyncStatus(inFlightOperationsRef.current.size > 0 ? "saving" : "saved");
  }, [mapId]);

  const sendOperations = useCallback((operations: MapOperation[]) => {
    for (const operation of operations) {
      operationCounterRef.current += 1;
      const operationId = `${clientIdRef.current}-${Date.now()}-${operationCounterRef.current}`;
      queuedOperationsRef.current.push({ operationId, operation });

      if (import.meta.env.DEV) {
        console.info("[MapSync] operation_created", {
          mapId,
          operationId,
          operationType: operation.type
        });
      }
    }

    flushOperations();
  }, [flushOperations, mapId]);

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

      if (!fogGesture) {
        return;
      }

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
          record(result.world);
        }

        return;
      }

      if (activeMode === "river") {
        return;
      }

      if (activeMode === "road") {
        if (view.level !== 3) {
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
          record(nextWorld);
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
      record,
      canEdit,
      selectedFeatureId,
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

      if (view.level !== 3) {
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
        record(finishedWorld);
      }
    }

    if (factionGesture) {
      const finishedWorld = getFinishedFactionGestureWorld(factionGesture);

      if (finishedWorld) {
        record(finishedWorld);
      }
    }

    if (riverGesture) {
      const finishedWorld = getFinishedRiverGestureWorld(riverGesture);

      if (finishedWorld) {
        record(finishedWorld);
      }
    }

    if (roadGesture) {
      const finishedWorld = getFinishedRoadGestureWorld(roadGesture);

      if (finishedWorld) {
        record(finishedWorld);
      }
    }

    if (fogGesture && fogGesture.world !== history.present) {
      record(fogGesture.world);
    }
  }, [history.present, record]);

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
        record(nextWorld);
      }
    },
    [canEdit, history.present, record, selectedFeatureId, view.level]
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
      record(nextWorld);
    }

    setSelectedFeatureId(null);
  }, [canEdit, history.present, record, selectedFeature, selectedFeatureId, view.level]);

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

      if (import.meta.env.DEV) {
        console.info("[MapSync] reconnect_scheduled", { mapId, socketUrl, delayMs, reconnectAttempt });
      }

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

      if (import.meta.env.DEV) {
        console.info("[MapSync] connecting", { mapId, socketUrl });
      }

      const socket = new WebSocket(socketUrl);
      activeSocket = socket;
      websocketRef.current = socket;
      setSyncStatus("connecting");

      socket.onopen = () => {
        if (disposed || websocketRef.current !== socket) {
          return;
        }

        reconnectAttempt = 0;

        if (import.meta.env.DEV) {
          console.info("[MapSync] open", { mapId, socketUrl });
        }

        if (inFlightOperationsRef.current.size > 0) {
          const queuedIds = new Set(queuedOperationsRef.current.map((envelope) => envelope.operationId));
          const retryEnvelopes = Array.from(inFlightOperationsRef.current.values())
            .filter((envelope) => !queuedIds.has(envelope.operationId));

          if (retryEnvelopes.length > 0) {
            queuedOperationsRef.current = [...retryEnvelopes, ...queuedOperationsRef.current];

            if (import.meta.env.DEV) {
              console.info("[MapSync] operation_retry_queued", {
                mapId,
                count: retryEnvelopes.length,
                inFlight: inFlightOperationsRef.current.size
              });
            }
          }
        }

        flushOperations();
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

        if ((message as { type?: string }).type !== "map_operation_applied") {
          return;
        }

        const payload = message as MapOperationMessage;
        const operationId = payload.operationId;

        if (typeof operationId !== "string" || !operationId) {
          console.error("[MapSync] invalid_operation_id", payload);
          return;
        }

        if (import.meta.env.DEV) {
          console.info("[MapSync] operation_received", {
            mapId,
            operationId,
            operationType: payload.operation.type,
            sourceClientId: payload.sourceClientId
          });
        }

        if (payload.sourceClientId === clientIdRef.current) {
          const wasPending = inFlightOperationsRef.current.delete(operationId);
          const wasNew = rememberOperationId(operationId);

          if (import.meta.env.DEV) {
            console.info("[MapSync] operation_ack", {
              mapId,
              operationId,
              operationType: payload.operation.type,
              wasPending,
              duplicateAck: !wasNew,
              inFlight: inFlightOperationsRef.current.size
            });
          }

          flushOperations();
          return;
        }

        if (!rememberOperationId(operationId)) {
          if (import.meta.env.DEV) {
            console.info("[MapSync] operation_ignored_duplicate", {
              mapId,
              operationId,
              operationType: payload.operation.type
            });
          }
          return;
        }

        if (import.meta.env.DEV) {
          console.info("[MapSync] operation_applied_remote", {
            mapId,
            operationId,
            operationType: payload.operation.type
          });
        }

        suppressNextOutboundSyncRef.current = true;
        setDraftWorld(null);
        resetFromCurrent((currentWorld) => applyMapOperationToWorld(currentWorld, payload.operation));
        setSyncStatus(inFlightOperationsRef.current.size > 0 ? "saving" : "saved");
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
          if (import.meta.env.DEV) {
            console.info("[MapSync] close_intentional", {
              mapId,
              socketUrl,
              code: event.code,
              reason: event.reason,
              wasClean: event.wasClean
            });
          }
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

      if (activeSocket && (activeSocket.readyState === WebSocket.CONNECTING || activeSocket.readyState === WebSocket.OPEN)) {
        activeSocket.close(1000, "client_cleanup");
      }

      websocketRef.current = null;
    };
  }, [flushOperations, mapId, rememberOperationId, resetFromCurrent]);

  useEffect(() => {
    const previous = previousPresentRef.current;
    const current = history.present;

    if (previous === current) {
      return;
    }

    previousPresentRef.current = current;

    if (suppressNextOutboundSyncRef.current) {
      suppressNextOutboundSyncRef.current = false;

      if (import.meta.env.DEV) {
        console.info("[MapSync] outbound_skipped_remote_apply", {
          mapId
        });
      }

      return;
    }

    const operations = diffWorldAsOperations(previous, current);

    if (operations.length === 0) {
      return;
    }

    if (import.meta.env.DEV) {
      console.info("[MapSync] outbound_diff_created", {
        mapId,
        count: operations.length,
        operationTypes: operations.map((operation) => operation.type)
      });
    }

    sendOperations(operations);
  }, [history.present, mapId, sendOperations]);

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
      record(nextWorld);
      setActiveFactionId(nextFaction.id);
      setActiveMode("faction");
    }
  }, [canEdit, createFactionId, factions.length, history.present, record]);

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
      record(nextWorld);
    }
  }, [canEdit, history.present, record]);

  const recolorFaction = useCallback((factionId: string, color: string) => {
    if (!canEdit) {
      return;
    }

    const nextWorld = updateFaction(history.present, factionId, { color });

    if (nextWorld !== history.present) {
      record(nextWorld);
    }
  }, [canEdit, history.present, record]);

  const deleteFactionById = useCallback((factionId: string) => {
    if (!canEdit) {
      return;
    }

    const nextWorld = removeFaction(history.present, factionId);

    if (nextWorld !== history.present) {
      record(nextWorld);
    }

    if (activeFactionId === factionId) {
      setActiveFactionId(null);
    }
  }, [activeFactionId, canEdit, history.present, record]);

  useKeyboardNavigation({
    center: view.center,
    level: view.level,
    panPixelsPerSecond: editorConfig.keyboardPanPixelsPerSecond,
    rootRef: appRef,
    visualZoom,
    onCenterChange: setCenter,
    onLevelStep: changeLevelByDelta,
    onRedo: redo,
    onToggleCoordinates: toggleCoordinates,
    onUndo: undo
  });

  const interactionLabel = useMemo(() => {
    if (!canEdit) {
      return "Read-only map view.";
    }

    if (activeMode === "terrain") {
      return `Left paints ${tileLabels[activeType]}, right erases terrain, middle drag pans.`;
    }

    if (activeMode === "feature") {
      if (view.level !== 3) {
        return `Left selects derived ${featureKindLabels[activeFeatureKind]} features, metadata edits update level 3 sources.`;
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
      if (view.level !== 3) {
        return "Roads are derived here. Use A/E to switch to level 3 and edit road edges.";
      }

      return "Left click and drag to draw roads, right click a road to remove it, middle drag pans.";
    }

    if (activeMode === "fog") {
      return "Left toggles terrain fog, right toggles feature hidden state, middle drag pans.";
    }

    if (view.level !== 3) {
      return "Rivers are derived here. Use A/E to switch to level 3 and edit river edges.";
    }

    return "Left paints river edges, right erases river edges, middle drag pans.";
  }, [activeFactionId, activeFeatureKind, activeMode, activeType, canEdit, selectedFaction, view.level]);

  const canvasProps = useMemo(
    () => ({
      center: view.center,
      canEdit,
      editMode: activeMode,
      featureVisibilityMode: role === "player" ? "player" : "gm",
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
