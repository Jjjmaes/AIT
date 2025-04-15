import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const LocationLogger: React.FC = () => {
  const location = useLocation();

  useEffect(() => {
    console.log('>>> React Router Location Changed To:', location.pathname, location.search, location.hash);
  }, [location]); // Log whenever location object changes

  // This component doesn't render anything itself
  return null;
};

export default LocationLogger; 