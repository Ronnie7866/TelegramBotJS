const { Telegraf } = require('telegraf');
const axios = require('axios');
const { URL } = require('url');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');

function startBot() {
    const bot = new Telegraf('7715788041:AAHivxUeO9se97Rm8RAHK5CcvKQyAcar8vY');

    const uniqueUsers = new Map();
    const fileCache = new Map();

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

    async function downloadVideo(url, fileName) {
        const tempPath = path.join(os.tmpdir(), fileName);
        const writer = fs.createWriteStream(tempPath);

        const response = await axios({
            method: 'get',
            url: url,
            responseType: 'stream'
        });

        response.data.pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on('finish', () => resolve(tempPath));
            writer.on('error', reject);
        });
    }

    async function uploadToTelegram(ctx, filePath, fileName, thumb) {
        const fileStream = fs.createReadStream(filePath);
        let message;
        
        try {
            message = await ctx.telegram.sendVideo(ctx.chat.id, 
                { source: fileStream },
                { 
                    filename: fileName,
                    caption: 'Here is your video!',
                    thumb: { url: thumb }  // Use the thumbnail from Terabox
                }
            );
        } catch (error) {
            console.log(`Error sending video: ${error.message}`);
            // If sending as video fails, try sending as document
            message = await ctx.telegram.sendDocument(ctx.chat.id, 
                { source: fileStream },
                { 
                    filename: fileName,
                    caption: 'Here is your video! (Sent as document due to size limitations)'
                }
            );
        }

        fs.unlinkSync(filePath); // Delete the temporary file
        return message.video ? message.video.file_id : message.document.file_id;
    }

    async function getOrUploadVideo(ctx, url) {
        const videoId = crypto.createHash('md5').update(url).digest('hex');
        
        if (fileCache.has(videoId)) {
            return fileCache.get(videoId);
        }

        const data = await getData(url);
        if (!data) throw new Error('Could not process the link');

        const fileName = `${data.title}.mp4`;
        const tempFilePath = await downloadVideo(data.direct_link, fileName);
        const fileId = await uploadToTelegram(ctx, tempFilePath, fileName, data.thumb);

        fileCache.set(videoId, fileId);
        return fileId;
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

            const processingMsg = await ctx.reply('Processing your link, please wait...');

            const fileId = await getOrUploadVideo(ctx, url);
            await ctx.deleteMessage(processingMsg.message_id);

            // Send the video using the file_id
            await ctx.replyWithVideo(fileId, { caption: 'Here is your video!' });

            console.log(`SUCCESS - User: ${userName} (ID: ${userId}) - Link: ${url}`);
        } catch (error) {
            console.log(`FAIL - User: ${userName} (ID: ${userId}), URL: ${url}, Error: ${error.message}`);
            await ctx.reply(`Sorry, I couldn't process this link. Please try again later.`);
        }
    });

    // Error handling
    bot.catch((err, ctx) => {
        console.error(`Ooops, encountered an error for ${ctx.updateType}`, err);
        ctx.reply('An unexpected error occurred. The bot will restart shortly.').catch(console.error);
    });

    bot.launch().then(() => {
        console.log('Bot started successfully');
    }).catch((error) => {
        console.log(`Error starting bot: ${error.message}`);
        setTimeout(startBot, 5000); // Try to restart after 5 seconds
    });

    // Enable graceful stop
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

// Start the bot initially
startBot();

// Uncaught exception handler
process.on('uncaughtException', (err) => {
    console.error('Uncaught exception:', err);
    setTimeout(() => {
        console.log('Restarting bot due to uncaught exception...');
        startBot();
    }, 5000);
});

// Unhandled rejection handler
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    setTimeout(() => {
        console.log('Restarting bot due to unhandled rejection...');
        startBot();
    }, 5000);
});
