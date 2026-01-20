/* eslint-disable @typescript-eslint/no-require-imports */
const http = require("http");
const next = require("next");
const { WebSocketServer, WebSocket } = require("ws");

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

const rooms = new Map();
const lastSpinByRoom = new Map();
const roomVotesByRoom = new Map();
const teamStateByRoom = new Map();
const adminByRoom = new Map();
const presenceByRoom = new Map();
const itemsByRoom = new Map();
const settingsByRoom = new Map();
const bulletinBoardByRoom = new Map(); // Store bulletin board content per room
const deviceConnectionsByRoom = new Map(); // Track device IDs per room
const roomLastActivity = new Map(); // Track last activity timestamp for each room
const chatMessagesByRoom = new Map(); // Track chat messages per room (max 200)
const chatRateLimitByUser = new Map(); // Track message timestamps per user for rate limiting
let clientCounter = 0;

function getRoom(req) {
  try {
    const url = new URL(req.url || "", `http://${req.headers.host}`);
    return url.searchParams.get("room") || "default";
  } catch {
    return "default";
  }
}

function getDeviceId(req) {
  try {
    const url = new URL(req.url || "", `http://${req.headers.host}`);
    return url.searchParams.get("deviceId") || null;
  } catch {
    return null;
  }
}

function getDeviceConnections(room) {
  if (!deviceConnectionsByRoom.has(room)) {
    deviceConnectionsByRoom.set(room, new Map());
    // Trigger cleanup when a new room is created
    cleanupStaleRooms();
  }
  return deviceConnectionsByRoom.get(room);
}

function getRoomClients(room) {
  if (!rooms.has(room)) {
    rooms.set(room, new Set());
  }
  return rooms.get(room);
}

function broadcast(room, message) {
  const payload = JSON.stringify(message);
  const roomClients = getRoomClients(room);
  let sentCount = 0;
  const OPEN_STATE = WebSocket.OPEN || 1; // WebSocket.OPEN is 1
  console.log(`[${room}] Broadcasting message type: ${message.type} to ${roomClients.size} clients`);
  for (const client of roomClients) {
    const isOpen = client.readyState === OPEN_STATE;
    console.log(`[${room}] Client ${client.clientId || 'unknown'} - readyState: ${client.readyState}, OPEN_STATE: ${OPEN_STATE}, isOpen: ${isOpen}`);
    if (isOpen) {
      try {
        client.send(payload);
        sentCount++;
        console.log(`[${room}] ✓ Sent message to client ${client.clientId || 'unknown'}`);
      } catch (error) {
        console.error(`[${room}] ✗ Error sending message to client ${client.clientId || 'unknown'}:`, error);
      }
    } else {
      console.log(`[${room}] ✗ Client ${client.clientId || 'unknown'} not ready, state: ${client.readyState}`);
    }
  }
  console.log(`[${room}] Broadcast complete: sent to ${sentCount}/${roomClients.size} clients`);
  return sentCount;
}

function getPresence(room) {
  if (!presenceByRoom.has(room)) {
    presenceByRoom.set(room, new Map());
    // Trigger cleanup when a new room is created
    cleanupStaleRooms();
  }
  return presenceByRoom.get(room);
}

function getChatMessages(room) {
  if (!chatMessagesByRoom.has(room)) {
    chatMessagesByRoom.set(room, []);
  }
  return chatMessagesByRoom.get(room);
}

function checkChatRateLimit(clientId, userName) {
  const key = `${clientId}:${userName}`;
  const now = Date.now();
  const oneSecondAgo = now - 1000;
  
  if (!chatRateLimitByUser.has(key)) {
    chatRateLimitByUser.set(key, []);
  }
  
  const timestamps = chatRateLimitByUser.get(key);
  // Remove timestamps older than 1 second
  const recentTimestamps = timestamps.filter(ts => ts > oneSecondAgo);
  
  if (recentTimestamps.length >= 5) {
    return false; // Rate limit exceeded
  }
  
  // Add current timestamp
  recentTimestamps.push(now);
  chatRateLimitByUser.set(key, recentTimestamps);
  return true; // Allowed
}

// Update room activity timestamp
function updateRoomActivity(room) {
  roomLastActivity.set(room, Date.now());
}

// Clean up stale rooms and clients (older than 24 hours with no activity)
function cleanupStaleRooms() {
  const now = Date.now();
  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
  const roomsToCleanup = [];
  
  // Find rooms that haven't been active in 24+ hours
  for (const [room, lastActivity] of roomLastActivity.entries()) {
    if (now - lastActivity > TWENTY_FOUR_HOURS) {
      // Check if room has any active connections
      const roomClients = rooms.get(room);
      const hasActiveConnections = roomClients && Array.from(roomClients).some(
        (client) => client.readyState === WebSocket.OPEN || client.readyState === WebSocket.CONNECTING
      );
      
      // Only cleanup if no active connections
      if (!hasActiveConnections) {
        roomsToCleanup.push(room);
      }
    }
  }
  
    // Also check rooms that have data but no activity tracking (legacy rooms)
    // These will get activity tracking on their next interaction
    const allRoomsWithData = new Set([
      ...roomVotesByRoom.keys(),
      ...itemsByRoom.keys(),
      ...settingsByRoom.keys(),
      ...adminByRoom.keys(),
      ...teamStateByRoom.keys(),
      ...bulletinBoardByRoom.keys(),
    ]);
  
  for (const room of allRoomsWithData) {
    // Skip if already in cleanup list or has activity tracking
    if (roomsToCleanup.includes(room) || roomLastActivity.has(room)) {
      continue;
    }
    
    // Check if room has any active connections
    const roomClients = rooms.get(room);
    const hasActiveConnections = roomClients && Array.from(roomClients).some(
      (client) => client.readyState === WebSocket.OPEN || client.readyState === WebSocket.CONNECTING
    );
    
    // If room has data but no connections and no activity tracking,
    // it's likely stale - but be conservative and only clean if it's been a while
    // For now, we'll only clean rooms with activity tracking to be safe
  }
  
    // Clean up stale rooms
    for (const room of roomsToCleanup) {
      console.log(`[CLEANUP] Removing stale room: ${room} (inactive for 24+ hours)`);
      
      // Remove all room data
      rooms.delete(room);
      lastSpinByRoom.delete(room);
      roomVotesByRoom.delete(room);
      teamStateByRoom.delete(room);
      adminByRoom.delete(room);
      presenceByRoom.delete(room);
      itemsByRoom.delete(room);
      settingsByRoom.delete(room);
      bulletinBoardByRoom.delete(room);
      deviceConnectionsByRoom.delete(room);
      roomLastActivity.delete(room);
      chatMessagesByRoom.delete(room);
    }
  
  if (roomsToCleanup.length > 0) {
    console.log(`[CLEANUP] Cleaned up ${roomsToCleanup.length} stale room(s)`);
  }
}

function broadcastPresence(room) {
  const presence = getPresence(room);
  const clients = getRoomClients(room);
  const connectedClientIds = new Set(Array.from(clients).map(c => c.clientId));
  
  // Build players array with connection status
  const allPlayers = Array.from(presence.entries())
    .filter(([_, playerData]) => playerData && (typeof playerData === 'string' ? playerData : playerData.name))
    .map(([clientId, playerData]) => {
      const name = typeof playerData === 'string' ? playerData : playerData.name;
      const connected = connectedClientIds.has(clientId);
      return { name, connected, clientId };
    });
  
  // Deduplicate by name - if same name appears multiple times, keep the connected one
  const playersByName = new Map();
  for (const player of allPlayers) {
    const existing = playersByName.get(player.name);
    if (!existing || (player.connected && !existing.connected)) {
      playersByName.set(player.name, { name: player.name, connected: player.connected });
    }
  }
  
  const players = Array.from(playersByName.values());
  
  console.log(`[${room}] Broadcasting presence: ${players.length} players`, players.map(p => `${p.name} (${p.connected ? 'connected' : 'disconnected'})`));
  
  broadcast(room, {
    type: "presence",
    payload: { players },
  });
}

// Set up periodic cleanup of stale rooms (run every hour)
setInterval(() => {
  cleanupStaleRooms();
}, 60 * 60 * 1000); // Run every hour

// Run cleanup immediately on startup
cleanupStaleRooms();

app.prepare().then(() => {
    const server = http.createServer((req, res) => handle(req, res));
  const upgradeHandler =
    typeof app.getUpgradeHandler === "function"
      ? app.getUpgradeHandler()
      : null;

  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    if (!req.url || !req.url.startsWith("/ws")) {
      if (upgradeHandler) {
        upgradeHandler(req, socket, head);
      } else {
        socket.destroy();
      }
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  });

  wss.on("connection", (ws, req) => {
    const room = getRoom(req);
    const deviceId = getDeviceId(req);
    ws.room = room;
    ws.clientId = `client-${clientCounter++}`;
    ws.deviceId = deviceId;
    
    // Update room activity on connection
    updateRoomActivity(room);

    // Check for multiple connections BEFORE fully establishing the connection
    let hasExistingConnection = false;
    let existingConnection = null;
    
    // If device ID is provided, check for existing connections from same device
    if (deviceId) {
      const deviceConnections = getDeviceConnections(room);
      existingConnection = deviceConnections.get(deviceId);
      
      if (existingConnection && existingConnection.readyState === existingConnection.OPEN) {
        hasExistingConnection = true;
        // Don't add to room clients yet - wait for user confirmation
        // Mark this connection as pending confirmation
        ws.pendingMultipleConnection = true;
      } else {
        // No existing connection, proceed normally
        deviceConnections.set(deviceId, ws);
        getRoomClients(room).add(ws);
      }
    } else {
      // No device ID, proceed normally
      getRoomClients(room).add(ws);
    }

    const roomVotes = roomVotesByRoom.get(room) || {};
    const teamState = teamStateByRoom.get(room) || null;
    const adminInfo = adminByRoom.get(room);
    const adminClaimed = !!adminInfo;
    const adminName = adminInfo?.name || null;
    const presence = getPresence(room);
    const clients = getRoomClients(room);
    const connectedClientIds = new Set(Array.from(clients).map(c => c.clientId));
    // Build players array with connection status
    const players = Array.from(presence.entries())
      .filter(([_, playerData]) => playerData && (typeof playerData === 'string' ? playerData : playerData.name))
      .map(([clientId, playerData]) => {
        const name = typeof playerData === 'string' ? playerData : playerData.name;
        const connected = connectedClientIds.has(clientId);
        return { name, connected };
      });
    const items = itemsByRoom.get(room) || null;
    const settings = settingsByRoom.get(room) || null;
    const bulletinBoard = bulletinBoardByRoom.get(room) || null;
    const chatMessages = getChatMessages(room);
    
    // Check if this client should be admin based on admin name matching presence
    // This helps restore admin status on reconnect
    let isClientAdmin = false;
    if (adminInfo && adminName) {
      // We'll check this after presence is established, but we can't do it here
      // because we don't have the client's name yet. We'll handle it in the sync message.
    }

    if (hasExistingConnection) {
      // Send a blocking message that requires user confirmation
      console.log("Sending multiple_connections_prompt to client", ws.clientId);
      ws.send(
        JSON.stringify({
          type: "multiple_connections_prompt",
          payload: {
            message: "Multiple connections detected from this device. Connecting will disconnect your other session. Do you want to continue?",
          },
        })
      );
      // Store connection info for later use (players already in new format with connection status)
      const bulletinBoard = bulletinBoardByRoom.get(room) || null;
      ws.pendingRoomData = {
        roomVotes,
        teamState,
        adminClaimed,
        adminName,
        players, // Already in new format { name, connected }
        items,
        settings,
        bulletinBoard,
        chatMessages: getChatMessages(room),
      };
    } else {
      // Normal connection flow - send sync immediately
      // Check if this client should be recognized as admin (name matches admin name)
      const clientIsAdmin = isClientNameAdmin(ws);
      if (clientIsAdmin && adminInfo) {
        // Client name matches admin, but don't auto-set isAdmin flag yet
        // They'll need to unlock with PIN, but we can indicate they're the admin
        ws.pendingAdminVerification = true;
      }
      
      ws.send(
        JSON.stringify({
          type: "sync",
          payload: {
            roomVotes,
            teamState,
            adminClaimed,
            adminName,
            players,
            items,
            settings,
            bulletinBoard,
            chatMessages,
            clientId: ws.clientId,
            clientIsAdmin: clientIsAdmin, // Indicate if client name matches admin name
          },
        })
      );
    }

    // Only send last spin if connection is not pending (normal flow)
    if (!ws.pendingMultipleConnection && lastSpinByRoom.has(room)) {
      const lastSpin = lastSpinByRoom.get(room);
      ws.send(
        JSON.stringify({
          ...lastSpin,
          payload: { ...lastSpin.payload, replay: true },
        })
      );
    }

    ws.on("message", (data) => {
      let message;
      try {
        message = JSON.parse(data.toString());
        console.log(`[${room}] Received message type:`, message?.type, "from client:", ws.clientId, "isAdmin:", ws.isAdmin);
      } catch {
        console.log(`[${room}] Failed to parse message from client:`, ws.clientId);
        return;
      }

      // Handle multiple connections confirmation
      if (message?.type === "multiple_connections_confirm") {
        const { proceed } = message.payload || {};
        if (proceed && ws.pendingMultipleConnection) {
          // User confirmed - disconnect the old connection and proceed
          const deviceId = ws.deviceId;
          if (deviceId) {
            const deviceConnections = getDeviceConnections(room);
            const existingConnection = deviceConnections.get(deviceId);
            
            if (existingConnection && existingConnection.readyState === existingConnection.OPEN) {
              existingConnection.close(4009, "Multiple connections detected");
              getRoomClients(room).delete(existingConnection);
              const presence = getPresence(room);
              presence.delete(existingConnection.clientId);
              broadcastPresence(room);
            }
            
            deviceConnections.set(deviceId, ws);
          }
          
          // Now add to room and send sync
          getRoomClients(room).add(ws);
          ws.pendingMultipleConnection = false;
          
          const pendingData = ws.pendingRoomData;
          if (pendingData) {
            ws.send(
              JSON.stringify({
                type: "sync",
                payload: {
                  roomVotes: pendingData.roomVotes,
                  teamState: pendingData.teamState,
                  adminClaimed: pendingData.adminClaimed,
                  adminName: pendingData.adminName,
                  players: pendingData.players,
                  items: pendingData.items,
                  settings: pendingData.settings,
                  bulletinBoard: pendingData.bulletinBoard,
                  chatMessages: getChatMessages(room),
                  clientId: ws.clientId,
                },
              })
            );
            
            // Send last spin replay if available
            if (lastSpinByRoom.has(room)) {
              const lastSpin = lastSpinByRoom.get(room);
              ws.send(
                JSON.stringify({
                  ...lastSpin,
                  payload: { ...lastSpin.payload, replay: true },
                })
              );
            }
            
            delete ws.pendingRoomData;
          }
        } else {
          // User cancelled - close this connection
          ws.close(1000, "Connection cancelled by user");
        }
        return;
      }

      // Don't process other messages if connection is pending confirmation
      if (ws.pendingMultipleConnection) {
        return;
      }

      if (message?.type === "spin") {
        updateRoomActivity(room);
        lastSpinByRoom.set(room, message);
        broadcast(room, message);
        return;
      }

      if (message?.type === "victory") {
        updateRoomActivity(room);
        const { winners } = message.payload || {};
        console.log(`[${room}] ===== VICTORY MESSAGE RECEIVED =====`);
        console.log(`[${room}] From client: ${ws.clientId}, isAdmin: ${ws.isAdmin}`);
        console.log(`[${room}] Winners:`, winners);
        if (!ws.isAdmin) {
          console.log(`[${room}] ✗ Victory rejected: not admin`);
          ws.send(
            JSON.stringify({
              type: "victory_result",
              payload: { success: false, message: "Admin required." },
            })
          );
          return;
        }
        if (!Array.isArray(winners) || winners.length === 0) {
          console.log(`[${room}] ✗ Victory rejected: invalid winners`);
          ws.send(
            JSON.stringify({
              type: "victory_result",
              payload: { success: false, message: "Invalid winners." },
            })
          );
          return;
        }
        // Broadcast victory to all clients in the room
        const roomClients = getRoomClients(room);
        console.log(`[${room}] ✓ Victory validated, broadcasting to ${roomClients.size} clients`);
        console.log(`[${room}] Room clients details:`, Array.from(roomClients).map(c => ({ 
          clientId: c.clientId, 
          readyState: c.readyState, 
          isAdmin: c.isAdmin 
        })));
        const victoryMessage = {
          type: "victory",
          payload: { winners },
        };
        const sentCount = broadcast(room, victoryMessage);
        console.log(`[${room}] ===== VICTORY BROADCAST COMPLETE: ${sentCount}/${roomClients.size} =====`);
        return;
      }


      if (message?.type === "presence") {
        const { name } = message.payload || {};
        const presence = getPresence(room);
        if (!name) {
          presence.delete(ws.clientId);
          broadcastPresence(room);
          return;
        }
        
        const nameTrimmed = name.trim();
        const currentName = presence.get(ws.clientId);
        
        // If the name hasn't changed, just update it (allows case changes, trimming, etc.)
        if (currentName && (typeof currentName === 'string' ? currentName.trim() : currentName.name?.trim()) === nameTrimmed) {
          presence.set(ws.clientId, nameTrimmed);
          broadcastPresence(room);
          return;
        }
        
        // Check if the new name is taken by another connected client
        const clients = getRoomClients(room);
        const connectedClientIds = new Set(Array.from(clients).map(c => c.clientId));
        let nameTaken = false;
        for (const [clientId, existingData] of presence.entries()) {
          // Skip checking against the current client
          if (clientId === ws.clientId) continue;
          const existingName = typeof existingData === 'string' ? existingData : existingData?.name;
          // Only check against connected clients (allow disconnected players to be replaced)
          if (existingName && existingName.trim().toLowerCase() === nameTrimmed.toLowerCase() && connectedClientIds.has(clientId)) {
            nameTaken = true;
            break;
          }
        }
        
        if (nameTaken) {
          ws.send(
            JSON.stringify({
              type: "presence_error",
              payload: { message: `Name "${nameTrimmed}" is already taken. Please choose a different name.` },
            })
          );
          // Keep the current name in presence (don't update it)
          return;
        }
        
        // Clean up any old entries with the same name (from previous disconnections)
        for (const [clientId, existingData] of presence.entries()) {
          if (clientId === ws.clientId) continue;
          const existingName = typeof existingData === 'string' ? existingData : existingData?.name;
          if (existingName && existingName.trim().toLowerCase() === nameTrimmed.toLowerCase()) {
            // Remove old entry for this name (player reconnected)
            presence.delete(clientId);
          }
        }
        
        // Name is available, set it
        presence.set(ws.clientId, nameTrimmed);
        broadcastPresence(room);
        
        // After setting name, check if this client should be recognized as admin
        const admin = adminByRoom.get(room);
        if (admin && admin.name && nameTrimmed.toLowerCase() === admin.name.toLowerCase()) {
          // Client name matches admin name - send update to client
          ws.send(
            JSON.stringify({
              type: "admin_status_update",
              payload: {
                clientIsAdmin: true,
                adminName: admin.name,
              },
            })
          );
        }
        return;
      }

      // Helper to check if client is admin
      function isAdmin(ws, providedPin) {
        const admin = adminByRoom.get(room);
        if (!admin) return false;
        // Check if this client has the admin flag set
        if (ws.isAdmin === true) return true;
        // Check if client's name matches admin name (for reconnection scenarios)
        const presence = getPresence(room);
        const clientName = presence.get(ws.clientId);
        const clientNameStr = typeof clientName === 'string' ? clientName : clientName?.name;
        if (clientNameStr && admin.name && clientNameStr.trim().toLowerCase() === admin.name.trim().toLowerCase()) {
          // Name matches admin, but still need PIN verification for security
          // If pin is provided, verify it matches
          if (providedPin && providedPin.trim() && admin.pin === providedPin.trim()) {
            ws.isAdmin = true; // Set it for future checks
            return true;
          }
        }
        // If pin is provided, verify it matches
        if (providedPin && providedPin.trim() && admin.pin === providedPin.trim()) {
          ws.isAdmin = true; // Set it for future checks
          return true;
        }
        return false;
      }
      
      // Helper to check if client name matches admin name (for sync)
      function isClientNameAdmin(ws) {
        const admin = adminByRoom.get(room);
        if (!admin || !admin.name) return false;
        const presence = getPresence(room);
        const clientName = presence.get(ws.clientId);
        const clientNameStr = typeof clientName === 'string' ? clientName : clientName?.name;
        if (!clientNameStr) return false;
        return clientNameStr.trim().toLowerCase() === admin.name.trim().toLowerCase();
      }

      if (message?.type === "admin_unlock") {
        updateRoomActivity(room);
        const { pin } = message.payload || {};
        const admin = adminByRoom.get(room);
        if (!admin) {
          ws.send(
            JSON.stringify({
              type: "admin_result",
              payload: { success: false, message: "No admin claimed yet." },
            })
          );
          return;
        }
        // Verify PIN matches
        if (!pin || admin.pin !== pin.trim()) {
          ws.send(
            JSON.stringify({
              type: "admin_result",
              payload: { success: false, message: "Incorrect admin code." },
            })
          );
          return;
        }
        // Additional check: verify client name matches admin name (for security)
        const presence = getPresence(room);
        const clientName = presence.get(ws.clientId);
        const clientNameStr = typeof clientName === 'string' ? clientName : clientName?.name;
        if (clientNameStr && admin.name && clientNameStr.trim().toLowerCase() !== admin.name.trim().toLowerCase()) {
          ws.send(
            JSON.stringify({
              type: "admin_result",
              payload: { success: false, message: "Name does not match admin name." },
            })
          );
          return;
        }
        // PIN is correct and name matches (or no name set yet), grant admin access
        ws.isAdmin = true;
        delete ws.pendingAdminVerification;
        ws.send(
          JSON.stringify({
            type: "admin_result",
            payload: { success: true, message: "Admin unlocked." },
          })
        );
        return;
      }

      if (message?.type === "admin_claim") {
        updateRoomActivity(room);
        const { name, pin } = message.payload || {};
        if (!name || !/^\d{4}$/.test(pin || "")) {
          ws.send(
            JSON.stringify({
              type: "admin_result",
              payload: {
                success: false,
                message: "Admin code must be 4 digits.",
              },
            })
          );
          return;
        }
        if (adminByRoom.has(room)) {
          ws.send(
            JSON.stringify({
              type: "admin_result",
              payload: { success: false, message: "Admin already claimed." },
            })
          );
          ws.send(
            JSON.stringify({
              type: "admin_status",
              payload: { claimed: true },
            })
          );
          return;
        }
        adminByRoom.set(room, { pin, name });
        ws.isAdmin = true; // Set admin flag when claiming
        ws.send(
          JSON.stringify({
            type: "admin_result",
            payload: { success: true, message: "Admin claimed." },
          })
        );
        const adminInfo = adminByRoom.get(room);
        broadcast(room, {
          type: "admin_status",
          payload: { claimed: true, adminName: adminInfo?.name || null },
        });
        return;
      }

      if (message?.type === "player_rename") {
        const { oldName, newName } = message.payload || {};
        if (!ws.isAdmin) {
          ws.send(
            JSON.stringify({
              type: "player_rename_result",
              payload: { success: false, message: "Admin required." },
            })
          );
          return;
        }
        if (!oldName || !newName || oldName.trim() === newName.trim()) {
          ws.send(
            JSON.stringify({
              type: "player_rename_result",
              payload: { success: false, message: "Invalid names." },
            })
          );
          return;
        }
        const presence = getPresence(room);
        let renamed = false;
        const oldNameTrimmed = oldName.trim();
        const newNameTrimmed = newName.trim();
        // Find clientId by old name and update (compare with trimmed names)
        for (const [clientId, name] of presence.entries()) {
          // Compare both trimmed to handle whitespace differences
          if (name && name.trim() === oldNameTrimmed) {
            presence.set(clientId, newNameTrimmed);
            // Update votes if any
            const roomVotes = roomVotesByRoom.get(room) || {};
            // Check all possible name variations (with/without trim)
            let votesToMove = null;
            let oldKey = null;
            for (const key of Object.keys(roomVotes)) {
              if (key.trim() === oldNameTrimmed) {
                votesToMove = roomVotes[key];
                oldKey = key;
                break;
              }
            }
            if (votesToMove) {
              const newVotes = { ...roomVotes };
              newVotes[newNameTrimmed] = votesToMove;
              delete newVotes[oldKey];
              roomVotesByRoom.set(room, newVotes);
              broadcast(room, {
                type: "roomVotes",
                payload: { roomVotes: newVotes },
              });
            }
            // If this player is the admin, update the admin name
            const adminInfo = adminByRoom.get(room);
            if (adminInfo && adminInfo.name.trim() === oldNameTrimmed) {
              adminInfo.name = newNameTrimmed;
              broadcast(room, {
                type: "admin_status",
                payload: { claimed: true, adminName: newNameTrimmed },
              });
            }
            renamed = true;
            break;
          }
        }
        if (renamed) {
          broadcastPresence(room);
          ws.send(
            JSON.stringify({
              type: "player_rename_result",
              payload: { success: true, message: "Player renamed." },
            })
          );
        } else {
          ws.send(
            JSON.stringify({
              type: "player_rename_result",
              payload: { success: false, message: "Player not found." },
            })
          );
        }
        return;
      }

      if (message?.type === "player_kick") {
        const { playerName } = message.payload || {};
        if (!ws.isAdmin) {
          ws.send(
            JSON.stringify({
              type: "player_kick_result",
              payload: { success: false, message: "Admin required." },
            })
          );
          return;
        }
        if (!playerName) {
          ws.send(
            JSON.stringify({
              type: "player_kick_result",
              payload: { success: false, message: "Player name required." },
            })
          );
          return;
        }
        // Prevent admin from kicking themselves
        const adminInfo = adminByRoom.get(room);
        if (
          adminInfo &&
          playerName.trim().toLowerCase() === adminInfo.name.trim().toLowerCase()
        ) {
          ws.send(
            JSON.stringify({
              type: "player_kick_result",
              payload: {
                success: false,
                message: "Cannot kick yourself.",
              },
            })
          );
          return;
        }
        const presence = getPresence(room);
        let kicked = false;
        let targetClientId = null;
        const playerNameTrimmed = playerName.trim();
        // Find clientId by player name (compare with trimmed names)
        for (const [clientId, name] of presence.entries()) {
          if (name && name.trim() === playerNameTrimmed) {
            targetClientId = clientId;
            break;
          }
        }
        if (targetClientId) {
          // Remove from presence first (before closing to avoid double-delete)
          presence.delete(targetClientId);
          // Remove votes (check all possible name variations)
          const roomVotes = roomVotesByRoom.get(room) || {};
          let votesKey = null;
          for (const key of Object.keys(roomVotes)) {
            if (key.trim() === playerNameTrimmed) {
              votesKey = key;
              break;
            }
          }
          if (votesKey) {
            const newVotes = { ...roomVotes };
            delete newVotes[votesKey];
            roomVotesByRoom.set(room, newVotes);
            broadcast(room, {
              type: "roomVotes",
              payload: { roomVotes: newVotes },
            });
          }
          // Find and close the WebSocket connection
          const clients = getRoomClients(room);
          for (const client of clients) {
            if (client.clientId === targetClientId) {
              // Mark as kicked to prevent onclose handler from re-removing
              client.kicked = true;
              // Use custom close code 4008 to indicate kick (4000-4999 range is reserved for libraries)
              client.close(4008, "Kicked by admin");
              kicked = true;
              break;
            }
          }
        }
        if (kicked) {
          // Broadcast updated presence (the close handler will also do this, but do it here too)
          broadcastPresence(room);
          ws.send(
            JSON.stringify({
              type: "player_kick_result",
              payload: { success: true, message: "Player kicked." },
            })
          );
        } else {
          ws.send(
            JSON.stringify({
              type: "player_kick_result",
              payload: { success: false, message: "Player not found." },
            })
          );
        }
        return;
      }

      if (message?.type === "vote") {
        const { name, itemId, level } = message.payload || {};
        if (!name || !itemId || !level) return;
        const nextVotes = roomVotesByRoom.get(room) || {};
        const userVotes = nextVotes[name] || {};
        const filteredVotes = Object.fromEntries(
          Object.entries(userVotes).filter(([, value]) => value !== level)
        );
        roomVotesByRoom.set(room, {
          ...nextVotes,
          [name]: { ...filteredVotes, [itemId]: level },
        });
        broadcast(room, {
          type: "roomVotes",
          payload: { roomVotes: roomVotesByRoom.get(room) },
        });
        return;
      }

      if (message?.type === "items_update") {
        updateRoomActivity(room);
        const { items, sourceClientId } = message.payload || {};
        if (!Array.isArray(items)) return;
        itemsByRoom.set(room, items);
        broadcast(room, {
          type: "items_update",
          payload: { items, sourceClientId },
        });
        return;
      }

      if (message?.type === "settings_update") {
        updateRoomActivity(room);
        const { settings } = message.payload || {};
        if (!settings) return;
        settingsByRoom.set(room, settings);
        broadcast(room, {
          type: "settings_update",
          payload: { settings },
        });
        return;
      }

      if (message?.type === "check_room_status") {
        const { roomToCheck } = message.payload || {};
        if (!roomToCheck) {
          ws.send(
            JSON.stringify({
              type: "room_status",
              payload: {
                room: roomToCheck || "",
                hasActivePlayers: false,
                activeCount: 0,
              },
            })
          );
          return;
        }
        
        const roomClients = getRoomClients(roomToCheck);
        const OPEN_STATE = WebSocket.OPEN || 1;
        const activeConnections = Array.from(roomClients).filter(
          (client) => client.readyState === OPEN_STATE
        ).length;
        
        ws.send(
          JSON.stringify({
            type: "room_status",
            payload: {
              room: roomToCheck,
              hasActivePlayers: activeConnections > 0,
              activeCount: activeConnections,
            },
          })
        );
        return;
      }

      if (message?.type === "teams") {
        updateRoomActivity(room);
        const { teamState } = message.payload || {};
        if (!teamState) return;
        teamStateByRoom.set(room, teamState);
        broadcast(room, {
          type: "teams",
          payload: { teamState },
        });
        return;
      }

      if (message?.type === "admin_reset") {
        const { target } = message.payload || {};
        if (target === "votes") {
          roomVotesByRoom.delete(room);
          teamStateByRoom.delete(room);
          broadcast(room, {
            type: "roomVotes",
            payload: { roomVotes: {} },
          });
          broadcast(room, {
            type: "teams",
            payload: { teamState: null },
          });
        }
        if (target === "admin") {
          adminByRoom.delete(room);
          broadcast(room, {
            type: "admin_status",
            payload: { claimed: false, adminName: null },
          });
        }
        return;
      }

      if (message?.type === "bulletin_board_update") {
        updateRoomActivity(room);
        const { content } = message.payload || {};
        if (!ws.isAdmin) {
          ws.send(
            JSON.stringify({
              type: "bulletin_board_result",
              payload: { success: false, message: "Admin required." },
            })
          );
          return;
        }
        // Store bulletin board content (can be null/empty to clear it)
        bulletinBoardByRoom.set(room, content || null);
        // Broadcast to all clients in the room
        broadcast(room, {
          type: "bulletin_board_update",
          payload: { content: content || null },
        });
        ws.send(
          JSON.stringify({
            type: "bulletin_board_result",
            payload: { success: true, message: "Bulletin board updated." },
          })
        );
        return;
      }

      if (message?.type === "ping") {
        updateRoomActivity(room);
        ws.send(JSON.stringify({ type: "pong" }));
        return;
      }

      if (message?.type === "chat_message") {
        updateRoomActivity(room);
        
        // Check if chat is enabled for this room (default to true if not set)
        const settings = settingsByRoom.get(room);
        if (settings && settings.chatEnabled === false) {
          ws.send(
            JSON.stringify({
              type: "chat_error",
              payload: { message: "Chat is disabled for this room" },
            })
          );
          return;
        }
        
        const { text, userName } = message.payload || {};
        if (!text || !userName || typeof text !== "string" || typeof userName !== "string") {
          ws.send(
            JSON.stringify({
              type: "chat_error",
              payload: { message: "Invalid message format" },
            })
          );
          return;
        }

        // Trim and validate message
        const trimmedText = text.trim();
        if (trimmedText.length === 0 || trimmedText.length > 500) {
          ws.send(
            JSON.stringify({
              type: "chat_error",
              payload: { message: "Message must be between 1 and 500 characters" },
            })
          );
          return;
        }

        // Check rate limit
        if (!checkChatRateLimit(ws.clientId, userName)) {
          ws.send(
            JSON.stringify({
              type: "chat_error",
              payload: { message: "Rate limit exceeded. Maximum 5 messages per second." },
            })
          );
          return;
        }

        // Get player name from presence to ensure it matches
        const presence = getPresence(room);
        const playerData = presence.get(ws.clientId);
        const playerName = typeof playerData === "string" ? playerData : playerData?.name;
        
        if (!playerName) {
          ws.send(
            JSON.stringify({
              type: "chat_error",
              payload: { message: "You must set your name before sending messages" },
            })
          );
          return;
        }

        // Create chat message using server-authoritative playerName
        const chatMessage = {
          id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          userName: playerName,
          text: trimmedText,
          timestamp: Date.now(),
        };

        // Add to messages array and enforce max limit
        const messages = getChatMessages(room);
        messages.push(chatMessage);
        
        // Keep only last 200 messages
        if (messages.length > 200) {
          messages.shift();
        }

        // Broadcast to all clients in room
        broadcast(room, {
          type: "chat_message",
          payload: chatMessage,
        });
        return;
      }
    });

    ws.on("close", () => {
      const clients = getRoomClients(room);
      const presence = getPresence(room);
      const playerName = presence.get(ws.clientId);
      console.log(`[${room}] Client ${ws.clientId} disconnected. Player name: ${playerName}, Kicked: ${ws.kicked}`);
      console.log(`[${room}] Presence before disconnect:`, Array.from(presence.entries()).map(([id, name]) => ({ clientId: id, name })));
      
      clients.delete(ws);
      
      // Don't delete from presence on disconnect - keep them but mark as disconnected
      // Only delete if kicked
      if (ws.kicked) {
        console.log(`[${room}] Player ${playerName} was kicked, removing from presence`);
        presence.delete(ws.clientId);
      } else {
        console.log(`[${room}] Player ${playerName} disconnected (not kicked), keeping in presence`);
      }
      
      // Always broadcast presence update to reflect connection status change
      console.log(`[${room}] Presence after disconnect:`, Array.from(presence.entries()).map(([id, name]) => ({ clientId: id, name })));
      broadcastPresence(room);
      // Clean up device connection tracking
      if (ws.deviceId) {
        const deviceConnections = getDeviceConnections(room);
        // Only remove if this is still the tracked connection
        if (deviceConnections.get(ws.deviceId) === ws) {
          deviceConnections.delete(ws.deviceId);
        }
      }
      // Don't delete presence when all clients disconnect - keep players in the list
      // Only clean up other room data if truly empty
      // Note: Stale room cleanup will handle rooms that are inactive for 24+ hours
      if (clients.size === 0) {
        // Don't immediately delete room data - let cleanup handle stale rooms
        // This allows rooms to persist for a while in case users reconnect
      }
    });
  });

  server.listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
