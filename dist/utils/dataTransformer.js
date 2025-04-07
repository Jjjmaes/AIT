"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanDocument = cleanDocument;
exports.normalizePagination = normalizePagination;
exports.parseFilters = parseFilters;
exports.getSortOptions = getSortOptions;
const mongoose_1 = require("mongoose");
/**
 * 将Mongoose文档转换为普通对象，清理不需要的属性
 *
 * @param doc Mongoose文档或文档数组
 * @returns 清理后的普通对象
 */
function cleanDocument(doc) {
    if (!doc) {
        return null;
    }
    if (Array.isArray(doc)) {
        return doc.map(item => cleanDocument(item));
    }
    const obj = doc.toObject ? doc.toObject() : doc;
    // 清理不需要的方法和Mongoose属性
    const { toObject, save, deleteOne, validate, $__, $isNew, ...cleanObj } = obj;
    // 处理嵌套对象
    Object.keys(cleanObj).forEach(key => {
        const value = cleanObj[key];
        if (value instanceof mongoose_1.Types.ObjectId) {
            cleanObj[key] = value.toString();
        }
        else if (value instanceof Date) {
            cleanObj[key] = value.toISOString();
        }
        else if (Array.isArray(value)) {
            cleanObj[key] = value.map((item) => {
                if (item instanceof mongoose_1.Types.ObjectId) {
                    return item.toString();
                }
                if (item instanceof mongoose_1.Document) {
                    return cleanDocument(item);
                }
                return item;
            });
        }
        else if (value !== null && typeof value === 'object') {
            cleanObj[key] = cleanNestedObject(value);
        }
    });
    return cleanObj;
}
/**
 * 处理嵌套对象，转换ObjectId和Date
 *
 * @param obj 嵌套对象
 * @returns 清理后的嵌套对象
 */
function cleanNestedObject(obj) {
    if (!obj) {
        return {};
    }
    const result = {};
    Object.keys(obj).forEach(key => {
        const value = obj[key];
        if (value instanceof mongoose_1.Types.ObjectId) {
            result[key] = value.toString();
        }
        else if (value instanceof Date) {
            result[key] = value.toISOString();
        }
        else if (Array.isArray(value)) {
            result[key] = value.map((item) => {
                if (item instanceof mongoose_1.Types.ObjectId) {
                    return item.toString();
                }
                if (typeof item === 'object' && item !== null) {
                    return cleanNestedObject(item);
                }
                return item;
            });
        }
        else if (value !== null && typeof value === 'object') {
            result[key] = cleanNestedObject(value);
        }
        else {
            result[key] = value;
        }
    });
    return result;
}
/**
 * 创建通用的分页选项
 *
 * @param page 页码
 * @param limit 每页数量
 * @param maxLimit 最大每页数量限制
 * @returns 规范化的分页选项
 */
function normalizePagination(page, limit, maxLimit = 100) {
    let parsedPage = typeof page === 'string' ? parseInt(page, 10) : page;
    let parsedLimit = typeof limit === 'string' ? parseInt(limit, 10) : limit;
    parsedPage = parsedPage && parsedPage > 0 ? parsedPage : 1;
    parsedLimit = parsedLimit && parsedLimit > 0 ? parsedLimit : 10;
    if (parsedLimit > maxLimit) {
        parsedLimit = maxLimit;
    }
    return {
        page: parsedPage,
        limit: parsedLimit,
        skip: (parsedPage - 1) * parsedLimit
    };
}
/**
 * 解析查询字符串中的过滤条件
 *
 * @param query 查询对象
 * @param allowedFields 允许的字段
 * @returns 处理后的过滤条件
 */
function parseFilters(query, allowedFields) {
    const filters = {};
    Object.keys(query).forEach(key => {
        if (allowedFields.includes(key)) {
            filters[key] = query[key];
        }
    });
    // 处理搜索
    if (query.search && typeof query.search === 'string') {
        // 默认搜索字段
        let fieldsToSearch = ['name', 'description'];
        // 如果提供了searchFields，则使用它
        if (query.searchFields) {
            if (Array.isArray(query.searchFields)) {
                fieldsToSearch = query.searchFields;
            }
            else if (typeof query.searchFields === 'string') {
                fieldsToSearch = query.searchFields.split(',');
            }
        }
        // 过滤出允许的搜索字段
        const validSearchFields = fieldsToSearch.filter(field => allowedFields.includes(field));
        // 创建搜索条件
        if (validSearchFields.length > 0) {
            filters.$or = validSearchFields.map(field => ({
                [field]: { $regex: query.search, $options: 'i' }
            }));
        }
    }
    // 处理日期范围
    if (query.startDate && allowedFields.includes('createdAt')) {
        filters.createdAt = { ...(filters.createdAt || {}), $gte: new Date(query.startDate) };
    }
    if (query.endDate && allowedFields.includes('createdAt')) {
        filters.createdAt = { ...(filters.createdAt || {}), $lte: new Date(query.endDate) };
    }
    return filters;
}
/**
 * 获取排序参数
 *
 * @param sortBy 排序字段
 * @param sortOrder 排序方向 ('asc' | 'desc')
 * @param allowedFields 允许的字段
 * @param defaultField 默认排序字段
 * @returns Mongoose排序对象
 */
function getSortOptions(sortBy, sortOrder, allowedFields = [], defaultField = 'createdAt') {
    const defaultOrder = -1; // desc
    if (!sortBy || !allowedFields.includes(sortBy)) {
        sortBy = defaultField;
    }
    const order = sortOrder?.toLowerCase() === 'asc' ? 1 : defaultOrder;
    return { [sortBy]: order };
}
