const express = require('express');
const puppeteer = require('puppeteer-core');

const app = express();
const PORT = 3001;

// ============================================
// CONFIGURACIÓN - OPTIMIZADO PARA SEO
// ============================================
const CACHE_TTL = 60 * 60 * 1000; // 1 hora de caché (antes: 5 min)
const MAX_CACHE_SIZE = 1000; // Máximo 1000 páginas en caché (antes: 100)
const RENDER_TIMEOUT = 30000; // 30 segundos timeout

// ============================================
// CACHÉ EN MEMORIA
// ============================================
const cache = new Map();

function getCached(url) {
    const cached = cache.get(url);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        console.log(`[CACHE HIT] ${url}`);
        return cached.html;
    }
    if (cached) {
        cache.delete(url); // Expirado, eliminar
    }
    return null;
}

function setCache(url, html) {
    // Limpiar caché si está llena
    if (cache.size >= MAX_CACHE_SIZE) {
        const oldestKey = cache.keys().next().value;
        cache.delete(oldestKey);
    }
    cache.set(url, { html, timestamp: Date.now() });
    console.log(`[CACHE SET] ${url} (${cache.size} items en caché)`);
}

// ============================================
// BROWSER MANAGEMENT
// ============================================
let browser = null;
let browserLaunchPromise = null;

async function getBrowser() {
    // Si ya hay un browser válido, usarlo
    if (browser && browser.isConnected()) {
        return browser;
    }

    // Si ya hay un launch en progreso, esperar
    if (browserLaunchPromise) {
        return browserLaunchPromise;
    }

    // Lanzar nuevo browser
    console.log('[BROWSER] Iniciando Chrome...');
    browserLaunchPromise = puppeteer.launch({
        executablePath: '/usr/bin/google-chrome-stable',
        headless: 'new',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-extensions',
            '--disable-background-networking',
            '--disable-default-apps',
            '--disable-sync',
            '--disable-translate',
            '--metrics-recording-only',
            '--mute-audio',
            '--no-default-browser-check',
            '--safebrowsing-disable-auto-update'
        ]
    });

    try {
        browser = await browserLaunchPromise;
        console.log('[BROWSER] Chrome iniciado correctamente');

        // Manejar cierre inesperado
        browser.on('disconnected', () => {
            console.log('[BROWSER] Chrome desconectado, se reiniciará en el próximo request');
            browser = null;
        });

        return browser;
    } finally {
        browserLaunchPromise = null;
    }
}

// ============================================
// ENDPOINTS
// ============================================

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        browserConnected: browser?.isConnected() || false,
        cacheSize: cache.size,
        uptime: process.uptime()
    });
});

// Limpiar caché
app.get('/cache/clear', (req, res) => {
    const size = cache.size;
    cache.clear();
    console.log(`[CACHE] Limpiada (${size} items eliminados)`);
    res.json({ cleared: size });
});

// Renderizar página
app.get('/render', async (req, res) => {
    const url = req.query.url;
    if (!url) {
        return res.status(400).send('Missing url parameter');
    }

    // Validar que es una URL de Opynio
    if (!url.includes('web.opynio.com')) {
        return res.status(403).send('Only web.opynio.com URLs allowed');
    }

    // Verificar caché
    const cached = getCached(url);
    if (cached) {
        return res.send(cached);
    }

    let page = null;
    try {
        const browserInstance = await getBrowser();
        page = await browserInstance.newPage();

        // Bloquear recursos innecesarios para acelerar
        await page.setRequestInterception(true);
        page.on('request', (request) => {
            const resourceType = request.resourceType();
            if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
                request.abort();
            } else {
                request.continue();
            }
        });

        // Configurar viewport y user agent
        await page.setViewport({ width: 1280, height: 800 });
        // IMPORTANTE: NO usar User-Agent de bot para evitar loop con nginx
        await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Prerender');

        console.log(`[RENDER] Iniciando: ${url}`);
        await page.goto(url, {
            waitUntil: 'networkidle0',
            timeout: RENDER_TIMEOUT
        });

        // Esperar un poco más para que React termine
        await new Promise(resolve => setTimeout(resolve, 1000));

        const html = await page.content();

        // SEO: Detectar si es página 404 para devolver código HTTP correcto
        const is404Page = html.includes('<title>404') ||
                          html.includes('noindex, nofollow') ||
                          html.includes('Página No Encontrada') ||
                          html.includes('Page Not Found');

        // Guardar en caché (solo si no es 404)
        if (!is404Page) {
            setCache(url, html);
        }

        console.log(`[RENDER] Completado: ${url}${is404Page ? ' (404)' : ''}`);

        // Devolver código HTTP apropiado
        if (is404Page) {
            res.status(404).send(html);
        } else {
            res.send(html);
        }

    } catch (error) {
        console.error(`[ERROR] ${url}: ${error.message}`);

        // Si el browser murió, resetear
        if (error.message.includes('Target closed') || error.message.includes('Session closed')) {
            browser = null;
        }

        res.status(500).send('Error rendering page');
    } finally {
        // Siempre cerrar la página
        if (page) {
            try {
                await page.close();
            } catch (e) {
                // Ignorar errores al cerrar
            }
        }
    }
});

// ============================================
// INICIAR SERVIDOR
// ============================================
app.listen(PORT, () => {
    console.log(`[SERVER] Prerender corriendo en puerto ${PORT}`);
    console.log(`[CONFIG] Caché TTL: ${CACHE_TTL/1000}s, Max: ${MAX_CACHE_SIZE} items`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('[SERVER] Apagando...');
    if (browser) {
        await browser.close();
    }
    process.exit(0);
});
