import React, { useState, useRef, useEffect, memo } from 'react';
import Spinner from './Spinner';

interface LazyRenderProps {
  children: React.ReactNode;
  placeholderHeight?: string;
}

const LazyRender: React.FC<LazyRenderProps> = ({ children, placeholderHeight = '250px' }) => {
  const [isVisible, setIsVisible] = useState(false);
  const placeholderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const elementToObserve = placeholderRef.current; // Capture the ref value

    if (!elementToObserve) {
        return; // Exit if the element is not yet available
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        // If the element is intersecting (visible or about to be), update state and unobserve.
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(elementToObserve); // Unobserve the specific element.
        }
      },
      {
        // Start loading content when it's 250px away from the bottom of the viewport.
        rootMargin: '0px 0px 250px 0px',
      }
    );

    observer.observe(elementToObserve);

    // The cleanup function will be called when the component unmounts.
    // It uses the captured `elementToObserve` value, which is safe.
    return () => {
      observer.unobserve(elementToObserve);
    };
  }, []); // Empty dependency array ensures this effect runs only once on mount.

  return (
    <div ref={placeholderRef} style={{ minHeight: isVisible ? 'auto' : placeholderHeight }}>
      {isVisible ? children : (
        <div className="w-full h-full flex items-center justify-center pt-12" style={{ height: placeholderHeight }}>
            <Spinner />
        </div>
      )}
    </div>
  );
};

export default memo(LazyRender);
