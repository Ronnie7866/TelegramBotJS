import { Telegraf } from 'telegraf';
import axios from 'axios';
import { URL } from 'url';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const bot = new Telegraf('7715788041:AAHivxUeO9se97Rm8RAHK5CcvKQyAcar8vY');

// Setup simple logging
const logFile = path.join(__dirname, 'bot_logs.txt');
const uniqueUsers = new Set();

function logMessage(message) {
  const timestamp = new Date().toISOString();
  const logEntry = `${timestamp} - ${message}\n`;
  console.log(logEntry.trim());
  fs.appendFileSync(logFile, logEntry);
}

async function getData(url) {
  const parsedUrl = new URL(url);
  if (['teraboxapp.com', 'terabox.com', '1024tera.com', 'teraboxlink.com'].includes(parsedUrl.hostname)) {
    url = url.replace(parsedUrl.hostname, '1024terabox.com');
  }

  try {
    const apiResponse = await axios.post('https://ytshorts.savetube.me/api/v1/terabox-downloader', {
      url: url
    }, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0',
        'Accept': 'application/json, text/plain, */*',
        'Content-Type': 'application/json',
        'Origin': 'https://ytshorts.savetube.me',
      }
    });

    if (apiResponse.status !== 200) return false;

    const resolutions = apiResponse.data.response[0]?.resolutions;
    if (!resolutions) return false;

    return {
      direct_link: resolutions['Fast Download'] || '',
      hd_link: resolutions['HD Video'] || '',
      thumb: apiResponse.data.response[0]?.thumbnail || '',
      title: apiResponse.data.response[0]?.title || 'Unknown Title',
    };

  } catch (error) {
    logMessage(`API Error: ${error.message}`);
    return false;
  }
}

bot.on('text', async (ctx) => {
  const url = ctx.message.text;
  const userId = ctx.from.id;

  // Validate if the URL is a valid Terabox link
  const teraboxDomains = ['terabox.com', '1024tera.com', 'teraboxapp.com', 'teraboxlink.com'];
  const isValidTeraboxLink = teraboxDomains.some(domain => url.includes(domain));

  if (!isValidTeraboxLink) {
    await ctx.reply('Please provide a valid Terabox link.');
    return;
  }

  // Proceed if the URL is valid
  let statusMessage;

  try {
    uniqueUsers.add(userId); // Add the user to unique users set
    const userCount = uniqueUsers.size;

    statusMessage = await ctx.reply('Processing your request... Please wait.');
    const data = await getData(url);
    if (data) {
      try {
        await ctx.deleteMessage(statusMessage.message_id);
      } catch (deleteError) {
        logMessage(`Failed to delete status message: ${deleteError.message}`);
      }

      const message = `
🎥 ${data.title}

📥 Download Links:
▶️ Stream/Download: ${data.hd_link}
⚡ Fast Download: ${data.direct_link}

⚠️ These links will expire soon. Download quickly!

Enjoy your video! 😊
      `;

      await ctx.replyWithPhoto(
        { url: data.thumb },
        { caption: message }
      );

      // Log success with user count, user ID, link, and success message
      logMessage(`User Count: ${userCount} - User: ${userId} - Link: ${url} - SUCCESS`);
    } else {
      throw new Error('Could not process the link');
    }
  } catch (error) {
    logMessage(`FAIL - User: ${userId}, URL: ${url}, Error: ${error.message}`);
    if (statusMessage) {
      try {
        await ctx.deleteMessage(statusMessage.message_id);
      } catch (deleteError) {
        logMessage(`Failed to delete status message: ${deleteError.message}`);
      }
    }
    await ctx.reply(`Sorry, I couldn't process this link. Please try again later.`);
  }
});

let isShuttingDown = false;

async function stopBot() {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logMessage('Stopping bot...');
  await bot.stop();
  logMessage('Bot stopped');
}

async function startBot() {
  if (isShuttingDown) return;

  try {
    await bot.launch();
    logMessage('Bot started successfully');
  } catch (error) {
    logMessage(`Error starting bot: ${error.message}`);
    logMessage('Attempting to restart in 5 seconds...');
    setTimeout(startBot, 5000);
  }
}

async function restartBot() {
  await stopBot();
  isShuttingDown = false;
  await startBot();
}

// Error handling
bot.catch((err, ctx) => {
  logMessage(`Error in bot: ${err}`);
  ctx.reply('An error occurred. The bot will attempt to restart.').catch(() => {});
  restartBot();
});

process.on('uncaughtException', async (error) => {
  logMessage(`Uncaught Exception: ${error.message}`);
  await restartBot();
});

process.on('unhandledRejection', async (reason, promise) => {
  logMessage(`Unhandled Rejection at: ${promise}, reason: ${reason}`);
  await restartBot();
});

process.once('SIGINT', async () => {
  logMessage('SIGINT received. Stopping bot...');
  await stopBot();
  process.exit(0);
});

process.once('SIGTERM', async () => {
  logMessage('SIGTERM received. Stopping bot...');
  await stopBot();
  process.exit(0);
});

// Start the bot
startBot();