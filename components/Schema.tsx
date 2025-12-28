import React, { useEffect } from 'react';

interface SchemaProps {
  data: object;
}

const Schema: React.FC<SchemaProps> = ({ data }) => {
  useEffect(() => {
    const scriptId = 'json-ld-schema';
    
    // Clean up function to remove the script when the component unmounts or data changes
    const removeScript = () => {
      const scriptToRemove = document.getElementById(scriptId);
      if (scriptToRemove) {
        scriptToRemove.remove();
      }
    };
    
    removeScript(); // Remove any existing script first

    // Create new script element
    const script = document.createElement('script');
    script.id = scriptId;
    script.type = 'application/ld+json';
    script.innerHTML = JSON.stringify(data, null, 2); // Pretty print for easier debugging
    
    document.head.appendChild(script);

    return () => {
      removeScript();
    };
  }, [data]); // Rerun effect if data changes

  return null;
};

export default Schema;
