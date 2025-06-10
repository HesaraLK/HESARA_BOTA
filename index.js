// index.js (Cleaned & Fixed Version)

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  jidNormalizedUser,
  getContentType,
  fetchLatestBaileysVersion,
  Browsers,
} = require("@whiskeysockets/baileys");

const fs = require("fs");
const path = require("path");
const P = require("pino");
const qrcode = require("qrcode-terminal");
const axios = require("axios");
const { File } = require("megajs");

const {
  getBuffer,
  getGroupAdmins,
  sms,
} = require("./lib/functions");

const config = require("./config");
const ownerNumber = config.OWNER_NUM;

// ============ SESSION AUTH SETUP ============
if (!fs.existsSync(__dirname + "/auth_info_baileys/creds.json")) {
  if (!config.SESSION_ID) {
    console.log("❌ SESSION_ID is missing in config!");
    process.exit(1);
  }

  const sessdata = config.SESSION_ID;
  const filer = File.fromURL(`https://mega.nz/file/${sessdata}`);
  filer.download((err, data) => {
    if (err) throw err;
    fs.writeFileSync(__dirname + "/auth_info_baileys/creds.json", data);
    console.log("✅ Session downloaded from MEGA");
  });
}

const express = require("express");
const app = express();
const port = process.env.PORT || 8000;

async function connectToWA() {
  const connectDB = require("./lib/mongodb");
  connectDB();

  const { readEnv } = require("./lib/database");
  const envConfig = await readEnv();
  const prefix = envConfig.PREFIX;

  console.log("🔄 Connecting to WhatsApp...");

  const { state, saveCreds } = await useMultiFileAuthState(
    __dirname + "/auth_info_baileys/"
  );
  const { version } = await fetchLatestBaileysVersion();

  const robin = makeWASocket({
    logger: P({ level: "silent" }),
    printQRInTerminal: false,
    browser: Browsers.macOS("Firefox"),
    syncFullHistory: true,
    auth: state,
    version,
  });

  robin.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "close") {
      const code = lastDisconnect?.error?.output?.statusCode;
      if (code !== DisconnectReason.loggedOut) {
        console.log("⚠️ Reconnecting...");
        connectToWA();
      } else {
        console.log("❌ Logged out from WhatsApp");
      }
    } else if (connection === "open") {
      console.log("✅ HESARA_BOTA connected to WhatsApp");

      // Load plugins
      try {
        const pluginDir = path.join(__dirname, "plugins");
        fs.readdirSync(pluginDir).forEach((file) => {
          if (file.endsWith(".js")) {
            require(`./plugins/${file}`);
          }
        });
        console.log("✅ Plugins loaded");
      } catch (e) {
        console.error("❌ Failed to load plugins:", e);
      }

      // Notify bot owner
      const imageURL = `https://i.pinimg.com/736x/d9/4f/60/d94f609478a2e0fc32af9d9e5ca129a4.jpg`;
      robin.sendMessage(ownerNumber + "@s.whatsapp.net", {
        image: { url: imageURL },
        caption: "HESARAYA connected successful ✅",
      });

      robin.sendMessage("94773207500@s.whatsapp.net", {
        image: { url: imageURL },
        caption: "Hello Hesara, Yay, thanks to you I made bot successful",
      });
    }
  });

  robin.ev.on("creds.update", saveCreds);

  robin.ev.on("messages.upsert", async ({ messages }) => {
    const mek = messages[0];
    if (!mek.message) return;

    const type = getContentType(mek.message);
    const msg =
      type === "ephemeralMessage"
        ? mek.message.ephemeralMessage.message
        : mek.message;

    mek.message = msg;
    const m = sms(robin, mek);

    const from = mek.key.remoteJid;
    const body =
      msg.conversation ||
      msg.extendedTextMessage?.text ||
      msg.imageMessage?.caption ||
      msg.videoMessage?.caption ||
      "";

    const isCmd = body.startsWith(prefix);
    const command = isCmd ? body.slice(prefix.length).split(" ")[0].toLowerCase() : "";
    const args = body.trim().split(/\s+/).slice(1);
    const q = args.join(" ");
    const isGroup = from.endsWith("@g.us");
    const sender = mek.key.fromMe ? robin.user.id : mek.key.participant || mek.key.remoteJid;
    const senderNumber = sender.split("@")[0];
    const botNumber = robin.user.id.split(":")[0];
    const pushname = mek.pushName || "User";
    const isMe = botNumber.includes(senderNumber);
    const isOwner = ownerNumber.includes(senderNumber) || isMe;
    const botNumber2 = await jidNormalizedUser(robin.user.id);

    const groupMetadata = isGroup ? await robin.groupMetadata(from).catch(() => {}) : {};
    const participants = groupMetadata?.participants || [];
    const groupAdmins = isGroup ? getGroupAdmins(participants) : [];
    const isBotAdmins = isGroup ? groupAdmins.includes(botNumber2) : false;
    const isAdmins = isGroup ? groupAdmins.includes(sender) : false;
    const quoted = msg?.extendedTextMessage?.contextInfo?.quotedMessage || null;

    const reply = (text) => robin.sendMessage(from, { text }, { quoted: mek });

    robin.sendFileUrl = async (jid, url, caption, quoted, options = {}) => {
      try {
        let res = await axios.head(url);
        let mime = res.headers["content-type"];
        let buffer = await getBuffer(url);

        if (mime.includes("gif")) {
          return robin.sendMessage(jid, { video: buffer, gifPlayback: true, caption, ...options }, { quoted });
        }

        if (mime === "application/pdf") {
          return robin.sendMessage(jid, { document: buffer, mimetype: mime, caption, ...options }, { quoted });
        }

        const [typeMain] = mime.split("/");
        const messageType = {
          image: "image",
          video: "video",
          audio: "audio",
        }[typeMain];

        if (messageType) {
          return robin.sendMessage(jid, { [messageType]: buffer, caption, ...options }, { quoted });
        }
      } catch (e) {
        console.error("❌ sendFileUrl error:", e);
      }
    };

    // ❤️ Auto-reaction
    if (senderNumber === "94773207500") {
      m.react("❤️");
    }

    // 🧠 Mode checks
    if (!isOwner && config.MODE === "private") return;
    if (!isOwner && isGroup && config.MODE === "inbox") return;
    if (!isOwner && !isGroup && config.MODE === "groups") return;

    const events = require("./command");
    const cmdName = isCmd ? command.toLowerCase() : false;

    // Run matching command
    if (isCmd) {
      const cmd =
        events.commands.find((c) => c.pattern === cmdName) ||
        events.commands.find((c) => c.alias?.includes(cmdName));
      if (cmd) {
        try {
          if (cmd.react)
            robin.sendMessage(from, { react: { text: cmd.react, key: mek.key } });

          await cmd.function(robin, mek, m, {
            from,
            quoted,
            body,
            isCmd,
            command,
            args,
            q,
            isGroup,
            sender,
            senderNumber,
            botNumber2,
            botNumber,
            pushname,
            isMe,
            isOwner,
            groupMetadata,
            participants,
            groupAdmins,
            isBotAdmins,
            isAdmins,
            reply,
          });
        } catch (e) {
          console.error("❌ Plugin error:", e);
        }
      }
    }

    // Event-based listeners
    for (let cmd of events.commands) {
      const matchesType =
        (cmd.on === "body" && body) ||
        (cmd.on === "text" && q) ||
        (cmd.on === "image" && type === "imageMessage") ||
        (cmd.on === "photo" && type === "imageMessage") ||
        (cmd.on === "sticker" && type === "stickerMessage");

      if (matchesType) {
        try {
          await cmd.function(robin, mek, m, {
            from,
            quoted,
            body,
            isCmd,
            command,
            args,
            q,
            isGroup,
            sender,
            senderNumber,
            botNumber2,
            botNumber,
            pushname,
            isMe,
            isOwner,
            groupMetadata,
            participants,
            groupAdmins,
            isBotAdmins,
            isAdmins,
            reply,
          });
        } catch (e) {
          console.error("❌ Event handler error:", e);
        }
      }
    }
  });
}

// Express HTTP healthcheck
app.get("/", (req, res) => {
  res.send("🟢 HESARA_BOTA is running!");
});

// Start server
app.listen(port, () =>
  console.log(`🌐 Web server running: http://localhost:${port}`)
);

// Start bot after slight delay
setTimeout(connectToWA, 4000);
