# 🦊 FROXY BOT MINI V3

A starter WhatsApp bot using Baileys with a classic FROXY header on text replies.

## Included
- `.help`, `.menu`, `.alive`, `.ping`, `.group`, `.support`
- `.froxy`, `.ask`, `.ai` demo responses (not connected to an AI service)
- Group info and invite link
- `.tagall` and `.hidetag`
- Welcome/goodbye messages
- Basic WhatsApp invite-link filter
- Admin-protected group settings and member moderation
- Classic decorated FROXY header and the supplied Froxy Family link on bot text replies
- Automatic creation of `owners.json` and `settings.json` if missing

## Important pairing note
A Baileys pairing code connects the WhatsApp account you choose to the bot's session. A command cannot make the bot create pairing codes for arbitrary people's accounts after it is already connected. This version's `.pair` command explains how to connect safely; QR pairing is printed in the hosting logs on a fresh session.

## Requirements
- Node.js 20+
- A host that supports a persistent filesystem and long-running Node.js processes
- A WhatsApp account you control

## Run locally
```bash
npm install
npm start
```

### Pairing with a phone number
On Hostless, add an environment variable named `PAIRING_NUMBER` with the WhatsApp number you own, digits only with country code. For the number you supplied, enter `263712552662` (without spaces or `+`). On a fresh session, the pairing code is printed to the private hosting logs. On your phone, open WhatsApp > Linked devices > Link a device > Link with phone number, then enter the code. If `PAIRING_NUMBER` is not set, the bot prints a QR code instead.

The `.pair` command explains the owner's pairing process. It intentionally does not create pairing codes for arbitrary people in public chats, because those codes link WhatsApp accounts and the resulting session credentials must remain under each account owner's control. Keep `session_froxy_mini/` private and never upload it to a public repository.

## Hostless deployment
1. Upload the ZIP contents to a GitHub repository.
2. Set runtime to Node.js 20 or newer.
3. Build/install command: `npm install`
4. Start command: `npm start`
5. Deploy the repository and open runtime logs.
6. Scan the QR code with WhatsApp > Linked devices.
7. Ensure the host preserves `session_froxy_mini/` between restarts. If its filesystem is ephemeral, the session may be lost after redeploy/restart.

## Notes
- Group moderation commands require both the sender and bot to be group admins.
- `.welcome`, `.goodbye`, and `.antilink` toggles require group admin privileges (or the configured owner).
- To add an owner, add their WhatsApp phone number without `+` to `owners.json`, for example:
```json
[
  "263712345678"
]
```
- `.froxy` is a demo placeholder, not a real AI integration.
- WhatsApp/third-party library APIs can change. Test with a separate group before using moderation commands.
