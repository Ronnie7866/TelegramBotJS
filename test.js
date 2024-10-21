import axios from 'axios';
import url from 'url';

async function checkAPI(inputUrl) {
    const baseUrl = 'https://terabox.hnn.workers.dev';
    let shorturl;

    // Check if the input is a full TeraBox URL or a short URL
    if (inputUrl.includes('terabox.com') || inputUrl.includes('teraboxapp.com')) {
        const parsedUrl = url.parse(inputUrl, true);
        shorturl = parsedUrl.pathname.split('/').pop();
    } else {
        shorturl = inputUrl;
    }

    const apiUrl = `${baseUrl}/api/get-info?shorturl=${shorturl}&pwd=`;

    try {
        // First request to get file info
        const infoResponse = await axios.get(apiUrl, {
            headers: getHeaders(baseUrl),
            timeout: 30000
        });

        if (infoResponse.status === 200 && infoResponse.data && infoResponse.data.ok) {
            console.log('File info:', infoResponse.data);

            const { shareid, uk, sign, timestamp, list } = infoResponse.data;
            const fs_id = list[0].fs_id;

            // Second request to get download link
            const downloadResponse = await axios.post(`${baseUrl}/api/get-download`, {
                shareid,
                uk,
                sign,
                timestamp,
                fs_id
            }, {
                headers: getHeaders(baseUrl, true),
                timeout: 30000
            });

            console.log('Download info:', downloadResponse.data);

            if (downloadResponse.data.ok && downloadResponse.data.downloadLink) {
                return {
                    downloadLink: downloadResponse.data.downloadLink,
                    filename: infoResponse.data.list[0].filename,
                    size: parseInt(infoResponse.data.list[0].size, 10)
                };
            } else {
                console.log('Download link not found in the response.');
                return null;
            }
        } else {
            console.log('Unexpected response from info API:', infoResponse.status, infoResponse.data);
            return null;
        }
    } catch (error) {
        console.error('API Error:', error.message);
        if (error.response) {
            console.error('API Response Status:', error.response.status);
            console.error('API Response Data:', error.response.data);
        }
        return null;
    }
}

function getHeaders(baseUrl, isJson = false) {
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Referer': baseUrl,
        'Origin': baseUrl,
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
    };

    if (isJson) {
        headers['Content-Type'] = 'application/json';
    }

    return headers;
}

// Example usage
const inputUrl = 'https://1024terabox.com/s/16h6bD64IaIfCiG-TTamnoQ'; // Replace with actual TeraBox link or short URL
checkAPI(inputUrl);

module.exports = { checkAPI };
