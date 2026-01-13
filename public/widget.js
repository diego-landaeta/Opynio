/**
 * Opynio Widget Loader v6.0
 * External script for embedding Opynio review widgets
 * Usage: <script src="https://web.opynio.com/widget.js" async></script>
 *        <div class="opynio-widget" data-business-id="UUID" data-type="badge" data-theme="light"></div>
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
        .opynio-verified-check { background: #4285f4; color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.7rem; font-weight: 700; }
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

        /* Floating */
        .opynio-floating { position: fixed; bottom: 20px; left: 20px; z-index: 1000; }
        .opynio-floating-trigger { background: var(--card-bg); padding: 0.75rem 1rem; border-radius: 50px; box-shadow: var(--shadow-lg); border: 1px solid var(--border-color); display: flex; align-items: center; gap: 0.75rem; cursor: pointer; transition: transform 0.2s; }
        .opynio-floating-trigger:hover { transform: scale(1.05); }
        .opynio-floating-logo { font-size: 0.9rem; font-weight: bold; color: var(--opynio-green); }
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
    `;

    // Inject styles
    function injectStyles() {
        if (document.getElementById('opynio-widget-styles')) return;
        var style = document.createElement('style');
        style.id = 'opynio-widget-styles';
        style.textContent = WIDGET_CSS;
        document.head.appendChild(style);
    }

    // Helper functions
    function renderLoader(el) {
        el.innerHTML = '<div class="opynio-loader"><div class="opynio-spinner"></div></div>';
    }

    function renderError(el, msg) {
        el.innerHTML = '<div style="color:#c00;padding:20px;border:1px solid #fdd;background:#ffeeee;border-radius:8px;"><strong>Error Opynio:</strong><br>' + msg + '</div>';
    }

    function generateStars(rating) {
        // Validate rating - default to 0 if invalid
        var validRating = (rating && !isNaN(rating)) ? Math.max(0, Math.min(5, rating)) : 0;
        return Array(5).fill(0).map(function(_, i) {
            return '<span class="' + (i < Math.round(validRating) ? 'full' : 'empty') + '">★</span>';
        }).join('');
    }

    function getBusinessUrl(business) {
        return BASE_URL + '/es/empresa/' + encodeURIComponent(business.name.replace(/ /g, '_'));
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

    // Widget Renderers
    var renderers = {
        'badge': function(el, business) {
            el.innerHTML = '<a href="' + getBusinessUrl(business) + '" target="_blank" class="opynio-widget-link"><div class="opynio-badge"><div class="opynio-badge-content"><div class="opynio-badge-logo">Opynio</div><div><div class="opynio-stars">' + generateStars(business.avg_rating) + '</div><div class="opynio-badge-text">' + (business.avg_rating || 0).toFixed(1) + ' de 5 estrellas</div><div class="opynio-badge-count">' + (business.review_count || 0) + ' reseñas</div></div></div></div></a>';
        },

        'floating': function(el, business) {
            el.innerHTML = '<a href="' + getBusinessUrl(business) + '" target="_blank" class="opynio-widget-link"><div class="opynio-floating"><div class="opynio-floating-trigger"><span class="opynio-floating-logo">Opynio</span><span class="opynio-floating-avg">' + (business.avg_rating || 0).toFixed(1) + '</span><div class="opynio-stars">' + generateStars(business.avg_rating) + '</div><span class="opynio-floating-count">(' + (business.review_count || 0) + ')</span></div></div></a>';
        },

        'sidebar': function(el, business) {
            el.innerHTML = '<a href="' + getBusinessUrl(business) + '" target="_blank" class="opynio-widget-link"><div class="opynio-sidebar"><div class="opynio-sidebar-brand">Opynio</div><h3>Reviews</h3><div class="opynio-sidebar-summary"><div class="opynio-sidebar-avg">' + (business.avg_rating || 0).toFixed(1) + '</div><div class="opynio-stars">' + generateStars(business.avg_rating) + '</div><p class="opynio-sidebar-total">' + (business.review_count || 0) + ' reseñas</p></div><span class="opynio-sidebar-cta" onclick="event.preventDefault();event.stopPropagation();window.open(\'' + BASE_URL + '/es/escribir?businessId=' + business.id + '\',\'_blank\')">Escribe tu reseña</span></div></a>';
        },

        'grid': function(el, business, reviews) {
            var ITEMS = 6, page = 0, total = Math.ceil(reviews.length / ITEMS);
            function render() {
                var start = page * ITEMS, items = reviews.slice(start, start + ITEMS);
                var html = items.map(function(r) {
                    return '<div class="opynio-grid-card"><div class="opynio-grid-header"><span class="opynio-grid-author">' + (r.original_author_name || 'Anónimo') + '</span><div class="opynio-stars">' + generateStars(r.rating) + '</div></div><h4 class="opynio-grid-title">' + (r.title || '') + '</h4><p>"' + ((r.review_text || '').substring(0, 100) + ((r.review_text || '').length > 100 ? '...' : '')) + '"</p></div>';
                }).join('');
                el.querySelector('.opynio-grid').innerHTML = html;
            }
            el.innerHTML = '<div><div class="opynio-grid"></div>' + (reviews.length > ITEMS ? '<div class="opynio-controls"><button class="opynio-control-btn prev">‹</button><button class="opynio-control-btn next">›</button></div>' : '') + '</div>';
            render();
            if (total > 1) {
                el.querySelector('.next').onclick = function(e) { e.preventDefault(); page = (page + 1) % total; render(); };
                el.querySelector('.prev').onclick = function(e) { e.preventDefault(); page = (page - 1 + total) % total; render(); };
            }
        },

        'wall': function(el, business, reviews) {
            var ITEMS = 9, page = 0, total = Math.ceil(reviews.length / ITEMS);
            function render() {
                var start = page * ITEMS, items = reviews.slice(start, start + ITEMS);
                var html = items.map(function(r) {
                    return '<div class="opynio-wall-card"><div class="opynio-wall-header"><span class="opynio-wall-author">' + (r.original_author_name || 'Anónimo') + '</span><div class="opynio-stars">' + generateStars(r.rating) + '</div></div><h4 class="opynio-wall-title">' + (r.title || '') + '</h4><p>"' + ((r.review_text || '').substring(0, 180) + ((r.review_text || '').length > 180 ? '...' : '')) + '"</p></div>';
                }).join('');
                el.querySelector('.opynio-wall').innerHTML = html;
            }
            el.innerHTML = '<div><div class="opynio-wall"></div>' + (reviews.length > ITEMS ? '<div class="opynio-controls"><button class="opynio-control-btn prev">‹</button><button class="opynio-control-btn next">›</button></div>' : '') + '</div>';
            render();
            if (total > 1) {
                el.querySelector('.next').onclick = function(e) { e.preventDefault(); page = (page + 1) % total; render(); };
                el.querySelector('.prev').onclick = function(e) { e.preventDefault(); page = (page - 1 + total) % total; render(); };
            }
        },

        'showcase': function(el, business, reviews) {
            var ITEMS = 3, page = 0, total = Math.ceil(reviews.length / ITEMS);
            function render() {
                var start = page * ITEMS, items = reviews.slice(start, start + ITEMS);
                var html = items.map(function(r) {
                    var badge = r.source === 'google' ? '<div class="opynio-google-badge"><svg class="opynio-google-logo" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg><span class="opynio-google-text">Google</span></div>' : '<div class="opynio-opynio-badge"><span class="opynio-opynio-text">Opynio</span></div>';
                    return '<div class="opynio-showcase-card"><div class="opynio-showcase-card-header"><span class="opynio-showcase-card-name">' + (r.original_author_name || 'Anónimo') + '</span><div class="opynio-stars">' + generateStars(r.rating) + '</div></div><h4 class="opynio-showcase-card-title">' + (r.title || '') + '</h4><p class="opynio-showcase-card-text">"' + (r.review_text || '') + '"</p>' + badge + '</div>';
                }).join('');
                el.querySelector('.opynio-showcase-grid').innerHTML = html;
            }
            el.innerHTML = '<div class="opynio-showcase-widget"><div class="opynio-showcase-header"><a href="' + getBusinessUrl(business) + '" target="_blank" style="text-decoration:none;color:inherit;"><div><h2 class="opynio-showcase-biz-name">' + business.name + '</h2><p class="opynio-showcase-subtitle">Valoración de nuestros clientes</p></div></a><div class="opynio-showcase-summary"><div class="opynio-showcase-summary-stars"><div class="opynio-showcase-summary-avg">' + (business.avg_rating || 0).toFixed(1) + '</div><div class="opynio-stars">' + generateStars(business.avg_rating) + '</div></div><div class="opynio-showcase-summary-total">Basado en ' + (business.review_count || 0) + ' reseñas</div></div></div><div class="opynio-showcase-grid"></div>' + (reviews.length > ITEMS ? '<div class="opynio-controls"><button class="opynio-control-btn prev">‹</button><button class="opynio-control-btn next">›</button></div>' : '') + '</div>';
            render();
            if (total > 1) {
                el.querySelector('.next').onclick = function(e) { e.preventDefault(); page = (page + 1) % total; render(); };
                el.querySelector('.prev').onclick = function(e) { e.preventDefault(); page = (page - 1 + total) % total; render(); };
            }
        },

        'large-carousel': function(el, business, reviews) {
            if (reviews.length === 0) { el.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--subtext-color);">No hay reseñas.</div>'; return; }
            el.innerHTML = '<a href="' + getBusinessUrl(business) + '" target="_blank" class="opynio-widget-link"><div class="opynio-large-carousel"><div class="opynio-large-carousel-track">' + reviews.map(function(r) {
                return '<div class="opynio-large-carousel-slide"><div class="opynio-large-carousel-quote-icon">"</div><h4 class="opynio-large-carousel-title">' + (r.title || '') + '</h4><div class="opynio-stars">' + generateStars(r.rating) + '</div><p>"' + (r.review_text || '') + '"</p><p class="author">— ' + (r.original_author_name || 'Anónimo') + '</p></div>';
            }).join('') + '</div><div class="opynio-large-carousel-nav"><button class="opynio-large-carousel-btn prev">‹</button><button class="opynio-large-carousel-btn next">›</button></div></div></a>';
            var track = el.querySelector('.opynio-large-carousel-track'), idx = 0;
            function update() { track.style.transform = 'translateX(-' + (idx * 100) + '%)'; }
            el.querySelector('.next').onclick = function(e) { e.preventDefault(); e.stopPropagation(); idx = (idx + 1) % reviews.length; update(); };
            el.querySelector('.prev').onclick = function(e) { e.preventDefault(); e.stopPropagation(); idx = (idx - 1 + reviews.length) % reviews.length; update(); };
            setInterval(function() { idx = (idx + 1) % reviews.length; update(); }, 8000);
        },

        'horizontal-carousel': function(el, business, reviews) {
            var validRating = (business.avg_rating && !isNaN(business.avg_rating)) ? Math.max(0, Math.min(5, business.avg_rating)) : 0;
            var ratingText = validRating >= 4.5 ? 'EXCELENTE' : validRating >= 3.5 ? 'MUY BUENO' : 'BUENO';
            var businessUrl = getBusinessUrl(business);
            var cardsHTML = reviews.map(function(r) {
                var source = (r.source || 'opynio').toString().toLowerCase().trim();
                var badge = source === 'google' ? '<div class="opynio-google-badge"><svg class="opynio-google-logo" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg><span class="opynio-google-text">Google</span></div>' : '';
                var icon = source === 'google' ? '<div class="opynio-platform-badge"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#4285f4"/><path d="M9 12l2 2 4-4" stroke="white" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></div>' : '<div class="opynio-platform-badge"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#00b67a"/><path d="M9 12l2 2 4-4" stroke="white" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></div>';
                var reviewText = r.review_text || 'Reseña multimedia.';
                // Truncar texto a 4 líneas (~200 chars) y mostrar "Ver más" si es largo
                var isLongText = reviewText.length > 200;
                var verMasBtn = isLongText ? '<a href="' + businessUrl + '" target="_blank" style="color: #00b67a; cursor: pointer; font-size: 0.85rem; font-weight: 600; text-decoration: underline; display: inline-block; margin-top: 0.5rem;">Ver más</a>' : '';
                return '<div class="opynio-review-card"><div class="opynio-review-header"><div class="opynio-review-user"><div class="opynio-avatar-placeholder">' + (r.original_author_name || 'A').charAt(0).toUpperCase() + '</div><div class="opynio-user-content"><div class="opynio-username">' + (r.original_author_name || 'Anónimo') + '</div>' + badge + '</div></div>' + icon + '</div><div class="opynio-review-stars"><div class="opynio-stars">' + generateStars(r.rating) + '</div></div><p class="opynio-review-text" style="' + (isLongText ? 'max-height: 120px; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; word-break: break-word;' : 'word-break: break-word;') + '">' + reviewText + '</p>' + verMasBtn + '</div>';
            }).join('');

            el.innerHTML = '<div class="opynio-horizontal-widget"><div class="opynio-horizontal-wrapper"><div class="opynio-rating-panel-wrapper"><a href="' + getBusinessUrl(business) + '" target="_blank" style="text-decoration:none;color:inherit;"><div class="opynio-rating-panel"><div class="opynio-rating-badge">' + ratingText + '</div><div class="opynio-stars-display">' + generateStars(validRating) + '</div><p class="opynio-rating-count">A base de <strong>' + (business.review_count || 0) + ' reseñas</strong></p><div class="opynio-logo"><div class="opynio-logo-text">Opynio</div></div></div></a></div><div class="opynio-cards-container"><div class="opynio-cards-track" id="track-' + business.id + '">' + cardsHTML + '</div><button class="opynio-nav-arrow opynio-nav-prev" type="button"><svg style="transform:rotate(180deg)" viewBox="0 0 24 24"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg></button><button class="opynio-nav-arrow opynio-nav-next" type="button"><svg viewBox="0 0 24 24"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg></button></div></div></div>';

            var track = el.querySelector('#track-' + business.id);
            var next = el.querySelector('.opynio-nav-next');
            var prev = el.querySelector('.opynio-nav-prev');
            var cards = el.querySelectorAll('.opynio-review-card');
            if (!track || cards.length === 0) return;

            // Clone cards for infinite scroll
            cards.forEach(function(c) { track.appendChild(c.cloneNode(true)); });

            var idx = 0, interval;
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
            function start() { clearInterval(interval); interval = setInterval(function() { scroll(1); }, 5000); }
            next.onclick = function(e) { e.preventDefault(); e.stopPropagation(); scroll(1); start(); };
            prev.onclick = function(e) { e.preventDefault(); e.stopPropagation(); scroll(-1); start(); };
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

        el.className = 'opynio-widget opynio-theme-' + theme;
        renderLoader(el);

        try {
            var data = await fetchData(businessId);
            if (!data.business) { renderError(el, 'Negocio no encontrado'); return; }

            var reviews = (data.reviews || []).filter(function(r) { return r.review_text; });

            // Widgets that only need metrics
            if (['badge', 'floating', 'sidebar'].indexOf(type) !== -1) {
                renderers[type](el, data.business, []);
                return;
            }

            // Widgets that need reviews
            if (reviews.length === 0) {
                el.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--subtext-color);">No hay reseñas con texto para mostrar.</div>';
                return;
            }

            if (renderers[type]) {
                renderers[type](el, data.business, reviews);
            } else {
                renderError(el, 'Tipo de widget no soportado: ' + type);
            }
        } catch (err) {
            renderError(el, err.message);
        }
    }

    // Initialize all widgets on page
    function initAll() {
        injectStyles();
        var widgets = document.querySelectorAll('.opynio-widget[data-business-id]:not([data-loaded])');
        widgets.forEach(initWidget);
    }

    // Run on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAll);
    } else {
        initAll();
    }

    // Watch for dynamically added widgets
    if (typeof MutationObserver !== 'undefined') {
        new MutationObserver(function(mutations) {
            mutations.forEach(function(m) {
                if (m.addedNodes.length) initAll();
            });
        }).observe(document.body, { childList: true, subtree: true });
    }
})();
