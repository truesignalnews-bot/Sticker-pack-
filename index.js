const { Telegraf } = require("telegraf");
const fs = require("fs");
const path = require("path");

// ================= CONFIG =================
const BOT_TOKEN = "8667702235:AAEEkzbBsFIGycRNqJUq42DFFVRdaEog8xI";
const BOT_USERNAME = "Stickorabot";
const CHANNEL_USERNAME = "@green_portfolio10";

const BUNDLES_FILE = path.join(__dirname, "bundles.txt");
const USERS_FILE = path.join(__dirname, "users.txt");

let DB = [];
let USERS = [];

// ================= LOAD USERS =================
if (fs.existsSync(USERS_FILE)) {
  USERS = fs.readFileSync(USERS_FILE, "utf8")
    .split("\n")
    .filter(Boolean)
    .map(line => {
      const [id, refBy, refCount, unlocked] = line.split("|||");

      return {
        id,
        refBy: refBy || "",
        refCount: Number(refCount || 0),
        unlocked: unlocked === "true"
      };
    });
}

// ================= SAVE USERS =================
function saveUsers() {
  fs.writeFileSync(
    USERS_FILE,
    USERS.map(u =>
      `${u.id}|||${u.refBy}|||${u.refCount}|||${u.unlocked}`
    ).join("\n")
  );
}

// ================= LOAD STICKER DB =================
function loadDB() {
  DB = [];

  if (!fs.existsSync(BUNDLES_FILE)) return;

  const lines = fs.readFileSync(BUNDLES_FILE, "utf8")
    .split("\n")
    .map(x => x.trim())
    .filter(Boolean);

  for (let i = 0; i < lines.length; i++) {
    const parts = lines[i].split("|");

    const title = parts[0];
    const link = parts[1];
    const stickers = parts[2] ? parts[2].split(",") : [];

    if (title && link) {
      DB.push({
        id: i,
        title,
        link,
        stickers
      });
    }
  }

  console.log("🔄 DB LOADED:", DB.length);
}

loadDB();
setInterval(loadDB, 5000);

// ================= BOT =================
const bot = new Telegraf(BOT_TOKEN);

// ================= START =================
bot.start(async (ctx) => {
  const userId = String(ctx.from.id);
  const ref = ctx.startPayload;

  let user = USERS.find(u => u.id === userId);

  // ===== NEW USER =====
  if (!user) {
    user = {
      id: userId,
      refBy: "",
      refCount: 0,
      unlocked: false
    };

    // Save referral info
    if (ref && ref !== userId) {
      user.refBy = ref;

      // Add +1 referral to inviter
      let refUser = USERS.find(u => u.id === ref);

      if (refUser) {
        refUser.refCount += 1;

        try {
          await bot.telegram.sendMessage(
            refUser.id,
            "🎉 Congratulations!\n\n✅ You received 1 successful referral.\n\nJoin count updated."
          );
        } catch {}
      }
    }

    USERS.push(user);
    saveUsers();
  }

  // ===== WELCOME MESSAGE =====
  ctx.reply(
`✨ Welcome to Sticker Hub

━━━━━━━━━━━━━━
🎉 Your Ultimate Sticker Collection

Discover thousands of premium sticker packs including:

😂 Funny Stickers
❤️ Love Stickers
🎌 Anime Stickers
😎 Attitude Stickers
🎉 Trending Stickers
🔥 And Much More

━━━━━━━━━━━━━━
🔓 Unlock Unlimited Access

✅ Invite 1 Friend
✅ Join Our Official Channel

After completing both steps, you'll get permanent unlimited access to all sticker packs for free.

━━━━━━━━━━━━━━
🚀 Search, Preview & Enjoy
💎 Premium Experience
♾ Unlimited Access

👇 Get started using the buttons below.`,
{
  reply_markup: {
    inline_keyboard: [
      [
        {
          text: "🎁 Invite & Share",
          url: `https://t.me/share/url?url=https://t.me/${BOT_USERNAME}?start=${userId}&text=🔥 Join this Sticker Hub Bot`
        }
      ],
      [
        {
          text: "📢 Join Official Channel",
          url: "https://t.me/green_portfolio10"
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
    console.log("Sticker Extract Error:", e.message);
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

    // Duplicate check
    if (DB.find(b => b.link === link)) return;

    console.log("📦 New Pack Found:", title);

    // Extract sticker file ids
    const stickers = await extractStickers(bot, link);

    DB.push({
      id: DB.length,
      title,
      link,
      stickers
    });

    // Save bundles.txt
    fs.writeFileSync(
      BUNDLES_FILE,
      DB.map(
        b => `${b.title}|${b.link}|${(b.stickers || []).join(",")}`
      ).join("\n")
    );

    console.log("✅ AUTO SAVED:", title);

  } catch (e) {
    console.log("Channel Post Error:", e.message);
  }
});

// ================= SEARCH =================
bot.on("text", async (ctx) => {

  if (ctx.message.text.startsWith("/")) return;

  const userId = String(ctx.from.id);

  let user = USERS.find(u => u.id === userId);

  if (!user) {
    user = {
      id: userId,
      refBy: "",
      refCount: 0,
      unlocked: false
    };

    USERS.push(user);
    saveUsers();
  }

  // ===== LOCK CHECK =====
  if (!user.unlocked) {

    return ctx.reply(
`🔒 Access Locked

To unlock unlimited access:

✅ Invite 1 Friend
✅ Join Our Official Channel

After completing both steps, press the button below.

🚀 Once unlocked, you'll get lifetime unlimited access to all sticker packs.`,
{
  reply_markup: {
    inline_keyboard: [
      [
        {
          text: "🎁 Invite Friend",
          url: `https://t.me/share/url?url=https://t.me/${BOT_USERNAME}?start=${userId}&text=🔥 Join this Sticker Hub Bot`
        }
      ],
      [
        {
          text: "📢 Join Channel",
          url: "https://t.me/green_portfolio10"
        }
      ],
      [
        {
          text: "✅ I've Completed Both",
          callback_data: "verify_access"
        }
      ]
    ]
  }
}
    );

  }

  // ===== SEARCH PACK =====
  const q = ctx.message.text.toLowerCase().trim();

  const found = DB.filter(b =>
    b.title.toLowerCase().includes(q)
  );

  if (!found.length) {
    return ctx.reply("❌ No sticker pack found.");
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
`🎁 Sticker Pack Ready

👇 Tap the button below to add this pack.`,
{
  reply_markup: {
    inline_keyboard: [
      [
        {
          text: "➕ Add Stickers",
          url: b.link
        }
      ]
    ]
  }
}
    );

  }

});

// ================= VERIFY ACCESS =================
bot.on("callback_query", async (ctx) => {

  const data = ctx.callbackQuery.data;

  if (data !== "verify_access") return;

  const userId = String(ctx.from.id);

  let user = USERS.find(u => u.id === userId);

  if (!user) {
    return ctx.answerCbQuery("User not found");
  }

  try {

    // ===== CHANNEL JOIN CHECK =====
    const member = await bot.telegram.getChatMember(
      CHANNEL_USERNAME,
      userId
    );

    const joined =
      member.status === "member" ||
      member.status === "administrator" ||
      member.status === "creator";

    if (!joined) {

      return ctx.reply(
`❌ Channel Join Not Detected

Please join our official channel first and then press the button again.`,
{
  reply_markup: {
    inline_keyboard: [
      [
        {
          text: "📢 Join Channel",
          url: "https://t.me/green_portfolio10"
        }
      ],
      [
        {
          text: "✅ I've Completed Both",
          callback_data: "verify_access"
        }
      ]
    ]
  }
}
      );

    }

    // ===== REFERRAL CHECK =====
    if (user.refCount < 1) {

      return ctx.reply(
`❌ Referral Requirement Not Completed

You need at least 1 successful referral to unlock unlimited access.`,
{
  reply_markup: {
    inline_keyboard: [
      [
        {
          text: "🎁 Invite Friend",
          url: `https://t.me/share/url?url=https://t.me/${BOT_USERNAME}?start=${userId}&text=🔥 Join this Sticker Hub Bot`
        }
      ],
      [
        {
          text: "✅ I've Completed Both",
          callback_data: "verify_access"
        }
      ]
    ]
  }
}
      );

    }

    // ===== UNLOCK USER =====
    user.unlocked = true;
    saveUsers();

    await ctx.reply(
`🎉 Congratulations!

━━━━━━━━━━━━━━
✅ Your account has been verified successfully.

🔓 Unlimited access unlocked.

🚀 You can now search and use all sticker packs without any limits.

💎 Enjoy Sticker Hub Premium Experience.
━━━━━━━━━━━━━━`
    );

    ctx.answerCbQuery("Access Unlocked!");

  } catch (e) {

    console.log(e.message);

    ctx.reply(
      "❌ Unable to verify channel membership.\n\nMake sure the bot is added to @green_portfolio10 as an administrator."
    );

  }

});

// ================= START BOT =================
bot.launch();

console.log("🚀 Sticker Hub Bot Running...");
