"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatCurrency = exports.formatProgress = exports.formatFileSize = exports.formatRelativeTime = exports.formatDate = void 0;
const dayjs_1 = __importDefault(require("dayjs"));
require("dayjs/locale/zh-cn");
// 设置语言为中文
dayjs_1.default.locale('zh-cn');
/**
 * 将日期格式化为用户友好的形式
 * @param date 日期字符串或Date对象
 * @param format 格式化模式，默认为'YYYY-MM-DD'
 * @returns 格式化后的日期字符串
 */
const formatDate = (date, format = 'YYYY-MM-DD') => {
    if (!date)
        return '';
    return (0, dayjs_1.default)(date).format(format);
};
exports.formatDate = formatDate;
/**
 * 将日期格式化为相对时间（如"3天前"）
 * @param date 日期字符串或Date对象
 * @returns 相对时间字符串
 */
const formatRelativeTime = (date) => {
    if (!date)
        return '';
    const now = (0, dayjs_1.default)();
    const target = (0, dayjs_1.default)(date);
    const diffDays = now.diff(target, 'day');
    if (diffDays === 0) {
        return '今天';
    }
    else if (diffDays === 1) {
        return '昨天';
    }
    else if (diffDays < 7) {
        return `${diffDays}天前`;
    }
    else if (diffDays < 30) {
        return `${Math.floor(diffDays / 7)}周前`;
    }
    else if (diffDays < 365) {
        return `${Math.floor(diffDays / 30)}个月前`;
    }
    else {
        return `${Math.floor(diffDays / 365)}年前`;
    }
};
exports.formatRelativeTime = formatRelativeTime;
/**
 * 格式化文件大小为人类可读形式
 * @param bytes 文件大小（字节）
 * @param decimals 小数位数，默认为2
 * @returns 格式化的文件大小字符串
 */
const formatFileSize = (bytes, decimals = 2) => {
    if (bytes === 0)
        return '0 字节';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['字节', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};
exports.formatFileSize = formatFileSize;
/**
 * 格式化进度百分比
 * @param value 进度值（0-100）
 * @returns 格式化的进度百分比字符串
 */
const formatProgress = (value) => {
    return `${Math.round(value)}%`;
};
exports.formatProgress = formatProgress;
/**
 * 格式化金额
 * @param amount 金额
 * @param currency 货币符号，默认为'¥'
 * @returns 格式化的金额字符串
 */
const formatCurrency = (amount, currency = '¥') => {
    return `${currency}${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
};
exports.formatCurrency = formatCurrency;
