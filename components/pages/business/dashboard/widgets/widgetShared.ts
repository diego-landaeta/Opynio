import React, { useState, useEffect } from 'react';
import type { Business } from '../../../../../types';
import { translateText } from '../../../../../services/geminiService';

// Import all widget preview components
import { HorizontalCarouselPreview } from './HorizontalCarouselWidget';
import { ShowcasePreview } from './ShowcaseWidget';
import { LargeCarouselPreview } from './LargeCarouselWidget';
import { SidebarPreview } from './SidebarWidget';
import { FloatingPreview } from './FloatingWidget';
import { GridPreview } from './GridWidget';
import { BadgePreview } from './BadgeWidget';
import { WallPreview } from './WallWidget';
import { StarsCarouselPreview } from './StarsCarouselWidget';

export interface WidgetConfig {
    name: string;
    description: string;
    component: React.FC<{ business: Business, theme: 'light' | 'dark', lang: string }>;
    type: string;
}

export const WIDGETS: WidgetConfig[] = [
    { name: 'stars-carousel', description: 'businessDashboard.widgetDescriptions.stars-carousel', component: StarsCarouselPreview, type: 'stars-carousel' },
    { name: 'horizontal-carousel', description: 'businessDashboard.widgetDescriptions.horizontal-carousel', component: HorizontalCarouselPreview, type: 'horizontal-carousel' },
    { name: 'showcase', description: 'businessDashboard.widgetDescriptions.showcase', component: ShowcasePreview, type: 'showcase' },
    { name: 'large-carousel', description: 'businessDashboard.widgetDescriptions.large-carousel', component: LargeCarouselPreview, type: 'large-carousel' },
    { name: 'wall', description: 'businessDashboard.widgetDescriptions.wall', component: WallPreview, type: 'wall' },
    { name: 'grid', description: 'businessDashboard.widgetDescriptions.grid', component: GridPreview, type: 'grid' },
    { name: 'sidebar', description: 'businessDashboard.widgetDescriptions.sidebar', component: SidebarPreview, type: 'sidebar' },
    { name: 'floating', description: 'businessDashboard.widgetDescriptions.floating', component: FloatingPreview, type: 'floating' },
    { name: 'badge', description: 'businessDashboard.widgetDescriptions.badge', component: BadgePreview, type: 'badge' },
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

    /* Stars Carousel — cuadro blanco + panel verde "EXCELENTE" izquierda +
       3 cards (avatar+nombre+estrellas) en bucle infinito + botón footer centrado.
       container-type permite que el widget responda a SU ancho (no al del viewport),
       imprescindible para previews en columnas estrechas del dashboard. */
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
    /* Columna derecha: cards arriba + botón "Ver reseñas completas" centrado debajo de las cards */
    .opynio-stars-carousel-right { display: flex; flex-direction: column; gap: 16px; align-items: center; justify-content: center; }

    /* Panel CTA "Ver más" a la izquierda */
    .opynio-stars-carousel-cta-link { text-decoration: none; color: inherit; display: flex; flex-shrink: 0; }
    .opynio-stars-carousel-cta {
        flex: 1;
        min-width: 210px;
        text-align: center;
        padding: 22px 18px;
        border-radius: 16px;
        box-shadow: var(--shadow);
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
    /* Label del rating (EXCELENTE/MUY BUENO/BUENO) — tipográfico con dos líneas verdes laterales */
    .opynio-stars-carousel-rating-label {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        color: var(--opynio-green-dark) !important;
        color: #008f5f !important;
        font-weight: 900;
        font-size: 0.95rem;
        text-transform: uppercase;
        letter-spacing: 2.5px;
        padding: 4px 0;
        margin-top: 4px;
    }
    .opynio-stars-carousel-rating-label::before,
    .opynio-stars-carousel-rating-label::after {
        content: '';
        display: inline-block;
        width: 16px;
        height: 2px;
        background: var(--opynio-green) !important;
        background-color: #00b67a !important;
        border-radius: 1px;
    }

    /* Botón inferior "Ver reseñas completas" — CTA principal verde sólido,
       separado del wrapper con un divisor sutil */
    .opynio-stars-carousel-footer {
        display: flex; justify-content: center;
    }
    .opynio-stars-carousel-footer-btn {
        display: inline-flex; align-items: center; gap: 8px;
        padding: 12px 28px;
        border-radius: 50px;
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

    /* Carousel de cards (solo estrellas) */
    /* cards-area = ancho exacto para 3 cards + padding lateral para las flechas */
    .opynio-stars-carousel-cards-area { flex: 0 1 auto; position: relative; padding: 0 42px; display: flex; align-items: center; }
    /* cards-container = exactamente 3 cards (3 * 165 + 2 * 14 = 523px). El clone queda fuera del overflow:hidden. */
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
        text-decoration: none;
        color: inherit;
        cursor: pointer;
        outline: none;
        transition: transform 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
    }
    .opynio-stars-carousel-card:hover {
        transform: translateY(-4px);
        border-color: var(--opynio-green) !important;
        border-color: #00b67a !important;
        box-shadow: 0 10px 26px rgba(0, 182, 122, 0.15);
    }
    .opynio-stars-carousel-card:focus-visible { outline: 3px solid #00b67a; outline-offset: 3px; }
    .opynio-stars-carousel-card-avatar { width: 44px !important; height: 44px !important; font-size: 1.1rem !important; }
    .opynio-stars-carousel-card-name {
        font-weight: 700;
        color: var(--text-color);
        font-size: 0.9rem;
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .opynio-stars-carousel-card-stars {
        font-size: 1rem;
        letter-spacing: 2px;
        color: var(--opynio-star);
    }
    .opynio-stars-carousel-card-stars .empty { color: var(--border-color); }

    /* Flechas */
    .opynio-stars-carousel-nav {
        position: absolute; top: 50%; transform: translateY(-50%);
        width: 42px; height: 42px;
        border-radius: 50%;
        border: 2px solid var(--opynio-green) !important;
        border-color: #00b67a !important;
        background: var(--card-bg) !important;
        display: flex; align-items: center; justify-content: center;
        cursor: pointer;
        padding: 0 !important;
        margin: 0 !important;
        outline: none !important;
        z-index: 10;
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
        transition: fill 0.3s ease;
        pointer-events: none;
    }
    .opynio-stars-carousel-nav:hover svg { fill: white !important; }
    .opynio-stars-carousel-nav:focus-visible { outline: 3px solid #00b67a; outline-offset: 2px; }
    .opynio-stars-carousel-nav-next { right: 0; }
    .opynio-stars-carousel-nav-prev {
        left: 0;
        opacity: 0;
        transition: opacity 0.3s ease, background 0.3s ease, transform 0.3s ease;
    }
    .opynio-stars-carousel-cards-area:hover .opynio-stars-carousel-nav-prev { opacity: 1; }

    /* Container queries: responden al ancho del widget, no al viewport.
       Crítico para previews en columnas estrechas del dashboard. */
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

export interface PreviewStrings {
    ratingExcellent: string;
    ratingVeryGood: string;
    ratingGood: string;
    reviews: string;
    outOf5: string;
    customerRatings: string;
    basedOn: string;
    basedOnAlt: string;
    writeReview: string;
    reviewsFor: string;
    googleReview: string;
    opynioReview: string;
    seeAllReviews: string;
}

const PREVIEW_STRINGS: Record<string, PreviewStrings> = {
    es: { ratingExcellent: 'EXCELENTE', ratingVeryGood: 'MUY BUENO', ratingGood: 'BUENO', reviews: 'reseñas', outOf5: 'de 5 estrellas', customerRatings: 'Valoración de nuestros clientes', basedOn: 'Basado en {n} reseñas', basedOnAlt: 'A base de <strong>{n} reseñas</strong>', writeReview: 'Escribe tu reseña', reviewsFor: 'Opiniones para', googleReview: 'Opinión de Google', opynioReview: 'Opinión de Opynio', seeAllReviews: 'Ver reseñas completas' },
    en: { ratingExcellent: 'EXCELLENT', ratingVeryGood: 'VERY GOOD', ratingGood: 'GOOD', reviews: 'reviews', outOf5: 'out of 5 stars', customerRatings: 'Our customer ratings', basedOn: 'Based on {n} reviews', basedOnAlt: 'Based on <strong>{n} reviews</strong>', writeReview: 'Write a review', reviewsFor: 'Reviews for', googleReview: 'Google Review', opynioReview: 'Opynio Review', seeAllReviews: 'See all reviews' },
    fr: { ratingExcellent: 'EXCELLENT', ratingVeryGood: 'TRÈS BIEN', ratingGood: 'BIEN', reviews: 'avis', outOf5: 'sur 5 étoiles', customerRatings: 'Évaluation de nos clients', basedOn: 'Basé sur {n} avis', basedOnAlt: 'Basé sur <strong>{n} avis</strong>', writeReview: 'Écrire un avis', reviewsFor: 'Avis pour', googleReview: 'Avis Google', opynioReview: 'Avis Opynio', seeAllReviews: 'Voir tous les avis' },
    de: { ratingExcellent: 'AUSGEZEICHNET', ratingVeryGood: 'SEHR GUT', ratingGood: 'GUT', reviews: 'Bewertungen', outOf5: 'von 5 Sternen', customerRatings: 'Bewertung unserer Kunden', basedOn: 'Basierend auf {n} Bewertungen', basedOnAlt: 'Basierend auf <strong>{n} Bewertungen</strong>', writeReview: 'Bewertung schreiben', reviewsFor: 'Bewertungen für', googleReview: 'Google-Bewertung', opynioReview: 'Opynio-Bewertung', seeAllReviews: 'Alle Bewertungen ansehen' },
    it: { ratingExcellent: 'ECCELLENTE', ratingVeryGood: 'MOLTO BUONO', ratingGood: 'BUONO', reviews: 'recensioni', outOf5: 'su 5 stelle', customerRatings: 'Valutazione dei nostri clienti', basedOn: 'Basato su {n} recensioni', basedOnAlt: 'Basato su <strong>{n} recensioni</strong>', writeReview: 'Scrivi una recensione', reviewsFor: 'Recensioni per', googleReview: 'Recensione Google', opynioReview: 'Recensione Opynio', seeAllReviews: 'Vedi tutte le recensioni' },
    pt: { ratingExcellent: 'EXCELENTE', ratingVeryGood: 'MUITO BOM', ratingGood: 'BOM', reviews: 'avaliações', outOf5: 'de 5 estrelas', customerRatings: 'Avaliação dos nossos clientes', basedOn: 'Baseado em {n} avaliações', basedOnAlt: 'Baseado em <strong>{n} avaliações</strong>', writeReview: 'Escrever avaliação', reviewsFor: 'Avaliações para', googleReview: 'Avaliação do Google', opynioReview: 'Avaliação do Opynio', seeAllReviews: 'Ver todas as avaliações' },
    ca: { ratingExcellent: 'EXCEL·LENT', ratingVeryGood: 'MOLT BO', ratingGood: 'BO', reviews: 'ressenyes', outOf5: 'de 5 estrelles', customerRatings: 'Valoració dels nostres clients', basedOn: 'Basat en {n} ressenyes', basedOnAlt: 'Basat en <strong>{n} ressenyes</strong>', writeReview: 'Escriu la teva ressenya', reviewsFor: 'Ressenyes per a', googleReview: 'Ressenya de Google', opynioReview: 'Ressenya d\'Opynio', seeAllReviews: 'Veure totes les ressenyes' },
    zh: { ratingExcellent: '优秀', ratingVeryGood: '很好', ratingGood: '好', reviews: '评论', outOf5: '/ 5 星', customerRatings: '客户评价', basedOn: '基于 {n} 条评论', basedOnAlt: '基于 <strong>{n} 条评论</strong>', writeReview: '写评论', reviewsFor: '评论', googleReview: 'Google 评论', opynioReview: 'Opynio 评论', seeAllReviews: '查看所有评论' },
};

const LANG_NORMALIZE: Record<string, string> = { 'zh-CN': 'zh', 'br': 'pt', 'cn': 'zh' };

export function getPreviewStrings(lang: string): PreviewStrings {
    const normalized = LANG_NORMALIZE[lang] || lang;
    return PREVIEW_STRINGS[normalized] || PREVIEW_STRINGS.en;
}

export function useTranslatedReviews<T extends Record<string, any>>(
    reviews: T[],
    lang: string,
    fields: string[]
): T[] {
    const [translated, setTranslated] = useState<T[]>(reviews);

    useEffect(() => {
        if (lang === 'es') {
            setTranslated(reviews);
            return;
        }

        let cancelled = false;

        Promise.all(reviews.map(async (review) => {
            const tr = { ...review };
            await Promise.all(fields.map(async (field) => {
                if (typeof review[field] === 'string') {
                    tr[field] = await translateText(review[field], lang);
                }
            }));
            return tr;
        })).then((result) => {
            if (!cancelled) setTranslated(result);
        });

        return () => { cancelled = true; };
    }, [lang]);

    return translated;
}

// Bump this whenever public/widget.js bumps its version header so the embed
// snippet that customers copy reflects what they're actually loading.
// The `?v=` query param in the script URL acts as cache-buster: a new bump
// forces visitors' browsers to redownload widget.js on first load instead of
// serving a stale cached copy from previous versions.
const EMBED_VERSION = 'v6.4.1';

export const getWidgetScript = (businessId: string, widgetType: string, theme: 'light' | 'dark', lang?: string): string => {
    const langAttr = lang ? ` data-lang="${lang}"` : '';
    return `<!-- Opynio Widget ${EMBED_VERSION} - ${widgetType} -->
<script src="https://web.opynio.com/widget.js?v=${EMBED_VERSION}" async></script>
<div class="opynio-widget" data-business-id="${businessId}" data-type="${widgetType}" data-theme="${theme}"${langAttr}></div>`;
};