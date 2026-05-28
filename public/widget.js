/**
 * Opynio Widget Loader v6.4.8
 * External script for embedding Opynio review widgets
 * Usage: <script src="https://web.opynio.com/widget.js" async></script>
 *        <div class="opynio-widget" data-business-id="UUID" data-type="badge" data-theme="light"></div>
 *
 * Isolation (v6.4.0):
 *  - Human path renders inside a Shadow DOM attached to each widget element.
 *    CSS is fully isolated from the host: the host's themes (WordPress, Shopify,
 *    etc.) cannot pierce the widget, and the widget cannot leak styles to the
 *    host. The !important arms race is over.
 *  - Bot path stays in light DOM (no shadow) so crawlers index the canonical
 *    anchor trivially. Browsers without attachShadow also fall back to light
 *    DOM, keeping backwards compatibility.
 *
 * SEO posture (v6.2.0+):
 *  - Bots get a centralized minimal HTML for ALL widget types — never the
 *    full review content — to avoid duplicate-content indexation across hosts.
 *  - No JSON-LD AggregateRating is emitted in the host DOM. Google ignores
 *    self-serving review markup for LocalBusiness/Organization since 2019;
 *    structured data lives only in web.opynio.com (the canonical source).
 *  - All outbound anchors carry rel="noopener nofollow" to neutralize the
 *    link-scheme risk of mass-deployed widgets.
 *
 * SEO-safe lazy loading (v6.1+):
 *  - Bots bypass lazy and render immediately.
 *  - Humans: IntersectionObserver(rootMargin:'200px') schedules each widget,
 *    requestIdleCallback defers init so we never compete with host LCP.
 *  - setInterval pauses when the widget leaves viewport or document is hidden.
 *  - MutationObserver is scoped to .opynio-widget additions with a 50ms debounce.
 *  - Per-type min-height reservation prevents CLS on the host.
 */
(function() {
    'use strict';

    // Prevent multiple initializations
    if (window.OpynioWidgetLoaded) return;
    window.OpynioWidgetLoaded = true;

    // Configuration
    var API_URL = 'https://hvtrrhxeqrsnjxhngdsj.supabase.co/functions/v1/widget-proxy';
    var API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2dHJyaHhlcXJzbmp4aG5nZHNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ2ODU4MjAsImV4cCI6MjA3MDI2MTgyMH0.9pkukI3fhJ3ce8RQyyrD88mZ7oEk7VcmYLQCvgE07vU';
    var BASE_URL = 'https://web.opynio.com';

    // Bot detection — used to avoid injecting indexable review content into client pages
    // and to bypass lazy loading (bots don't scroll, so IO would never fire for them).
    // Googlebot Mobile renders with headless Chromium, so any HTML inserted by widget.js is indexed.
    // Widgets that opt into this guard (stars-carousel, etc.) render an SEO-safe minimal block for bots.
    //
    // Includes: search crawlers (Googlebot, Bingbot, AhrefsBot, SemrushBot, DuckDuckBot, Slurp,
    // Baiduspider, YandexBot, Applebot), social previewers (facebookexternalhit, Twitterbot,
    // LinkedInBot, WhatsApp, Discordbot, TelegramBot, Pinterest), AdSense crawler
    // (Mediapartners-Google), and Lighthouse / PageSpeed Insights (Chrome-Lighthouse) so that
    // PSI reports don't see a half-loaded lazy state and grade the host worse than reality.
    var BOT_REGEX = /Googlebot|Mediapartners-Google|bingbot|AhrefsBot|SemrushBot|DuckDuckBot|Slurp|Baiduspider|YandexBot|facebookexternalhit|Twitterbot|LinkedInBot|WhatsApp|Discordbot|TelegramBot|Pinterest|Applebot|Chrome-Lighthouse/i;
    var IS_BOT = BOT_REGEX.test((typeof navigator !== 'undefined' && navigator.userAgent) || '');

    // CSS Styles
    var WIDGET_CSS = `
        :root {
            --opynio-green: #00b67a;
            --opynio-green-dark: #008f5f;
            --opynio-green-light: #00d68f;
            --opynio-star: #ffc107;
        }
        .opynio-widget { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important; box-sizing: border-box !important; text-align: left !important; width: 100%; }
        .opynio-widget *, .opynio-widget *:before, .opynio-widget *:after { box-sizing: inherit !important; }

        /* WordPress Override Fixes */
        .opynio-widget .opynio-rating-badge { background: #00b67a !important; color: white !important; }
        .opynio-widget .opynio-logo-text { color: #00b67a !important; }
        .opynio-widget .opynio-nav-arrow { border-color: #00b67a !important; }
        .opynio-widget .opynio-nav-arrow:hover { background: #00b67a !important; }
        .opynio-widget .opynio-nav-arrow:active, .opynio-widget .opynio-nav-arrow.active-click { background: #00b67a !important; }
        .opynio-widget .opynio-nav-arrow svg { fill: #00b67a !important; }
        .opynio-widget .opynio-nav-arrow:hover svg, .opynio-widget .opynio-nav-arrow:active svg, .opynio-widget .opynio-nav-arrow.active-click svg { fill: white !important; }
        .opynio-widget .opynio-avatar-placeholder { background: linear-gradient(135deg, #00b67a, #00d68f) !important; }
        .opynio-widget .opynio-review-card:hover { border-color: #00b67a !important; }
        .opynio-widget .opynio-platform-badge svg circle { fill: #00b67a !important; }
        .opynio-widget .opynio-control-btn:hover { background: #00b67a !important; }
        .opynio-widget .opynio-sidebar-brand { color: #00b67a !important; }
        .opynio-widget .opynio-sidebar-cta { background: #00b67a !important; }
        .opynio-widget .opynio-sidebar-cta:hover { background: #008f5f !important; }
        .opynio-widget .opynio-floating-logo { color: #00b67a !important; }
        .opynio-widget .opynio-badge-logo { color: #00b67a !important; }
        .opynio-widget .opynio-large-carousel-quote-icon { color: #00b67a !important; }

        /* Themes */
        .opynio-theme-light {
            --bg-color: #f8f9fa;
            --text-color: #212529;
            --subtext-color: #495057;
            --card-bg: #ffffff;
            --border-color: #e9ecef;
            --shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
            --shadow-lg: 0 20px 60px rgba(0, 0, 0, 0.1);
        }
        .opynio-theme-dark {
            --bg-color: #111827;
            --text-color: #f3f4f6;
            --subtext-color: #9ca3af;
            --card-bg: #1f2937;
            --border-color: #374151;
            --shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
            --shadow-lg: 0 20px 60px rgba(0, 0, 0, 0.25);
        }

        /* Loader & Base */
        .opynio-loader { display: flex; justify-content: center; align-items: center; min-height: 150px; }
        .opynio-spinner { width: 40px; height: 40px; border: 4px solid var(--border-color); border-top-color: var(--opynio-green); border-radius: 50%; animation: opynio-spin 1s linear infinite; }
        @keyframes opynio-spin { to { transform: rotate(360deg); } }
        .opynio-stars { display: inline-flex; gap: 2px; }
        .opynio-stars span { color: var(--opynio-star); filter: drop-shadow(0 0 2px rgba(255, 193, 7, 0.3)); }
        .opynio-stars .empty { color: #e5e7eb; filter: none; }
        .opynio-theme-dark .opynio-stars .empty { color: #4b5563; }
        .opynio-stars-display { letter-spacing: 8px; text-shadow: 0 2px 8px rgba(255, 193, 7, 0.3); }
        .opynio-stars-display .empty { color: var(--border-color); text-shadow: none; }
        .opynio-google-badge, .opynio-opynio-badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 50px; font-size: 0.75rem; font-weight: 600; border: 1px solid; }
        .opynio-google-badge { background: rgba(66, 133, 244, 0.1); border-color: rgba(66, 133, 244, 0.2); }
        .opynio-opynio-badge { background: rgba(0, 182, 122, 0.1); border-color: rgba(0, 182, 122, 0.2); }
        .opynio-google-logo { width: 14px; height: 14px; flex-shrink: 0; }
        .opynio-google-text { color: #1e40af; }
        .opynio-opynio-text { color: #065f46; }
        .opynio-theme-dark .opynio-google-text { color: #93c5fd; }
        .opynio-theme-dark .opynio-opynio-text { color: #6ee7b7; }
        .opynio-platform-badge { flex-shrink: 0; width: 24px; height: 24px; }
        .opynio-platform-badge svg { width: 100%; height: 100%; }
        a.opynio-widget-link { text-decoration: none; color: inherit; display: block; }

        /* Horizontal Carousel */
        .opynio-horizontal-widget { padding: 50px; background: var(--card-bg); border-radius: 24px; box-shadow: var(--shadow-lg); max-width: 1400px; margin: 0 auto; width: 100%; position: relative; isolation: isolate; }
        .opynio-horizontal-wrapper { display: flex; gap: 40px; align-items: flex-start; }
        .opynio-rating-panel-wrapper { flex-shrink: 0; }
        .opynio-rating-panel { min-width: 300px; text-align: center; padding: 40px 30px; border-radius: 20px; box-shadow: var(--shadow); }
        .opynio-theme-light .opynio-rating-panel { background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); }
        .opynio-theme-dark .opynio-rating-panel { background: linear-gradient(135deg, #064e3b 0%, #065f46 100%); }
        .opynio-rating-badge { display: inline-block; background: var(--opynio-green) !important; color: white !important; padding: 10px 28px; border-radius: 50px; font-weight: 700; font-size: 1.5rem; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 20px; }
        .opynio-stars-display { font-size: 2.5rem; color: var(--opynio-star); margin-bottom: 15px; }
        .opynio-rating-count { font-size: 1.1rem; color: var(--subtext-color); font-weight: 500; margin-bottom: 20px; }
        .opynio-rating-count strong { color: var(--text-color); }
        .opynio-logo { padding-top: 20px; border-top: 2px solid rgba(0, 182, 122, 0.2); margin-top: 20px; }
        .opynio-logo-text { font-size: 2rem; font-weight: 900; color: var(--opynio-green) !important; }
        .opynio-cards-container { flex: 1; position: relative; overflow: hidden; padding: 10px 60px 10px 10px; }
        .opynio-cards-track { display: flex; gap: 20px; transition: transform 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94); }
        .opynio-cards-track.no-transition { transition: none; }
        .opynio-review-card { min-width: 350px; max-width: 350px; width: 350px; min-height: 280px; height: auto; border-radius: 20px; padding: 25px; border: 2px solid var(--border-color); flex-shrink: 0; transition: all 0.3s ease; position: relative; background: var(--card-bg); display: flex; flex-direction: column; }
        .opynio-review-card:hover { transform: translateY(-8px); box-shadow: 0 15px 40px rgba(0, 182, 122, 0.15); border-color: var(--opynio-green) !important; }
        .opynio-review-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px; }
        .opynio-review-user { display: flex; gap: 12px; align-items: flex-start; flex: 1; }
        .opynio-avatar-placeholder { width: 45px; height: 45px; border-radius: 50%; background: linear-gradient(135deg, var(--opynio-green), var(--opynio-green-light)) !important; display: flex; align-items: center; justify-content: center; color: white !important; font-weight: 700; font-size: 1.2rem; flex-shrink: 0; box-shadow: 0 4px 12px rgba(0, 182, 122, 0.25); }
        .opynio-user-content { flex: 1; min-width: 0; }
        .opynio-username { font-weight: 700; color: var(--text-color); font-size: 1rem; margin-bottom: 6px; }
        .opynio-review-title { font-weight: 700; color: var(--text-color); margin-bottom: 0.5rem; font-size: 1rem; }
        .opynio-review-stars { display: flex; align-items: center; gap: 10px; margin-bottom: 15px; }
        .opynio-review-stars .opynio-stars { font-size: 1.1rem; letter-spacing: 2px; }
        .opynio-review-text { color: var(--subtext-color); line-height: 1.6; font-size: 0.9rem; flex: 1; margin-bottom: 10px; max-height: 120px; overflow-y: auto; overflow-x: hidden; word-wrap: break-word; }
        .opynio-review-text::-webkit-scrollbar { width: 6px; }
        .opynio-review-text::-webkit-scrollbar-track { background: transparent; }
        .opynio-review-text::-webkit-scrollbar-thumb { background: var(--border-color); border-radius: 3px; }
        .opynio-review-text::-webkit-scrollbar-thumb:hover { background: var(--opynio-green); }

        .opynio-nav-arrow {
            position: absolute;
            top: 105px;
            width: 45px;
            height: 45px;
            border-radius: 50%;
            border: 2px solid var(--opynio-green) !important;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.3s ease;
            z-index: 10;
            padding: 0 !important;
            margin: 0 !important;
            background: var(--card-bg) !important;
            outline: none !important;
            box-shadow: none !important;
            user-select: none;
        }

        .opynio-theme-dark .opynio-nav-arrow { background: #374151; border-color: var(--opynio-green-light); }
        .opynio-nav-arrow:hover { background: var(--opynio-green) !important; transform: scale(1.1); }
        .opynio-nav-arrow:active, .opynio-nav-arrow.active-click { background: var(--opynio-green) !important; transform: scale(0.95); }
        .opynio-nav-arrow svg { width: 24px; height: 24px; fill: var(--opynio-green) !important; transition: fill 0.3s ease; pointer-events: none; }
        .opynio-nav-arrow:hover svg, .opynio-nav-arrow:active svg, .opynio-nav-arrow.active-click svg { fill: white !important; }
        .opynio-nav-arrow:focus { outline: none !important; box-shadow: none !important; }
        .opynio-nav-next { right: 10px; }
        .opynio-nav-prev { left: -50px; opacity: 0; transition: opacity 0.3s, left 0.3s ease-out; }
        .opynio-cards-container:hover .opynio-nav-prev { opacity: 1; left: 10px; }

        /* Responsive Design - Horizontal Carousel */
        @media (max-width: 1200px) { .opynio-horizontal-widget { padding: 40px 30px; } }
        @media (max-width: 1024px) {
            .opynio-horizontal-wrapper { flex-direction: column; align-items: center; }
            .opynio-rating-panel-wrapper { width: 100%; max-width: 500px; margin-bottom: 30px; }
            .opynio-cards-container { width: 100%; max-width: 100%; padding: 10px 55px; overflow-x: hidden; }
            .opynio-review-card { min-width: 350px; max-width: 350px; width: 350px; height: auto; min-height: 300px; padding: 22px; }
        }
        @media (max-width: 768px) {
            .opynio-horizontal-widget { padding: 25px 15px; border-radius: 16px; }
            .opynio-horizontal-wrapper { gap: 25px; flex-direction: column; align-items: center; }
            .opynio-rating-panel-wrapper { width: 100%; max-width: 100%; margin-bottom: 0; }
            .opynio-rating-panel { min-width: 100%; padding: 25px 20px; }
            .opynio-rating-badge { font-size: 1.1rem; padding: 8px 20px; letter-spacing: 1px; }
            .opynio-stars-display { font-size: 1.8rem; letter-spacing: 4px; }
            .opynio-cards-container { width: 100%; max-width: 100%; padding: 10px 50px; overflow: hidden; }
            .opynio-review-card { min-width: 100%; max-width: 100%; width: 100%; height: auto; min-height: 280px; padding: 20px; }
            .opynio-nav-arrow { width: 40px; height: 40px; top: 50%; transform: translateY(-50%); }
            .opynio-nav-arrow:hover { transform: translateY(-50%) scale(1.1); }
            .opynio-nav-next { right: 5px; }
            .opynio-nav-prev { left: 5px; opacity: 1; }
        }
        @media (max-width: 480px) {
            .opynio-horizontal-widget { padding: 20px 10px; }
            .opynio-rating-panel { padding: 20px 15px; }
            .opynio-rating-badge { font-size: 1rem; padding: 6px 16px; }
            .opynio-stars-display { font-size: 1.5rem; letter-spacing: 3px; }
            .opynio-cards-container { padding: 10px 45px; }
            .opynio-review-card { padding: 18px; min-height: 300px; }
            .opynio-nav-arrow { width: 38px; height: 38px; }
            .opynio-nav-arrow svg { width: 20px; height: 20px; }
            .opynio-avatar-placeholder { width: 38px; height: 38px; font-size: 1rem; }
        }

        /* Showcase Widget */
        .opynio-showcase-widget { background: var(--card-bg); padding: 1.5rem; border-radius: 16px; box-shadow: var(--shadow); border: 1px solid var(--border-color); }
        .opynio-showcase-header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 1rem; border-bottom: 1px solid var(--border-color); }
        .opynio-showcase-biz-name { font-size: 1.25rem; font-weight: bold; color: var(--text-color); margin-bottom: 0.25rem; }
        .opynio-showcase-subtitle { font-size: 0.875rem; color: var(--subtext-color); }
        .opynio-showcase-summary { text-align: right; }
        .opynio-showcase-summary-stars { display: flex; align-items: center; gap: 0.5rem; justify-content: flex-end; }
        .opynio-showcase-summary-avg { font-size: 1.5rem; font-weight: bold; color: var(--text-color); }
        .opynio-showcase-summary-stars .opynio-stars { font-size: 1.25rem; }
        .opynio-showcase-summary-total { font-size: 0.8rem; color: var(--subtext-color); }
        .opynio-showcase-grid { margin-top: 1.5rem; display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem; }
        .opynio-showcase-card { border: 1px solid var(--border-color); border-radius: 12px; padding: 1rem; }
        .opynio-showcase-card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem; }
        .opynio-showcase-card-name { font-weight: 600; color: var(--text-color); }
        .opynio-showcase-card-text { font-size: 0.875rem; color: var(--subtext-color); font-style: italic; }
        .opynio-showcase-card .opynio-google-badge, .opynio-showcase-card .opynio-opynio-badge { margin-top: 0.75rem; }
        .opynio-showcase-card-title, .opynio-grid-title, .opynio-wall-title { font-weight: 600; color: var(--text-color); margin-top: 0.5rem; margin-bottom: 0.5rem; font-size: 0.95rem; }

        /* Reusable Pagination Controls */
        .opynio-controls { text-align: right; margin-top: 1.5rem; }
        .opynio-control-btn { background: var(--border-color); color: var(--subtext-color); border: none; width: 36px; height: 36px; border-radius: 50%; font-size: 1.3rem; cursor: pointer; transition: all 0.2s; margin-left: 0.5rem; }
        .opynio-control-btn:hover { background: var(--opynio-green); color: white; transform: scale(1.1); }
        .opynio-control-btn:disabled { background: var(--border-color); color: #ccc; cursor: not-allowed; transform: none; }
        .opynio-theme-dark .opynio-control-btn:disabled { color: #555; }

        /* Large Carousel */
        .opynio-large-carousel { position: relative; max-width: 450px; margin: auto; overflow: hidden; }
        .opynio-large-carousel-track { display: flex; transition: transform 0.4s ease-in-out; }
        .opynio-large-carousel-slide { min-width: 100%; width: 100%; padding: 2rem; text-align: center; background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 16px; box-shadow: var(--shadow); }
        .opynio-large-carousel-quote-icon { font-size: 4rem; color: var(--opynio-green); line-height: 0.5; }
        .opynio-large-carousel-title { font-weight: bold; margin-top: 1rem; color: var(--text-color); }
        .opynio-large-carousel-slide .opynio-stars { justify-content: center; font-size: 1.5rem; margin-top: 1rem; }
        .opynio-large-carousel-slide p { font-style: italic; font-size: 1.1rem; color: var(--text-color); margin-top: 1rem; }
        .opynio-large-carousel-slide .author { font-weight: 600; color: var(--subtext-color); margin-top: 1.5rem; }
        .opynio-large-carousel-nav { position: absolute; top: 50%; width: 100%; display: flex; justify-content: space-between; transform: translateY(-50%); padding: 0 0.5rem; pointer-events: none; }
        .opynio-large-carousel-btn { background: rgba(0,0,0,0.2); color: white; border: none; width: 40px; height: 40px; border-radius: 50%; font-size: 1.5rem; cursor: pointer; transition: background-color 0.2s; pointer-events: all; }
        .opynio-large-carousel-btn:hover { background: rgba(0,0,0,0.4); }

        /* Sidebar */
        .opynio-sidebar { background: var(--card-bg); padding: 1.5rem; border-radius: 12px; box-shadow: var(--shadow); border: 1px solid var(--border-color); max-width: 300px; margin: auto; text-align: center; }
        .opynio-sidebar-brand { font-size: 1.5rem; font-weight: bold; color: var(--opynio-green); }
        .opynio-sidebar h3 { font-size: 1rem; font-weight: 600; color: var(--text-color); margin-top: 1rem; }
        .opynio-sidebar-summary { background: var(--bg-color); padding: 1rem; border-radius: 8px; margin-top: 1rem; }
        .opynio-sidebar-avg { font-size: 2rem; font-weight: bold; color: var(--text-color); }
        .opynio-sidebar-summary .opynio-stars { justify-content: center; margin-top: 0.25rem; }
        .opynio-sidebar-total { font-size: 0.8rem; color: var(--subtext-color); margin-top: 0.25rem; }
        .opynio-sidebar-cta { display: block; background: var(--opynio-green); color: #fff; font-weight: 600; padding: 0.75rem; border-radius: 8px; margin-top: 1rem; text-decoration: none; transition: background-color 0.2s; }
        .opynio-sidebar-cta:hover { background-color: var(--opynio-green-dark); }

        /* Floating — supports data-position: bottom-left (default), bottom-right, top-left, top-right.
           Auto-hides on scroll-down, reappears on scroll-up. The hidden translation is per-position
           so the pill always exits toward its anchored edge (top-anchored slides up, bottom slides down). */
        .opynio-floating { position: fixed; z-index: 1000; transition: transform 0.3s ease, opacity 0.3s ease; }
        .opynio-floating-pos-bl { bottom: 20px; left: 20px; }
        .opynio-floating-pos-br { bottom: 20px; right: 20px; }
        .opynio-floating-pos-tl { top: 20px; left: 20px; }
        .opynio-floating-pos-tr { top: 20px; right: 20px; }
        .opynio-floating-pos-bl.opynio-floating-hidden,
        .opynio-floating-pos-br.opynio-floating-hidden { transform: translateY(150%); opacity: 0; pointer-events: none; }
        .opynio-floating-pos-tl.opynio-floating-hidden,
        .opynio-floating-pos-tr.opynio-floating-hidden { transform: translateY(-150%); opacity: 0; pointer-events: none; }
        .opynio-floating-trigger { background: var(--card-bg); padding: 0.75rem 1rem; border-radius: 50px; box-shadow: var(--shadow-lg); border: 1px solid var(--border-color); display: flex; align-items: center; gap: 0.75rem; cursor: pointer; transition: transform 0.2s; text-decoration: none; color: inherit; }
        .opynio-floating-trigger:hover { transform: scale(1.05); }
        .opynio-floating-logo { font-size: 0.9rem; font-weight: bold; color: var(--opynio-green) !important; }
        .opynio-floating-avg { font-weight: bold; color: var(--text-color); }
        .opynio-floating .opynio-stars { font-size: 0.8rem; }

        /* Grid */
        .opynio-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem; }
        .opynio-grid-card { background: var(--card-bg); padding: 1rem; border-radius: 12px; box-shadow: var(--shadow); border: 1px solid var(--border-color); }
        .opynio-grid-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; }
        .opynio-grid-author { font-weight: 600; color: var(--text-color); }
        .opynio-grid-card p { font-size: 0.875rem; color: var(--subtext-color); font-style: italic; }

        /* Badge */
        .opynio-badge { display: inline-block; background: var(--card-bg); padding: 1rem 1.5rem; border-radius: 12px; box-shadow: var(--shadow); border: 1px solid var(--border-color); }
        .opynio-badge-content { display: flex; align-items: center; gap: 1rem; }
        .opynio-badge-logo { font-size: 1.5rem; font-weight: bold; color: var(--opynio-green); }
        .opynio-badge-text { font-size: 0.8rem; color: var(--subtext-color); margin-top: 0.25rem; }
        .opynio-badge .opynio-stars { font-size: 1rem; }
        .opynio-badge-content > div:last-child { border-left: 1px solid var(--border-color); padding-left: 1rem; }

        /* Wall */
        .opynio-wall { columns: 3 250px; column-gap: 1rem; }
        .opynio-wall-card { background: var(--card-bg); padding: 1rem; border-radius: 12px; box-shadow: var(--shadow); border: 1px solid var(--border-color); margin-bottom: 1rem; break-inside: avoid; }
        .opynio-wall-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; }
        .opynio-wall-author { font-weight: 600; color: var(--text-color); }
        .opynio-wall-card p { font-size: 0.875rem; color: var(--subtext-color); font-style: italic; }

        /* Floating count */
        .opynio-floating-count { font-size: 0.75rem; color: var(--subtext-color); margin-left: 4px; }

        /* Badge count */
        .opynio-badge-count { font-size: 0.7rem; color: var(--subtext-color); margin-top: 2px; }

        /* Stars Carousel — cuadro blanco + panel verde + 3 cards + botón footer.
           container-type: el widget responde a SU ancho, no al viewport. */
        .opynio-stars-carousel-widget {
            background: var(--card-bg);
            border-radius: 20px;
            box-shadow: var(--shadow-lg);
            padding: 24px;
            max-width: 880px;
            margin: 0 auto;
            position: relative;
            display: flex;
            flex-direction: column;
            container-type: inline-size;
        }
        .opynio-stars-carousel-wrapper { display: flex; gap: 22px; align-items: stretch; justify-content: center; }
        .opynio-stars-carousel-right { display: flex; flex-direction: column; gap: 16px; align-items: center; justify-content: center; }
        .opynio-stars-carousel-cta-link { text-decoration: none; color: inherit; display: flex; flex-shrink: 0; }
        .opynio-stars-carousel-cta {
            flex: 1;
            min-width: 210px; text-align: center;
            padding: 22px 18px; border-radius: 16px; box-shadow: var(--shadow);
            display: flex; flex-direction: column; justify-content: center; align-items: center;
            gap: 8px;
            transition: transform 0.25s ease, box-shadow 0.25s ease;
        }
        .opynio-stars-carousel-cta-link:hover .opynio-stars-carousel-cta {
            transform: translateY(-2px);
            box-shadow: 0 10px 24px rgba(0, 182, 122, 0.18);
        }
        .opynio-theme-light .opynio-stars-carousel-cta { background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); }
        .opynio-theme-dark  .opynio-stars-carousel-cta { background: linear-gradient(135deg, #064e3b 0%, #065f46 100%); }
        .opynio-stars-carousel-score {
            font-size: 2.6rem; font-weight: 800;
            color: var(--text-color); line-height: 1;
            letter-spacing: -0.02em;
            font-variant-numeric: tabular-nums;
        }
        .opynio-stars-carousel-score-stars { font-size: 1.15rem; letter-spacing: 3px; color: var(--opynio-star); }
        .opynio-stars-carousel-score-stars .empty { color: var(--border-color); }
        .opynio-stars-carousel-count { font-size: 0.82rem; color: var(--subtext-color); font-weight: 500; }
        .opynio-stars-carousel-count strong { color: var(--text-color); font-weight: 700; }
        .opynio-stars-carousel-rating-label {
            display: inline-flex; align-items: center; gap: 10px;
            color: var(--opynio-green-dark) !important;
            color: #008f5f !important;
            font-weight: 900; font-size: 0.95rem;
            text-transform: uppercase; letter-spacing: 2.5px;
            padding: 4px 0; margin-top: 4px;
        }
        .opynio-stars-carousel-rating-label::before,
        .opynio-stars-carousel-rating-label::after {
            content: ''; display: inline-block;
            width: 16px; height: 2px;
            background: var(--opynio-green) !important;
            background-color: #00b67a !important;
            border-radius: 1px;
        }
        .opynio-stars-carousel-footer {
            display: flex; justify-content: center;
        }
        .opynio-stars-carousel-footer-btn {
            display: inline-flex; align-items: center; gap: 8px;
            padding: 12px 28px; border-radius: 50px;
            background: var(--opynio-green) !important;
            background-color: #00b67a !important;
            color: white !important;
            border: none;
            font-weight: 700; font-size: 0.92rem;
            text-decoration: none;
            box-shadow: 0 6px 16px rgba(0, 182, 122, 0.3);
            transition: background 0.3s ease, transform 0.2s ease, box-shadow 0.3s ease;
        }
        .opynio-stars-carousel-footer-btn:hover {
            background: var(--opynio-green-dark) !important;
            background-color: #008f5f !important;
            transform: translateY(-2px);
            box-shadow: 0 10px 22px rgba(0, 182, 122, 0.4);
        }
        .opynio-stars-carousel-footer-btn:focus-visible { outline: 3px solid #00b67a; outline-offset: 3px; }
        .opynio-stars-carousel-footer-btn svg { width: 14px; height: 14px; fill: white; transition: transform 0.2s ease; }
        .opynio-stars-carousel-footer-btn:hover svg { transform: translateX(2px); }
        .opynio-stars-carousel-cards-area { flex: 0 1 auto; position: relative; padding: 0 42px; display: flex; align-items: center; }
        .opynio-stars-carousel-cards-container { width: 523px; max-width: 100%; position: relative; overflow: hidden; padding: 4px 0; display: flex; align-items: center; }
        .opynio-stars-carousel-track { display: flex; gap: 14px; transition: transform 0.55s cubic-bezier(0.25, 0.46, 0.45, 0.94); }
        .opynio-stars-carousel-card {
            min-width: 165px; max-width: 165px; width: 165px;
            flex-shrink: 0;
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            gap: 10px;
            padding: 18px 14px;
            border-radius: 14px;
            background: var(--card-bg);
            border: 2px solid var(--border-color);
            box-shadow: var(--shadow);
            text-align: center;
            text-decoration: none; color: inherit; cursor: pointer; outline: none;
            transition: transform 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
        }
        .opynio-stars-carousel-card:hover {
            transform: translateY(-4px);
            border-color: var(--opynio-green) !important;
            border-color: #00b67a !important;
            box-shadow: 0 10px 26px rgba(0, 182, 122, 0.15);
        }
        .opynio-stars-carousel-card:focus-visible { outline: 3px solid #00b67a; outline-offset: 3px; }
        .opynio-stars-carousel-card .opynio-avatar-placeholder { width: 44px !important; height: 44px !important; font-size: 1.1rem !important; }
        .opynio-stars-carousel-card-name {
            font-weight: 700; color: var(--text-color);
            font-size: 0.9rem;
            max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .opynio-stars-carousel-card-stars {
            font-size: 1rem; letter-spacing: 2px;
            color: var(--opynio-star);
        }
        .opynio-stars-carousel-card-stars .empty { color: var(--border-color); }
        .opynio-stars-carousel-nav {
            position: absolute; top: 50%; transform: translateY(-50%);
            width: 42px; height: 42px; border-radius: 50%;
            border: 2px solid var(--opynio-green) !important;
            border-color: #00b67a !important;
            background: var(--card-bg) !important;
            display: flex; align-items: center; justify-content: center;
            cursor: pointer; padding: 0 !important; margin: 0 !important;
            outline: none !important; z-index: 10;
            transition: background 0.3s ease, transform 0.3s ease;
        }
        .opynio-theme-dark .opynio-stars-carousel-nav { background: #374151 !important; border-color: var(--opynio-green-light) !important; }
        .opynio-stars-carousel-nav:hover {
            background: var(--opynio-green) !important;
            background-color: #00b67a !important;
            transform: translateY(-50%) scale(1.1);
        }
        .opynio-stars-carousel-nav svg {
            width: 20px; height: 20px;
            fill: var(--opynio-green) !important;
            fill: #00b67a !important;
            transition: fill 0.3s ease; pointer-events: none;
        }
        .opynio-stars-carousel-nav:hover svg { fill: white !important; }
        .opynio-stars-carousel-nav:focus-visible { outline: 3px solid #00b67a; outline-offset: 2px; }
        .opynio-stars-carousel-nav-next { right: 0; }
        .opynio-stars-carousel-nav-prev {
            left: 0; opacity: 0;
            transition: opacity 0.3s ease, background 0.3s ease, transform 0.3s ease;
        }
        .opynio-stars-carousel-cards-area:hover .opynio-stars-carousel-nav-prev { opacity: 1; }
        @container (max-width: 760px) {
            .opynio-stars-carousel-widget { padding: 22px 18px; }
            .opynio-stars-carousel-wrapper { flex-direction: column; gap: 18px; }
            .opynio-stars-carousel-cta-link { width: 100%; }
            .opynio-stars-carousel-cta { min-width: 100%; padding: 20px 16px; }
            .opynio-stars-carousel-right { width: 100%; }
            .opynio-stars-carousel-cards-area { padding: 0 42px; width: 100%; }
            .opynio-stars-carousel-cards-container { width: 100%; max-width: 100%; }
            .opynio-stars-carousel-track { justify-content: center; }
            .opynio-stars-carousel-nav-prev { opacity: 1; }
        }
        @container (max-width: 480px) {
            .opynio-stars-carousel-widget { padding: 18px 12px; }
            .opynio-stars-carousel-score { font-size: 2.2rem; }
            .opynio-stars-carousel-card { min-width: 150px; max-width: 150px; width: 150px; padding: 16px 12px; }
            .opynio-stars-carousel-card .opynio-avatar-placeholder { width: 40px !important; height: 40px !important; font-size: 1rem !important; }
            .opynio-stars-carousel-nav { width: 32px; height: 32px; }
        }

    `;

    // Inject styles into the host's <head>. Only used for the bot path and as a
    // fallback for browsers without attachShadow — the human path lives inside a
    // Shadow DOM with its own scoped style copy (see attachWidgetShell).
    function injectStyles() {
        if (document.getElementById('opynio-widget-styles')) return;
        var style = document.createElement('style');
        style.id = 'opynio-widget-styles';
        style.textContent = WIDGET_CSS;
        document.head.appendChild(style);
    }

    // ---------------------------------------------------------------
    // Shadow DOM isolation (v6.4.0)
    // ---------------------------------------------------------------
    // CSS for shadow scope:
    //   - :root → :host  (CSS variables declared on the host element)
    //   - !important stripped — pointless inside a shadow boundary, no host
    //     selector can pierce in to outweigh us. Cleaner cascade.
    var WIDGET_CSS_SHADOW = WIDGET_CSS
        .replace(/:root\s*\{/g, ':host {')
        // Strip !important only when followed by a declaration terminator (; or }),
        // so a literal "!important" inside a string value (e.g. content: "...")
        // would survive untouched. None today, but defensive.
        .replace(/\s*!important(?=\s*[;}])/g, '');

    // Constructable Stylesheets are shared across shadow roots — one stylesheet
    // object reused by every widget instead of N copies parsed N times.
    var sharedStylesheet = null;
    function getSharedStylesheet() {
        if (sharedStylesheet) return sharedStylesheet;
        try {
            if (typeof CSSStyleSheet === 'function' && CSSStyleSheet.prototype.replaceSync) {
                sharedStylesheet = new CSSStyleSheet();
                sharedStylesheet.replaceSync(WIDGET_CSS_SHADOW);
                return sharedStylesheet;
            }
        } catch (e) { /* fall through */ }
        return null;
    }

    var supportsShadow = typeof Element !== 'undefined'
        && typeof Element.prototype.attachShadow === 'function';

    // Attach an open shadow root with a wrapper div that carries the same
    // .opynio-widget + theme classes, so the existing CSS selectors keep
    // working unchanged inside the shadow scope.
    //
    // Returns null when attachShadow throws — happens for elements that don't
    // support shadow (<input>, <img>, etc.) or when the host already has a
    // closed shadow root. Caller must fall back to light DOM in that case.
    function attachWidgetShell(el, theme) {
        if (el.__opynioRoot) return el.__opynioRoot;
        var shadow;
        try {
            shadow = el.attachShadow({ mode: 'open' });
        } catch (e) {
            return null;
        }
        var sheet = getSharedStylesheet();
        if (sheet && shadow.adoptedStyleSheets !== undefined) {
            shadow.adoptedStyleSheets = [sheet];
        } else {
            var styleEl = document.createElement('style');
            styleEl.textContent = WIDGET_CSS_SHADOW;
            shadow.appendChild(styleEl);
        }
        var wrapper = document.createElement('div');
        wrapper.className = 'opynio-widget opynio-theme-' + (theme || 'light');
        shadow.appendChild(wrapper);
        el.__opynioShadow = shadow;
        el.__opynioRoot = wrapper;
        return wrapper;
    }

    // Helper functions
    function renderLoader(el) {
        el.innerHTML = '<div class="opynio-loader"><div class="opynio-spinner"></div></div>';
    }

    function escapeHtml(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function renderError(el, msg) {
        el.innerHTML = '<div style="color:#c00;padding:20px;border:1px solid #fdd;background:#ffeeee;border-radius:8px;"><strong>Error Opynio:</strong><br>' + escapeHtml(msg) + '</div>';
    }

    function generateStars(rating) {
        // Validate rating - default to 0 if invalid
        var validRating = (rating && !isNaN(rating)) ? Math.max(0, Math.min(5, rating)) : 0;
        return Array(5).fill(0).map(function(_, i) {
            return '<span class="' + (i < Math.round(validRating) ? 'full' : 'empty') + '">★</span>';
        }).join('');
    }

    // Mapeo country → prefijo de URL pública en Opynio.
    // Mantén sincronizado con pathTranslations.business + countryToUrlCode del frontend.
    // Si la empresa no tiene country, fallback a /es/empresa (canonical histórico).
    var COUNTRY_TO_URL_PATH = {
        'ES': '/es/empresa', 'MX': '/mx/empresa', 'AR': '/ar/empresa', 'CO': '/co/empresa',
        'CL': '/cl/empresa', 'PE': '/pe/empresa', 'VE': '/ve/empresa', 'EC': '/ec/empresa',
        'GT': '/gt/empresa', 'CR': '/cr/empresa', 'PA': '/pa/empresa', 'UY': '/uy/empresa',
        'US': '/us/business', 'GB': '/gb/business',
        'BR': '/br/empresa', 'PT': '/pt/empresa',
        'FR': '/fr/entreprise', 'DE': '/de/unternehmen', 'IT': '/it/azienda',
        'AD': '/ad/empresa', 'CN': '/cn/公司',
        'SE': '/se/foretag', 'PL': '/pl/firma', 'JP': '/jp/会社'
    };

    function getBusinessUrl(business) {
        // Identificador: slug canónico si existe (evita redirect 301 al name URL-encoded)
        var identifier = (business && business.slug)
            ? business.slug
            : encodeURIComponent(((business && business.name) ? business.name : 'business').replace(/ /g, '_'));
        var country = (business && business.country) ? String(business.country).toUpperCase() : 'ES';
        var pathPrefix = COUNTRY_TO_URL_PATH[country] || '/es/empresa';
        return BASE_URL + pathPrefix + '/' + identifier;
    }

    // Widget UI strings (static text translations)
    var UI_STRINGS = {
        es: { reviews: 'reseñas', outOf5: 'de 5 estrellas', customerRatings: 'Valoración de nuestros clientes', basedOn: 'Basado en {n} reseñas', basedOnAlt: 'A base de <strong>{n} reseñas</strong>', seeMore: 'Ver más', seeAllReviews: 'Ver reseñas completas', writeReview: 'Escribe tu reseña', anonymous: 'Anónimo', noReviews: 'No hay reseñas.', noReviewsText: 'No hay reseñas con texto para mostrar.', multimediaReview: 'Reseña multimedia.', ratingExcellent: 'EXCELENTE', ratingVeryGood: 'MUY BUENO', ratingGood: 'BUENO', googleReview: 'Opinión de Google', opynioReview: 'Opinión de Opynio', close: 'Cerrar' },
        en: { reviews: 'reviews', outOf5: 'out of 5 stars', customerRatings: 'Our customer ratings', basedOn: 'Based on {n} reviews', basedOnAlt: 'Based on <strong>{n} reviews</strong>', seeMore: 'See more', seeAllReviews: 'See all reviews', writeReview: 'Write a review', anonymous: 'Anonymous', noReviews: 'No reviews.', noReviewsText: 'No reviews with text to show.', multimediaReview: 'Multimedia review.', ratingExcellent: 'EXCELLENT', ratingVeryGood: 'VERY GOOD', ratingGood: 'GOOD', googleReview: 'Google Review', opynioReview: 'Opynio Review', close: 'Close' },
        fr: { reviews: 'avis', outOf5: 'sur 5 étoiles', customerRatings: 'Évaluation de nos clients', basedOn: 'Basé sur {n} avis', basedOnAlt: 'Basé sur <strong>{n} avis</strong>', seeMore: 'Voir plus', seeAllReviews: 'Voir tous les avis', writeReview: 'Écrire un avis', anonymous: 'Anonyme', noReviews: 'Pas d\'avis.', noReviewsText: 'Pas d\'avis avec du texte.', multimediaReview: 'Avis multimédia.', ratingExcellent: 'EXCELLENT', ratingVeryGood: 'TRÈS BIEN', ratingGood: 'BIEN', googleReview: 'Avis Google', opynioReview: 'Avis Opynio', close: 'Fermer' },
        de: { reviews: 'Bewertungen', outOf5: 'von 5 Sternen', customerRatings: 'Bewertung unserer Kunden', basedOn: 'Basierend auf {n} Bewertungen', basedOnAlt: 'Basierend auf <strong>{n} Bewertungen</strong>', seeMore: 'Mehr sehen', seeAllReviews: 'Alle Bewertungen ansehen', writeReview: 'Bewertung schreiben', anonymous: 'Anonym', noReviews: 'Keine Bewertungen.', noReviewsText: 'Keine Bewertungen mit Text.', multimediaReview: 'Multimedia-Bewertung.', ratingExcellent: 'AUSGEZEICHNET', ratingVeryGood: 'SEHR GUT', ratingGood: 'GUT', googleReview: 'Google-Bewertung', opynioReview: 'Opynio-Bewertung', close: 'Schließen' },
        it: { reviews: 'recensioni', outOf5: 'su 5 stelle', customerRatings: 'Valutazione dei nostri clienti', basedOn: 'Basato su {n} recensioni', basedOnAlt: 'Basato su <strong>{n} recensioni</strong>', seeMore: 'Vedi di più', seeAllReviews: 'Vedi tutte le recensioni', writeReview: 'Scrivi una recensione', anonymous: 'Anonimo', noReviews: 'Nessuna recensione.', noReviewsText: 'Nessuna recensione con testo.', multimediaReview: 'Recensione multimediale.', ratingExcellent: 'ECCELLENTE', ratingVeryGood: 'MOLTO BUONO', ratingGood: 'BUONO', googleReview: 'Recensione Google', opynioReview: 'Recensione Opynio', close: 'Chiudi' },
        pt: { reviews: 'avaliações', outOf5: 'de 5 estrelas', customerRatings: 'Avaliação dos nossos clientes', basedOn: 'Baseado em {n} avaliações', basedOnAlt: 'Baseado em <strong>{n} avaliações</strong>', seeMore: 'Ver mais', seeAllReviews: 'Ver todas as avaliações', writeReview: 'Escrever avaliação', anonymous: 'Anônimo', noReviews: 'Sem avaliações.', noReviewsText: 'Sem avaliações com texto.', multimediaReview: 'Avaliação multimídia.', ratingExcellent: 'EXCELENTE', ratingVeryGood: 'MUITO BOM', ratingGood: 'BOM', googleReview: 'Avaliação do Google', opynioReview: 'Avaliação do Opynio', close: 'Fechar' },
        ca: { reviews: 'ressenyes', outOf5: 'de 5 estrelles', customerRatings: 'Valoració dels nostres clients', basedOn: 'Basat en {n} ressenyes', basedOnAlt: 'Basat en <strong>{n} ressenyes</strong>', seeMore: 'Veure més', seeAllReviews: 'Veure totes les ressenyes', writeReview: 'Escriu la teva ressenya', anonymous: 'Anònim', noReviews: 'No hi ha ressenyes.', noReviewsText: 'No hi ha ressenyes amb text.', multimediaReview: 'Ressenya multimèdia.', ratingExcellent: 'EXCEL·LENT', ratingVeryGood: 'MOLT BO', ratingGood: 'BO', googleReview: 'Ressenya de Google', opynioReview: "Ressenya d'Opynio", close: 'Tancar' },
        zh: { reviews: '评论', outOf5: '/ 5 星', customerRatings: '客户评价', basedOn: '基于 {n} 条评论', basedOnAlt: '基于 <strong>{n} 条评论</strong>', seeMore: '查看更多', seeAllReviews: '查看所有评论', writeReview: '写评论', anonymous: '匿名', noReviews: '暂无评论。', noReviewsText: '暂无文字评论。', multimediaReview: '多媒体评论。', ratingExcellent: '优秀', ratingVeryGood: '很好', ratingGood: '好', googleReview: 'Google 评论', opynioReview: 'Opynio 评论', close: '关闭' },
        ja: { reviews: 'レビュー', outOf5: '/ 5 つ星', customerRatings: 'お客様の評価', basedOn: '{n} 件のレビューに基づく', basedOnAlt: '<strong>{n} 件のレビュー</strong>に基づく', seeMore: 'もっと見る', seeAllReviews: 'すべてのレビューを見る', writeReview: 'レビューを書く', anonymous: '匿名', noReviews: 'レビューはありません。', noReviewsText: 'テキスト付きのレビューはありません。', multimediaReview: 'マルチメディアレビュー。', ratingExcellent: '最高', ratingVeryGood: 'とても良い', ratingGood: '良い', googleReview: 'Google レビュー', opynioReview: 'Opynio レビュー', close: '閉じる' },
        ko: { reviews: '리뷰', outOf5: '/ 5 점', customerRatings: '고객 평가', basedOn: '{n}개 리뷰 기반', basedOnAlt: '<strong>{n}개 리뷰</strong> 기반', seeMore: '더 보기', seeAllReviews: '모든 리뷰 보기', writeReview: '리뷰 쓰기', anonymous: '익명', noReviews: '리뷰가 없습니다.', noReviewsText: '텍스트 리뷰가 없습니다.', multimediaReview: '멀티미디어 리뷰.', ratingExcellent: '최고', ratingVeryGood: '매우 좋음', ratingGood: '좋음', googleReview: 'Google 리뷰', opynioReview: 'Opynio 리뷰', close: '닫기' },
        nl: { reviews: 'beoordelingen', outOf5: 'van 5 sterren', customerRatings: 'Klantbeoordelingen', basedOn: 'Gebaseerd op {n} beoordelingen', basedOnAlt: 'Gebaseerd op <strong>{n} beoordelingen</strong>', seeMore: 'Meer zien', seeAllReviews: 'Alle beoordelingen bekijken', writeReview: 'Schrijf een beoordeling', anonymous: 'Anoniem', noReviews: 'Geen beoordelingen.', noReviewsText: 'Geen beoordelingen met tekst.', multimediaReview: 'Multimedia beoordeling.', ratingExcellent: 'UITSTEKEND', ratingVeryGood: 'ZEER GOED', ratingGood: 'GOED', googleReview: 'Google-beoordeling', opynioReview: 'Opynio-beoordeling', close: 'Sluiten' },
        ru: { reviews: 'отзывов', outOf5: 'из 5 звёзд', customerRatings: 'Оценки наших клиентов', basedOn: 'На основе {n} отзывов', basedOnAlt: 'На основе <strong>{n} отзывов</strong>', seeMore: 'Подробнее', seeAllReviews: 'Все отзывы', writeReview: 'Написать отзыв', anonymous: 'Аноним', noReviews: 'Нет отзывов.', noReviewsText: 'Нет текстовых отзывов.', multimediaReview: 'Мультимедиа отзыв.', ratingExcellent: 'ОТЛИЧНО', ratingVeryGood: 'ОЧЕНЬ ХОРОШО', ratingGood: 'ХОРОШО', googleReview: 'Отзыв Google', opynioReview: 'Отзыв Opynio', close: 'Закрыть' },
        ar: { reviews: 'تقييمات', outOf5: 'من 5 نجوم', customerRatings: 'تقييمات عملائنا', basedOn: 'بناءً على {n} تقييمات', basedOnAlt: 'بناءً على <strong>{n} تقييمات</strong>', seeMore: 'عرض المزيد', seeAllReviews: 'عرض جميع التقييمات', writeReview: 'اكتب تقييماً', anonymous: 'مجهول', noReviews: 'لا توجد تقييمات.', noReviewsText: 'لا توجد تقييمات نصية.', multimediaReview: 'تقييم وسائط متعددة.', ratingExcellent: 'ممتاز', ratingVeryGood: 'جيد جداً', ratingGood: 'جيد', googleReview: 'مراجعة Google', opynioReview: 'مراجعة Opynio', close: 'إغلاق' },
        sv: { reviews: 'recensioner', outOf5: 'av 5 stjärnor', customerRatings: 'Våra kunders betyg', basedOn: 'Baserat på {n} recensioner', basedOnAlt: 'Baserat på <strong>{n} recensioner</strong>', seeMore: 'Se mer', seeAllReviews: 'Se alla recensioner', writeReview: 'Skriv en recension', anonymous: 'Anonym', noReviews: 'Inga recensioner.', noReviewsText: 'Inga recensioner med text.', multimediaReview: 'Multimediarecension.', ratingExcellent: 'UTMÄRKT', ratingVeryGood: 'MYCKET BRA', ratingGood: 'BRA', googleReview: 'Google-recension', opynioReview: 'Opynio-recension', close: 'Stäng' },
        pl: { reviews: 'opinii', outOf5: 'na 5 gwiazdek', customerRatings: 'Oceny naszych klientów', basedOn: 'Na podstawie {n} opinii', basedOnAlt: 'Na podstawie <strong>{n} opinii</strong>', seeMore: 'Zobacz więcej', seeAllReviews: 'Zobacz wszystkie opinie', writeReview: 'Napisz opinię', anonymous: 'Anonim', noReviews: 'Brak opinii.', noReviewsText: 'Brak opinii z tekstem.', multimediaReview: 'Opinia multimedialna.', ratingExcellent: 'ZNAKOMICIE', ratingVeryGood: 'BARDZO DOBRZE', ratingGood: 'DOBRZE', googleReview: 'Opinia Google', opynioReview: 'Opinia Opynio', close: 'Zamknij' },
        vi: { reviews: 'đánh giá', outOf5: 'trên 5 sao', customerRatings: 'Đánh giá của khách hàng', basedOn: 'Dựa trên {n} đánh giá', basedOnAlt: 'Dựa trên <strong>{n} đánh giá</strong>', seeMore: 'Xem thêm', seeAllReviews: 'Xem tất cả đánh giá', writeReview: 'Viết đánh giá', anonymous: 'Ẩn danh', noReviews: 'Chưa có đánh giá.', noReviewsText: 'Không có đánh giá nào có văn bản.', multimediaReview: 'Đánh giá đa phương tiện.', ratingExcellent: 'XUẤT SẮC', ratingVeryGood: 'RẤT TỐT', ratingGood: 'TỐT', googleReview: 'Đánh giá Google', opynioReview: 'Đánh giá Opynio', close: 'Đóng' },
        bn: { reviews: 'পর্যালোচনা', outOf5: '৫ তারার মধ্যে', customerRatings: 'আমাদের গ্রাহক রেটিং', basedOn: '{n} পর্যালোচনার ভিত্তিতে', basedOnAlt: '<strong>{n} পর্যালোচনার</strong> ভিত্তিতে', seeMore: 'আরও দেখুন', seeAllReviews: 'সব পর্যালোচনা দেখুন', writeReview: 'পর্যালোচনা লিখুন', anonymous: 'নামহীন', noReviews: 'কোনো পর্যালোচনা নেই।', noReviewsText: 'দেখানোর জন্য পাঠ্য সহ কোনো পর্যালোচনা নেই।', multimediaReview: 'মাল্টিমিডিয়া পর্যালোচনা।', ratingExcellent: 'চমৎকার', ratingVeryGood: 'খুব ভালো', ratingGood: 'ভালো', googleReview: 'Google পর্যালোচনা', opynioReview: 'Opynio পর্যালোচনা', close: 'বন্ধ করুন' },
    };

    async function getStrings(lang) {
        var exact = UI_STRINGS[lang] || UI_STRINGS[lang.split('-')[0]];
        if (exact) return exact;
        // Translate English UI strings on-the-fly for unsupported languages
        var base = UI_STRINGS.en;
        var keys = Object.keys(base);
        var values = keys.map(function(k) { return base[k]; });
        var translated = await Promise.all(values.map(function(v) {
            // Skip strings with HTML tags — translate the plain text parts only
            if (v.indexOf('{n}') !== -1 || v.indexOf('<') !== -1) {
                return translateReviewText(v.replace(/<[^>]+>/g, '').replace('{n}', '888'), lang).then(function(t) {
                    // Restore {n} placeholder and reconstruct
                    return v.indexOf('<strong>') !== -1
                        ? t.replace('888', '<strong>{n}').replace(/$/, '</strong>').replace(/<\/strong><\/strong>/, '</strong>')
                        : t.replace('888', '{n}');
                });
            }
            return translateReviewText(v, lang);
        }));
        var result = {};
        keys.forEach(function(k, i) { result[k] = translated[i]; });
        UI_STRINGS[lang] = result; // Cache for future use
        return result;
    }

    // ---------------------------------------------------------------
    // Persistent translation cache (v6.3.0)
    // ---------------------------------------------------------------
    // Backed by localStorage so translations survive across page loads on the
    // host. Keyed by (text, targetLang); 7-day TTL so corrections to upstream
    // reviews eventually propagate. In-memory mirror avoids JSON.parse on
    // every lookup.
    var TX_KEY = 'opynio_tx_v1';
    var TX_TTL = 7 * 24 * 60 * 60 * 1000;

    function loadTranslationCache() {
        try {
            var raw = (typeof localStorage !== 'undefined') ? localStorage.getItem(TX_KEY) : null;
            if (!raw) return {};
            var data = JSON.parse(raw) || {};
            var now = Date.now();
            var cleaned = {};
            for (var k in data) {
                if (Object.prototype.hasOwnProperty.call(data, k) && data[k] && (now - data[k].ts) < TX_TTL) {
                    cleaned[k] = data[k];
                }
            }
            return cleaned;
        } catch (e) { return {}; }
    }

    var translationCache = loadTranslationCache();
    var translationCacheDirty = false;
    var translationFlushHandle = null;
    // Once localStorage rejects us (quota exceeded, security mode, etc.), stop
    // trying to persist. The in-memory cache keeps working for the page session;
    // without this flag every translated review would re-trigger the failure
    // and spam the host's console.
    var translationCacheBroken = false;

    function flushTranslationCache() {
        if (translationCacheBroken || !translationCacheDirty) return;
        try {
            if (typeof localStorage !== 'undefined') localStorage.setItem(TX_KEY, JSON.stringify(translationCache));
            translationCacheDirty = false;
        } catch (e) {
            translationCacheBroken = true;
            translationCacheDirty = false;
            try { if (typeof localStorage !== 'undefined') localStorage.removeItem(TX_KEY); } catch (e2) {}
        }
    }

    function scheduleTranslationFlush() {
        if (translationCacheBroken) return;
        translationCacheDirty = true;
        if (translationFlushHandle) return;
        translationFlushHandle = setTimeout(function() {
            translationFlushHandle = null;
            flushTranslationCache();
        }, 1000);
    }

    var LANG_MAP = { en: 'en', pt: 'pt', fr: 'fr', de: 'de', it: 'it', ca: 'ca', zh: 'zh-CN', ja: 'ja', ko: 'ko', nl: 'nl', ru: 'ru', ar: 'ar', sv: 'sv', pl: 'pl' };

    function detectTargetLang() {
        // 1. Page's <html lang="fr"> (set by i18n frameworks)
        var htmlLang = document.documentElement.lang;
        if (htmlLang) return htmlLang.split('-')[0].toLowerCase();
        // 2. Fallback to browser language
        return (navigator.language || navigator.userLanguage || 'es').split('-')[0].toLowerCase();
    }

    async function translateReviewText(text, targetLang) {
        if (!text) return text;
        var targetCode = LANG_MAP[targetLang] || targetLang;
        var key = text + '|' + targetCode;
        var hit = translationCache[key];
        if (hit && hit.value) return hit.value;
        try {
            var url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=' + targetCode + '&dt=t&q=' + encodeURIComponent(text);
            var resp = await fetch(url);
            if (!resp.ok) throw new Error('HTTP ' + resp.status);
            var data = await resp.json();
            var segments = data && data[0];
            if (!Array.isArray(segments)) throw new Error('Bad response');
            var translated = segments.map(function(seg) { return seg[0]; }).join('').trim();
            if (translated) {
                translationCache[key] = { value: translated, ts: Date.now() };
                scheduleTranslationFlush();
                return translated;
            }
        } catch (e) { /* fallback to original */ }
        return text;
    }


    async function translateReviews(reviews, targetLang) {
        var promises = reviews.map(function(review) {
            return Promise.all([
                translateReviewText(review.title, targetLang),
                translateReviewText(review.review_text, targetLang)
            ]).then(function(results) {
                var copy = Object.assign({}, review);
                copy.title = results[0];
                copy.review_text = results[1];
                return copy;
            });
        });
        return Promise.all(promises);
    }

    // Fetch widget data
    async function fetchData(businessId) {
        var response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'apikey': API_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({ businessId: businessId })
        });
        if (!response.ok) {
            var err = await response.json().catch(function() { return { error: 'HTTP ' + response.status }; });
            throw new Error(err.error || 'Error del servidor');
        }
        return await response.json();
    }

    // ---------------------------------------------------------------
    // SEO link policy: every outbound anchor carries rel="noopener nofollow".
    // - noopener: prevents tabnabbing (target=_blank security).
    // - nofollow: declares to Google we don't vouch for the link, neutralizing
    //   the link-scheme risk of mass-deployed widgets pointing to web.opynio.com
    //   from thousands of host pages with identical anchor text.
    // ---------------------------------------------------------------

    // Centralized bot-safe renderer used for ALL widget types when IS_BOT is true.
    // Returns a single anchor with brand + stars + rating, marked nofollow.
    // Goal: bots get a tiny, indexable, non-duplicate footprint on the host page.
    // The actual review content stays canonical on web.opynio.com.
    function renderBotSafe(el, business, s) {
        var rating = (business.avg_rating || 0).toFixed(1);
        var count = business.review_count || 0;
        el.innerHTML = '<a href="' + getBusinessUrl(business) + '" rel="noopener nofollow" class="opynio-widget-link"><div class="opynio-badge"><div class="opynio-badge-content"><div class="opynio-badge-logo">Opynio</div><div><div class="opynio-stars">' + generateStars(business.avg_rating) + '</div><div class="opynio-badge-text">' + rating + ' ' + s.outOf5 + '</div><div class="opynio-badge-count">' + count + ' ' + s.reviews + '</div></div></div></div></a>';
    }

    // Widget Renderers — signature: (root, el, business, reviews, s)
    //   root: rendering target (shadow wrapper for humans, el itself for bot/light fallback)
    //   el:   the original host element — kept for dataset reads and host-level events
    var renderers = {
        'badge': function(root, el, business, reviews, s) {
            root.innerHTML = '<a href="' + getBusinessUrl(business) + '" target="_blank" rel="noopener nofollow" class="opynio-widget-link"><div class="opynio-badge"><div class="opynio-badge-content"><div class="opynio-badge-logo">Opynio</div><div><div class="opynio-stars">' + generateStars(business.avg_rating) + '</div><div class="opynio-badge-text">' + (business.avg_rating || 0).toFixed(1) + ' ' + s.outOf5 + '</div><div class="opynio-badge-count">' + (business.review_count || 0) + ' ' + s.reviews + '</div></div></div></div></a>';
        },

        'floating': function(root, el, business, reviews, s) {
            // data-position: bottom-left (default), bottom-right, top-left, top-right.
            // Lets the host avoid collisions with cookie banners, chat widgets, etc.
            var posMap = { 'bottom-left': 'bl', 'bottom-right': 'br', 'top-left': 'tl', 'top-right': 'tr' };
            var posKey = (el.dataset.position || 'bottom-left').toLowerCase();
            var posClass = 'opynio-floating-pos-' + (posMap[posKey] || 'bl');
            root.innerHTML =
                '<div class="opynio-floating ' + posClass + '">' +
                  '<a href="' + getBusinessUrl(business) + '" target="_blank" rel="noopener nofollow" class="opynio-floating-trigger" aria-label="Opynio">' +
                    '<span class="opynio-floating-logo">Opynio</span>' +
                    '<span class="opynio-floating-avg">' + (business.avg_rating || 0).toFixed(1) + '</span>' +
                    '<div class="opynio-stars">' + generateStars(business.avg_rating) + '</div>' +
                    '<span class="opynio-floating-count">(' + (business.review_count || 0) + ')</span>' +
                  '</a>' +
                '</div>';

            // Auto-hide on scroll-down, show on scroll-up.
            // rAF-throttled so we only do work once per frame even if the host
            // scroll fires storms of events. Threshold of 8px deadband so tiny
            // scroll jitters don't flicker the pill.
            var floating = root.querySelector('.opynio-floating');
            if (!floating) return;
            var lastY = window.scrollY || window.pageYOffset || 0;
            var ticking = false;
            var DEADBAND = 8;
            function evaluate() {
                ticking = false;
                var y = window.scrollY || window.pageYOffset || 0;
                var delta = y - lastY;
                if (Math.abs(delta) < DEADBAND) return;
                if (delta > 0 && y > 200) {
                    floating.classList.add('opynio-floating-hidden');
                } else if (delta < 0) {
                    floating.classList.remove('opynio-floating-hidden');
                }
                lastY = y;
            }
            window.addEventListener('scroll', function() {
                if (!ticking) {
                    ticking = true;
                    requestAnimationFrame(evaluate);
                }
            }, { passive: true });
        },

        'sidebar': function(root, el, business, reviews, s) {
            root.innerHTML = '<a href="' + getBusinessUrl(business) + '" target="_blank" rel="noopener nofollow" class="opynio-widget-link"><div class="opynio-sidebar"><div class="opynio-sidebar-brand">Opynio</div><h3>' + s.reviews + '</h3><div class="opynio-sidebar-summary"><div class="opynio-sidebar-avg">' + (business.avg_rating || 0).toFixed(1) + '</div><div class="opynio-stars">' + generateStars(business.avg_rating) + '</div><p class="opynio-sidebar-total">' + (business.review_count || 0) + ' ' + s.reviews + '</p></div><span class="opynio-sidebar-cta" onclick="event.preventDefault();event.stopPropagation();window.open(\'' + BASE_URL + '/es/escribir?businessId=' + business.id + '\',\'_blank\',\'noopener,noreferrer\')">' + s.writeReview + '</span></div></a>';
        },

        'grid': function(root, el, business, reviews, s) {
            var ITEMS = 6, page = 0, total = Math.ceil(reviews.length / ITEMS);
            function render() {
                var start = page * ITEMS, items = reviews.slice(start, start + ITEMS);
                var html = items.map(function(r) {
                    return '<div class="opynio-grid-card"><div class="opynio-grid-header"><span class="opynio-grid-author">' + (r.original_author_name || s.anonymous) + '</span><div class="opynio-stars">' + generateStars(r.rating) + '</div></div><h4 class="opynio-grid-title">' + (r.title || '') + '</h4><p>"' + ((r.review_text || '').substring(0, 100) + ((r.review_text || '').length > 100 ? '...' : '')) + '"</p></div>';
                }).join('');
                root.querySelector('.opynio-grid').innerHTML = html;
            }
            root.innerHTML = '<div><div class="opynio-grid"></div>' + (reviews.length > ITEMS ? '<div class="opynio-controls"><button class="opynio-control-btn prev">‹</button><button class="opynio-control-btn next">›</button></div>' : '') + '</div>';
            render();
            if (total > 1) {
                root.querySelector('.next').onclick = function(e) { e.preventDefault(); page = (page + 1) % total; render(); };
                root.querySelector('.prev').onclick = function(e) { e.preventDefault(); page = (page - 1 + total) % total; render(); };
            }
        },

        'wall': function(root, el, business, reviews, s) {
            var ITEMS = 9, page = 0, total = Math.ceil(reviews.length / ITEMS);
            function render() {
                var start = page * ITEMS, items = reviews.slice(start, start + ITEMS);
                var html = items.map(function(r) {
                    return '<div class="opynio-wall-card"><div class="opynio-wall-header"><span class="opynio-wall-author">' + (r.original_author_name || s.anonymous) + '</span><div class="opynio-stars">' + generateStars(r.rating) + '</div></div><h4 class="opynio-wall-title">' + (r.title || '') + '</h4><p>"' + ((r.review_text || '').substring(0, 180) + ((r.review_text || '').length > 180 ? '...' : '')) + '"</p></div>';
                }).join('');
                root.querySelector('.opynio-wall').innerHTML = html;
            }
            root.innerHTML = '<div><div class="opynio-wall"></div>' + (reviews.length > ITEMS ? '<div class="opynio-controls"><button class="opynio-control-btn prev">‹</button><button class="opynio-control-btn next">›</button></div>' : '') + '</div>';
            render();
            if (total > 1) {
                root.querySelector('.next').onclick = function(e) { e.preventDefault(); page = (page + 1) % total; render(); };
                root.querySelector('.prev').onclick = function(e) { e.preventDefault(); page = (page - 1 + total) % total; render(); };
            }
        },

        'showcase': function(root, el, business, reviews, s) {
            var ITEMS = 3, page = 0, total = Math.ceil(reviews.length / ITEMS);
            function render() {
                var start = page * ITEMS, items = reviews.slice(start, start + ITEMS);
                var html = items.map(function(r) {
                    var badge = r.source === 'google' ? '<div class="opynio-google-badge"><svg class="opynio-google-logo" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg><span class="opynio-google-text">' + s.googleReview + '</span></div>' : '<div class="opynio-opynio-badge"><span class="opynio-opynio-text">' + s.opynioReview + '</span></div>';
                    return '<div class="opynio-showcase-card"><div class="opynio-showcase-card-header"><span class="opynio-showcase-card-name">' + (r.original_author_name || s.anonymous) + '</span><div class="opynio-stars">' + generateStars(r.rating) + '</div></div><h4 class="opynio-showcase-card-title">' + (r.title || '') + '</h4><p class="opynio-showcase-card-text">"' + (r.review_text || '') + '"</p>' + badge + '</div>';
                }).join('');
                root.querySelector('.opynio-showcase-grid').innerHTML = html;
            }
            root.innerHTML = '<div class="opynio-showcase-widget"><div class="opynio-showcase-header"><a href="' + getBusinessUrl(business) + '" target="_blank" rel="noopener nofollow" style="text-decoration:none;color:inherit;"><div><h2 class="opynio-showcase-biz-name">' + business.name + '</h2><p class="opynio-showcase-subtitle">' + s.customerRatings + '</p></div></a><div class="opynio-showcase-summary"><div class="opynio-showcase-summary-stars"><div class="opynio-showcase-summary-avg">' + (business.avg_rating || 0).toFixed(1) + '</div><div class="opynio-stars">' + generateStars(business.avg_rating) + '</div></div><div class="opynio-showcase-summary-total">' + s.basedOn.replace('{n}', business.review_count || 0) + '</div></div></div><div class="opynio-showcase-grid"></div>' + (reviews.length > ITEMS ? '<div class="opynio-controls"><button class="opynio-control-btn prev">‹</button><button class="opynio-control-btn next">›</button></div>' : '') + '</div>';
            render();
            if (total > 1) {
                root.querySelector('.next').onclick = function(e) { e.preventDefault(); page = (page + 1) % total; render(); };
                root.querySelector('.prev').onclick = function(e) { e.preventDefault(); page = (page - 1 + total) % total; render(); };
            }
        },

        'large-carousel': function(root, el, business, reviews, s) {
            if (reviews.length === 0) { root.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--subtext-color);">' + s.noReviews + '</div>'; return; }
            root.innerHTML = '<a href="' + getBusinessUrl(business) + '" target="_blank" rel="noopener nofollow" class="opynio-widget-link"><div class="opynio-large-carousel"><div class="opynio-large-carousel-track">' + reviews.map(function(r) {
                return '<div class="opynio-large-carousel-slide"><div class="opynio-large-carousel-quote-icon">"</div><h4 class="opynio-large-carousel-title">' + (r.title || '') + '</h4><div class="opynio-stars">' + generateStars(r.rating) + '</div><p>"' + (r.review_text || '') + '"</p><p class="author">— ' + (r.original_author_name || s.anonymous) + '</p></div>';
            }).join('') + '</div><div class="opynio-large-carousel-nav"><button class="opynio-large-carousel-btn prev">‹</button><button class="opynio-large-carousel-btn next">›</button></div></div></a>';
            var track = root.querySelector('.opynio-large-carousel-track'), idx = 0;
            function update() { track.style.transform = 'translateX(-' + (idx * 100) + '%)'; }
            root.querySelector('.next').onclick = function(e) { e.preventDefault(); e.stopPropagation(); idx = (idx + 1) % reviews.length; update(); };
            root.querySelector('.prev').onclick = function(e) { e.preventDefault(); e.stopPropagation(); idx = (idx - 1 + reviews.length) % reviews.length; update(); };
            // Visibility observer attaches to the host element (el) — that's what
            // moves in/out of viewport from the host's perspective; the shadow
            // wrapper is a descendant that always tracks with it.
            visibilityAwareInterval(el, function() { idx = (idx + 1) % reviews.length; update(); }, 8000);
        },

        'horizontal-carousel': function(root, el, business, reviews, s) {
            var validRating = (business.avg_rating && !isNaN(business.avg_rating)) ? Math.max(0, Math.min(5, business.avg_rating)) : 0;
            var ratingText = validRating >= 4.5 ? s.ratingExcellent : validRating >= 3.5 ? s.ratingVeryGood : s.ratingGood;
            var businessUrl = getBusinessUrl(business);
            var cardsHTML = reviews.map(function(r) {
                var source = (r.source || 'opynio').toString().toLowerCase().trim();
                var badge = source === 'google' ? '<div class="opynio-google-badge"><svg class="opynio-google-logo" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg><span class="opynio-google-text">' + s.googleReview + '</span></div>' : '';
                var icon = source === 'google' ? '<div class="opynio-platform-badge"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#4285f4"/><path d="M9 12l2 2 4-4" stroke="white" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></div>' : '<div class="opynio-platform-badge"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#00b67a"/><path d="M9 12l2 2 4-4" stroke="white" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></div>';
                var reviewText = r.review_text || s.multimediaReview;
                var isLongText = reviewText.length > 200;
                var seeMoreBtn = isLongText ? '<a href="' + businessUrl + '" target="_blank" rel="noopener nofollow" style="color: #00b67a; cursor: pointer; font-size: 0.85rem; font-weight: 600; text-decoration: underline; display: inline-block; margin-top: 0.5rem;">' + s.seeMore + '</a>' : '';
                return '<div class="opynio-review-card"><div class="opynio-review-header"><div class="opynio-review-user"><div class="opynio-avatar-placeholder">' + (r.original_author_name || 'A').charAt(0).toUpperCase() + '</div><div class="opynio-user-content"><div class="opynio-username">' + (r.original_author_name || s.anonymous) + '</div>' + badge + '</div></div>' + icon + '</div><div class="opynio-review-stars"><div class="opynio-stars">' + generateStars(r.rating) + '</div></div><p class="opynio-review-text" style="' + (isLongText ? 'max-height: 120px; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; word-break: break-word;' : 'word-break: break-word;') + '">' + reviewText + '</p>' + seeMoreBtn + '</div>';
            }).join('');

            root.innerHTML = '<div class="opynio-horizontal-widget"><div class="opynio-horizontal-wrapper"><div class="opynio-rating-panel-wrapper"><a href="' + getBusinessUrl(business) + '" target="_blank" rel="noopener nofollow" style="text-decoration:none;color:inherit;"><div class="opynio-rating-panel"><div class="opynio-rating-badge">' + ratingText + '</div><div class="opynio-stars-display">' + generateStars(validRating) + '</div><p class="opynio-rating-count">' + s.basedOnAlt.replace('{n}', business.review_count || 0) + '</p><div class="opynio-logo"><div class="opynio-logo-text">Opynio</div></div></div></a></div><div class="opynio-cards-container"><div class="opynio-cards-track" id="track-' + business.id + '">' + cardsHTML + '</div><button class="opynio-nav-arrow opynio-nav-prev" type="button"><svg style="transform:rotate(180deg)" viewBox="0 0 24 24"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg></button><button class="opynio-nav-arrow opynio-nav-next" type="button"><svg viewBox="0 0 24 24"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg></button></div></div></div>';

            var track = root.querySelector('#track-' + business.id);
            var next = root.querySelector('.opynio-nav-next');
            var prev = root.querySelector('.opynio-nav-prev');
            var cards = root.querySelectorAll('.opynio-review-card');
            if (!track || cards.length === 0) return;

            // Clone cards for infinite scroll
            cards.forEach(function(c) { track.appendChild(c.cloneNode(true)); });

            var idx = 0, ticker = null;
            function scroll(dir) {
                if (!cards[0]) return;
                var w = cards[0].offsetWidth + 20;
                idx += dir;
                track.style.transition = 'transform 0.5s cubic-bezier(0.25,0.46,0.45,0.94)';
                track.style.transform = 'translateX(-' + (idx * w) + 'px)';
                if (idx >= cards.length) {
                    setTimeout(function() { track.style.transition = 'none'; idx = 0; track.style.transform = 'translateX(0)'; }, 500);
                } else if (idx < 0) {
                    idx = cards.length - 1;
                    track.style.transition = 'none';
                    track.style.transform = 'translateX(-' + (idx * w) + 'px)';
                }
            }
            function start() {
                if (ticker) ticker.stop();
                ticker = visibilityAwareInterval(el, function() { scroll(1); }, 5000);
            }
            next.onclick = function(e) { e.preventDefault(); e.stopPropagation(); scroll(1); start(); };
            prev.onclick = function(e) { e.preventDefault(); e.stopPropagation(); scroll(-1); start(); };
            start();
        },

        // Stars Carousel: large widget with "See more" CTA on the left and a track of
        // cards on the right (avatar + name + stars).
        //
        // SEO note: NO JSON-LD AggregateRating is emitted in the host DOM. Google's
        // policy (Sept 2019, still in effect 2026) ignores self-serving review
        // markup for LocalBusiness/Organization, and emitting it from a third-party
        // widget can conflict with the host's own structured data. The canonical
        // structured data lives on web.opynio.com; the host gets a clean anchor.
        // Bots are handled centrally in initWidget via renderBotSafe(), so this
        // renderer only runs for humans.
        'stars-carousel': function(root, el, business, reviews, s) {
            var validRating = (business.avg_rating && !isNaN(business.avg_rating)) ? Math.max(0, Math.min(5, business.avg_rating)) : 0;
            var rating = validRating.toFixed(1);
            var count = business.review_count || 0;
            var businessUrl = getBusinessUrl(business);

            // Top 3 reviews — keep it tight and focused.
            var picks = (reviews || []).slice(0, 3);
            var ratingText = validRating >= 4.5 ? s.ratingExcellent : validRating >= 3.5 ? s.ratingVeryGood : s.ratingGood;
            var ctaHTML = '<a href="' + businessUrl + '" target="_blank" rel="noopener nofollow" class="opynio-stars-carousel-cta-link">'
                        + '<div class="opynio-stars-carousel-cta">'
                        +   '<div class="opynio-stars-carousel-score">' + rating + '</div>'
                        +   '<div class="opynio-stars-carousel-score-stars opynio-stars">' + generateStars(validRating) + '</div>'
                        +   '<div class="opynio-stars-carousel-count"><strong>' + count + '</strong> ' + s.reviews + '</div>'
                        +   '<div class="opynio-stars-carousel-rating-label">' + ratingText + '</div>'
                        + '</div>'
                        + '</a>';

            var footerHTML = '<div class="opynio-stars-carousel-footer"><a href="' + businessUrl + '" target="_blank" rel="noopener nofollow" class="opynio-stars-carousel-footer-btn">' + (s.seeAllReviews || 'Ver reseñas completas') + '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg></a></div>';

            if (picks.length === 0) {
                root.innerHTML = '<div class="opynio-stars-carousel-widget"><div class="opynio-stars-carousel-wrapper">' + ctaHTML + '<div class="opynio-stars-carousel-right">' + footerHTML + '</div></div></div>';
                return;
            }

            var cardsHTML = picks.map(function(r) {
                var fullName = r.original_author_name || s.anonymous;
                var firstName = fullName.split(' ')[0];
                var initial = fullName.charAt(0).toUpperCase();
                return '<a href="' + businessUrl + '" target="_blank" rel="noopener nofollow" class="opynio-stars-carousel-card" title="' + fullName + '">'
                     +   '<div class="opynio-avatar-placeholder opynio-stars-carousel-card-avatar">' + initial + '</div>'
                     +   '<div class="opynio-stars-carousel-card-name">' + firstName + '</div>'
                     +   '<div class="opynio-stars-carousel-card-stars opynio-stars">' + generateStars(r.rating) + '</div>'
                     + '</a>';
            }).join('');

            root.innerHTML = '<div class="opynio-stars-carousel-widget"><div class="opynio-stars-carousel-wrapper">'
                         + ctaHTML
                         + '<div class="opynio-stars-carousel-right">'
                         +   '<div class="opynio-stars-carousel-cards-area">'
                         +     '<button type="button" class="opynio-stars-carousel-nav opynio-stars-carousel-nav-prev" aria-label="' + (s.previous || 'Anterior') + '"><svg style="transform:rotate(180deg)" viewBox="0 0 24 24" aria-hidden="true"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg></button>'
                         +     '<div class="opynio-stars-carousel-cards-container" role="region" aria-label="' + (s.reviews || 'Reseñas') + '" aria-live="polite" aria-roledescription="carrusel">'
                         +       '<div class="opynio-stars-carousel-track" id="stars-track-' + business.id + '">' + cardsHTML + '</div>'
                         +     '</div>'
                         +     '<button type="button" class="opynio-stars-carousel-nav opynio-stars-carousel-nav-next" aria-label="' + (s.next || 'Siguiente') + '"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg></button>'
                         +   '</div>'
                         +   footerHTML
                         + '</div>'
                         + '</div></div>';

            var widget = root.querySelector('.opynio-stars-carousel-widget');
            var track = root.querySelector('#stars-track-' + business.id);
            var nextBtn = root.querySelector('.opynio-stars-carousel-nav-next');
            var prevBtn = root.querySelector('.opynio-stars-carousel-nav-prev');
            var cards = root.querySelectorAll('.opynio-stars-carousel-card');
            if (!widget || !track || cards.length === 0) return;

            // Clone all cards for infinite scroll (cards still inside overflow:hidden track).
            cards.forEach(function(c) { track.appendChild(c.cloneNode(true)); });

            var idx = 0, ticker = null, paused = false;
            function scroll(dir) {
                if (!cards[0]) return;
                var w = cards[0].offsetWidth + 14;
                idx += dir;
                track.style.transition = 'transform 0.55s cubic-bezier(0.25,0.46,0.45,0.94)';
                track.style.transform = 'translateX(-' + (idx * w) + 'px)';
                if (idx >= cards.length) {
                    setTimeout(function() { track.style.transition = 'none'; idx = 0; track.style.transform = 'translateX(0)'; }, 550);
                } else if (idx < 0) {
                    idx = cards.length - 1;
                    track.style.transition = 'none';
                    track.style.transform = 'translateX(-' + (idx * w) + 'px)';
                }
            }
            function start() {
                if (ticker) ticker.stop();
                ticker = visibilityAwareInterval(widget, function() { if (!paused) scroll(1); }, 3500);
            }

            widget.addEventListener('mouseenter', function() { paused = true; });
            widget.addEventListener('mouseleave', function() { paused = false; });
            nextBtn.onclick = function(e) { e.preventDefault(); e.stopPropagation(); scroll(1); start(); };
            prevBtn.onclick = function(e) { e.preventDefault(); e.stopPropagation(); scroll(-1); start(); };
            start();
        }
    };

    // Initialize a single widget
    async function initWidget(el) {
        if (el.dataset.loaded) return;
        el.dataset.loaded = 'true';

        var businessId = el.dataset.businessId;
        var type = el.dataset.type || 'badge';
        var theme = el.dataset.theme || 'light';

        if (!businessId) { renderError(el, 'data-business-id requerido'); return; }

        // Bot path stays in light DOM (no shadow) so crawlers index the canonical
        // anchor without traversing shadow trees. Browsers without attachShadow
        // also fall back to light DOM. Everyone else gets shadow isolation.
        var useShadow = !IS_BOT && supportsShadow;
        var root = useShadow ? attachWidgetShell(el, theme) : null;
        // attachWidgetShell returns null if the host element refuses a shadow root
        // (e.g. <input>, <img>, or already has a closed shadow). Degrade to light DOM.
        if (!root) {
            useShadow = false;
            el.className = 'opynio-widget opynio-theme-' + theme;
            injectStyles();
            root = el;
        }
        renderLoader(root);

        try {
            var data = await fetchData(businessId);
            if (!data.business) { renderError(root, 'Negocio no encontrado'); return; }

            var targetLang = el.dataset.lang || detectTargetLang();
            var s = await getStrings(targetLang);

            // Bot path — centralized for all 9 widget types. Bots see only
            // a small anchor with brand + rating + count, not the per-review
            // text. This protects the host from duplicate-content indexation
            // when the same reviews are embedded across many sites.
            if (IS_BOT) {
                renderBotSafe(el, data.business, s);
                return;
            }

            var reviews = (data.reviews || []).filter(function(r) { return r.review_text; });

            // Translate reviews to the target language (humans only).
            if (reviews.length > 0) {
                reviews = await translateReviews(reviews, targetLang);
            }

            // Widgets that only need metrics
            if (['badge', 'floating', 'sidebar'].indexOf(type) !== -1) {
                renderers[type](root, el, data.business, [], s);
                return;
            }

            // Widgets that need reviews — these handle the empty case themselves (SEO-safe fallback).
            var SELF_HANDLED_EMPTY = ['stars-carousel'];
            if (reviews.length === 0 && SELF_HANDLED_EMPTY.indexOf(type) === -1) {
                root.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--subtext-color);">' + s.noReviewsText + '</div>';
                return;
            }

            if (renderers[type]) {
                renderers[type](root, el, data.business, reviews, s);
            } else {
                renderError(root, 'Tipo de widget no soportado: ' + type);
            }
        } catch (err) {
            renderError(root, err.message);
        }
    }

    // ---------------------------------------------------------------
    // SEO-safe lazy loading scheduler (v6.1)
    // ---------------------------------------------------------------

    // Per-type min-height to reserve space and keep CLS = 0 on the host.
    // Numbers chosen to match the median rendered height of each widget;
    // a couple of pixels of shift after hydration is acceptable, big shifts are not.
    var TYPE_MIN_HEIGHT = {
        'badge': 90,
        'floating': 60,
        'sidebar': 320,
        'grid': 480,
        'wall': 560,
        'showcase': 440,
        'large-carousel': 380,
        'horizontal-carousel': 440,
        'stars-carousel': 320
    };

    function reserveSpace(el) {
        if (el.dataset.reserved) return;
        el.dataset.reserved = '1';
        var type = el.dataset.type || 'badge';
        // 'floating' is position:fixed, so it doesn't push host content; skip min-height.
        if (type === 'floating') return;
        var min = TYPE_MIN_HEIGHT[type] || 150;
        // Don't override an explicit min-height — check both inline and computed style
        // so a host that sets `.opynio-widget { min-height: 200px }` in their external CSS
        // wins over our default. getComputedStyle returns "0px" or "auto" when unset.
        if (el.style.minHeight) return;
        if (typeof getComputedStyle === 'function') {
            var computed = getComputedStyle(el).minHeight;
            if (computed && computed !== '0px' && computed !== 'auto') return;
        }
        el.style.minHeight = min + 'px';
    }

    // Defer init until the browser is idle so we never race the host's LCP.
    function deferInit(el) {
        var run = function() { initWidget(el); };
        if (typeof requestIdleCallback === 'function') {
            requestIdleCallback(run, { timeout: 1500 });
        } else {
            setTimeout(run, 1);
        }
    }

    // One shared observer for "schedule this widget when it nears the viewport".
    // rootMargin 200px: pre-render widgets just before they become visible so the
    // user sees content, not a spinner. Threshold 0: any pixel triggers.
    var lazyObserver = (typeof IntersectionObserver !== 'undefined')
        ? new IntersectionObserver(function(entries, obs) {
            entries.forEach(function(entry) {
                if (entry.isIntersecting) {
                    obs.unobserve(entry.target);
                    deferInit(entry.target);
                }
            });
        }, { rootMargin: '200px 0px', threshold: 0 })
        : null;

    // Detect Chrome's prerender state (Speculation Rules, etc.). When the page is
    // being prerendered, IntersectionObserver behavior is unreliable and the
    // activated page should already have content visible — so we render eagerly.
    function isPrerendering() {
        return typeof document !== 'undefined' && document.prerendering === true;
    }

    function scheduleWidget(el) {
        if (el.dataset.loaded || el.dataset.scheduled) return;
        if (!el.dataset.businessId) { renderError(el, 'data-business-id requerido'); return; }

        reserveSpace(el);
        el.dataset.scheduled = '1';

        // Bots and prerender: render immediately. Googlebot doesn't scroll and won't
        // trigger IO, Search Central explicitly warns against scroll-dependent loading,
        // and Chrome prerender pages should be ready at activation time. The IS_BOT
        // path inside each renderer also serves a SEO-safe HTML.
        if (IS_BOT || isPrerendering() || !lazyObserver) {
            initWidget(el);
            return;
        }

        // Floating widgets are always above-the-fold on the host (position:fixed),
        // but we still defer them via rIC so they don't compete with host LCP.
        if (el.dataset.type === 'floating') {
            deferInit(el);
            return;
        }

        lazyObserver.observe(el);
    }

    // ---------------------------------------------------------------
    // Visibility-aware interval — used by carousels to stop draining
    // CPU when the widget is offscreen or the tab is hidden.
    //
    // stop() does a FULL teardown: clears the interval, disconnects the IO,
    // and removes the visibilitychange listener. Without this the renderers
    // that re-arm the ticker on every prev/next click would leak a listener
    // and an IO each time, polluting `document` over the lifetime of an SPA.
    // ---------------------------------------------------------------
    function visibilityAwareInterval(el, fn, ms) {
        var handle = null;
        var visible = true;
        var io = null;
        var visListener = null;

        function tick() {
            if (!document.hidden && visible) {
                try { fn(); } catch (e) { /* swallow to keep the host stable */ }
            }
        }
        function pauseTimer() { if (handle != null) { clearInterval(handle); handle = null; } }
        function start() { if (handle == null) handle = setInterval(tick, ms); }
        function stop() {
            pauseTimer();
            if (io) { io.disconnect(); io = null; }
            if (visListener) { document.removeEventListener('visibilitychange', visListener); visListener = null; }
        }

        if (typeof IntersectionObserver !== 'undefined') {
            io = new IntersectionObserver(function(entries) {
                entries.forEach(function(e) {
                    visible = e.isIntersecting;
                    if (visible) start(); else pauseTimer();
                });
            }, { threshold: 0 });
            io.observe(el);
        }

        // Note: tick() filters by `visible && !document.hidden` so we can call
        // start() unconditionally on visibilitychange — that closes the race
        // where the IO and visibilitychange callbacks arrive out of order.
        visListener = function() {
            if (document.hidden) pauseTimer(); else start();
        };
        document.addEventListener('visibilitychange', visListener, { passive: true });

        start();
        var ticker = {
            stop: stop,
            isVisible: function() { return visible && !document.hidden; }
        };
        // Expose for cleanup-on-removal in the MutationObserver.
        el.__opynioTicker = ticker;
        return ticker;
    }
    // ---------------------------------------------------------------
    // Page-level scheduling
    // ---------------------------------------------------------------
    function scheduleAll() {
        injectStyles();
        var widgets = document.querySelectorAll('.opynio-widget[data-business-id]:not([data-loaded]):not([data-scheduled])');
        for (var i = 0; i < widgets.length; i++) scheduleWidget(widgets[i]);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', scheduleAll);
    } else {
        scheduleAll();
    }

    // Scoped MutationObserver: only react when an .opynio-widget is added (or a
    // subtree containing one). Debounced so SPA route changes don't thrash.
    // Also cleans up on removal so SPAs that unmount widgets don't leak the
    // shared lazyObserver entry or the per-widget visibility-aware ticker.
    if (typeof MutationObserver !== 'undefined') {
        var mutationTimer = null;
        var pending = false;
        function flush() { mutationTimer = null; if (pending) { pending = false; scheduleAll(); } }

        function cleanupRemoved(node) {
            if (!node || node.nodeType !== 1) return;
            var widgets = [];
            if (node.classList && node.classList.contains('opynio-widget')) widgets.push(node);
            if (node.querySelectorAll) {
                var nested = node.querySelectorAll('.opynio-widget');
                for (var k = 0; k < nested.length; k++) widgets.push(nested[k]);
            }
            for (var n = 0; n < widgets.length; n++) {
                var w = widgets[n];
                if (lazyObserver) { try { lazyObserver.unobserve(w); } catch (e) {} }
                if (w.__opynioTicker && w.__opynioTicker.stop) {
                    try { w.__opynioTicker.stop(); } catch (e) {}
                    w.__opynioTicker = null;
                }
            }
        }

        new MutationObserver(function(mutations) {
            for (var i = 0; i < mutations.length; i++) {
                var added = mutations[i].addedNodes;
                for (var j = 0; j < added.length; j++) {
                    var node = added[j];
                    if (node.nodeType !== 1) continue;
                    if (node.classList && node.classList.contains('opynio-widget')) { pending = true; break; }
                    if (node.querySelector && node.querySelector('.opynio-widget')) { pending = true; break; }
                }
                if (pending) break;
            }
            // Cleanup in a separate pass so removals are always processed.
            for (var a = 0; a < mutations.length; a++) {
                var removed = mutations[a].removedNodes;
                for (var b = 0; b < removed.length; b++) cleanupRemoved(removed[b]);
            }
            if (pending && mutationTimer == null) mutationTimer = setTimeout(flush, 50);
        }).observe(document.body, { childList: true, subtree: true });
    }
})();
