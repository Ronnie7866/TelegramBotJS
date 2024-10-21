const { Telegraf } = require('telegraf');
const axios = require('axios');
const { URL } = require('url');

const bot = new Telegraf('7733315589:AAH3FAqe3lvE0oTNUTDQcCMlL1DLWv3vNXk');

const uniqueUsers = new Map();

function getUserName(ctx) {
  const firstName = ctx.from.first_name || '';
  const lastName = ctx.from.last_name || '';
  return `${firstName} ${lastName}`.trim() || 'Unknown User';
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
      },
      timeout: 30000 // 30 seconds timeout for API call
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
    console.log(`API Error: ${error.message}`);
    return false;
  }
}

bot.on('text', async (ctx) => {
  const url = ctx.message.text;
  const userId = ctx.from.id;
  const userName = getUserName(ctx);

  uniqueUsers.set(userId, userName);

  const teraboxDomains = ['terabox.com', '1024tera.com', 'teraboxapp.com', 'teraboxlink.com'];
  const isValidTeraboxLink = teraboxDomains.some(domain => url.includes(domain));

  if (!isValidTeraboxLink) {
    await ctx.reply('Please provide a valid Terabox link.');
    return;
  }

  try {
    const userCount = uniqueUsers.size;
    console.log(`Request from: ${userName} (ID: ${userId}) - Total Users: ${userCount}`);

    const data = await getData(url);
    if (data) {
      await ctx.replyWithPhoto(
        { url: data.thumb },
        {
          caption: `🎥 ${data.title}\n\n📥 Download Links:\n▶️ Stream/Download: ${data.hd_link}\n⚡ Fast Download: ${data.direct_link}\n\n⚠️ These links will expire soon. Download quickly!`
        }
      );
      console.log(`SUCCESS - User: ${userName} (ID: ${userId}) - Link: ${url}`);
    } else {
      throw new Error('Could not process the link');
    }
  } catch (error) {
    console.log(`FAIL - User: ${userName} (ID: ${userId}), URL: ${url}, Error: ${error.message}`);
    await ctx.reply(`Sorry, I couldn't process this link. Please try again later.`);
  }
});

bot.launch().then(() => {
  console.log('Bot started successfully');
}).catch((error) => {
  console.log(`Error starting bot: ${error.message}`);
});

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
