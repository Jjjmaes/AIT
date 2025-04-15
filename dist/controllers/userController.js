"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const user_service_1 = require("../services/user.service");
const errors_1 = require("../utils/errors");
class UserController {
    async getProfile(req, res, next) {
        try {
            if (!req.user) {
                return next(new errors_1.UnauthorizedError('请先登录'));
            }
            const userData = await user_service_1.userService.getUserById(req.user.id);
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
            if (!req.user) {
                return next(new errors_1.UnauthorizedError('请先登录'));
            }
            const userData = await user_service_1.userService.updateUser(req.user.id, req.body);
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
            if (!req.user) {
                return next(new errors_1.UnauthorizedError('请先登录'));
            }
            const result = await user_service_1.userService.changePassword(req.user.id, req.body);
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
