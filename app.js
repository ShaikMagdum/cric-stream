// Map your stream IDs (like the one in your URL) to the actual M3U8/MPD links
const STREAM_DATABASE = {
    'zDKQrvxMimFyO6JZvffm': {
        title: 'India vs West Indies - 5th T20I',
        url: 'https://live11p.hotstar.com/hls/live/2024721/inallow-indvswi-2026/eng/1540080173/15mindvrm0163e94d10072246cb8a66a8fc6796a66417october2026/master_ap.m3u8|Cookie=hdntl=exp=1792243159~acl=/*&User-Agent=Hotstar(Android/15)'
    },
    'default': {
        title: 'CRICKET 24/7 NETWORK',
        url: 'https://live09p.hotstar.com/mp2/incagbsgallow-biggboss-tel-2026/f129670ca03b4bb988c841f9bbdce777/index.m3u8'
    }
};

// Replace with your active Cloudflare Worker Proxy URL
const WORKER_URL = "https://stream-proxy.tollynexus.workers.dev";

let shakaPlayer = null;
const videoElement = document.getElementById('player');
const titleElement = document.getElementById('match-title');
const errorOverlay = document.getElementById('player-error');
const skipAdBtn = document.getElementById('skip-ad-btn');

// Show fake Ad skip button for realism (as requested in the template)
setTimeout(() => {
    skipAdBtn.style.display = 'block';
}, 3000);

skipAdBtn.addEventListener('click', () => {
    skipAdBtn.style.display = 'none';
});

// Converts raw URL to Proxy URL
function buildProxyUrl(rawUrl) {
    const parts = rawUrl.split('|');
    const proxyUri = new URL(WORKER_URL);
    proxyUri.searchParams.set('url', parts[0].trim());

    if (parts.length > 1) {
        const pipeParams = new URLSearchParams(parts[1]);
        for (const [key, value] of pipeParams.entries()) {
            const lowerKey = key.toLowerCase();
            if (lowerKey === 'user-agent') proxyUri.searchParams.set('ua', value);
            if (lowerKey === 'cookie') proxyUri.searchParams.set('cookie', value);
        }
    }
    return proxyUri.toString();
}

async function initPlayer() {
    shaka.polyfill.installAll();
    if (!shaka.Player.isBrowserSupported()) {
        errorOverlay.innerText = "BROWSER NOT SUPPORTED";
        errorOverlay.style.display = 'block';
        return;
    }

    shakaPlayer = new shaka.Player(videoElement);
    const ui = new shaka.ui.Overlay(shakaPlayer, document.querySelector('.video-stage'), videoElement);
    ui.configure({
        controlPanelElements: ['play_pause', 'time_and_duration', 'spacer', 'mute', 'volume', 'quality', 'picture_in_picture', 'fullscreen'],
        addBigPlayButton: true
    });

    shakaPlayer.addEventListener('error', (e) => {
        errorOverlay.innerText = "STREAM OFFLINE (ERROR " + e.detail.code + ")";
        errorOverlay.style.display = 'block';
    });

    // Extract ID from URL (e.g., ?id=zDKQrvxMimFyO6JZvffm)
    const urlParams = new URLSearchParams(window.location.search);
    const streamId = urlParams.get('id');
    
    // Fetch stream details from database
    const streamData = STREAM_DATABASE[streamId] || STREAM_DATABASE['default'];
    
    // Update UI Header
    titleElement.innerText = streamData.title;

    // Load Stream
    try {
        const proxiedUrl = buildProxyUrl(streamData.url);
        await shakaPlayer.load(proxiedUrl);
    } catch (e) {
        errorOverlay.innerText = "CONNECTION FAILED";
        errorOverlay.style.display = 'block';
    }
}

document.addEventListener('DOMContentLoaded', initPlayer);
