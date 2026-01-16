/* eslint-disable @typescript-eslint/no-require-imports */
const http = require("http");
const next = require("next");
const { WebSocketServer } = require("ws");

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
let clientCounter = 0;

function getRoom(req) {
  try {
    const url = new URL(req.url || "", `http://${req.headers.host}`);
    return url.searchParams.get("room") || "default";
  } catch {
    return "default";
  }
}

function getRoomClients(room) {
  if (!rooms.has(room)) {
    rooms.set(room, new Set());
  }
  return rooms.get(room);
}

function broadcast(room, message) {
  const payload = JSON.stringify(message);
  for (const client of getRoomClients(room)) {
    if (client.readyState === client.OPEN) {
      client.send(payload);
    }
  }
}

function getPresence(room) {
  if (!presenceByRoom.has(room)) {
    presenceByRoom.set(room, new Map());
  }
  return presenceByRoom.get(room);
}

function broadcastPresence(room) {
  const presence = getPresence(room);
  const players = Array.from(presence.values()).filter(Boolean);
  broadcast(room, {
    type: "presence",
    payload: { players },
  });
}

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
    ws.room = room;
    ws.clientId = `client-${clientCounter++}`;
    getRoomClients(room).add(ws);
    const roomVotes = roomVotesByRoom.get(room) || {};
    const teamState = teamStateByRoom.get(room) || null;
    const adminClaimed = adminByRoom.has(room);
    const players = Array.from(getPresence(room).values()).filter(Boolean);
    const items = itemsByRoom.get(room) || null;
    const settings = settingsByRoom.get(room) || null;

    ws.send(
      JSON.stringify({
        type: "sync",
        payload: {
          roomVotes,
          teamState,
          adminClaimed,
          players,
          items,
          settings,
          clientId: ws.clientId,
        },
      })
    );

    if (lastSpinByRoom.has(room)) {
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
      } catch {
        return;
      }

      if (message?.type === "spin") {
        lastSpinByRoom.set(room, message);
        broadcast(room, message);
        return;
      }

      if (message?.type === "admin_claim") {
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
        ws.send(
          JSON.stringify({
            type: "admin_result",
            payload: { success: true, message: "Admin claimed." },
          })
        );
        broadcast(room, {
          type: "admin_status",
          payload: { claimed: true },
        });
        return;
      }

      if (message?.type === "presence") {
        const { name } = message.payload || {};
        const presence = getPresence(room);
        if (!name) {
          presence.delete(ws.clientId);
        } else {
          presence.set(ws.clientId, name);
        }
        broadcastPresence(room);
        return;
      }

      if (message?.type === "admin_unlock") {
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
        if (!pin || admin.pin !== pin) {
          ws.send(
            JSON.stringify({
              type: "admin_result",
              payload: { success: false, message: "Incorrect admin code." },
            })
          );
          return;
        }
        ws.send(
          JSON.stringify({
            type: "admin_result",
            payload: { success: true, message: "Admin unlocked." },
          })
        );
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
        const { settings } = message.payload || {};
        if (!settings) return;
        settingsByRoom.set(room, settings);
        broadcast(room, {
          type: "settings_update",
          payload: { settings },
        });
        return;
      }

      if (message?.type === "teams") {
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
            payload: { claimed: false },
          });
        }
        return;
      }

      if (message?.type === "ping") {
        ws.send(JSON.stringify({ type: "pong" }));
      }
    });

    ws.on("close", () => {
      const clients = getRoomClients(room);
      clients.delete(ws);
      const presence = getPresence(room);
      presence.delete(ws.clientId);
      broadcastPresence(room);
      if (clients.size === 0) {
        rooms.delete(room);
        lastSpinByRoom.delete(room);
        roomVotesByRoom.delete(room);
        teamStateByRoom.delete(room);
        adminByRoom.delete(room);
        presenceByRoom.delete(room);
        settingsByRoom.delete(room);
      }
    });
  });

  server.listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
