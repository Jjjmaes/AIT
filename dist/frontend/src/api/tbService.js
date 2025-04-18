"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTermBases = void 0;
// import api from './api'; // Remove old import
const base_1 = require("./base"); // Import and alias the correct instance
const antd_1 = require("antd");
// Function to fetch all Term Bases
// Assuming endpoint GET /term-bases returns { success: boolean, data: TermBase[] }
const getTermBases = async () => {
    try {
        const response = await base_1.axiosInstance.get('/api/term-bases');
        if (response.data && response.data.success && Array.isArray(response.data.data)) {
            return response.data.data;
        }
        else {
            console.error("Failed to fetch Term Bases:", response.data?.message || 'No data returned');
            antd_1.message.error(response.data?.message || "Failed to fetch Term Bases.");
            return [];
        }
    }
    catch (error) {
        console.error("Error fetching Term Bases:", error);
        const errorMsg = error.response?.data?.message || error.message || "An unknown error occurred";
        antd_1.message.error(`Error fetching TBs: ${errorMsg}`);
        return [];
    }
};
exports.getTermBases = getTermBases;
// Add other TB-related API functions (create, update, delete, import, export, etc.) as needed 
