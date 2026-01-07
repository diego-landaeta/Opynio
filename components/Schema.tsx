import React, { useEffect } from 'react';

interface SchemaProps {
  data: object;
  id?: string; // ID único para permitir múltiples schemas en la misma página
}

const Schema: React.FC<SchemaProps> = ({ data, id = 'json-ld-schema' }) => {
  useEffect(() => {
    const scriptId = id;

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
  }, [data, id]); // Rerun effect if data or id changes

  return null;
};

export default Schema;
