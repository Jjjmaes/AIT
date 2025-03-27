"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const user_model_1 = __importDefault(require("../models/user.model"));
class UserController {
    async getProfile(req, res, next) {
        try {
            const user = await user_model_1.default.findById(req.user?.id);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: '用户不存在'
                });
            }
            const userData = {
                id: user._id,
                email: user.email,
                username: user.username,
                role: user.role
            };
            res.json({
                success: true,
                data: userData
            });
        }
        catch (error) {
            next(error);
        }
    }
    async updateProfile(req, res, next) {
        try {
            const user = await user_model_1.default.findById(req.user?.id);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: '用户不存在'
                });
            }
            const { username, email } = req.body;
            if (username)
                user.username = username;
            if (email)
                user.email = email;
            await user.save();
            const userData = {
                id: user._id,
                email: user.email,
                username: user.username,
                role: user.role
            };
            res.json({
                success: true,
                data: userData
            });
        }
        catch (error) {
            next(error);
        }
    }
    async changePassword(req, res, next) {
        try {
            const user = await user_model_1.default.findById(req.user?.id);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: '用户不存在'
                });
            }
            const { currentPassword, newPassword } = req.body;
            const isMatch = await user.comparePassword(currentPassword);
            if (!isMatch) {
                return res.status(400).json({
                    success: false,
                    message: '当前密码错误'
                });
            }
            user.password = newPassword;
            await user.save();
            res.json({
                success: true,
                message: '密码修改成功'
            });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.default = UserController;
