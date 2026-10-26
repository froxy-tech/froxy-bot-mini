// 🦊 FROXY BOT MINI V3 — starter bot for a Node.js host
// FXT Solutions | WhatsApp automation using Baileys
// Note: WhatsApp pairing links a WhatsApp account to THIS bot session.
// It cannot safely/legitimately pair arbitrary other people's numbers from a command.

import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  makeCacheableSignalKeyStore
} from "@whiskeysockets/baileys";
import P from "pino";
import fs from "node:fs";
import path from "node:path";
import qrcode from "qrcode-terminal";

const PREFIX = process.env.PREFIX || ".";
// Set PAIRING_NUMBER to the WhatsApp number you own, digits only with country code.
const PAIRING_NUMBER = (process.env.PAIRING_NUMBER || "").replace(/[^0-9]/g, "");
const GROUP_LINK = "https://chat.whatsapp.com/GcVgHuHQIe3AYr0FP0EeyP?s=cl&p=a&mlu=4&ilr=4";
const ROOT = process.cwd();
const AUTH_DIR = path.join(ROOT, "session_froxy_mini");
const OWNERS_FILE = path.join(ROOT, "owners.json");
const SETTINGS_FILE = path.join(ROOT, "settings.json");

function ensureJson(file, fallback) {
  if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify(fallback, null, 2));
}
ensureJson(OWNERS_FILE, []);
ensureJson(SETTINGS_FILE, {});

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); }
  catch { return fallback; }
}
let owners = readJson(OWNERS_FILE, []);
let settings = readJson(SETTINGS_FILE, {});

function saveJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}
function saveSettings() { saveJson(SETTINGS_FILE, settings); }
function normalizeJid(jid = "") {
  return jid.replace(/:\d+@/, "@");
}
function numberFromJid(jid = "") {
  return normalizeJid(jid).split("@")[0];
}
function isOwner(jid) {
  return owners.includes(numberFromJid(jid));
}

// Every bot text reply uses this classic FROXY header and support link.
function FROXY(text, { includeGroupLink = true } = {}) {
  const lines = String(text).split("\n");
  const body = lines.map(line => `┃ ${line}`).join("\n");
  return [
    "╭━━━〘 🦊 𝗙𝗥𝗢𝗫𝗬 𝗕𝗢𝗧 〙━━━╮",
    body,
    "╰━━━━━━━━━━━━━━━━━━━━━━━━╯",
    "• FXT Solutions • 💜🖤",
    ...(includeGroupLink ? [`🔗 Froxy Family: ${GROUP_LINK}`] : [])
  ].join("\n");
}

function connectedMsg() {
  return FROXY(`✨ BOT SUCCESSFULLY CONNECTED ✨

🟢 Status: Online
⚡ Version: Mini V3
🛡️ Session: Connected

Quick start:
• .help — show commands
• .alive — check status
• .pair — pairing help
• .group — Froxy support group

FXT Solutions © 2026
Excellence • Trust • Speed 💜`);
}

function menuText(ownerUser) {
  return FROXY(`📜 FROXY MINI V3 MENU

🤖 GENERAL COMMANDS — EVERYONE
• .help / .menu — command list
• .alive / .ping — bot status
• .group / .support — support link
• .froxy <question> — basic assistant response
• .pair — how to connect a bot session

👥 GROUP COMMANDS
• .groupinfo — group details
• .link — current group's invite link
• .tagall <message> — mention group members
• .hidetag <message> — mention members without listing names
• .welcome on/off — toggle welcome messages
• .goodbye on/off — toggle goodbye messages
• .antilink on/off — toggle basic invite-link filter
• .open / .close — change who can send messages
• .kick @user — remove a member (group admin only)
• .promote @user / .demote @user — group admin only

${ownerUser ? "👑 OWNER: You are listed in owners.json." : "ℹ️ Owner-only configuration is managed by the bot owner."}

⚠️ Group moderation actions require the sender and bot to have suitable admin permissions.`);
}

function getBody(message) {
  const m = message?.message;
  if (!m) return "";
  return m.conversation
    || m.extendedTextMessage?.text
    || m.imageMessage?.caption
    || m.videoMessage?.caption
    || m.documentMessage?.caption
    || "";
}

async function isGroupAdmin(sock, groupJid, participantJid) {
  const meta = await sock.groupMetadata(groupJid);
  const target = normalizeJid(participantJid);
  const participant = meta.participants.find(p => normalizeJid(p.id) === target);
  return Boolean(participant?.admin === "admin" || participant?.admin === "superadmin");
}
async function botIsGroupAdmin(sock, groupJid) {
  return isGroupAdmin(sock, groupJid, sock.user.id);
}
function mentionedJids(message) {
  return message?.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
}
function ensureGroupSettings(jid) {
  if (!settings[jid]) {
    settings[jid] = { welcome: false, goodbye: false, antilink: false };
    saveSettings();
  }
  return settings[jid];
}

let reconnecting = false;
async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const sock = makeWASocket({
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, P({ level: "silent" }))
    },
    logger: P({ level: "silent" }),
    browser: ["Froxy Mini", "Chrome", "3.0.0"],
    printQRInTerminal: false
  });

  sock.ev.on("creds.update", saveCreds);

  // Request a pairing code only for the owner's configured account on a fresh session.
  // It is printed to private hosting logs because it is a login credential.
  if (!state.creds.registered && PAIRING_NUMBER) {
    setTimeout(async () => {
      try {
        const pairingCode = await sock.requestPairingCode(PAIRING_NUMBER);
        console.log("\\n========================================");
        console.log("FROXY WHATSAPP PAIRING CODE (PRIVATE)");
        console.log("Number:", PAIRING_NUMBER);
        console.log("Code:", pairingCode);
        console.log("Enter it in WhatsApp > Linked devices > Link with phone number.");
        console.log("Do not share this code with anyone.");
        console.log("========================================\\n");
      } catch (err) {
        console.error("Could not request pairing code. Check PAIRING_NUMBER and host/library support:", err?.message || err);
      }
    }, 3000);
  }

  sock.ev.on("connection.update", async ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      console.log("Scan this QR with WhatsApp > Linked devices:");
      qrcode.generate(qr, { small: true });
    }
    if (connection === "open") {
      reconnecting = false;
      console.log("🟢 FROXY BOT MINI V3 connected.");
      try {
        // Send confirmation to the bot account's own chat.
        await sock.sendMessage(sock.user.id, { text: connectedMsg() });
      } catch (err) {
        console.error("Could not send connection confirmation:", err?.message || err);
      }
    }
    if (connection === "close") {
      const code = lastDisconnect?.error?.output?.statusCode;
      if (code === DisconnectReason.loggedOut) {
        console.error("WhatsApp session logged out. Remove the session folder and reconnect.");
        return;
      }
      if (!reconnecting) {
        reconnecting = true;
        setTimeout(() => startBot().catch(err => {
          reconnecting = false;
          console.error("Reconnect failed:", err);
        }), 3000);
      }
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    for (const m of messages) {
      try {
        if (!m.message || m.key.fromMe) continue;
        const chat = m.key.remoteJid;
        if (!chat || chat === "status@broadcast" || chat.endsWith("@broadcast")) continue;

        const sender = m.key.participant || chat;
        const group = chat.endsWith("@g.us");
        const body = getBody(m).trim();
        if (!body) continue;

        if (group) {
          const gs = ensureGroupSettings(chat);
          const hasInviteLink = /chat\.whatsapp\.com\/[A-Za-z0-9]+/i.test(body);
          if (gs.antilink && hasInviteLink && !isOwner(sender)) {
            try {
              await sock.sendMessage(chat, {
                text: FROXY(`🚫 WhatsApp invite link detected. Please follow this group's rules.`),
                quoted: m
              });
            } catch {}
            continue;
          }
        }

        if (!body.startsWith(PREFIX)) continue;
        const parts = body.slice(PREFIX.length).trim().split(/\s+/);
        const cmd = (parts.shift() || "").toLowerCase();
        const q = parts.join(" ");
        const ownerUser = isOwner(sender);
        const reply = async text => sock.sendMessage(chat, { text: FROXY(text), quoted: m });

        if (["help", "menu"].includes(cmd)) {
          await sock.sendMessage(chat, { text: menuText(ownerUser), quoted: m });
          continue;
        }
        if (["alive", "ping"].includes(cmd)) {
          await reply(`💜 FROXY BOT ONLINE\n\n🟢 Status: Active\n⚡ Version: Mini V3\n👥 Listed owners: ${owners.length}`);
          continue;
        }
        if (["group", "support", "gc"].includes(cmd)) {
          await reply(`💜 OFFICIAL FROXY GROUP\n\n${GROUP_LINK}\n\nUpdates • Help • Community`);
          continue;
        }
        if (cmd === "pair") {
          await reply(`🔗 OWNER ACCOUNT PAIRING\n\nFroxy pairs the single account configured by its owner. Set PAIRING_NUMBER to your own number with country code and digits only. On a fresh session, the pairing code appears in private Hostless logs.\n\nOn your phone: WhatsApp → Linked devices → Link a device → Link with phone number, then enter the code.\n\nFor safety, this bot does not issue login codes for arbitrary users through a public command. Never share pairing codes or session files.`);
          continue;
        }
        if (["froxy", "ask", "ai"].includes(cmd)) {
          if (!q) {
            await reply("🦊 Ask Froxy something!\nExample: .froxy give me three study tips\n\nThis starter version uses built-in demo replies. Connect an AI API to enable real AI answers.");
          } else {
            await reply(`🦊 FROXY MINI\n\nYou asked: ${q}\n\nI'm running the starter version of Froxy. Real AI answers require an AI API key and an API integration.`);
          }
          continue;
        }

        if (!group && ["groupinfo", "link", "tagall", "hidetag", "welcome", "goodbye", "antilink", "open", "close", "kick", "promote", "demote"].includes(cmd)) {
          await reply("👥 This command works inside a WhatsApp group.");
          continue;
        }
        if (!group) continue;

        if (cmd === "groupinfo") {
          const meta = await sock.groupMetadata(chat);
          await reply(`👥 GROUP INFO\n\nName: ${meta.subject}\nMembers: ${meta.participants.length}\nCreated: ${meta.creation ? new Date(meta.creation * 1000).toLocaleDateString() : "Not available"}`);
          continue;
        }
        if (cmd === "link") {
          if (!await botIsGroupAdmin(sock, chat)) {
            await reply("⚠️ The bot must be a group admin to retrieve the invite link.");
            continue;
          }
          const code = await sock.groupInviteCode(chat);
          await reply(`🔗 THIS GROUP'S INVITE LINK\nhttps://chat.whatsapp.com/${code}`);
          continue;
        }
        if (cmd === "tagall" || cmd === "hidetag") {
          const meta = await sock.groupMetadata(chat);
          const mentions = meta.participants.map(p => p.id);
          const message = q || (cmd === "tagall" ? "Attention everyone!" : "Froxy announcement");
          await sock.sendMessage(chat, {
            text: FROXY(`${cmd === "tagall" ? "📣 TAG ALL" : "📢 ANNOUNCEMENT"}\n\n${message}`, { includeGroupLink: true }),
            mentions,
            quoted: m
          });
          continue;
        }
        if (["welcome", "goodbye", "antilink"].includes(cmd)) {
          if (!["on", "off"].includes(q.toLowerCase())) {
            await reply(`Usage: .${cmd} on/off`);
            continue;
          }
          if (!await isGroupAdmin(sock, chat, sender) && !ownerUser) {
            await reply("🔒 Only group admins can change this setting.");
            continue;
          }
          const gs = ensureGroupSettings(chat);
          gs[cmd] = q.toLowerCase() === "on";
          saveSettings();
          await reply(`${cmd}: ${gs[cmd] ? "ON ✅" : "OFF ❌"}`);
          continue;
        }
        if (cmd === "open" || cmd === "close") {
          if (!await isGroupAdmin(sock, chat, sender) || !await botIsGroupAdmin(sock, chat)) {
            await reply("🔒 The sender and the bot must be group admins to change group posting settings.");
            continue;
          }
          await sock.groupSettingUpdate(chat, cmd === "open" ? "not_announcement" : "announcement");
          await reply(cmd === "open" ? "🔓 Group opened. All members can send messages." : "🔒 Group closed. Only admins can send messages.");
          continue;
        }
        if (["kick", "promote", "demote"].includes(cmd)) {
          if (!await isGroupAdmin(sock, chat, sender) || !await botIsGroupAdmin(sock, chat)) {
            await reply("🔒 The sender and the bot must be group admins to manage members.");
            continue;
          }
          const targets = mentionedJids(m);
          if (!targets.length) {
            await reply(`Mention the member you want to ${cmd}.\nExample: .${cmd} @member`);
            continue;
          }
          const action = cmd === "kick" ? "remove" : cmd;
          await sock.groupParticipantsUpdate(chat, targets, action);
          await reply(`✅ ${cmd} action requested for ${targets.length} member(s).`);
          continue;
        }
        if (cmd === "welcome" || cmd === "goodbye" || cmd === "antilink") continue;
      } catch (err) {
        console.error("Message handler error:", err?.stack || err);
        try {
          await sock.sendMessage(m.key.remoteJid, {
            text: FROXY("⚠️ That command could not be completed. Check bot permissions and hosting logs."),
            quoted: m
          });
        } catch {}
      }
    }
  });

  sock.ev.on("group-participants.update", async update => {
    try {
      const gs = settings[update.id];
      if (!gs) return;
      const names = (update.participants || []).map(jid => `@${numberFromJid(jid)}`);
      if (update.action === "add" && gs.welcome) {
        await sock.sendMessage(update.id, {
          text: FROXY(`🎉 Welcome ${names.join(", ")} to Froxy Family!`),
          mentions: update.participants
        });
      }
      if (update.action === "remove" && gs.goodbye) {
        await sock.sendMessage(update.id, {
          text: FROXY(`👋 Goodbye ${names.join(", ")}. Take care!`),
          mentions: update.participants
        });
      }
    } catch (err) {
      console.error("Participant update error:", err?.message || err);
    }
  });
}

startBot().catch(err => {
  console.error("FROXY failed to start:", err);
  process.exitCode = 1;
});
