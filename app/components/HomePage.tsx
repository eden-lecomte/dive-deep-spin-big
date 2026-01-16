"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import HeaderBar from "./HeaderBar";
import WheelSection from "./WheelSection";
import ModesPanel from "./panels/ModesPanel";
import VotingPanel from "./panels/VotingPanel";
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
  const roomParam = searchParams.get("room");
  const room = roomParam ?? "";
  const viewParam = searchParams.get("view") === "1";
  
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
  const [disconnectMessage, setDisconnectMessage] = useState<string | null>(null);
  const [socketReady, setSocketReady] = useState(false);
  const [multipleConnectionsPrompt, setMultipleConnectionsPrompt] = useState<{
    message: string;
  } | null>(null);
  const [victoryWinners, setVictoryWinners] = useState<string[] | null>(null);
  const [toastMessages, setToastMessages] = useState<Array<{ id: string; message: string }>>([]);
  const [reconnectTrigger, setReconnectTrigger] = useState(0);
  const [teamState, setTeamState] = useState<TeamState | null>(null);
  const [teamShuffle, setTeamShuffle] = useState(false);
  const [adminClaimed, setAdminClaimed] = useState(false);
  const [adminName, setAdminName] = useState<string | null>(null);
  const [adminPin, setAdminPin] = useState("");
  const [players, setPlayers] = useState<Array<{ name: string; connected: boolean }>>([]);
  const [playerStats, setPlayerStats] = useLocalStorageState<Record<string, { wins: number; losses: number }>>(
    `wheel:playerStats:${room}`,
    {}
  );
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

  const hiddenLabels = mysteryEnabled && !canEdit;
  const voterNames = useMemo(
    () => Object.keys(roomVotes).filter((name) => name.trim()),
    [roomVotes]
  );
  const teamCandidates = useMemo(
    () => (voterNames.length ? voterNames : players),
    [players, voterNames]
  );

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
      deviceId = `device-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
      localStorage.setItem(STORAGE_KEY, deviceId);
    }
    return deviceId;
  }, []);

  useEffect(() => {
    if (!roomParam) return;
    
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
    }/ws?room=${encodeURIComponent(room)}&deviceId=${encodeURIComponent(deviceId)}`;

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
      if (adminUnlockedRef.current && adminPinSessionRef.current && !manualUnlockAttemptedRef.current) {
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
            setTeamState(teamState);
          }
          if (typeof adminClaimed === "boolean") {
            setAdminClaimed(adminClaimed);
          }
          if (adminName !== undefined) {
            setAdminName(adminName);
          }
          if (Array.isArray(players)) {
            // Handle both old format (strings) and new format (objects with name/connected)
            const normalizedPlayers = players.map(p => 
              typeof p === 'string' ? { name: p, connected: true } : p
            );
            setPlayers(normalizedPlayers);
          }
          if (Array.isArray(items)) {
            lastItemsSourceRef.current = "server";
            setItems(items);
          }
          if (settings) {
            suppressSettingsBroadcastRef.current = true;
            const { mysteryEnabled, votingEnabled, noRepeatMode } = settings;
            if (typeof mysteryEnabled === "boolean") {
              setMysteryEnabled(mysteryEnabled);
            }
            if (typeof votingEnabled === "boolean") {
              setVotingEnabled(votingEnabled);
            }
            if (noRepeatMode) {
              setNoRepeatMode(noRepeatMode);
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
          setTeamState(teamState ?? null);
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
            const pinValue = adminPinRef.current || adminPinSession || adminPin.trim();
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
            const normalizedPlayers = players.map(p => 
              typeof p === 'string' ? { name: p, connected: true } : p
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
            const { mysteryEnabled, votingEnabled, noRepeatMode } = settings;
            if (typeof mysteryEnabled === "boolean") {
              setMysteryEnabled(mysteryEnabled);
            }
            if (typeof votingEnabled === "boolean") {
              setVotingEnabled(votingEnabled);
            }
            if (noRepeatMode) {
              setNoRepeatMode(noRepeatMode);
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
            console.log("[CLIENT] Victory message invalid - winners not array or empty");
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
        setDisconnectMessage("Multiple connections detected. You can't log in as multiple users from the same device.");
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
        setDisconnectMessage("Connection lost. The server may have disconnected or there's a network issue.");
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
      setDisconnectMessage("WebSocket error occurred. Please check your connection.");
    };

    return () => {
      ws.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    room,
    roomParam,
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
      console.log("[CLIENT] Visibility changed:", document.visibilityState, "socketReady:", socketReady);
      // Only reconnect if page becomes visible and WebSocket is not ready
      if (document.visibilityState === "visible" && !socketReady) {
        const ws = wsRef.current;
        const wsState = ws ? ws.readyState : 'null';
        console.log("[CLIENT] WebSocket state:", wsState, "disconnectMessage:", disconnectMessage);
        
        // Check if WebSocket is closed, closing, or null (cleaned up)
        const isDisconnected = !ws || 
          ws.readyState === WebSocket.CLOSED || 
          ws.readyState === WebSocket.CLOSING;
        
        if (isDisconnected) {
          // Check if we have a disconnect message that indicates we shouldn't reconnect
          const shouldReconnect = !disconnectMessage || 
            (!disconnectMessage.includes("kicked") && 
             !disconnectMessage.includes("Multiple connections"));
          
          if (shouldReconnect) {
            console.log("[CLIENT] Page visible, WebSocket disconnected, triggering reconnect...");
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
            setReconnectTrigger(prev => prev + 1);
          } else {
            console.log("[CLIENT] Not reconnecting - user was kicked or has multiple connections");
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

  useEffect(() => {
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

  const saveAsDefault = useCallback(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("wheel:defaultItems", JSON.stringify(items));
      setStatusMessage("Current items saved as default for new rooms.");
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

  const renamePlayer = useCallback(
    (oldName: string, newName: string) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        setStatusMessage("Not connected to server yet.");
        return;
      }
      if (!adminUnlocked) {
        setStatusMessage("You must be unlocked as admin to perform this action.");
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
        setStatusMessage("You must be unlocked as admin to perform this action.");
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
        setStatusMessage("You must be unlocked as admin to perform this action.");
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
      setToastMessages((prev) => [...prev, { id: toastId, message: `Victory awarded to ${playerName}!` }]);
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
        setStatusMessage("You must be unlocked as admin to perform this action.");
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
        setStatusMessage("You must be unlocked as admin to perform this action.");
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
      setToastMessages((prev) => [...prev, { id: toastId, message: `Victory awarded to ${teamNames}!` }]);
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
        setStatusMessage("You must be unlocked as admin to perform this action.");
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
        setStatusMessage("You must be unlocked as admin to perform this action.");
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

  const applyQueryParams = useCallback((params: Record<string, string>) => {
    const url = new URL(window.location.href);
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
    window.history.replaceState({}, "", url.toString());
  }, []);

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

  const [roomInput, setRoomInput] = useState("");
  const [playerNameInput, setPlayerNameInput] = useState(userName || "");

  // Update playerNameInput when userName changes (e.g., when returning to landing screen)
  useEffect(() => {
    setPlayerNameInput(userName || "");
  }, [userName]);

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
    applyQueryParams({ room: code });
  }

  function joinRoom() {
    const name = playerNameInput.trim();
    if (!name) return;
    const code = roomInput.trim();
    if (!code) return;
    // Set name first
    setUserName(name);
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
                    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
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
                    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
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
        adminActive={adminUnlocked}
        adminPopoverOpen={Boolean(adminPopoverContent)}
        adminPopoverContent={adminPopoverContent}
        players={players}
        adminName={adminName}
        onAdminClick={() => setShowAdminAccess((prev) => !prev)}
        onLeaveRoom={leaveRoom}
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
              className="toast-notification"
              style={{ top: `${24 + index * 45}px` }}
            >
              <div className="toast-content">
                <span className="toast-icon">✓</span>
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
                  if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
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
                  if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
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

      <main>
        <div className={`layout ${viewParam ? "view-mode" : ""}`}>
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
            onSpin={() => requestSpin("manual")}
            onResetRotation={() => setRotation(0)}
            onCreateTeams={createTeams}
            onAwardTeamWin={awardTeamWin}
            onAwardTeamLoss={awardTeamLoss}
          />

          {!viewParam && (
            <section className="panel">
              {votingEnabled && (
                <VotingPanel
                  items={items}
                  hiddenLabels={hiddenLabels}
                  votesByItem={votesByItem}
                  voteSummary={voteSummary}
                  userName={userName}
                  roomVotes={effectiveRoomVotes}
                  onUserNameChange={setUserName}
                  onSetVote={setVote}
                />
              )}

              {adminUnlocked && (
                <>
                  <ModesPanel
                    votingEnabled={votingEnabled}
                    mysteryEnabled={mysteryEnabled}
                    noRepeatMode={noRepeatMode}
                    controlsEnabled={adminUnlocked}
                    onVotingToggle={setVotingEnabled}
                    onMysteryToggle={setMysteryEnabled}
                    onNoRepeatModeChange={setNoRepeatMode}
                    onResetSessionHistory={() => setUsedItemIds([])}
                  />
                  <AdminControlsPanel
                    onResetVotes={resetVotes}
                    onResetHistory={resetHistory}
                    onResetItems={resetItems}
                    onResetResult={resetResult}
                    onResetAdmin={resetAdmin}
                  />
                </>
              )}
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
      </main>
    </div>
  );
}
