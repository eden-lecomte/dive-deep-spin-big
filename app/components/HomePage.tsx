"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import HeaderBar from "./HeaderBar";
import WheelSection from "./WheelSection";
import GamesListPanel from "./panels/GamesListPanel";
import EditPanel from "./panels/EditPanel";
import AdminAccessPanel from "./panels/AdminAccessPanel";
import AdminControlsPanel from "./panels/AdminControlsPanel";
import PlayerManagementPanel from "./panels/PlayerManagementPanel";
import VictoryModal from "./VictoryModal";
import {
  COLORS,
  DEFAULT_ITEMS,
  SPIN_DURATION,
  VOTE_WEIGHTS,
} from "../lib/constants";
import {
  useLocalStorageState,
  useSessionStorageState,
} from "../hooks/useStoredState";
import { randomId, shuffleArray, weightedPick } from "../lib/utils";
import type {
  DraftItem,
  NoRepeatMode,
  TeamState,
  VoteLevel,
  VoteSummaryEntry,
  WheelItem,
  WheelSegment,
} from "../lib/types";

export default function Home() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const roomParam = searchParams.get("room");
  const room = roomParam ?? "";
  const viewParam = searchParams.get("view") === "1";

  // Store current room and timestamp in localStorage when in a room
  useEffect(() => {
    if (roomParam && roomParam.trim() && typeof window !== "undefined") {
      localStorage.setItem("wheel:lastRoom", roomParam);
      localStorage.setItem("wheel:lastRoomTimestamp", Date.now().toString());
    }
  }, [roomParam]);

  // Get default items from localStorage or use DEFAULT_ITEMS
  // Recompute when room changes to get fresh defaults for new rooms
  const defaultItems = useMemo(() => {
    if (typeof window === "undefined") return DEFAULT_ITEMS;
    const saved = localStorage.getItem("wheel:defaultItems");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch {
        // Invalid JSON, use default
      }
    }
    return DEFAULT_ITEMS;
  }, [room]); // Recompute when room changes to get fresh defaults

  const [items, setItems] = useLocalStorageState<WheelItem[]>(
    `wheel:items:${room}`,
    defaultItems
  );
  const [rotation, setRotation] = useState(0);
  const rotationRef = useRef(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [pendingResultId, setPendingResultId] = useState<string | null>(null);
  const [landedItemId, setLandedItemId] = useState<string | null>(null);
  const [mysteryEnabled, setMysteryEnabled] = useLocalStorageState<boolean>(
    `wheel:mystery:${room}`,
    false
  );
  const [votingEnabled, setVotingEnabled] = useLocalStorageState<boolean>(
    `wheel:voting:${room}`,
    false
  );
  const [noRepeatMode, setNoRepeatMode] = useLocalStorageState<NoRepeatMode>(
    `wheel:norepeat:${room}`,
    "off"
  );
  const [presentationModeState, setPresentationMode] =
    useLocalStorageState<boolean>(`wheel:presentation:${room}`, false);
  const presentationMode = presentationModeState ?? false;
  const [userName, setUserName] = useLocalStorageState<string>(
    `wheel:username`,
    ""
  );
  const [votesByItem, setVotesByItem] = useLocalStorageState<
    Record<string, VoteLevel>
  >(`wheel:votes:${room}:${userName || "anon"}`, {});
  const [roomVotes, setRoomVotes] = useLocalStorageState<
    Record<string, Record<string, VoteLevel>>
  >(`wheel:roomVotes:${room}`, {});
  const [adminUnlocked, setAdminUnlocked] = useSessionStorageState<boolean>(
    `wheel:adminUnlocked:${room}`,
    false
  );
  const [usedItemIds, setUsedItemIds] = useSessionStorageState<string[]>(
    `wheel:used:${room}`,
    []
  );
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [disconnectMessage, setDisconnectMessage] = useState<string | null>(
    null
  );
  const [socketReady, setSocketReady] = useState(false);
  // Initialize reconnecting state immediately if we have a room param
  // This prevents showing default/empty room data on refresh
  const [isReconnecting, setIsReconnecting] = useState(() => {
    if (typeof window === "undefined") return false;
    const urlRoomParam = new URLSearchParams(window.location.search).get(
      "room"
    );
    // Only show reconnecting if we have a room param
    return !!urlRoomParam;
  });
  const [reconnectingStartTime, setReconnectingStartTime] = useState<
    number | null
  >(null);
  const [multipleConnectionsPrompt, setMultipleConnectionsPrompt] = useState<{
    message: string;
  } | null>(null);
  const [victoryWinners, setVictoryWinners] = useState<string[] | null>(null);
  const [toastMessages, setToastMessages] = useState<
    Array<{ id: string; message: string; type?: "success" | "error" }>
  >([]);
  const [reconnectTrigger, setReconnectTrigger] = useState(0);
  const [teamState, setTeamState] = useState<TeamState | null>(null);
  const [teamShuffle, setTeamShuffle] = useState(false);
  const [adminClaimed, setAdminClaimed] = useState(false);
  const [adminName, setAdminName] = useState<string | null>(null);
  const [adminPin, setAdminPin] = useState("");
  const [players, setPlayers] = useState<
    Array<{ name: string; connected: boolean }>
  >([]);
  const [playerStats, setPlayerStats] = useLocalStorageState<
    Record<string, { wins: number; losses: number }>
  >(`wheel:playerStats:${room}`, {});
  const lastItemsSourceRef = useRef<"local" | "server" | null>(null);
  const itemsRef = useRef<WheelItem[]>(items);
  const suppressSettingsBroadcastRef = useRef(false);
  const clientIdRef = useRef<string | null>(null);
  const adminPinRef = useRef<string>("");
  const [adminPinSession, setAdminPinSession] = useSessionStorageState<string>(
    `wheel:adminPin:${room}`,
    ""
  );
  const [showAdminAccess, setShowAdminAccess] = useState(false);

  const isEmptyRoom = items.length === 0;
  const canEdit = adminUnlocked || (isEmptyRoom && !adminClaimed);
  const editLocked = !canEdit;

  const wsRef = useRef<WebSocket | null>(null);
  const spinTimeoutRef = useRef<number | null>(null);
  const pendingSpinRef = useRef(false);
  const spinTriggerHandled = useRef(false);
  const lastSpinId = useRef<string | null>(null);
  const teamIntervalRef = useRef<number | null>(null);
  const teamTimeoutRef = useRef<number | null>(null);
  const manualUnlockAttemptedRef = useRef(false);
  const adminUnlockedRef = useRef(adminUnlocked);
  const adminPinSessionRef = useRef(adminPinSession);

  // Keep refs in sync with state
  useEffect(() => {
    adminUnlockedRef.current = adminUnlocked;
  }, [adminUnlocked]);

  useEffect(() => {
    adminPinSessionRef.current = adminPinSession;
  }, [adminPinSession]);

  const effectiveRoomVotes = useMemo(() => {
    const name = userName.trim();
    if (!name) return roomVotes;
    if (roomVotes[name] === votesByItem) return roomVotes;
    return {
      ...roomVotes,
      [name]: votesByItem,
    };
  }, [roomVotes, userName, votesByItem]);

  const voteTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    Object.values(effectiveRoomVotes).forEach((votes) => {
      Object.entries(votes).forEach(([itemId, level]) => {
        totals[itemId] = (totals[itemId] || 0) + VOTE_WEIGHTS[level];
      });
    });
    return totals;
  }, [effectiveRoomVotes]);

  const weightedItems = useMemo(() => {
    return items.map((item) => ({
      ...item,
      weight: Math.max(0.1, item.weight + (voteTotals[item.id] || 0)),
    }));
  }, [items, voteTotals]);

  const segments = useMemo<WheelSegment[]>(() => {
    if (!weightedItems.length) return [];
    const totalWeight = weightedItems.reduce(
      (sum, item) => sum + Math.max(0.1, item.weight || 0),
      0
    );
    let current = 0;
    return weightedItems.map((item, index) => {
      const slice = (Math.max(0.1, item.weight || 0) / totalWeight) * 360;
      const start = current;
      const end = current + slice;
      current = end;
      return {
        ...item,
        start,
        end,
        mid: start + slice / 2,
        color: COLORS[index % COLORS.length],
      };
    });
  }, [weightedItems]);

  const gradient = useMemo(() => {
    if (!segments.length) return "conic-gradient(#2b2d31 0deg 360deg)";
    return `conic-gradient(${segments
      .map(
        (segment) => `${segment.color} ${segment.start}deg ${segment.end}deg`
      )
      .join(", ")})`;
  }, [segments]);

  const landedItem = useMemo(
    () => items.find((item) => item.id === landedItemId) || null,
    [items, landedItemId]
  );

  const hiddenLabels = mysteryEnabled;
  const voterNames = useMemo(
    () => Object.keys(roomVotes).filter((name) => name.trim()),
    [roomVotes]
  );
  const teamCandidates = useMemo(() => {
    if (voterNames.length) {
      return voterNames;
    }
    // Extract names from player objects
    return players.map((p) => (typeof p === "string" ? p : p.name));
  }, [players, voterNames]);

  const spinToItem = useCallback(
    (itemId: string, targetRotation: number) => {
      const item = items.find((entry) => entry.id === itemId);
      if (!item) return;
      setPendingResultId(itemId);
      setIsSpinning(true);
      setStatusMessage(null);

      setRotation(targetRotation);

      if (spinTimeoutRef.current) {
        window.clearTimeout(spinTimeoutRef.current);
      }

      spinTimeoutRef.current = window.setTimeout(() => {
        setIsSpinning(false);
        setLandedItemId(itemId);
        setPendingResultId(null);
        if (noRepeatMode === "session") {
          setUsedItemIds((prev) =>
            prev.includes(itemId) ? prev : [...prev, itemId]
          );
        }
      }, SPIN_DURATION);
    },
    [items, noRepeatMode, setUsedItemIds]
  );

  const requestSpin = useCallback(
    (source: "manual" | "param") => {
      if (!items.length || isSpinning) return;
      if (!adminUnlocked) {
        setStatusMessage("Only the admin can spin this room.");
        return;
      }
      const excluded = new Set<string>();
      if (noRepeatMode === "consecutive" && landedItemId) {
        excluded.add(landedItemId);
      }
      if (noRepeatMode === "session") {
        usedItemIds.forEach((id) => excluded.add(id));
        if (excluded.size >= items.length) {
          setStatusMessage(
            "All items have been spun. Reset session to continue."
          );
          return;
        }
      }

      const available = weightedItems.filter((item) => !excluded.has(item.id));
      if (!available.length) return;
      const pick = weightedPick(available);
      const segment = segments.find((entry) => entry.id === pick.id);
      if (!segment) return;

      const current = rotationRef.current;
      const extraSpins = Math.floor(Math.random() * 3);
      const fullSpins = (5 + extraSpins) * 360;
      const offset = (360 - ((current + segment.mid) % 360)) % 360;
      const targetRotation = current + fullSpins + offset;
      const spinId = randomId();
      lastSpinId.current = spinId;

      const payload = {
        type: "spin",
        payload: {
          itemId: pick.id,
          targetRotation,
          spinId,
          source,
        },
      };

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(payload));
      }

      spinToItem(pick.id, targetRotation);
      setVotingEnabled(false);
    },
    [
      adminUnlocked,
      isSpinning,
      items,
      landedItemId,
      noRepeatMode,
      segments,
      spinToItem,
      setVotingEnabled,
      usedItemIds,
      weightedItems,
    ]
  );

  useEffect(() => {
    rotationRef.current = rotation;
  }, [rotation]);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // Generate or retrieve device ID (persisted in localStorage)
  const getDeviceId = useCallback(() => {
    const STORAGE_KEY = "wheel:deviceId";
    let deviceId = localStorage.getItem(STORAGE_KEY);
    if (!deviceId) {
      // Generate a unique device ID
      deviceId = `device-${Date.now()}-${Math.random()
        .toString(36)
        .substring(2, 15)}`;
      localStorage.setItem(STORAGE_KEY, deviceId);
    }
    return deviceId;
  }, []);

  useEffect(() => {
    if (!roomParam) return;

    // Don't clear room param on initial load - wait for userName to load from localStorage
    // Only validate name after we've had a chance to load from localStorage
    // Check if userName might still be loading (empty string could mean not loaded yet)
    // We'll let the user stay in the room and they can enter their name if needed
    // The room param should persist regardless of userName state

    // Close any existing WebSocket connection before creating a new one
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch (e) {
        console.log("[CLIENT] Error closing existing WebSocket:", e);
      }
      wsRef.current = null;
    }

    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const deviceId = getDeviceId();
    const wsUrl = `${protocol}://${
      window.location.host
    }/ws?room=${encodeURIComponent(room)}&deviceId=${encodeURIComponent(
      deviceId
    )}`;

    console.log("[CLIENT] Creating new WebSocket connection to:", wsUrl);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setSocketReady(true);
      setDisconnectMessage(null); // Clear disconnect message on successful connection
      if (pendingSpinRef.current) {
        pendingSpinRef.current = false;
      }
      // Send presence message to restore/establish session
      if (userName) {
        ws.send(
          JSON.stringify({
            type: "presence",
            payload: { name: userName },
          })
        );
      }
      // If admin was previously unlocked, restore admin status on reconnect
      // Only auto-restore if we haven't just attempted a manual unlock
      // Use refs to get latest values without causing reconnection
      if (
        adminUnlockedRef.current &&
        adminPinSessionRef.current &&
        !manualUnlockAttemptedRef.current
      ) {
        ws.send(
          JSON.stringify({
            type: "admin_unlock",
            payload: { pin: adminPinSessionRef.current },
          })
        );
      }
      // Reset the manual unlock flag after connection is established
      manualUnlockAttemptedRef.current = false;
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message?.type === "spin") {
          const { itemId, targetRotation, spinId, replay } =
            message.payload || {};
          if (!itemId || typeof targetRotation !== "number") return;
          if (spinId && lastSpinId.current === spinId) return;
          lastSpinId.current = spinId || null;
          if (replay) {
            setRotation(targetRotation);
            setLandedItemId(itemId);
            setPendingResultId(null);
            setIsSpinning(false);
          } else {
            spinToItem(itemId, targetRotation);
          }
        }
        if (message?.type === "sync") {
          const {
            roomVotes,
            teamState,
            adminClaimed,
            adminName,
            players,
            items,
            settings,
            clientId,
          } = message.payload || {};
          if (roomVotes) {
            setRoomVotes(roomVotes);
          }
          if (teamState !== undefined) {
            // Backward compatibility: if teamState doesn't have mode, default to "teams"
            const normalizedTeamState =
              teamState && !teamState.mode
                ? { ...teamState, mode: "teams" as const }
                : teamState;
            setTeamState(normalizedTeamState);
          }
          if (typeof adminClaimed === "boolean") {
            setAdminClaimed(adminClaimed);
          }
          if (adminName !== undefined) {
            setAdminName(adminName);
          }
          if (Array.isArray(players)) {
            // Handle both old format (strings) and new format (objects with name/connected)
            const normalizedPlayers = players.map((p) =>
              typeof p === "string" ? { name: p, connected: true } : p
            );
            setPlayers(normalizedPlayers);
          }
          if (Array.isArray(items)) {
            lastItemsSourceRef.current = "server";
            setItems(items);
          }
          if (settings) {
            suppressSettingsBroadcastRef.current = true;
            const {
              mysteryEnabled,
              votingEnabled,
              noRepeatMode,
              presentationMode,
            } = settings;
            if (typeof mysteryEnabled === "boolean") {
              setMysteryEnabled(mysteryEnabled);
            }
            if (typeof votingEnabled === "boolean") {
              setVotingEnabled(votingEnabled);
            }
            if (noRepeatMode) {
              setNoRepeatMode(noRepeatMode);
            }
            if (typeof presentationMode === "boolean") {
              setPresentationMode(presentationMode);
            }
          }
          if (clientId) {
            clientIdRef.current = clientId;
          }
        }
        if (message?.type === "roomVotes") {
          const { roomVotes } = message.payload || {};
          if (roomVotes) {
            setRoomVotes(roomVotes);
          }
        }
        if (message?.type === "teams") {
          const { teamState } = message.payload || {};
          // Backward compatibility: if teamState doesn't have mode, default to "teams"
          const normalizedTeamState =
            teamState && !teamState.mode
              ? { ...teamState, mode: "teams" as const }
              : teamState;
          setTeamState(normalizedTeamState ?? null);
        }
        if (message?.type === "admin_status") {
          const { claimed, adminName: statusAdminName } = message.payload || {};
          if (typeof claimed === "boolean") {
            setAdminClaimed(claimed);
          }
          if (statusAdminName !== undefined) {
            setAdminName(statusAdminName);
          }
        }
        if (message?.type === "admin_result") {
          const { success, message: resultMessage } = message.payload || {};
          if (success) {
            setAdminUnlocked(true);
            setAdminClaimed(true);
            // Use pin from ref (most up-to-date) or session, fallback to state
            const pinValue =
              adminPinRef.current || adminPinSession || adminPin.trim();
            if (pinValue) {
              adminPinRef.current = pinValue;
              setAdminPinSession(pinValue);
            }
            setShowAdminAccess(false);
          } else {
            // If claim failed because admin is already claimed, update state
            if (resultMessage && resultMessage.includes("already claimed")) {
              setAdminClaimed(true);
            }
          }
          if (resultMessage) {
            setStatusMessage(resultMessage);
          }
        }
        if (message?.type === "presence") {
          const { players } = message.payload || {};
          if (Array.isArray(players)) {
            // Handle both old format (strings) and new format (objects with name/connected)
            const normalizedPlayers = players.map((p) =>
              typeof p === "string" ? { name: p, connected: true } : p
            );
            setPlayers(normalizedPlayers);
          }
        }
        if (message?.type === "presence_error") {
          const { message: errorMessage } = message.payload || {};
          if (errorMessage) {
            setStatusMessage(errorMessage);
            // Don't clear userName - keep the current name so user stays in the room
            // The error message will prompt them to choose a different name
          }
        }
        if (message?.type === "multiple_connections_prompt") {
          const { message: promptMessage } = message.payload || {};
          if (promptMessage) {
            console.log("Multiple connections prompt received:", promptMessage);
            setMultipleConnectionsPrompt({ message: promptMessage });
          }
        }
        if (message?.type === "items_update") {
          const { items, sourceClientId } = message.payload || {};
          if (!Array.isArray(items)) return;
          if (sourceClientId && sourceClientId === clientIdRef.current) {
            if (itemsRef.current.length !== items.length) {
              setStatusMessage("Edit rejected by server. Check admin status.");
              return;
            }
            return;
          }
          lastItemsSourceRef.current = "server";
          setItems(items);
        }
        if (message?.type === "settings_update") {
          const { settings } = message.payload || {};
          if (settings) {
            suppressSettingsBroadcastRef.current = true;
            const {
              mysteryEnabled,
              votingEnabled,
              noRepeatMode,
              presentationMode,
            } = settings;
            if (typeof mysteryEnabled === "boolean") {
              setMysteryEnabled(mysteryEnabled);
            }
            if (typeof votingEnabled === "boolean") {
              setVotingEnabled(votingEnabled);
            }
            if (noRepeatMode) {
              setNoRepeatMode(noRepeatMode);
            }
            if (typeof presentationMode === "boolean") {
              setPresentationMode(presentationMode);
            }
          }
        }
        if (message?.type === "player_rename_result") {
          const { success, message: resultMessage } = message.payload || {};
          if (resultMessage) {
            setStatusMessage(resultMessage);
          }
        }
        if (message?.type === "player_kick_result") {
          const { success, message: resultMessage } = message.payload || {};
          if (resultMessage) {
            setStatusMessage(resultMessage);
          }
        }
        if (message?.type === "victory") {
          const { winners } = message.payload || {};
          console.log("[CLIENT] Received victory message:", message);
          console.log("[CLIENT] Winners extracted:", winners);
          console.log("[CLIENT] Winners is array?", Array.isArray(winners));
          console.log("[CLIENT] Winners length:", winners?.length);
          if (Array.isArray(winners) && winners.length > 0) {
            console.log("[CLIENT] Accumulating victory winners");
            // Accumulate winners instead of replacing them
            setVictoryWinners((prev) => {
              if (!prev) return winners;
              // Combine previous and new winners, keeping unique names only
              const combined = [...prev, ...winners];
              return Array.from(new Set(combined));
            });
            console.log("[CLIENT] Victory winners state updated");
          } else {
            console.log(
              "[CLIENT] Victory message invalid - winners not array or empty"
            );
          }
        }
      } catch {
        return;
      }
    };

    ws.onclose = (event) => {
      setSocketReady(false);

      // Handle different disconnect reasons
      if (event.code === 4008) {
        // Kicked by admin
        setDisconnectMessage("You have been kicked from the room by an admin.");
        // Remove room parameter to go back to join screen
        const url = new URL(window.location.href);
        url.searchParams.delete("room");
        window.history.replaceState({}, "", url.toString());
        // Force a page reload to show the join screen after a short delay
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else if (event.code === 4009) {
        // Multiple connections from same device
        setDisconnectMessage(
          "Multiple connections detected. You can't log in as multiple users from the same device."
        );
        // Remove room parameter to go back to join screen
        const url = new URL(window.location.href);
        url.searchParams.delete("room");
        window.history.replaceState({}, "", url.toString());
        // Force a page reload to show the join screen after a short delay
        setTimeout(() => {
          window.location.reload();
        }, 3000);
      } else if (event.code === 1006 || event.code === 1001) {
        // Abnormal closure or going away (server disconnect, network issue)
        setDisconnectMessage(
          "Connection lost. The server may have disconnected or there's a network issue."
        );
      } else if (event.code !== 1000) {
        // Other non-normal closures
        const reason = event.reason || "Unknown reason";
        setDisconnectMessage(`Connection closed: ${reason}`);
      } else {
        // Normal closure (1000) - clear any previous disconnect message
        setDisconnectMessage(null);
      }
    };

    ws.onerror = () => {
      setSocketReady(false);
      setDisconnectMessage(
        "WebSocket error occurred. Please check your connection."
      );
    };

    return () => {
      ws.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    room,
    roomParam,
    userName,
    getDeviceId,
    reconnectTrigger, // Add reconnectTrigger to force reconnection
    // Note: Setters and other functions are intentionally excluded to prevent
    // unnecessary WebSocket reconnections. The event handlers capture the
    // latest values via closures, and setState functions are stable.
  ]);

  // Auto-reconnect when page becomes visible (e.g., phone comes back to foreground)
  useEffect(() => {
    if (!roomParam) return;

    const handleVisibilityChange = () => {
      console.log(
        "[CLIENT] Visibility changed:",
        document.visibilityState,
        "socketReady:",
        socketReady
      );
      // Only reconnect if page becomes visible and WebSocket is not ready
      if (document.visibilityState === "visible" && !socketReady) {
        const ws = wsRef.current;
        const wsState = ws ? ws.readyState : "null";
        console.log(
          "[CLIENT] WebSocket state:",
          wsState,
          "disconnectMessage:",
          disconnectMessage
        );

        // Check if WebSocket is closed, closing, or null (cleaned up)
        const isDisconnected =
          !ws ||
          ws.readyState === WebSocket.CLOSED ||
          ws.readyState === WebSocket.CLOSING;

        if (isDisconnected) {
          // Check if we have a disconnect message that indicates we shouldn't reconnect
          const shouldReconnect =
            !disconnectMessage ||
            (!disconnectMessage.includes("kicked") &&
              !disconnectMessage.includes("Multiple connections"));

          if (shouldReconnect) {
            console.log(
              "[CLIENT] Page visible, WebSocket disconnected, triggering reconnect..."
            );
            // Close any existing connection first
            if (ws) {
              try {
                ws.close();
              } catch (e) {
                console.log("[CLIENT] Error closing old WebSocket:", e);
              }
            }
            // Trigger reconnection by incrementing reconnectTrigger
            // This will cause the WebSocket useEffect to re-run
            setReconnectTrigger((prev) => prev + 1);
          } else {
            console.log(
              "[CLIENT] Not reconnecting - user was kicked or has multiple connections"
            );
          }
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Also check on focus (some browsers may not fire visibilitychange reliably)
    const handleFocus = () => {
      if (!socketReady && roomParam) {
        console.log("[CLIENT] Window focused, checking connection...");
        handleVisibilityChange();
      }
    };

    window.addEventListener("focus", handleFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, [roomParam, socketReady, disconnectMessage]);

  useEffect(() => {
    if (!spinTriggerHandled.current) {
      spinTriggerHandled.current = true;
    }
  }, []);

  useEffect(() => {
    if (!landedItem) return;
    if (landedItem.soundUrl) {
      const audio = new Audio(landedItem.soundUrl);
      audio.play().catch(() => null);
    }
  }, [landedItem]);

  useEffect(() => {
    if (!socketReady) return;
    const name = userName.trim();
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "presence",
          payload: { name: name || null },
        })
      );
    }
  }, [socketReady, userName]);

  useEffect(() => {
    if (adminPinSession) {
      adminPinRef.current = adminPinSession;
    }
  }, [adminPinSession, setAdminPinSession]);

  const pushItemsUpdate = useCallback(
    (nextItems: WheelItem[]) => {
      if (!socketReady || !canEdit) return;
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: "items_update",
            payload: {
              items: nextItems,
              sourceClientId: clientIdRef.current,
              adminPin:
                adminPinRef.current || adminPinSession || adminPin.trim(),
            },
          })
        );
      }
    },
    [adminPin, adminPinSession, canEdit, socketReady]
  );

  const broadcastSettings = useCallback(() => {
    if (!socketReady || !canEdit) return;
    if (suppressSettingsBroadcastRef.current) {
      suppressSettingsBroadcastRef.current = false;
      return;
    }
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "settings_update",
          payload: {
            settings: {
              mysteryEnabled,
              votingEnabled,
              noRepeatMode,
              presentationMode,
            },
            adminPin: adminPinRef.current || adminPinSession || adminPin.trim(),
          },
        })
      );
    }
  }, [
    adminPin,
    adminPinSession,
    canEdit,
    mysteryEnabled,
    noRepeatMode,
    presentationMode,
    socketReady,
    votingEnabled,
  ]);

  useEffect(() => {
    broadcastSettings();
  }, [
    adminPin,
    adminPinSession,
    canEdit,
    mysteryEnabled,
    noRepeatMode,
    presentationMode,
    socketReady,
    votingEnabled,
  ]);

  useEffect(() => {
    return () => {
      if (teamIntervalRef.current) {
        window.clearInterval(teamIntervalRef.current);
      }
      if (teamTimeoutRef.current) {
        window.clearTimeout(teamTimeoutRef.current);
      }
    };
  }, []);

  const createTeams = useCallback(() => {
    if (!teamCandidates.length) {
      setStatusMessage("No players yet. Ask players to join or vote first.");
      return;
    }
    setStatusMessage(null);
    setTeamShuffle(true);

    if (teamIntervalRef.current) {
      window.clearInterval(teamIntervalRef.current);
    }
    if (teamTimeoutRef.current) {
      window.clearTimeout(teamTimeoutRef.current);
    }

    const shuffleOnce = () => {
      const shuffled = shuffleArray(teamCandidates);
      const mid = Math.ceil(shuffled.length / 2);
      setTeamState({
        mode: "teams" as const,
        teamA: shuffled.slice(0, mid),
        teamB: shuffled.slice(mid),
      });
    };

    shuffleOnce();
    teamIntervalRef.current = window.setInterval(shuffleOnce, 140);
    teamTimeoutRef.current = window.setTimeout(() => {
      if (teamIntervalRef.current) {
        window.clearInterval(teamIntervalRef.current);
      }
      const finalShuffle = shuffleArray(teamCandidates);
      const mid = Math.ceil(finalShuffle.length / 2);
      const finalState = {
        mode: "teams" as const,
        teamA: finalShuffle.slice(0, mid),
        teamB: finalShuffle.slice(mid),
      };
      setTeamState(finalState);
      setTeamShuffle(false);
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: "teams",
            payload: {
              teamState: finalState,
            },
          })
        );
      }
    }, 1600);
  }, [teamCandidates]);

  const createFreeForAll = useCallback(() => {
    if (!teamCandidates.length) {
      setStatusMessage("No players yet. Ask players to join or vote first.");
      return;
    }
    setStatusMessage(null);
    const shuffled = shuffleArray(teamCandidates);
    const finalState = {
      mode: "freeforall" as const,
      teamA: shuffled,
      teamB: [],
    };
    setTeamState(finalState);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "teams",
          payload: {
            teamState: finalState,
          },
        })
      );
    }
  }, [teamCandidates]);

  const claimAdmin = useCallback(() => {
    if (adminClaimed && !adminUnlocked) {
      setStatusMessage("Admin already claimed for this room.");
      return;
    }
    const pinValue = adminPin.trim();
    if (!/^\d{4}$/.test(pinValue)) {
      setStatusMessage("Admin code must be 4 digits.");
      return;
    }
    if (!userName.trim()) {
      setStatusMessage("Enter your name before claiming admin.");
      return;
    }
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setStatusMessage("Not connected to server yet.");
      return;
    }
    manualUnlockAttemptedRef.current = true;
    adminPinRef.current = pinValue;
    setAdminPin(pinValue);
    setAdminPinSession(pinValue);
    wsRef.current.send(
      JSON.stringify({
        type: "admin_claim",
        payload: { name: userName.trim(), pin: pinValue },
      })
    );
  }, [adminClaimed, adminPin, adminUnlocked, setAdminPinSession, userName]);

  const unlockAdmin = useCallback(() => {
    const pin = adminPin.trim();
    if (!/^\d{4}$/.test(pin)) {
      setStatusMessage("Admin code must be 4 digits.");
      return;
    }
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setStatusMessage("Not connected to server yet.");
      return;
    }
    manualUnlockAttemptedRef.current = true;
    adminPinRef.current = pin;
    setAdminPin(pin);
    setAdminPinSession(pin);
    wsRef.current.send(
      JSON.stringify({
        type: "admin_unlock",
        payload: { pin },
      })
    );
  }, [adminPin, setAdminPinSession]);

  const handleVotingToggle = useCallback(() => {
    // Update both states atomically - React will batch these updates
    // Ensure we're not suppressing broadcasts for this local change
    suppressSettingsBroadcastRef.current = false;
    setPresentationMode(false);
    setVotingEnabled(true);
  }, [setPresentationMode, setVotingEnabled]);

  const handlePresentationToggle = useCallback(() => {
    // Update both states atomically - React will batch these updates
    // Ensure we're not suppressing broadcasts for this local change
    suppressSettingsBroadcastRef.current = false;
    setVotingEnabled(false);
    setPresentationMode(true);
  }, [setVotingEnabled, setPresentationMode]);

  const resetVotes = useCallback(() => {
    setVotesByItem({});
    setRoomVotes({});
    setTeamState(null);
    setStatusMessage("Votes cleared for this room.");
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "admin_reset",
          payload: { target: "votes" },
        })
      );
    }
  }, [setRoomVotes, setVotesByItem]);

  const resetItems = useCallback(() => {
    setItems(DEFAULT_ITEMS);
    setStatusMessage("Wheel items reset to defaults.");
  }, [setItems]);

  const saveAsDefault = useCallback(async (): Promise<boolean> => {
    if (typeof window === "undefined") {
      return false;
    }
    try {
      localStorage.setItem("wheel:defaultItems", JSON.stringify(items));
      const toastId = `toast-${Date.now()}-${Math.random()}`;
      setToastMessages((prev) => [
        ...prev,
        {
          id: toastId,
          message: "Items saved as default successfully!",
          type: "success",
        },
      ]);
      setTimeout(() => {
        setToastMessages((prev) => prev.filter((t) => t.id !== toastId));
      }, 3000);
      return true;
    } catch (error) {
      const toastId = `toast-${Date.now()}-${Math.random()}`;
      setToastMessages((prev) => [
        ...prev,
        {
          id: toastId,
          message: "Failed to save items as default.",
          type: "error",
        },
      ]);
      setTimeout(() => {
        setToastMessages((prev) => prev.filter((t) => t.id !== toastId));
      }, 3000);
      return false;
    }
  }, [items]);

  const resetHistory = useCallback(() => {
    setUsedItemIds([]);
    setStatusMessage("No-repeat history cleared.");
  }, [setUsedItemIds]);

  const resetResult = useCallback(() => {
    setRotation(0);
    setLandedItemId(null);
    setPendingResultId(null);
    setIsSpinning(false);
    if (spinTimeoutRef.current) {
      window.clearTimeout(spinTimeoutRef.current);
    }
    setStatusMessage("Spin result cleared.");
  }, []);

  const exportItems = useCallback(() => {
    const payload = JSON.stringify(items, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `wheel-items-${room || "room"}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    return true;
  }, [items, room]);

  const importItems = useCallback(
    (payload: WheelItem[]) => {
      const nextItems = payload
        .filter((item) => item && typeof item.label === "string")
        .map((item) => ({
          id: item.id || randomId(),
          label: item.label.trim(),
          weight: typeof item.weight === "number" ? item.weight : 1,
          imageUrl: item.imageUrl || undefined,
          soundUrl: item.soundUrl || undefined,
        }))
        .filter((item) => item.label);
      if (!nextItems.length) {
        setStatusMessage("Import failed: no valid items.");
        return false;
      }
      lastItemsSourceRef.current = "local";
      setItems(() => {
        pushItemsUpdate(nextItems);
        return nextItems;
      });
      setStatusMessage("Items imported.");
      return true;
    },
    [pushItemsUpdate, setItems]
  );

  const handleImportError = useCallback((message: string) => {
    setStatusMessage(message);
  }, []);

  const renamePlayer = useCallback(
    (oldName: string, newName: string) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        setStatusMessage("Not connected to server yet.");
        return;
      }
      if (!adminUnlocked) {
        setStatusMessage(
          "You must be unlocked as admin to perform this action."
        );
        return;
      }
      wsRef.current.send(
        JSON.stringify({
          type: "player_rename",
          payload: { oldName, newName },
        })
      );
    },
    [adminUnlocked]
  );

  const kickPlayer = useCallback(
    (playerName: string) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        setStatusMessage("Not connected to server yet.");
        return;
      }
      if (!adminUnlocked) {
        setStatusMessage(
          "You must be unlocked as admin to perform this action."
        );
        return;
      }
      if (!confirm(`Are you sure you want to kick "${playerName}"?`)) {
        return;
      }
      wsRef.current.send(
        JSON.stringify({
          type: "player_kick",
          payload: { playerName },
        })
      );
    },
    [adminUnlocked]
  );

  const awardPlayerWin = useCallback(
    (playerName: string) => {
      if (!adminUnlocked) {
        setStatusMessage(
          "You must be unlocked as admin to perform this action."
        );
        return;
      }
      setPlayerStats((prev) => {
        const current = prev[playerName] || { wins: 0, losses: 0 };
        return {
          ...prev,
          [playerName]: { ...current, wins: current.wins + 1 },
        };
      });
      // Show toast notification for admin
      const toastId = `toast-${Date.now()}-${Math.random()}`;
      setToastMessages((prev) => [
        ...prev,
        {
          id: toastId,
          message: `Victory awarded to ${playerName}!`,
          type: "success",
        },
      ]);
      // Auto-clear toast after 3 seconds
      setTimeout(() => {
        setToastMessages((prev) => prev.filter((t) => t.id !== toastId));
      }, 3000);
      // Broadcast victory to all clients (including this one via broadcast)
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        const victoryMessage = JSON.stringify({
          type: "victory",
          payload: { winners: [playerName] },
        });
        console.log("Sending victory message:", victoryMessage);
        wsRef.current.send(victoryMessage);
      } else {
        console.log("WebSocket not ready, cannot send victory message");
      }
    },
    [adminUnlocked, setPlayerStats]
  );

  const awardPlayerLoss = useCallback(
    (playerName: string) => {
      if (!adminUnlocked) {
        setStatusMessage(
          "You must be unlocked as admin to perform this action."
        );
        return;
      }
      setPlayerStats((prev) => {
        const current = prev[playerName] || { wins: 0, losses: 0 };
        return {
          ...prev,
          [playerName]: { ...current, losses: current.losses + 1 },
        };
      });
    },
    [adminUnlocked, setPlayerStats]
  );

  const awardTeamWin = useCallback(
    (team: string[]) => {
      if (!adminUnlocked) {
        setStatusMessage(
          "You must be unlocked as admin to perform this action."
        );
        return;
      }
      setPlayerStats((prev) => {
        const updated = { ...prev };
        team.forEach((playerName) => {
          const current = updated[playerName] || { wins: 0, losses: 0 };
          updated[playerName] = { ...current, wins: current.wins + 1 };
        });
        return updated;
      });
      // Show toast notification for admin
      const teamNames = team.join(", ");
      const toastId = `toast-${Date.now()}-${Math.random()}`;
      setToastMessages((prev) => [
        ...prev,
        {
          id: toastId,
          message: `Victory awarded to ${teamNames}!`,
          type: "success",
        },
      ]);
      // Auto-clear toast after 3 seconds
      setTimeout(() => {
        setToastMessages((prev) => prev.filter((t) => t.id !== toastId));
      }, 3000);
      // Broadcast victory to all clients (including this one via broadcast)
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        const victoryMessage = JSON.stringify({
          type: "victory",
          payload: { winners: team },
        });
        console.log("Sending victory message:", victoryMessage);
        wsRef.current.send(victoryMessage);
      } else {
        console.log("WebSocket not ready, cannot send victory message");
      }
    },
    [adminUnlocked, setPlayerStats]
  );

  const awardTeamLoss = useCallback(
    (team: string[]) => {
      if (!adminUnlocked) {
        setStatusMessage(
          "You must be unlocked as admin to perform this action."
        );
        return;
      }
      setPlayerStats((prev) => {
        const updated = { ...prev };
        team.forEach((playerName) => {
          const current = updated[playerName] || { wins: 0, losses: 0 };
          updated[playerName] = { ...current, losses: current.losses + 1 };
        });
        return updated;
      });
    },
    [adminUnlocked, setPlayerStats]
  );

  const resetPlayerStats = useCallback(
    (playerName: string) => {
      if (!adminUnlocked) {
        setStatusMessage(
          "You must be unlocked as admin to perform this action."
        );
        return;
      }
      setPlayerStats((prev) => {
        const updated = { ...prev };
        delete updated[playerName];
        return updated;
      });
    },
    [adminUnlocked, setPlayerStats]
  );

  const resetAdmin = useCallback(() => {
    setAdminUnlocked(false);
    setAdminClaimed(false);
    adminPinRef.current = "";
    setAdminPin("");
    setAdminPinSession("");
    setShowAdminAccess(false);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "admin_reset",
          payload: { target: "admin" },
        })
      );
    }
    setStatusMessage("Admin claim reset.");
  }, [setAdminPinSession, setAdminUnlocked]);

  function updateItem(id: string, patch: Partial<WheelItem>) {
    lastItemsSourceRef.current = "local";
    setItems((prev) => {
      const nextItems = prev.map((item) =>
        item.id === id ? { ...item, ...patch } : item
      );
      pushItemsUpdate(nextItems);
      return nextItems;
    });
  }

  function removeItem(id: string) {
    lastItemsSourceRef.current = "local";
    setItems((prev) => {
      const nextItems = prev.filter((item) => item.id !== id);
      pushItemsUpdate(nextItems);
      return nextItems;
    });
    setVotesByItem((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  function addItem(newItem: Omit<WheelItem, "id">) {
    lastItemsSourceRef.current = "local";
    setItems((prev) => {
      const nextItems = [...prev, { id: randomId(), ...newItem }];
      pushItemsUpdate(nextItems);
      return nextItems;
    });
  }

  function setVote(itemId: string, level: VoteLevel) {
    setVotesByItem((prev) => {
      const next = Object.fromEntries(
        Object.entries(prev).filter(([, value]) => value !== level)
      );
      next[itemId] = level;
      return next;
    });
    const name = userName.trim();
    if (!name) return;
    setRoomVotes((prev) => {
      const current = prev[name] || {};
      const filtered = Object.fromEntries(
        Object.entries(current).filter(([, value]) => value !== level)
      );
      return {
        ...prev,
        [name]: { ...filtered, [itemId]: level },
      };
    });
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "vote",
          payload: { name, itemId, level },
        })
      );
    }
  }

  const applyQueryParams = useCallback(
    (params: Record<string, string>) => {
      if (typeof window === "undefined") return;
      const url = new URL(window.location.href);
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });
      // Use router.replace to update URL - this persists on refresh and updates Next.js state
      const newUrl = url.pathname + url.search;
      router.replace(newUrl);
    },
    [router]
  );

  const voteSummary = useMemo<VoteSummaryEntry[]>(() => {
    return Object.entries(votesByItem)
      .map(([itemId, level]) => ({
        item: items.find((item) => item.id === itemId),
        level,
      }))
      .filter((entry): entry is VoteSummaryEntry => Boolean(entry.item));
  }, [votesByItem, items]);

  const [draftItem, setDraftItem] = useState<DraftItem>({
    label: "",
    weight: 1,
    imageUrl: "",
    soundUrl: "",
  });

  function handleDraftSubmit() {
    if (!draftItem.label.trim()) return;
    lastItemsSourceRef.current = "local";
    addItem({
      label: draftItem.label.trim(),
      weight: Number(draftItem.weight) || 1,
      imageUrl: draftItem.imageUrl.trim() || undefined,
      soundUrl: draftItem.soundUrl.trim() || undefined,
    });
    setDraftItem({ label: "", weight: 1, imageUrl: "", soundUrl: "" });
  }

  // Get last room from localStorage (for pre-filling input, not auto-reconnect)
  const lastRoomFromStorage = useMemo(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("wheel:lastRoom") || "";
  }, []);

  const [roomInput, setRoomInput] = useState(lastRoomFromStorage);
  const [playerNameInput, setPlayerNameInput] = useState(userName || "");
  const [recentRoom, setRecentRoom] = useState<{
    room: string;
    hasActivePlayers: boolean;
  } | null>(null);
  const [checkingRecentRoom, setCheckingRecentRoom] = useState(false);

  // Handle reconnecting state when we have a room param
  useEffect(() => {
    // Only handle reconnecting if we have a room param
    if (!roomParam) {
      // No room param - clear reconnecting state
      setIsReconnecting(false);
      setReconnectingStartTime(null);
      return;
    }

    // Set reconnecting state and start time when we have a room param but socket isn't ready yet
    if (!socketReady) {
      if (!isReconnecting) {
        setIsReconnecting(true);
      }
      if (!reconnectingStartTime) {
        setReconnectingStartTime(Date.now());
      }
    }

    // If socket is ready and we're reconnecting, start fade-out timer
    if (socketReady && isReconnecting) {
      if (!reconnectingStartTime) {
        // Just became ready, set start time if not set
        setReconnectingStartTime(Date.now());
      } else {
        // Check if minimum time has passed
        const elapsed = Date.now() - reconnectingStartTime;
        const remaining = Math.max(0, 500 - elapsed);
        if (remaining > 0) {
          const timer = setTimeout(() => {
            setIsReconnecting(false);
            setReconnectingStartTime(null);
          }, remaining);
          return () => clearTimeout(timer);
        } else {
          // Minimum time has passed, can hide now
          setIsReconnecting(false);
          setReconnectingStartTime(null);
        }
      }
    }
  }, [
    roomParam,
    applyQueryParams,
    socketReady,
    isReconnecting,
    reconnectingStartTime,
  ]);

  // Update playerNameInput when userName changes (e.g., when returning to landing screen)
  useEffect(() => {
    setPlayerNameInput(userName || "");
  }, [userName]);

  // Check for recent room when on landing screen
  useEffect(() => {
    if (roomParam) return; // Don't check if already in a room

    if (typeof window === "undefined") return;

    const lastRoom = localStorage.getItem("wheel:lastRoom");
    const lastRoomTimestamp = localStorage.getItem("wheel:lastRoomTimestamp");

    if (!lastRoom || !lastRoomTimestamp) {
      setRecentRoom(null);
      return;
    }

    // Check if room is within 2 hours (7200000 ms)
    const timestamp = parseInt(lastRoomTimestamp, 10);
    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;

    if (timestamp < twoHoursAgo) {
      setRecentRoom(null);
      return;
    }

    // Check if room has active players
    setCheckingRecentRoom(true);

    // Create a temporary WebSocket connection to check room status
    const wsUrl =
      typeof window !== "undefined"
        ? `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${
            window.location.host
          }/ws?room=${lastRoom}`
        : "";

    if (!wsUrl) {
      setCheckingRecentRoom(false);
      return;
    }

    const checkWs = new WebSocket(wsUrl);

    checkWs.onopen = () => {
      checkWs.send(
        JSON.stringify({
          type: "check_room_status",
          payload: { roomToCheck: lastRoom },
        })
      );
    };

    checkWs.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === "room_status") {
          const { room, hasActivePlayers } = message.payload || {};
          if (room === lastRoom) {
            setRecentRoom({
              room: lastRoom,
              hasActivePlayers: hasActivePlayers || false,
            });
          }
        }
      } catch (e) {
        // Ignore parse errors
      }
      checkWs.close();
      setCheckingRecentRoom(false);
    };

    checkWs.onerror = () => {
      setRecentRoom(null);
      setCheckingRecentRoom(false);
      checkWs.close();
    };

    checkWs.onclose = () => {
      setCheckingRecentRoom(false);
    };

    return () => {
      if (
        checkWs.readyState === WebSocket.OPEN ||
        checkWs.readyState === WebSocket.CONNECTING
      ) {
        checkWs.close();
      }
    };
  }, [roomParam]);

  function handleSetPlayerName() {
    const name = playerNameInput.trim();
    if (!name) return;
    setUserName(name);
  }

  function createRoomCode() {
    const name = playerNameInput.trim();
    if (!name) return;
    // Set name first
    setUserName(name);
    // Then create room
    const code = Math.random().toString(36).slice(2, 8).toUpperCase();
    // Store last room for auto-reconnect
    if (typeof window !== "undefined") {
      localStorage.setItem("wheel:lastRoom", code);
    }
    applyQueryParams({ room: code });
  }

  function joinRoom() {
    const name = playerNameInput.trim();
    if (!name) return;
    const code = roomInput.trim();
    if (!code) return;
    // Set name first
    setUserName(name);
    // Store last room for auto-reconnect
    if (typeof window !== "undefined") {
      localStorage.setItem("wheel:lastRoom", code);
    }
    // Then join room
    applyQueryParams({ room: code });
  }

  function leaveRoom() {
    // Close WebSocket connection
    if (wsRef.current) {
      wsRef.current.close();
    }
    // Remove room parameter to go back to landing screen
    const url = new URL(window.location.href);
    url.searchParams.delete("room");
    window.history.replaceState({}, "", url.toString());
    // Reload to show landing screen
    window.location.reload();
  }

  // Show loading spinner if we have a room param but socket isn't ready
  // This prevents showing default/empty room data
  const shouldShowLoading = roomParam && !socketReady;
  // Get the room name to display
  const reconnectingRoomName = roomParam;
  if (shouldShowLoading) {
    return (
      <div className="page reconnecting-loader">
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            gap: "16px",
          }}
        >
          <div
            style={{
              width: "48px",
              height: "48px",
              border: "4px solid var(--border)",
              borderTop: "4px solid var(--success)",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
            }}
          />
          <p className="subtle">
            Reconnecting to room{" "}
            <span className="pill">{reconnectingRoomName}</span>...
          </p>
        </div>
      </div>
    );
  }

  if (!roomParam) {
    // Show room entry UI with name input
    return (
      <>
        {multipleConnectionsPrompt && (
          <div className="modal-overlay">
            <div className="modal-content">
              <h3>Multiple Connections Detected</h3>
              <p>{multipleConnectionsPrompt.message}</p>
              <div className="modal-actions">
                <button
                  className="primary"
                  onClick={() => {
                    if (
                      wsRef.current &&
                      wsRef.current.readyState === WebSocket.OPEN
                    ) {
                      wsRef.current.send(
                        JSON.stringify({
                          type: "multiple_connections_confirm",
                          payload: { proceed: true },
                        })
                      );
                    }
                    setMultipleConnectionsPrompt(null);
                  }}
                >
                  Continue
                </button>
                <button
                  className="ghost"
                  onClick={() => {
                    if (
                      wsRef.current &&
                      wsRef.current.readyState === WebSocket.OPEN
                    ) {
                      wsRef.current.send(
                        JSON.stringify({
                          type: "multiple_connections_confirm",
                          payload: { proceed: false },
                        })
                      );
                      wsRef.current.close();
                    }
                    setMultipleConnectionsPrompt(null);
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
        <div className="page room-gate">
          <div className="room-card">
            <h1>Join a room</h1>
            <p className="subtle">
              Enter your name and a room code to join, or create a new one.
            </p>
            <div className="room-actions">
              <label className="field">
                Your name
                <input
                  type="text"
                  value={playerNameInput}
                  onChange={(event) => setPlayerNameInput(event.target.value)}
                  placeholder="Player name"
                />
              </label>
              <input
                type="text"
                value={roomInput}
                onChange={(event) => setRoomInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    joinRoom();
                  }
                }}
                placeholder="Room code"
              />
              <button
                className="primary"
                onClick={joinRoom}
                disabled={!roomInput.trim() || !playerNameInput.trim()}
              >
                Join room
              </button>
            </div>
            <button
              className="ghost"
              onClick={createRoomCode}
              disabled={!playerNameInput.trim()}
            >
              Create new room
            </button>
          </div>
          {recentRoom && recentRoom.hasActivePlayers && (
            <div
              className="recent-room-card"
              style={{
                marginTop: "24px",
                padding: "16px",
                border: "1px solid var(--border)",
                borderRadius: "12px",
                background: "var(--panel)",
              }}
            >
              <p className="subtle" style={{ marginBottom: "12px" }}>
                Recent room
              </p>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <p style={{ fontWeight: 500, marginBottom: "4px" }}>
                    Room: <span className="pill">{recentRoom.room}</span>
                  </p>
                  <p className="subtle" style={{ fontSize: "0.85rem" }}>
                    Active players in room
                  </p>
                </div>
                <button
                  className="primary"
                  onClick={() => {
                    if (playerNameInput.trim()) {
                      setUserName(playerNameInput.trim());
                    }
                    applyQueryParams({ room: recentRoom.room });
                  }}
                  disabled={!playerNameInput.trim()}
                >
                  Rejoin
                </button>
              </div>
            </div>
          )}
          {checkingRecentRoom && (
            <div
              style={{
                marginTop: "24px",
                padding: "16px",
                textAlign: "center",
              }}
            >
              <p className="subtle">Checking for recent room...</p>
            </div>
          )}
        </div>
      </>
    );
  }

  const adminPopoverContent = showAdminAccess ? (
    adminUnlocked ? (
      <div className="admin-popover">
        <div className="panel-block">
          <h3>Admin</h3>
          <p className="subtle">You are admin.</p>
          <button className="ghost" onClick={resetAdmin}>
            Logout admin
          </button>
        </div>
      </div>
    ) : (
      <div className="admin-popover">
        <AdminAccessPanel
          userName={userName}
          adminClaimed={adminClaimed}
          adminPin={adminPin}
          socketReady={socketReady}
          onUserNameChange={setUserName}
          onAdminPinChange={setAdminPin}
          onClaimAdmin={claimAdmin}
          onUnlockAdmin={unlockAdmin}
        />
      </div>
    )
  ) : null;

  return (
    <div className={`page ${viewParam ? "view-mode" : ""}`}>
      <HeaderBar
        room={room}
        viewMode={viewParam}
        socketReady={socketReady}
        votingEnabled={votingEnabled}
        presentationMode={presentationMode}
        adminActive={adminUnlocked}
        adminPopoverOpen={Boolean(adminPopoverContent)}
        adminPopoverContent={adminPopoverContent}
        players={players}
        adminName={adminName}
        onAdminClick={() => setShowAdminAccess((prev) => !prev)}
        onLeaveRoom={leaveRoom}
        onVotingToggle={handleVotingToggle}
        onPresentationToggle={handlePresentationToggle}
      />

      {disconnectMessage && (
        <div className="disconnect-banner">
          <div className="disconnect-banner-content">
            <span className="disconnect-icon">⚠️</span>
            <span>{disconnectMessage}</span>
            <button
              className="ghost"
              onClick={() => setDisconnectMessage(null)}
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {toastMessages.length > 0 && (
        <div className="toast-container">
          {toastMessages.map((toast, index) => (
            <div
              key={toast.id}
              className={`toast-notification ${
                toast.type === "error" ? "toast-error" : ""
              }`}
              style={{ top: `${24 + index * 45}px` }}
            >
              <div className="toast-content">
                <span className="toast-icon">
                  {toast.type === "error" ? "✕" : "✓"}
                </span>
                <span>{toast.message}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {multipleConnectionsPrompt && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Multiple Connections Detected</h3>
            <p>{multipleConnectionsPrompt.message}</p>
            <div className="modal-actions">
              <button
                className="primary"
                onClick={() => {
                  if (
                    wsRef.current &&
                    wsRef.current.readyState === WebSocket.OPEN
                  ) {
                    wsRef.current.send(
                      JSON.stringify({
                        type: "multiple_connections_confirm",
                        payload: { proceed: true },
                      })
                    );
                    // socketReady will be set when sync message is received
                  }
                  setMultipleConnectionsPrompt(null);
                }}
              >
                Continue
              </button>
              <button
                className="ghost"
                onClick={() => {
                  if (
                    wsRef.current &&
                    wsRef.current.readyState === WebSocket.OPEN
                  ) {
                    wsRef.current.send(
                      JSON.stringify({
                        type: "multiple_connections_confirm",
                        payload: { proceed: false },
                      })
                    );
                    wsRef.current.close();
                  }
                  setMultipleConnectionsPrompt(null);
                  // Go back to landing screen
                  const url = new URL(window.location.href);
                  url.searchParams.delete("room");
                  window.history.replaceState({}, "", url.toString());
                  window.location.reload();
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {victoryWinners && !adminUnlocked && (
        <VictoryModal
          winners={victoryWinners}
          onClose={() => setVictoryWinners(null)}
        />
      )}

      {socketReady && (
        <main>
          <div
            className={`layout ${viewParam ? "view-mode" : ""} ${
              presentationMode ? "presentation-mode" : ""
            }`}
          >
            <WheelSection
              viewMode={viewParam}
              showSpin={adminUnlocked}
              rotation={rotation}
              spinDuration={SPIN_DURATION}
              isSpinning={isSpinning}
              itemsCount={items.length}
              segments={segments}
              gradient={gradient}
              hiddenLabels={hiddenLabels}
              pendingResultId={pendingResultId}
              landedItem={landedItem}
              teamState={teamState}
              teamShuffle={teamShuffle}
              statusMessage={statusMessage}
              adminUnlocked={adminUnlocked}
              presentationMode={presentationMode}
              votingEnabled={votingEnabled}
              voteTotals={voteTotals}
              onSpin={() => requestSpin("manual")}
              onResetRotation={() => setRotation(0)}
              onCreateTeams={createTeams}
              onCreateFreeForAll={createFreeForAll}
              onAwardTeamWin={awardTeamWin}
              onAwardTeamLoss={awardTeamLoss}
            />

            {!viewParam && (
              <section className="panel">
                <GamesListPanel
                  items={items}
                  hiddenLabels={false}
                  roomVotes={effectiveRoomVotes}
                  votingEnabled={votingEnabled}
                  votesByItem={votesByItem}
                  voteSummary={voteSummary}
                  noRepeatMode={noRepeatMode}
                  landedItemId={landedItemId}
                  usedItemIds={usedItemIds}
                  onSetVote={setVote}
                />
              </section>
            )}
          </div>

          {!viewParam && adminUnlocked && (
            <div className="edit-panel-fullwidth">
              <EditPanel
                editLocked={editLocked}
                canEdit={canEdit}
                items={items}
                draftItem={draftItem}
                onUpdateItem={updateItem}
                onRemoveItem={removeItem}
                onDraftChange={setDraftItem}
                onDraftSubmit={handleDraftSubmit}
                onSaveAsDefault={saveAsDefault}
                onExportItems={exportItems}
                onImportItems={importItems}
                onImportError={handleImportError}
              />
            </div>
          )}

          {!viewParam && adminUnlocked && (
            <div className="edit-panel-fullwidth">
              <PlayerManagementPanel
                players={players}
                socketReady={socketReady}
                adminName={adminName}
                playerStats={playerStats}
                onRenamePlayer={renamePlayer}
                onKickPlayer={kickPlayer}
                onAwardWin={awardPlayerWin}
                onAwardLoss={awardPlayerLoss}
                onResetStats={resetPlayerStats}
              />
            </div>
          )}

          {!viewParam && adminUnlocked && (
            <div className="edit-panel-fullwidth">
              <AdminControlsPanel
                mysteryEnabled={mysteryEnabled}
                noRepeatMode={noRepeatMode}
                onMysteryToggle={setMysteryEnabled}
                onNoRepeatModeChange={setNoRepeatMode}
                onResetSessionHistory={() => setUsedItemIds([])}
                onResetVotes={resetVotes}
                onResetHistory={resetHistory}
                onResetItems={resetItems}
                onResetResult={resetResult}
                onResetAdmin={resetAdmin}
              />
            </div>
          )}
        </main>
      )}
    </div>
  );
}
