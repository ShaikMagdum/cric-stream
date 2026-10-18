// REPLACE WITH YOUR CLOUDFLARE WORKER URL
const WORKER_URL = "https://stream-proxy.magdumshaik082005.workers.dev";

// Expanded dataset including a ClearKey encrypted .mpd stream (Everton vs Chelsea)
const CHANNELS = [
    {
        id: "ind_wi_eng",
        name: "India vs West Indies (English)",
        category: "Cricket (HLS)",
        logo: "https://img1.hotstarext.com/image/upload/sources/r1/cms/prod/4524/1792147234524-b",
        url: "https://live11p.hotstar.com/hls/live/2024721/inallow-indvswi-2026/eng/1540080173/15mindvrm0163e94d10072246cb8a66a8fc6796a66417october2026/master_ap.m3u8|Cookie=hdntl=exp=1792243159~acl=/*&User-Agent=Hotstar(Android/15)"
    },
    {
        id: "everton_chelsea",
        name: "Everton vs Chelsea",
        category: "Football (DASH/DRM)",
        logo: "https://img1.hotstarext.com/image/upload/sources/r1/cms/prod/6936/1792160446936-b",
        // Notice the drmLicense explicitly separated for the Shaka parser
        url: "https://live09p.hotstar.com/mp2/inallow-epl-2026-27-1540083116/a505ffc96c2541428eeb7eda00ef8afc/index.mpd|Cookie=hdntl=exp=1792322836~acl=/*&User-Agent=Hotstar(Android/15)",
        drmKey: "618cefdcfe094000a8222adab6fe0000:1c90ee160571480d97ed086559e2d468" 
    },
    {
        id: "bb_telugu",
        name: "Bigg Boss 24X7 Stream (Telugu)",
        category: "24/7 Reality",
        logo: "https://img1.hotstarext.com/image/upload/sources/r1/cms/prod/3541/1788705493541-b",
        url: "https://live09p.hotstar.com/mp2/incagbsgallow-biggboss-tel-2026/f129670ca03b4bb988c841f9bbdce777/index.m3u8"
    }
];

let shakaPlayer = null;
const videoElement = document.getElementById('player');
const videoContainer = document.getElementById('video-container');
const channelContainer = document.getElementById('channel-container');
const activeTitle = document.getElementById('active-title');
const activeCategory = document.getElementById('active-category');
const playerStatus = document.getElementById('player-status');

// Initialize Shaka Player (The core of the Reproductor-MPD-M3U8 repo)
async function initPlayer() {
    shaka.polyfill.installAll();
    if (!shaka.Player.isBrowserSupported()) {
        console.error('Browser not supported for Shaka Player');
        return;
    }

    shakaPlayer = new shaka.Player(videoElement);
    const ui = new shaka.ui.Overlay(shakaPlayer, videoContainer, videoElement);
    const config = {
        controlPanelElements: ['play_pause', 'time_and_duration', 'spacer', 'mute', 'volume', 'quality', 'fullscreen'],
        addBigPlayButton: true
    };
    ui.configure(config);

    shakaPlayer.addEventListener('error', onPlayerErrorEvent);
}

function onPlayerErrorEvent(event) {
    console.error('Error code', event.detail.code, 'object', event.detail);
    playerStatus.innerText = `Playback Error: Token likely expired (Code: ${event.detail.code})`;
    playerStatus.style.display = 'block';
}

function buildProxyUrl(rawUrl) {
    const parts = rawUrl.split('|');
    const streamUrl = parts[0].trim();
    const proxyUri = new URL(WORKER_URL);
    proxyUri.searchParams.set('url', streamUrl);

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

async function loadStream(channel) {
    activeTitle.innerText = channel.name;
    activeCategory.innerText = channel.category;
    playerStatus.style.display = 'none';

    document.querySelectorAll('.channel-card').forEach(el => el.classList.remove('active'));
    const activeCard = document.querySelector(`.channel-card[data-id="${channel.id}"]`);
    if (activeCard) activeCard.classList.add('active');

    const proxiedUrl = buildProxyUrl(channel.url);

    // 1. Reset DRM configurations
    shakaPlayer.configure({ drm: { clearKeys: {} } });

    // 2. Inject ClearKey DRM if the channel requires it
    if (channel.drmKey) {
        const [kid, key] = channel.drmKey.split(':');
        shakaPlayer.configure({
            drm: {
                clearKeys: {
                    [kid]: key
                }
            }
        });
        console.log("Injected ClearKey DRM License.");
    }

    // 3. Load the Stream
    try {
        await shakaPlayer.load(proxiedUrl);
        console.log('Stream loaded successfully.');
    } catch (e) {
        onPlayerErrorEvent({ detail: e });
    }
}

function renderChannels(channels) {
    channelContainer.innerHTML = '';
    channels.forEach(ch => {
        const item = document.createElement('div');
        item.className = 'channel-card';
        item.dataset.id = ch.id;
        item.innerHTML = `
            <img src="${ch.logo}" alt="${ch.name}" class="channel-thumb" onerror="this.src='https://placehold.co/80x45?text=LIVE'">
            <div class="channel-details">
                <span class="channel-title">${ch.name}</span>
                <span class="channel-meta">${ch.category}</span>
            </div>
        `;
        item.addEventListener('click', () => {
            loadStream(ch);
            history.pushState(null, '', `?share=${ch.id}`);
        });
        channelContainer.appendChild(item);
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    await initPlayer();
    renderChannels(CHANNELS);

    const params = new URLSearchParams(window.location.search);
    const channelId = params.get('share');
    const match = CHANNELS.find(c => c.id === channelId);

    if (match) loadStream(match);
    else if (CHANNELS.length > 0) loadStream(CHANNELS[0]);
});