import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { isAuthenticated } from '../api/authService';

interface ProtectedRouteProps {
  // You can add props here if needed, e.g., required roles
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = () => {
  console.log("--- Entering ProtectedRoute --- Location:", useLocation().pathname);
  const location = useLocation();
  const isAuth = isAuthenticated();
  console.log("--- ProtectedRoute Check --- isAuth:", isAuth);

  if (!isAuth) {
    console.log("--- ProtectedRoute: Redirecting to /login ---");
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  console.log("--- ProtectedRoute: Rendering Outlet --- Now rendering child component...");
  // If authenticated, render the child route element
  return <Outlet />;
};

export default ProtectedRoute; 