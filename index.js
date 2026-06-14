const { Telegraf } = require("telegraf");
const fs = require("fs");
const path = require("path");

// ================= CONFIG =================
const BOT_TOKEN = "8667702235:AAHhC9jgOt93ZXRvcvF75qxdXmEux6ZQG44";
const BOT_USERNAME = "Stickorabot";

const BUNDLES_FILE = path.join(__dirname, "bundles.txt");
const USERS_FILE = path.join(__dirname, "users.txt");

let DB = [];
let USERS = [];

// ================= USERS =================
if (fs.existsSync(USERS_FILE)) {
  USERS = fs.readFileSync(USERS_FILE, "utf-8")
    .split("\n")
    .filter(Boolean)
    .map(l => {
      const [id, refBy, points] = l.split("|||");
      return {
        id,
        refBy: refBy || "",
        points: Number(points || 0)
      };
    });
}

function saveUsers() {
  fs.writeFileSync(
    USERS_FILE,
    USERS.map(u => `${u.id}|||${u.refBy}|||${u.points}`).join("\n")
  );
}

// ================= LOAD DB =================
function loadDB() {
  DB = [];

  if (!fs.existsSync(BUNDLES_FILE)) return;

  const lines = fs.readFileSync(BUNDLES_FILE, "utf-8")
    .split("\n")
    .map(l => l.trim())
    .filter(Boolean);

  for (let i = 0; i < lines.length; i++) {
    const parts = lines[i].split("|");

    const title = parts[0];
    const link = parts[1];
    const stickers = parts[2] ? parts[2].split(",") : [];

    if (title && link) {
      DB.push({ id: i, title, link, stickers });
    }
  }

  console.log("🔄 DB LOADED:", DB.length);
}

loadDB();
setInterval(loadDB, 5000);

// ================= BOT =================
const bot = new Telegraf(BOT_TOKEN);

// ================= START (UPDATED ONLY) =================
bot.start((ctx) => {
  const userId = String(ctx.from.id);
  const ref = ctx.startPayload;

  let user = USERS.find(u => u.id === userId);

  if (!user) {
    user = {
      id: userId,
      refBy: ref || "",
      points: 1
    };

    USERS.push(user);

    if (ref && ref !== userId) {
      let refUser = USERS.find(u => u.id === ref);
      if (refUser) {
        refUser.points += 1;
        bot.telegram.sendMessage(refUser.id, "🎉 +1 Referral Point Added!");
      }
    }

    saveUsers();
  }

  ctx.reply(
`👋 Welcome to Sticker Hub Bot

━━━━━━━━━━━━━━
👤 Name: ${ctx.from.first_name}
🆔 ID: ${userId}

💎 Your Points: ${user.points}

━━━━━━━━━━━━━━
📦 HOW IT WORKS:
• Search sticker packs (funny / love / anime)
• Preview 2 stickers before opening
• 1 pack = 1 point required

━━━━━━━━━━━━━━
👥 REFERRAL SYSTEM:
• Invite friends using your link
• Each join = +1 point

━━━━━━━━━━━━━━
🚀 SHARE & EARN:
Use button below to invite friends

🔥 Enjoy your experience 🚀`,
{
  reply_markup: {
    inline_keyboard: [
      [
        {
          text: "🎁 Invite & Earn Points",
          url: `https://t.me/share/url?url=https://t.me/${BOT_USERNAME}?start=${userId}&text=🔥 Join this Sticker Hub Bot and earn free points!`
        }
      ]
    ]
  }
}
  );
});

// ================= AUTO EXTRACTOR =================
async function extractStickers(bot, packLink) {
  try {
    const match = packLink.match(/addstickers\/(.+)/);
    if (!match) return [];

    const packName = match[1];
    const result = await bot.telegram.getStickerSet(packName);

    return result.stickers.map(s => s.file_id);
  } catch (e) {
    return [];
  }
}

// ================= CHANNEL POST =================
bot.on("channel_post", async (ctx) => {
  try {
    const text = ctx.channelPost.caption || ctx.channelPost.text;
    if (!text) return;

    let match =
      text.match(/(.+?)\s*\|\s*(https:\/\/t\.me\/addstickers\/\S+)/) ||
      text.match(/(.+?)\s*:\s*(https:\/\/t\.me\/addstickers\/\S+)/);

    if (!match) return;

    const title = match[1].trim();
    const link = match[2].trim();

    if (DB.find(b => b.link === link)) return;

    const stickers = await extractStickers(bot, link);

    DB.push({ id: DB.length, title, link, stickers });

    fs.writeFileSync(
      BUNDLES_FILE,
      DB.map(b => `${b.title}|${b.link}|${(b.stickers || []).join(",")}`).join("\n")
    );

    console.log("✅ AUTO SAVED:", title);
  } catch (e) {
    console.log(e.message);
  }
});

// ================= SEARCH =================
bot.on("text", async (ctx) => {
  const q = ctx.message.text.toLowerCase().trim();

  const found = DB.filter(b =>
    b.title.toLowerCase().includes(q)
  );

  if (!found.length) {
    return ctx.reply("❌ No sticker pack found");
  }

  for (let b of found) {
  await ctx.reply(`📦 ${b.title}`);

  const preview = (b.stickers || []).slice(0, 2);

  for (let s of preview) {
    try {
      await ctx.replyWithSticker(s);
    } catch {}
  }

  await ctx.reply(
`📦 PACK LOCKED

🔒 Preview only

👉 Open pack to get stickers
💎 1 Point required

👥 Invite friends to earn points

👇 Tap button below`,
{
  reply_markup: {
    inline_keyboard: [
      [
        {
          text: "📦 Open Pack (1 Point)",
          callback_data: `open_${b.id}`
        }
      ]
    ]
  }
}
  );
}

}); // ✅ THIS IS REQUIRED (VERY IMPORTANT)

// ================= CALLBACK =================
bot.on("callback_query", async (ctx) => {
  const data = ctx.callbackQuery.data;
  if (!data.startsWith("open_")) return;

  const id = parseInt(data.split("_")[1]);
  const pack = DB.find(p => p.id === id);

  const userId = String(ctx.from.id);
  let user = USERS.find(u => u.id === userId);

  if (!pack) return ctx.answerCbQuery("❌ Not found");

  if (!user) {
    user = { id: userId, refBy: "", points: 0 };
    USERS.push(user);
  }

  if (user.points < 1) {
    return ctx.reply(
`❌ Not enough points

💎 You need 1 point to open this sticker pack

🚀 Invite friends to earn points`,
{
  reply_markup: {
    inline_keyboard: [[
      {
        url: `https://t.me/share/url?url=https://t.me/${BOT_USERNAME}?start=${userId}&text=🔥 Join This Sticker Hub Bot!%0A%0A📦 Unlimited Sticker Packs%0A😂 Funny Stickers%0A💕 Love Stickers%0A🎌 Anime Stickers%0A😎 Cool & Trending Stickers%0A💥 Special Exclusive Packs%0A%0A💎 Earn Points & Unlock Packs%0A👥 Invite Friends & Get Rewards%0A%0A🚀 Daily New Sticker Packs Added%0A👇 Start Now 👇`
}

  user.points -= 1;
  saveUsers();

  ctx.answerCbQuery("Opening...");

  const preview = (pack.stickers || []).slice(0, 2);

  for (let s of preview) {
    try {
      await ctx.replyWithSticker(s);
    } catch {}
  }

  ctx.reply(`🎁 PACK UNLOCKED\n📦 ${pack.title}`, {
  reply_markup: {
    inline_keyboard: [[
      {
        text: "➕ Add Stickers",
        url: pack.link
      }
    ]]
  }
});
  
bot.launch();
console.log("🚀 CLEAN BOT RUNNING PERFECTLY");
