import React from 'react';
import type { Business } from '../../../../../types';

// Import all widget preview components
import { HorizontalCarouselPreview } from './HorizontalCarouselWidget';
import { ShowcasePreview } from './ShowcaseWidget';
import { LargeCarouselPreview } from './LargeCarouselWidget';
import { SidebarPreview } from './SidebarWidget';
import { FloatingPreview } from './FloatingWidget';
import { GridPreview } from './GridWidget';
import { BadgePreview } from './BadgeWidget';
import { WallPreview } from './WallWidget';

export interface WidgetConfig {
    name: string;
    description: string;
    component: React.FC<{ business: Business, theme: 'light' | 'dark' }>;
    type: string;
}

export const WIDGETS: WidgetConfig[] = [
    { name: 'horizontal-carousel', description: 'businessDashboard.widgetDescriptions.horizontal-carousel', component: HorizontalCarouselPreview, type: 'horizontal-carousel' },
    { name: 'showcase', description: 'businessDashboard.widgetDescriptions.showcase', component: ShowcasePreview, type: 'showcase' },
    { name: 'large-carousel', description: 'businessDashboard.widgetDescriptions.large-carousel', component: LargeCarouselPreview, type: 'large-carousel' },
    { name: 'sidebar', description: 'businessDashboard.widgetDescriptions.sidebar', component: SidebarPreview, type: 'sidebar' },
    { name: 'floating', description: 'businessDashboard.widgetDescriptions.floating', component: FloatingPreview, type: 'floating' },
    { name: 'grid', description: 'businessDashboard.widgetDescriptions.grid', component: GridPreview, type: 'grid' },
    { name: 'badge', description: 'businessDashboard.widgetDescriptions.badge', component: BadgePreview, type: 'badge' },
    { name: 'wall', description: 'businessDashboard.widgetDescriptions.wall', component: WallPreview, type: 'wall' },
];

export const WIDGET_CSS = `
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
    
    /* Horizontal Carousel - ACTUALIZADO */
    .opynio-horizontal-widget { padding: 50px; background: var(--card-bg); border-radius: 24px; box-shadow: var(--shadow-lg); max-width: 1400px; margin: 0 auto; width: 100%; position: relative; isolation: isolate; }
    .opynio-horizontal-wrapper { display: flex; gap: 40px; align-items: flex-start; }
    .opynio-rating-panel-wrapper { flex-shrink: 0; }
    .opynio-rating-panel { min-width: 300px; text-align: center; padding: 40px 30px; border-radius: 20px; box-shadow: var(--shadow); }
    .opynio-theme-light .opynio-rating-panel { background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); }
    .opynio-theme-dark .opynio-rating-panel { background: linear-gradient(135deg, #064e3b 0%, #065f46 100%); }
    .opynio-rating-badge { display: inline-block; background: var(--opynio-green) !important; background-color: #00b67a !important; color: white !important; padding: 10px 28px; border-radius: 50px; font-weight: 700; font-size: 1.5rem; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 20px; }
    .opynio-stars-display { font-size: 2.5rem; color: var(--opynio-star); margin-bottom: 15px; }
    .opynio-rating-count { font-size: 1.1rem; color: var(--subtext-color); font-weight: 500; margin-bottom: 20px; }
    .opynio-rating-count strong { color: var(--text-color); }
    .opynio-logo { padding-top: 20px; border-top: 2px solid rgba(0, 182, 122, 0.2); margin-top: 20px; }
    .opynio-logo-text { font-size: 2rem; font-weight: 900; color: var(--opynio-green) !important; color: #00b67a !important; }
    .opynio-cards-container { flex: 1; position: relative; overflow: hidden; padding: 10px 60px 10px 10px; }
    .opynio-cards-track { display: flex; gap: 20px; transition: transform 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94); }
    .opynio-cards-track.no-transition { transition: none; }
    .opynio-review-card { min-width: 350px; max-width: 350px; width: 350px; min-height: 280px; height: auto; border-radius: 20px; padding: 25px; border: 2px solid var(--border-color); flex-shrink: 0; transition: all 0.3s ease; position: relative; background: var(--card-bg); display: flex; flex-direction: column; }
    .opynio-review-card:hover { transform: translateY(-8px); box-shadow: 0 15px 40px rgba(0, 182, 122, 0.15); border-color: var(--opynio-green) !important; border-color: #00b67a !important; }
    .opynio-review-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px; }
    .opynio-review-user { display: flex; gap: 12px; align-items: flex-start; flex: 1; }
    .opynio-avatar-placeholder { width: 45px; height: 45px; border-radius: 50%; background: linear-gradient(135deg, var(--opynio-green), var(--opynio-green-light)) !important; background: linear-gradient(135deg, #00b67a, #00d68f) !important; display: flex; align-items: center; justify-content: center; color: white !important; font-weight: 700; font-size: 1.2rem; flex-shrink: 0; box-shadow: 0 4px 12px rgba(0, 182, 122, 0.25); }
    .opynio-user-content { flex: 1; min-width: 0; }
    .opynio-username { font-weight: 700; color: var(--text-color); font-size: 1rem; margin-bottom: 6px; }
    .opynio-review-title { font-weight: 700; color: var(--text-color); margin-bottom: 0.5rem; font-size: 1rem; }
    .opynio-review-stars { display: flex; align-items: center; gap: 10px; margin-bottom: 15px; }
    .opynio-review-stars .opynio-stars { font-size: 1.1rem; letter-spacing: 2px; }
    .opynio-review-text { color: var(--subtext-color); line-height: 1.6; font-size: 0.9rem; flex: 1; margin-bottom: 10px; }
    
    .opynio-nav-arrow {
        position: absolute;
        top: 105px;
        width: 45px;
        height: 45px;
        border-radius: 50%;
        border: 2px solid var(--opynio-green) !important;
        border-color: #00b67a !important;
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
        -webkit-user-select: none;
        -moz-user-select: none;
        -ms-user-select: none;
    }
    
    .opynio-theme-dark .opynio-nav-arrow {
        background: #374151;
        border-color: var(--opynio-green-light);
    }
    
    .opynio-nav-arrow:hover {
        background: var(--opynio-green) !important;
        background-color: #00b67a !important;
        transform: scale(1.1);
    }
    
    .opynio-nav-arrow:active,
    .opynio-nav-arrow.active-click {
        background: var(--opynio-green) !important;
        background-color: #00b67a !important;
        transform: scale(0.95);
    }
    
    .opynio-nav-arrow svg {
        width: 24px;
        height: 24px;
        fill: var(--opynio-green) !important;
        fill: #00b67a !important;
        transition: fill 0.3s ease;
        pointer-events: none;
    }
    
    .opynio-nav-arrow:hover svg,
    .opynio-nav-arrow:active svg,
    .opynio-nav-arrow.active-click svg {
        fill: white !important;
    }
    
    .opynio-nav-arrow:focus {
        outline: none !important;
        box-shadow: none !important;
    }
    
    .opynio-nav-next {
        right: 10px;
    }
    
    .opynio-nav-prev {
        left: -50px;
        opacity: 0;
        transition: opacity 0.3s, left 0.3s ease-out;
    }
    
    .opynio-cards-container:hover .opynio-nav-prev {
        opacity: 1;
        left: 10px;
    }

    /* Responsive Design - Horizontal Carousel */
    @media (max-width: 1200px) {
        .opynio-horizontal-widget { padding: 40px 30px; }
    }
    
    @media (max-width: 1024px) { 
        .opynio-horizontal-wrapper { flex-direction: column; align-items: center; } 
        .opynio-rating-panel-wrapper { width: 100%; max-width: 500px; margin-bottom: 30px; }
        .opynio-cards-container { 
            width: 100%; 
            max-width: 100%;
            padding: 10px 55px; 
            overflow-x: hidden;
        }
        .opynio-cards-track {
            width: 100%;
        }
        .opynio-review-card { 
            min-width: 350px; 
            max-width: 350px; 
            width: 350px;
            height: auto;
            min-height: 300px;
            padding: 22px;
        }
        .opynio-review-text {
            display: -webkit-box;
            -webkit-line-clamp: 6;
            -webkit-box-orient: vertical;
            overflow: hidden;
            font-size: 0.88rem;
            line-height: 1.5;
            max-height: none;
        }
    }
    
    @media (max-width: 768px) { 
        .opynio-horizontal-widget { padding: 25px 15px; border-radius: 16px; }
        .opynio-horizontal-wrapper { gap: 25px; flex-direction: column; align-items: center; }
        .opynio-rating-panel-wrapper { width: 100%; max-width: 100%; margin-bottom: 0; }
        .opynio-rating-panel { min-width: 100%; padding: 25px 20px; }
        .opynio-rating-badge { font-size: 1.1rem; padding: 8px 20px; letter-spacing: 1px; }
        .opynio-stars-display { font-size: 1.8rem; letter-spacing: 4px; }
        .opynio-rating-count { font-size: 0.95rem; }
        .opynio-logo-text { font-size: 1.4rem; }
        .opynio-cards-container { 
            width: 100%; 
            max-width: 100%;
            padding: 10px 50px; 
            overflow: hidden;
        }
        .opynio-cards-track {
            width: 100%;
        }
        .opynio-review-card { 
            min-width: 100%; 
            max-width: 100%; 
            width: 100%; 
            height: auto; 
            min-height: 280px;
            padding: 20px;
        }
        .opynio-review-text {
            display: -webkit-box;
            -webkit-line-clamp: 6;
            -webkit-box-orient: vertical;
            overflow: hidden;
            font-size: 0.88rem;
            line-height: 1.5;
        }
        .opynio-nav-arrow { 
            width: 40px; 
            height: 40px; 
            top: 50%; 
            transform: translateY(-50%); 
        }
        .opynio-nav-arrow:hover { transform: translateY(-50%) scale(1.1); }
        .opynio-nav-next { right: 5px; }
        .opynio-nav-prev { left: 5px; opacity: 1; }
        .opynio-google-badge { font-size: 0.7rem; padding: 3px 8px; }
        .opynio-google-logo { width: 12px; height: 12px; }
    }
    
    @media (max-width: 480px) {
        .opynio-horizontal-widget { padding: 20px 10px; }
        .opynio-horizontal-wrapper { gap: 20px; }
        .opynio-rating-panel { padding: 20px 15px; }
        .opynio-rating-badge { font-size: 1rem; padding: 6px 16px; }
        .opynio-stars-display { font-size: 1.5rem; letter-spacing: 3px; }
        .opynio-rating-count { font-size: 0.85rem; }
        .opynio-logo-text { font-size: 1.2rem; }
        .opynio-cards-container { padding: 10px 45px; }
        .opynio-review-card { 
            min-width: 100%; 
            max-width: 100%; 
            width: 100%; 
            padding: 18px; 
            min-height: 300px;
        }
        .opynio-nav-arrow { width: 38px; height: 38px; }
        .opynio-nav-arrow svg { width: 20px; height: 20px; }
        .opynio-nav-next { right: 2px; }
        .opynio-nav-prev { left: 2px; }
        .opynio-avatar-placeholder { width: 38px; height: 38px; font-size: 1rem; }
        .opynio-username { font-size: 0.88rem; }
        .opynio-review-text { font-size: 0.85rem; line-height: 1.5; -webkit-line-clamp: 5; }
        .opynio-review-stars .opynio-stars { font-size: 1rem; letter-spacing: 1px; }
        .opynio-platform-badge { width: 20px; height: 20px; }
        .opynio-google-badge { font-size: 0.65rem; padding: 2px 6px; }
    }
    
    @media (max-width: 390px) {
        .opynio-horizontal-widget { padding: 18px 8px; }
        .opynio-rating-panel { padding: 18px 12px; }
        .opynio-cards-container { padding: 10px 42px; }
        .opynio-review-card { 
            min-width: 100%; 
            max-width: 100%; 
            width: 100%; 
            padding: 16px;
            min-height: 280px;
        }
        .opynio-nav-arrow { width: 36px; height: 36px; }
        .opynio-nav-arrow svg { width: 18px; height: 18px; }
    }
    
    @media (max-width: 360px) {
        .opynio-cards-container { padding: 10px 40px; }
        .opynio-review-card { 
            min-width: 100%; 
            max-width: 100%; 
            width: 100%;
        }
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

    /* FORZAR COLORES VERDES - MÁXIMA ESPECIFICIDAD */
    .opynio-widget.opynio-theme-light .opynio-rating-badge,
    .opynio-widget.opynio-theme-dark .opynio-rating-badge {
        background: #00b67a !important;
        background-color: #00b67a !important;
        color: white !important;
    }
    
    .opynio-widget.opynio-theme-light .opynio-logo-text,
    .opynio-widget.opynio-theme-dark .opynio-logo-text {
        color: #00b67a !important;
    }
    
    .opynio-widget.opynio-theme-light .opynio-nav-arrow,
    .opynio-widget.opynio-theme-dark .opynio-nav-arrow {
        border-color: #00b67a !important;
    }
    
    .opynio-widget.opynio-theme-light .opynio-nav-arrow:hover,
    .opynio-widget.opynio-theme-dark .opynio-nav-arrow:hover,
    .opynio-widget.opynio-theme-light .opynio-nav-arrow:active,
    .opynio-widget.opynio-theme-dark .opynio-nav-arrow:active,
    .opynio-widget.opynio-theme-light .opynio-nav-arrow.active-click,
    .opynio-widget.opynio-theme-dark .opynio-nav-arrow.active-click {
        background: #00b67a !important;
        background-color: #00b67a !important;
    }
    
    .opynio-widget.opynio-theme-light .opynio-nav-arrow svg,
    .opynio-widget.opynio-theme-dark .opynio-nav-arrow svg {
        fill: #00b67a !important;
    }
    
    .opynio-widget.opynio-theme-light .opynio-nav-arrow:hover svg,
    .opynio-widget.opynio-theme-dark .opynio-nav-arrow:hover svg,
    .opynio-widget.opynio-theme-light .opynio-nav-arrow:active svg,
    .opynio-widget.opynio-theme-dark .opynio-nav-arrow:active svg,
    .opynio-widget.opynio-theme-light .opynio-nav-arrow.active-click svg,
    .opynio-widget.opynio-theme-dark .opynio-nav-arrow.active-click svg {
        fill: white !important;
    }
    
    .opynio-widget.opynio-theme-light .opynio-avatar-placeholder,
    .opynio-widget.opynio-theme-dark .opynio-avatar-placeholder {
        background: linear-gradient(135deg, #00b67a, #00d68f) !important;
        color: white !important;
    }
    
    .opynio-widget.opynio-theme-light .opynio-review-card:hover,
    .opynio-widget.opynio-theme-dark .opynio-review-card:hover {
        border-color: #00b67a !important;
    }
    
    .opynio-widget.opynio-theme-light .opynio-platform-badge svg circle,
    .opynio-widget.opynio-theme-dark .opynio-platform-badge svg circle {
        fill: #00b67a !important;
    }
`;

export const getWidgetScript = (businessId: string, widgetType: string, theme: 'light' | 'dark'): string => {
    return `<!-- Opynio Widget v6.0 - ${widgetType} -->
<script src="https://web.opynio.com/widget.js" async></script>
<div class="opynio-widget" data-business-id="${businessId}" data-type="${widgetType}" data-theme="${theme}"></div>`;
};