import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import Meta from '../Meta';
import { useTranslation, useI18n, pathTranslations } from '../../contexts/i18nContext';
import { useCountry } from '../../contexts/CountryContext';
import { COUNTRIES } from '../../constants';

// Animated counter hook
const useCountUp = (end: number, duration: number = 2000, startOnView: boolean = true) => {
  const [count, setCount] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!startOnView) {
      setHasStarted(true);
    }
  }, [startOnView]);

  useEffect(() => {
    if (!startOnView) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasStarted) {
          setHasStarted(true);
        }
      },
      { threshold: 0.3 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [hasStarted, startOnView]);

  useEffect(() => {
    if (!hasStarted) return;

    let startTime: number;
    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(easeOut * end));

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [hasStarted, end, duration]);

  return { count, ref };
};

// Animated stat card with mini chart
const AnimatedStatCard: React.FC<{
  value: number;
  suffix: string;
  label: string;
  icon: string;
  color: string;
  delay: number;
}> = ({ value, suffix, label, icon, color, delay }) => {
  const { count, ref } = useCountUp(value, 2000);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  // Generate random bar heights for mini chart
  const bars = [40, 65, 45, 80, 60, 90, 75, 95];

  return (
    <div
      ref={ref}
      className={`relative overflow-hidden bg-white dark:bg-zinc-800 rounded-2xl p-6 border border-gray-100 dark:border-zinc-700 shadow-lg hover:shadow-xl transition-all duration-500 transform ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {/* Background animated chart */}
      <div className="absolute bottom-0 left-0 right-0 h-16 flex items-end justify-around px-2 opacity-20">
        {bars.map((height, i) => (
          <div
            key={i}
            className={`w-2 rounded-t ${color} transition-all duration-1000`}
            style={{
              height: isVisible ? `${height}%` : '0%',
              transitionDelay: `${delay + i * 100}ms`
            }}
          />
        ))}
      </div>

      {/* Content */}
      <div className="relative z-10">
        <div className={`w-12 h-12 rounded-xl ${color} bg-opacity-20 flex items-center justify-center mb-4`}>
          <i className={`${icon} text-xl ${color.replace('bg-', 'text-')}`}></i>
        </div>
        <div className="text-4xl font-bold text-gray-900 dark:text-white mb-1">
          {count}{suffix}
        </div>
        <div className="text-gray-500 dark:text-gray-400 text-sm">{label}</div>
      </div>

      {/* Floating decoration */}
      <div className={`absolute -top-4 -right-4 w-24 h-24 ${color} rounded-full opacity-10 animate-pulse`} />
    </div>
  );
};

// Floating number that rises up
const FloatingNumber: React.FC<{ value: string; left: string; top: string; delay: number }> = ({ value, left, top, delay }) => (
  <div
    className="absolute text-brand-green/[0.07] font-bold text-xl animate-float-number"
    style={{
      left,
      top,
      animationDelay: `${delay}s`,
    }}
  >
    {value}
  </div>
);

// Mini bar chart background element
const MiniBarChart: React.FC<{ left: string; top: string; delay: number }> = ({ left, top, delay }) => {
  const bars = [30, 50, 40, 70, 55, 85, 60];
  return (
    <div
      className="absolute flex items-end gap-0.5 opacity-[0.06] animate-float"
      style={{ left, top, animationDelay: `${delay}s`, animationDuration: '6s' }}
    >
      {bars.map((h, i) => (
        <div
          key={i}
          className="w-1.5 bg-brand-green rounded-t animate-bar-grow"
          style={{
            height: `${h}px`,
            animationDelay: `${delay + i * 0.1}s`
          }}
        />
      ))}
    </div>
  );
};

// Mini line chart background element
const MiniLineChart: React.FC<{ left: string; top: string; delay: number }> = ({ left, top, delay }) => (
  <svg
    className="absolute w-24 h-16 opacity-[0.08] animate-float"
    style={{ left, top, animationDelay: `${delay}s`, animationDuration: '5s' }}
    viewBox="0 0 100 50"
  >
    <path
      d="M0,40 Q20,35 30,30 T50,20 T70,25 T100,10"
      fill="none"
      stroke="rgb(34, 197, 94)"
      strokeWidth="2"
      className="animate-draw-line"
      style={{ animationDelay: `${delay}s` }}
    />
  </svg>
);

// Floating percentage
const FloatingPercent: React.FC<{ value: string; right: string; top: string; delay: number }> = ({ value, right, top, delay }) => (
  <div
    className="absolute text-blue-500/8 font-bold text-xl animate-pulse-slow"
    style={{ right, top, animationDelay: `${delay}s` }}
  >
    {value}
  </div>
);

// Floating background elements
const FloatingElements: React.FC = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    {/* Animated gradient circles */}
    <div className="absolute top-[5%] left-[5%] w-64 h-64 bg-brand-green/5 rounded-full blur-3xl animate-blob" />
    <div className="absolute top-[15%] right-[10%] w-72 h-72 bg-blue-500/5 rounded-full blur-3xl animate-blob animation-delay-2000" />
    <div className="absolute top-[35%] left-1/3 w-80 h-80 bg-purple-500/5 rounded-full blur-3xl animate-blob animation-delay-4000" />
    <div className="absolute top-[55%] right-[5%] w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl animate-blob" />
    <div className="absolute top-[75%] left-[10%] w-72 h-72 bg-orange-500/5 rounded-full blur-3xl animate-blob animation-delay-2000" />

    {/* Floating icons */}
    {[
      { icon: 'fa-chart-line', top: '5%', left: '5%', delay: '0s' },
      { icon: 'fa-star', top: '10%', right: '8%', delay: '1s' },
      { icon: 'fa-arrow-trend-up', top: '25%', left: '3%', delay: '2s' },
      { icon: 'fa-chart-pie', top: '30%', right: '5%', delay: '0.5s' },
      { icon: 'fa-award', top: '45%', left: '6%', delay: '1.5s' },
      { icon: 'fa-rocket', top: '50%', right: '4%', delay: '2.5s' },
      { icon: 'fa-chart-bar', top: '65%', left: '4%', delay: '0.8s' },
      { icon: 'fa-coins', top: '70%', right: '6%', delay: '1.8s' },
      { icon: 'fa-chart-area', top: '85%', left: '7%', delay: '2.2s' },
      { icon: 'fa-ranking-star', top: '90%', right: '3%', delay: '0.3s' },
    ].map((item, i) => (
      <div
        key={i}
        className="absolute text-brand-green/10 text-2xl animate-float"
        style={{
          top: item.top,
          left: item.left,
          right: item.right,
          animationDelay: item.delay,
          animationDuration: `${3 + i * 0.5}s`
        }}
      >
        <i className={`fa-solid ${item.icon}`}></i>
      </div>
    ))}

    {/* Floating numbers */}
    {[
      { value: '+45%', left: '2%', top: '8%', delay: 0 },
      { value: '+120', left: '92%', top: '15%', delay: 1 },
      { value: '+88%', left: '4%', top: '35%', delay: 2 },
      { value: '+250', left: '90%', top: '45%', delay: 0.5 },
      { value: '+67%', left: '3%', top: '55%', delay: 1.5 },
      { value: '+95', left: '93%', top: '65%', delay: 2.5 },
      { value: '+33%', left: '5%', top: '75%', delay: 0.8 },
      { value: '+180', left: '91%', top: '85%', delay: 1.8 },
    ].map((item, i) => (
      <FloatingNumber key={`num-${i}`} {...item} />
    ))}

    {/* Mini bar charts */}
    {[
      { left: '1%', top: '15%', delay: 0 },
      { left: '93%', top: '35%', delay: 2 },
      { left: '2%', top: '55%', delay: 4 },
      { left: '94%', top: '75%', delay: 1 },
      { left: '3%', top: '95%', delay: 3 },
    ].map((item, i) => (
      <MiniBarChart key={`bar-${i}`} {...item} />
    ))}

    {/* Mini line charts */}
    {[
      { left: '0%', top: '25%', delay: 1 },
      { left: '90%', top: '45%', delay: 3 },
      { left: '1%', top: '65%', delay: 0 },
      { left: '92%', top: '85%', delay: 2 },
    ].map((item, i) => (
      <MiniLineChart key={`line-${i}`} {...item} />
    ))}

    {/* Floating percentages */}
    {[
      { value: '95%', right: '2%', top: '20%', delay: 0 },
      { value: '40%', right: '4%', top: '40%', delay: 2 },
      { value: '87%', right: '1%', top: '60%', delay: 4 },
      { value: '125%', right: '3%', top: '80%', delay: 1 },
    ].map((item, i) => (
      <FloatingPercent key={`pct-${i}`} {...item} />
    ))}

    {/* Floating data points */}
    {[...Array(8)].map((_, i) => (
      <div
        key={`dot-${i}`}
        className="absolute w-2 h-2 bg-brand-green/10 rounded-full animate-float"
        style={{
          left: `${3 + (i % 2 === 0 ? 0 : 92)}%`,
          top: `${10 + i * 12}%`,
          animationDelay: `${i * 0.5}s`,
          animationDuration: `${3 + (i % 3)}s`
        }}
      />
    ))}
  </div>
);

// Animated line chart SVG
const AnimatedLineChart: React.FC<{ className?: string }> = ({ className }) => {
  const [animated, setAnimated] = useState(false);
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setAnimated(true);
      },
      { threshold: 0.3 }
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <svg ref={ref} viewBox="0 0 200 100" className={className}>
      <defs>
        <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="rgb(34, 197, 94)" stopOpacity="0.3" />
          <stop offset="100%" stopColor="rgb(34, 197, 94)" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Area fill */}
      <path
        d="M0,80 Q30,70 50,60 T100,40 T150,30 T200,20 L200,100 L0,100 Z"
        fill="url(#chartGradient)"
        className={`transition-all duration-1000 ${animated ? 'opacity-100' : 'opacity-0'}`}
      />

      {/* Line */}
      <path
        d="M0,80 Q30,70 50,60 T100,40 T150,30 T200,20"
        fill="none"
        stroke="rgb(34, 197, 94)"
        strokeWidth="2"
        strokeLinecap="round"
        className={`transition-all duration-1000 ${animated ? 'opacity-100' : 'opacity-0'}`}
        style={{
          strokeDasharray: 300,
          strokeDashoffset: animated ? 0 : 300,
          transition: 'stroke-dashoffset 2s ease-out'
        }}
      />

      {/* Data points */}
      {[[0, 80], [50, 60], [100, 40], [150, 30], [200, 20]].map(([cx, cy], i) => (
        <circle
          key={i}
          cx={cx}
          cy={cy}
          r="4"
          fill="rgb(34, 197, 94)"
          className={`transition-all duration-500 ${animated ? 'opacity-100 scale-100' : 'opacity-0 scale-0'}`}
          style={{ transitionDelay: `${800 + i * 200}ms`, transformOrigin: `${cx}px ${cy}px` }}
        />
      ))}
    </svg>
  );
};

// Case study card component with animations
const CaseStudyCard: React.FC<{
  title: string;
  industry: string;
  description: string;
  quote: string;
  result: string;
  link: string;
  opynioUrl: string;
  logoUrl: string;
  industryLabel: string;
  websiteLabel: string;
  opynioLabel: string;
  resultLabel: string;
  gradient: string;
  index: number;
}> = ({ title, industry, description, quote, result, link, opynioUrl, logoUrl, industryLabel, websiteLabel, opynioLabel, resultLabel, gradient, index }) => {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { threshold: 0.1 }
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`group bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-700 overflow-hidden hover:shadow-2xl transition-all duration-500 transform ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0'}`}
      style={{ transitionDelay: `${index * 100}ms` }}
    >
      {/* Header with gradient and logo */}
      <div className={`relative h-36 bg-gradient-to-br ${gradient} flex items-center justify-center p-4 overflow-hidden`}>
        {/* Animated background pattern */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 left-0 w-32 h-32 bg-white/20 rounded-full -translate-x-1/2 -translate-y-1/2 group-hover:scale-150 transition-transform duration-700" />
          <div className="absolute bottom-0 right-0 w-24 h-24 bg-white/20 rounded-full translate-x-1/2 translate-y-1/2 group-hover:scale-150 transition-transform duration-700" />
        </div>

        {logoUrl ? (
          <div className="relative w-24 h-24 bg-white rounded-xl shadow-lg flex items-center justify-center p-3 transform group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
            <img src={logoUrl} alt={title} className="max-w-full max-h-full object-contain" />
          </div>
        ) : (
          <i className="fa-solid fa-building text-5xl text-white/50"></i>
        )}
      </div>

      <div className="p-6">
        {/* Title and Industry */}
        <h3 className="font-bold text-xl text-gray-900 dark:text-white mb-2 group-hover:text-brand-green transition-colors">{title}</h3>
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-4">
          <i className="fa-solid fa-tag"></i>
          <span>{industryLabel}: {industry}</span>
        </div>

        {/* Description */}
        <p className="text-gray-600 dark:text-gray-400 mb-4 line-clamp-3">{description}</p>

        {/* Quote */}
        <blockquote className="border-l-4 border-brand-green pl-4 italic text-gray-700 dark:text-gray-300 mb-4 text-sm">
          "{quote}"
        </blockquote>

        {/* Result with animated highlight */}
        <div className="relative bg-gradient-to-r from-brand-green/10 to-emerald-500/10 dark:from-brand-green/20 dark:to-emerald-500/20 rounded-lg p-4 mb-4 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-brand-green/0 via-brand-green/10 to-brand-green/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
          <div className="relative">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider">{resultLabel}</div>
            <div className="font-bold text-brand-green flex items-center gap-2">
              <i className="fa-solid fa-chart-line text-sm"></i>
              {result}
            </div>
          </div>
        </div>

        {/* Links Section */}
        <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-zinc-700">
          {/* Website Link */}
          <div className="flex items-center gap-2 text-sm">
            <i className="fa-solid fa-globe text-gray-400"></i>
            <span className="text-gray-500 dark:text-gray-400">{websiteLabel}:</span>
            <a
              href={`https://${link}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-green hover:underline"
            >
              {link}
            </a>
          </div>
          {/* Opynio Profile Link */}
          <div className="flex items-center gap-2 text-sm">
            <i className="fa-solid fa-star text-brand-green"></i>
            <Link
              to={opynioUrl}
              className="text-brand-green hover:underline font-medium inline-flex items-center gap-1 group/link"
            >
              {opynioLabel}
              <i className="fa-solid fa-arrow-right text-xs group-hover/link:translate-x-1 transition-transform"></i>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

const CaseStudiesPage: React.FC = () => {
  const t = useTranslation();
  const { language } = useI18n();
  const { country } = useCountry();

  const countryPrefix = country ? `/${country.toLowerCase()}` : '';
  const paths = pathTranslations[language] || pathTranslations.es;

  // SEO: Obtener nombre del país para títulos únicos
  const countryName = COUNTRIES.find(c => c.code === country)?.name || '';
  const countryInTitle = countryName ? ` ${t('common.in')} ${countryName}` : '';

  const caseStudies = [
    {
      titleKey: 'caseStudiesPage.case1Title',
      industryKey: 'caseStudiesPage.case1Industry',
      descKey: 'caseStudiesPage.case1Desc',
      quoteKey: 'caseStudiesPage.case1Quote',
      resultKey: 'caseStudiesPage.case1Result',
      linkKey: 'caseStudiesPage.case1Link',
      opynioUrlKey: 'caseStudiesPage.case1OpynioUrl',
      logoUrlKey: 'caseStudiesPage.case1Logo',
      gradient: 'from-blue-500 to-blue-600',
    },
    {
      titleKey: 'caseStudiesPage.case2Title',
      industryKey: 'caseStudiesPage.case2Industry',
      descKey: 'caseStudiesPage.case2Desc',
      quoteKey: 'caseStudiesPage.case2Quote',
      resultKey: 'caseStudiesPage.case2Result',
      linkKey: 'caseStudiesPage.case2Link',
      opynioUrlKey: 'caseStudiesPage.case2OpynioUrl',
      logoUrlKey: 'caseStudiesPage.case2Logo',
      gradient: 'from-purple-500 to-purple-600',
    },
    {
      titleKey: 'caseStudiesPage.case3Title',
      industryKey: 'caseStudiesPage.case3Industry',
      descKey: 'caseStudiesPage.case3Desc',
      quoteKey: 'caseStudiesPage.case3Quote',
      resultKey: 'caseStudiesPage.case3Result',
      linkKey: 'caseStudiesPage.case3Link',
      opynioUrlKey: 'caseStudiesPage.case3OpynioUrl',
      logoUrlKey: 'caseStudiesPage.case3Logo',
      gradient: 'from-orange-500 to-orange-600',
    },
    {
      titleKey: 'caseStudiesPage.case4Title',
      industryKey: 'caseStudiesPage.case4Industry',
      descKey: 'caseStudiesPage.case4Desc',
      quoteKey: 'caseStudiesPage.case4Quote',
      resultKey: 'caseStudiesPage.case4Result',
      linkKey: 'caseStudiesPage.case4Link',
      opynioUrlKey: 'caseStudiesPage.case4OpynioUrl',
      logoUrlKey: 'caseStudiesPage.case4Logo',
      gradient: 'from-red-500 to-red-600',
    },
    {
      titleKey: 'caseStudiesPage.case5Title',
      industryKey: 'caseStudiesPage.case5Industry',
      descKey: 'caseStudiesPage.case5Desc',
      quoteKey: 'caseStudiesPage.case5Quote',
      resultKey: 'caseStudiesPage.case5Result',
      linkKey: 'caseStudiesPage.case5Link',
      opynioUrlKey: 'caseStudiesPage.case5OpynioUrl',
      logoUrlKey: 'caseStudiesPage.case5Logo',
      gradient: 'from-teal-500 to-teal-600',
    },
    {
      titleKey: 'caseStudiesPage.case6Title',
      industryKey: 'caseStudiesPage.case6Industry',
      descKey: 'caseStudiesPage.case6Desc',
      quoteKey: 'caseStudiesPage.case6Quote',
      resultKey: 'caseStudiesPage.case6Result',
      linkKey: 'caseStudiesPage.case6Link',
      opynioUrlKey: 'caseStudiesPage.case6OpynioUrl',
      logoUrlKey: 'caseStudiesPage.case6Logo',
      gradient: 'from-indigo-500 to-indigo-600',
    },
  ];

  return (
    <>
      <Meta
        title={`${t('caseStudiesPage.metaTitle')}${countryInTitle}`}
        description={`${t('caseStudiesPage.metaDescription')}${countryInTitle}.`}
      />

      {/* CSS for animations */}
      <style>{`
        @keyframes blob {
          0%, 100% { transform: translate(0, 0) scale(1); }
          25% { transform: translate(20px, -30px) scale(1.1); }
          50% { transform: translate(-20px, 20px) scale(0.9); }
          75% { transform: translate(30px, 10px) scale(1.05); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(5deg); }
        }
        @keyframes float-number {
          0%, 100% {
            transform: translateY(0) scale(1);
            opacity: 0.07;
          }
          50% {
            transform: translateY(-15px) scale(1.05);
            opacity: 0.12;
          }
        }
        @keyframes bar-grow {
          0% { transform: scaleY(0); }
          100% { transform: scaleY(1); }
        }
        @keyframes draw-line {
          0% { stroke-dasharray: 200; stroke-dashoffset: 200; }
          100% { stroke-dasharray: 200; stroke-dashoffset: 0; }
        }
        @keyframes pulse-slow {
          0%, 100% { opacity: 0.08; transform: scale(1); }
          50% { opacity: 0.15; transform: scale(1.1); }
        }
        .animate-blob {
          animation: blob 8s ease-in-out infinite;
        }
        .animate-float {
          animation: float 4s ease-in-out infinite;
        }
        .animate-float-number {
          animation: float-number 5s ease-in-out infinite;
        }
        .animate-bar-grow {
          animation: bar-grow 1s ease-out forwards;
          transform-origin: bottom;
        }
        .animate-draw-line {
          animation: draw-line 2s ease-out forwards;
        }
        .animate-pulse-slow {
          animation: pulse-slow 3s ease-in-out infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>

      <div className="relative max-w-6xl mx-auto">
        <FloatingElements />

        {/* Hero Section */}
        <section className="relative text-center py-16 md:py-24">
          {/* Animated badge */}
          <div className="inline-flex items-center gap-2 bg-brand-green/10 text-brand-green px-4 py-2 rounded-full text-sm font-semibold mb-6 animate-pulse">
            <i className="fa-solid fa-trophy"></i>
            <span>{t('caseStudiesPage.badgeText') || 'Historias de Éxito'}</span>
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-white mb-6">
            {t('caseStudiesPage.title')}{countryInTitle}
          </h1>
          <p className="text-lg md:text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
            {t('caseStudiesPage.subtitle')}
          </p>

          {/* Animated line chart decoration */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md opacity-30 pointer-events-none">
            <AnimatedLineChart className="w-full h-24" />
          </div>
        </section>

        {/* Stats Section with animated counters */}
        <section className="relative py-12 mb-8">
          <div className="grid md:grid-cols-3 gap-6">
            <AnimatedStatCard
              value={500}
              suffix="+"
              label={t('caseStudiesPage.stat1Label') || 'Empresas confían en nosotros'}
              icon="fa-solid fa-building"
              color="bg-brand-green"
              delay={0}
            />
            <AnimatedStatCard
              value={95}
              suffix="%"
              label={t('caseStudiesPage.stat2Label') || 'Satisfacción de clientes'}
              icon="fa-solid fa-face-smile"
              color="bg-blue-500"
              delay={150}
            />
            <AnimatedStatCard
              value={40}
              suffix="%"
              label={t('caseStudiesPage.stat3Label') || 'Aumento medio en conversiones'}
              icon="fa-solid fa-arrow-trend-up"
              color="bg-purple-500"
              delay={300}
            />
          </div>
        </section>

        {/* Intro Section */}
        <section className="relative py-12">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-4">
              {t('caseStudiesPage.introTitle')}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              {t('caseStudiesPage.introDesc')}
            </p>
          </div>

          {/* Visual results bar */}
          <div className="bg-gradient-to-r from-brand-green/5 via-blue-500/5 to-purple-500/5 rounded-2xl p-6 md:p-8">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 text-center">
              {t('caseStudiesPage.resultsTitle')}
            </h3>
            <div className="grid md:grid-cols-3 gap-4">
              {[
                { text: t('caseStudiesPage.result1'), icon: 'fa-users', color: 'text-brand-green' },
                { text: t('caseStudiesPage.result2'), icon: 'fa-star', color: 'text-yellow-500' },
                { text: t('caseStudiesPage.result3'), icon: 'fa-chart-line', color: 'text-blue-500' },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3 bg-white dark:bg-zinc-800 p-4 rounded-xl border border-gray-100 dark:border-zinc-700 hover:border-brand-green/50 transition-colors">
                  <div className={`w-10 h-10 rounded-full bg-gray-100 dark:bg-zinc-700 flex items-center justify-center flex-shrink-0`}>
                    <i className={`fa-solid ${item.icon} ${item.color}`}></i>
                  </div>
                  <span className="text-gray-700 dark:text-gray-300 font-medium text-sm">{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Case Studies Grid */}
        <section className="py-12">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {caseStudies.map((caseStudy, index) => (
              <CaseStudyCard
                key={index}
                index={index}
                title={t(caseStudy.titleKey)}
                industry={t(caseStudy.industryKey)}
                description={t(caseStudy.descKey)}
                quote={t(caseStudy.quoteKey)}
                result={t(caseStudy.resultKey)}
                link={t(caseStudy.linkKey)}
                opynioUrl={t(caseStudy.opynioUrlKey)}
                logoUrl={t(caseStudy.logoUrlKey)}
                industryLabel={t('caseStudiesPage.industry')}
                websiteLabel={t('caseStudiesPage.website')}
                opynioLabel={t('caseStudiesPage.opynioProfile')}
                resultLabel={t('caseStudiesPage.keyResult')}
                gradient={caseStudy.gradient}
              />
            ))}
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-12">
          <div className="relative bg-gradient-to-r from-brand-green to-emerald-600 rounded-3xl p-8 md:p-12 text-center overflow-hidden">
            {/* Animated background elements */}
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute -top-10 -left-10 w-40 h-40 bg-white/10 rounded-full blur-2xl animate-pulse" />
              <div className="absolute -bottom-10 -right-10 w-60 h-60 bg-white/10 rounded-full blur-2xl animate-pulse animation-delay-2000" />
              {/* Floating particles */}
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="absolute w-2 h-2 bg-white/30 rounded-full animate-float"
                  style={{
                    top: `${20 + i * 15}%`,
                    left: `${10 + i * 15}%`,
                    animationDelay: `${i * 0.5}s`,
                    animationDuration: `${3 + i * 0.3}s`
                  }}
                />
              ))}
            </div>

            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 bg-white/20 text-white px-4 py-2 rounded-full text-sm font-medium mb-6">
                <i className="fa-solid fa-rocket"></i>
                <span>{t('caseStudiesPage.ctaBadge') || 'Empieza hoy'}</span>
              </div>

              <h2 className="text-2xl md:text-4xl font-bold text-white mb-4">
                {t('caseStudiesPage.ctaTitle')}
              </h2>
              <p className="text-white/90 mb-8 max-w-2xl mx-auto text-lg">
                {t('caseStudiesPage.ctaDesc')}
              </p>
              <Link
                to={`${countryPrefix}/${paths.register}?type=business`}
                className="inline-flex items-center gap-3 bg-white text-brand-green px-8 py-4 rounded-xl font-semibold hover:bg-gray-100 hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-xl"
              >
                {t('caseStudiesPage.ctaButton')}
                <i className="fa-solid fa-arrow-right"></i>
              </Link>
            </div>
          </div>
        </section>
      </div>
    </>
  );
};

export default CaseStudiesPage;
