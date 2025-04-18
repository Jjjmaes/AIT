"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = require("react");
const react_router_dom_1 = require("react-router-dom");
const LocationLogger = () => {
    const location = (0, react_router_dom_1.useLocation)();
    (0, react_1.useEffect)(() => {
        console.log('>>> React Router Location Changed To:', location.pathname, location.search, location.hash);
    }, [location]); // Log whenever location object changes
    // This component doesn't render anything itself
    return null;
};
exports.default = LocationLogger;
