import axios from 'axios';
import fs from 'fs';
import { URL } from 'url';
import querystring from 'querystring';

function extractDomainAndSurl(url) {
    const parsedUrl = new URL(url);
    return [parsedUrl.hostname, querystring.parse(parsedUrl.search.substring(1)).surl || ''];
}

function parseCookieFile(cookiefile) {
    const cookies = {};
    const lines = fs.readFileSync(cookiefile, 'utf-8').split('\n');

    lines.forEach(line => {
        if (!line.startsWith('#') && line.trim() !== '') {
            const lineFields = line.trim().split('\t');
            // Check if the line has the expected number of fields for Netscape format
            if (lineFields.length >= 7) {
                const cookieName = lineFields[5];
                const cookieValue = lineFields[6];
                cookies[cookieName] = cookieValue;
            }
        }
    });
    return cookies;
}

async function download(url) {
    const axiosInstance = axios.create();

    // Load cookies from 'cookies.txt'
    const cookies = parseCookieFile('cookies.txt');
    axiosInstance.defaults.headers.Cookie = Object.entries(cookies).map(([key, value]) => `${key}=${value}`).join('; ');

    const maxRetries = 3;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const response = await axiosInstance.get(url);
            const [domain, key] = extractDomainAndSurl(response.request.res.responseUrl);

            const headers = {
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate, br',
                'Referer': `https://${domain}/sharing/link?surl=${key}`,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/93.0.4577.82 Safari/537.36'
            };

            const downloadResponse = await axiosInstance.get(`https://www.terabox.com/share/list?app_id=250528&shorturl=${key}&root=1`, { headers });

            // Log the entire response to check its structure
            console.log("Download Response:", downloadResponse.data);

            // Check if list exists and has elements
            if (downloadResponse.data.list && downloadResponse.data.list.length > 0) {
                return downloadResponse.data.list[0].dlink;
            } else {
                console.error("No download link found in the response.");
                return null; // or handle accordingly
            }

        } catch (error) {
            if (error.code === 'ECONNRESET') {
                console.error("Connection was reset. Retrying...");
                if (attempt === maxRetries - 1) {
                    console.error("Max retries reached. Please check your network connection or try again later.");
                }
            } else {
                console.error("An error occurred:", error.message);
                break; // Exit the loop on other errors
            }
        }
    }
}

// Example usage
download('https://1024terabox.com/s/1GyN-82LQLKpkPj34rT0p-A')
    .then(dlink => console.log(dlink))
    .catch(err => console.error(err));
