"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import HeaderBar from "./HeaderBar";
import WheelSection from "./WheelSection";
import ModesPanel from "./panels/ModesPanel";
import HelpPanel from "./panels/HelpPanel";
import VotingPanel from "./panels/VotingPanel";
import EditPanel from "./panels/EditPanel";
import AdminAccessPanel from "./panels/AdminAccessPanel";
import AdminControlsPanel from "./panels/AdminControlsPanel";
import PlayersPanel from "./panels/PlayersPanel";
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
  const [items, setItems] = useLocalStorageState<WheelItem[]>(
    `wheel:items:${room}`,
    DEFAULT_ITEMS
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
  const [socketReady, setSocketReady] = useState(false);
  const [teamState, setTeamState] = useState<TeamState | null>(null);
  const [teamShuffle, setTeamShuffle] = useState(false);
  const [adminClaimed, setAdminClaimed] = useState(false);
  const [adminPin, setAdminPin] = useState("");
  const [players, setPlayers] = useState<string[]>([]);
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

  useEffect(() => {
    if (!roomParam) return;
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const wsUrl = `${protocol}://${
      window.location.host
    }/ws?room=${encodeURIComponent(room)}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setSocketReady(true);
      if (pendingSpinRef.current) {
        pendingSpinRef.current = false;
      }
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
          if (Array.isArray(players)) {
            setPlayers(players);
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
          const { claimed } = message.payload || {};
          if (typeof claimed === "boolean") {
            setAdminClaimed(claimed);
          }
        }
        if (message?.type === "admin_result") {
          const { success, message: resultMessage } = message.payload || {};
          if (success) {
            setAdminUnlocked(true);
            setAdminClaimed(true);
            const pinValue = adminPin.trim();
            adminPinRef.current = pinValue;
            setAdminPinSession(pinValue);
            setShowAdminAccess(false);
          }
          if (resultMessage) {
            setStatusMessage(resultMessage);
          }
        }
        if (message?.type === "presence") {
          const { players } = message.payload || {};
          if (Array.isArray(players)) {
            setPlayers(players);
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
      } catch {
        return;
      }
    };

    ws.onclose = () => {
      setSocketReady(false);
    };

    ws.onerror = () => {
      setSocketReady(false);
    };

    return () => {
      ws.close();
    };
  }, [
    adminPin,
    requestSpin,
    room,
    roomParam,
    setAdminUnlocked,
    setItems,
    setMysteryEnabled,
    setNoRepeatMode,
    setRoomVotes,
    setTeamState,
    setAdminPinSession,
    setVotingEnabled,
    spinToItem,
  ]);

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

  function createRoomCode() {
    const code = Math.random().toString(36).slice(2, 8).toUpperCase();
    applyQueryParams({ room: code });
  }

  function joinRoom() {
    const code = roomInput.trim();
    if (!code) return;
    applyQueryParams({ room: code });
  }

  if (!roomParam) {
    return (
      <div className="page room-gate">
        <div className="room-card">
          <h1>Join a room</h1>
          <p className="subtle">
            Enter a room code to join, or create a new one.
          </p>
          <div className="room-actions">
            <input
              type="text"
              value={roomInput}
              onChange={(event) => setRoomInput(event.target.value)}
              placeholder="Room code"
            />
            <button className="primary" onClick={joinRoom}>
              Join room
            </button>
          </div>
          <button className="ghost" onClick={createRoomCode}>
            Create new room
          </button>
        </div>
      </div>
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
        onAdminClick={() => setShowAdminAccess((prev) => !prev)}
      />

      <main className={`layout ${viewParam ? "view-mode" : ""}`}>
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
          onSpin={() => requestSpin("manual")}
          onResetRotation={() => setRotation(0)}
          onCreateTeams={createTeams}
        />

        {!viewParam && (
          <section className="panel">
            {adminUnlocked && (
              <HelpPanel onApplyQueryParams={applyQueryParams} />
            )}

            <PlayersPanel players={players} />

            {votingEnabled && (
              <VotingPanel
                items={items}
                hiddenLabels={hiddenLabels}
                votesByItem={votesByItem}
                voteSummary={voteSummary}
                userName={userName}
                onUserNameChange={setUserName}
                onSetVote={setVote}
              />
            )}

            {adminUnlocked && (
              <EditPanel
                editLocked={editLocked}
                canEdit={canEdit}
                items={items}
                draftItem={draftItem}
                onUpdateItem={updateItem}
                onRemoveItem={removeItem}
                onDraftChange={setDraftItem}
                onDraftSubmit={handleDraftSubmit}
              />
            )}

            {!adminUnlocked && !adminClaimed && (
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
      </main>
    </div>
  );
}
