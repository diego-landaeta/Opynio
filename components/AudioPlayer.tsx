

import React, { useState, useRef, useEffect } from 'react';

interface AudioPlayerProps {
    audioSrc: string;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({ audioSrc }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const audioRef = useRef<HTMLAudioElement>(null);
    const progressBarRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const setAudioData = () => {
            setDuration(audio.duration);
            setCurrentTime(audio.currentTime);
        };

        const setAudioTime = () => setCurrentTime(audio.currentTime);

        audio.addEventListener('loadeddata', setAudioData);
        audio.addEventListener('timeupdate', setAudioTime);
        
        // Reset state when src changes
        setIsPlaying(false);
        setCurrentTime(0);


        return () => {
            audio.removeEventListener('loadeddata', setAudioData);
            audio.removeEventListener('timeupdate', setAudioTime);
        };
    }, [audioSrc]);

    const togglePlayPause = () => {
        const audio = audioRef.current;
        if (!audio) return;
        if (isPlaying) {
            audio.pause();
        } else {
            audio.play();
        }
        setIsPlaying(!isPlaying);
    };
    
    const onProgressChange = () => {
        if (audioRef.current && progressBarRef.current) {
            audioRef.current.currentTime = Number(progressBarRef.current.value);
        }
    };

    const formatTime = (time: number) => {
        if (isNaN(time) || time === 0) return '00:00';
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };

    return (
        <div className="flex items-center gap-3 w-full bg-green-50 dark:bg-green-900/50 border border-green-100 dark:border-green-800/30 rounded-full p-2">
            <audio ref={audioRef} src={audioSrc} preload="metadata" onEnded={() => setIsPlaying(false)}></audio>
            <button onClick={togglePlayPause} className="w-10 h-10 flex-shrink-0 flex items-center justify-center bg-brand-green text-white rounded-full hover:bg-opacity-90 transition-colors">
                <i className={`fas ${isPlaying ? 'fa-pause' : 'fa-play'}`}></i>
            </button>
            <div className="flex-grow flex items-center gap-2">
                <span className="text-xs font-mono text-green-800 dark:text-green-300">{formatTime(currentTime)}</span>
                <input
                    ref={progressBarRef}
                    type="range"
                    value={currentTime}
                    max={duration || 0}
                    onChange={onProgressChange}
                    className="w-full h-1.5 bg-green-200 dark:bg-green-800/50 rounded-lg appearance-none cursor-pointer accent-brand-green"
                />
                <span className="text-xs font-mono text-green-800 dark:text-green-300">{formatTime(duration)}</span>
            </div>
        </div>
    );
};

export default AudioPlayer;