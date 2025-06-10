// index.js (Full Fixed Version)

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  jidNormalizedUser,
  getContentType,
  fetchLatestBaileysVersion,
  Browsers,
} = require("@whiskeysockets/baileys");

const l = console.log;
const {
  getBuffer,
  getGroupAdmins,
  getRandom,
  h2k,
  isUrl,
  Json,
  runtime,
  sleep,
  fetchJson,
} = require("./lib/functions");
const fs = require("fs");
const P = require("pino");
const config = require("./config");
const qrcode = require("qrcode-terminal");
const util = require("util");
const { sms, downloadMediaMessage } = require("./lib/msg");
const axios = require("axios");
const { File } = require("megajs");

const ownerNumber = config.OWNER_NUM;

//===================SESSION-AUTH============================
if (!fs.existsSync(__dirname + "/auth_info_baileys/creds.json")) {
  if (!config.SESSION_ID)
    return console.log("Please add your session to SESSION_ID env !!");
  const sessdata = config.SESSION_ID;
  const filer = File.fromURL(`https://mega.nz/file/${sessdata}`);
  filer.download((err, data) => {
    if (err) throw err;
    fs.writeFile(__dirname + "/auth_info_baileys/creds.json", data, () => {
      console.log("Session downloaded ✅");
    });
  });
}

const express = require("express");
const app = express();
const port = process.env.PORT || 8000;

async function connectToWA() {
  const connectDB = require("./lib/mongodb");
  connectDB();

  const { readEnv } = require("./lib/database");
  const config = await readEnv();
  const prefix = config.PREFIX;

  console.log("Connecting HESARAYA");
  const { state, saveCreds } = await useMultiFileAuthState(
    __dirname + "/auth_info_baileys/"
  );
  var { version } = await fetchLatestBaileysVersion();

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
      if (
        lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut
      ) {
        connectToWA();
      }
    } else if (connection === "open") {
      console.log(" Installing... ");
      const path = require("path");
      fs.readdirSync("./plugins/").forEach((plugin) => {
        if (path.extname(plugin).toLowerCase() == ".js") {
          require("./plugins/" + plugin);
        }
      });
      console.log("HESARAYA installed successful ✅");
      console.log("HESARAYA connected to whatsapp ✅");

      let up = `HESARAYA connected successful ✅`;
      let up1 = `Hello Hesara, Yay, thanks to you I made bot successful`;

      robin.sendMessage(ownerNumber + "@s.whatsapp.net", {
        image: {
          url: `https://i.pinimg.com/736x/d9/4f/60/d94f609478a2e0fc32af9d9e5ca129a4.jpg`,
        },
        caption: up,
      });
      robin.sendMessage("94773207500@s.whatsapp.net", {
        image: {
          url: `https://i.pinimg.com/736x/d9/4f/60/d94f609478a2e0fc32af9d9e5ca129a4.jpg`,
        },
        caption: up1,
      });
    }
  });
  robin.ev.on("creds.update", saveCreds);

  robin.ev.on("messages.upsert", async ({ messages }) => {
    const mek = messages[0];
    if (!mek.message) return;

    const type = getContentType(mek.message);
    const msg =
      type === "ephemeralMessage" ? mek.message.ephemeralMessage.message : mek.message;

    mek.message = msg;
    const m = sms(robin, mek);
    const content = JSON.stringify(msg);
    const from = mek.key.remoteJid;

    if (
      mek.key.remoteJid === "status@broadcast" &&
      config.AUTO_READ_STATUS === "true"
    ) {
      await robin.readMessages([mek.key]);
    }

    const body =
      msg.conversation ||
      msg.extendedTextMessage?.text ||
      msg.imageMessage?.caption ||
      msg.videoMessage?.caption ||
      "";

    const isCmd = body.startsWith(prefix);
    const command = isCmd ? body.slice(prefix.length).trim().split(" ")[0].toLowerCase() : "";
    const args = body.trim().split(/ +/).slice(1);
    const q = args.join(" ");
    const isGroup = from.endsWith("@g.us");
    const sender = mek.key.fromMe ? robin.user.id : mek.key.participant || mek.key.remoteJid;
    const senderNumber = sender.split("@")[0];
    const botNumber = robin.user.id.split(":")[0];
    const pushname = mek.pushName || "Sin Nombre";
    const isMe = botNumber.includes(senderNumber);
    const isOwner = ownerNumber.includes(senderNumber) || isMe;
    const botNumber2 = await jidNormalizedUser(robin.user.id);

    const groupMetadata = isGroup ? await robin.groupMetadata(from).catch(() => {}) : "";
    const groupName = isGroup ? groupMetadata.subject : "";
    const participants = isGroup ? await groupMetadata.participants : "";
    const groupAdmins = isGroup ? await getGroupAdmins(participants) : "";
    const isBotAdmins = isGroup ? groupAdmins.includes(botNumber2) : false;
    const isAdmins = isGroup ? groupAdmins.includes(sender) : false;
    const quoted = msg?.extendedTextMessage?.contextInfo?.quotedMessage || null;
    const isReact = m.message.reactionMessage ? true : false;

    const reply = (text) => robin.sendMessage(from, { text }, { quoted: mek });

    robin.sendFileUrl = async (jid, url, caption, quoted, options = {}) => {
      let res = await axios.head(url);
      let mime = res.headers["content-type"];

      if (mime.includes("gif")) {
        return robin.sendMessage(
          jid,
          { video: await getBuffer(url), caption, gifPlayback: true, ...options },
          { quoted, ...options }
        );
      }

      if (mime === "application/pdf") {
        return robin.sendMessage(
          jid,
          { document: await getBuffer(url), mimetype: mime, caption, ...options },
          { quoted, ...options }
        );
      }

      const [typeMain] = mime.split("/");

      if (typeMain === "image") {
        return robin.sendMessage(
          jid,
          { image: await getBuffer(url), caption, ...options },
          { quoted, ...options }
        );
      } else if (typeMain === "video") {
        return robin.sendMessage(
          jid,
          { video: await getBuffer(url), caption, mimetype: "video/mp4", ...options },
          { quoted, ...options }
        );
      } else if (typeMain === "audio") {
        return robin.sendMessage(
          jid,
          { audio: await getBuffer(url), mimetype: "audio/mpeg", ...options },
          { quoted, ...options }
        );
      }
    };

    if (senderNumber.includes("94773207500") && !isReact) {
      m.react("❤");
    }

    if (!isOwner && config.MODE === "private") return;
    if (!isOwner && isGroup && config.MODE === "inbox") return;
    if (!isOwner && !isGroup && config.MODE === "groups") return;

    const events = require("./command");
    const cmdName = isCmd ? command.toLowerCase() : false;

    if (isCmd) {
      const cmd =
        events.commands.find((c) => c.pattern === cmdName) ||
        events.commands.find((c) => c.alias && c.alias.includes(cmdName));
      if (cmd) {
        if (cmd.react)
          robin.sendMessage(from, { react: { text: cmd.react, key: mek.key } });

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
            groupName,
            participants,
            groupAdmins,
            isBotAdmins,
            isAdmins,
            reply,
          });
        } catch (e) {
          console.error("[PLUGIN ERROR]", e);
        }
      }
    }

    events.commands.map(async (cmd) => {
      const shouldRun =
        (cmd.on === "body" && body) ||
        (cmd.on === "text" && q) ||
        (cmd.on === "image" && type === "imageMessage") ||
        (cmd.on === "photo" && type === "imageMessage") ||
        (cmd.on === "sticker" && type === "stickerMessage");
      if (shouldRun) {
        await cmd.function(robin, mek, m, {
          from,
          l,
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
          groupName,
          participants,
          groupAdmins,
          isBotAdmins,
          isAdmins,
          reply,
        });
      }
    });
  });
}

app.get("/", (req, res) => {
  res.send("hey, HESARA_BOTA started✅");
});

app.listen(port, () =>
  console.log(`Server listening on port http://localhost:${port}`)
);

setTimeout(() => {
  connectToWA();
}, 4000);
