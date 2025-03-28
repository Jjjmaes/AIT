import { Document, Types } from 'mongoose';

/**
 * 通用对象类型，支持任意属性
 */
export type GenericObject = Record<string, unknown>;

/**
 * 基本数据类型
 */
export type PrimitiveTypes = string | number | boolean | null | undefined;

/**
 * 将Mongoose文档转换为普通对象，清理不需要的属性
 * 
 * @param doc Mongoose文档或文档数组
 * @returns 清理后的普通对象
 */
export function cleanDocument<T extends Document>(doc: T | T[] | null): GenericObject | GenericObject[] | null {
  if (!doc) {
    return null;
  }
  
  if (Array.isArray(doc)) {
    return doc.map(item => cleanDocument(item) as GenericObject);
  }
  
  const obj = doc.toObject ? doc.toObject() : doc;
  
  // 清理不需要的方法和Mongoose属性
  const { toObject, save, deleteOne, validate, $__, $isNew, ...cleanObj } = obj as any;
  
  // 处理嵌套对象
  Object.keys(cleanObj).forEach(key => {
    const value = cleanObj[key];
    
    if (value instanceof Types.ObjectId) {
      cleanObj[key] = value.toString();
    } else if (value instanceof Date) {
      cleanObj[key] = value.toISOString();
    } else if (Array.isArray(value)) {
      cleanObj[key] = value.map((item: unknown) => {
        if (item instanceof Types.ObjectId) {
          return item.toString();
        }
        if (item instanceof Document) {
          return cleanDocument(item) as GenericObject;
        }
        return item;
      });
    } else if (value !== null && typeof value === 'object') {
      cleanObj[key] = cleanNestedObject(value as GenericObject);
    }
  });
  
  return cleanObj as GenericObject;
}

/**
 * 处理嵌套对象，转换ObjectId和Date
 * 
 * @param obj 嵌套对象
 * @returns 清理后的嵌套对象
 */
function cleanNestedObject(obj: GenericObject): GenericObject {
  if (!obj) {
    return {};
  }
  
  const result: GenericObject = {};
  
  Object.keys(obj).forEach(key => {
    const value = obj[key];
    
    if (value instanceof Types.ObjectId) {
      result[key] = value.toString();
    } else if (value instanceof Date) {
      result[key] = value.toISOString();
    } else if (Array.isArray(value)) {
      result[key] = value.map((item: unknown) => {
        if (item instanceof Types.ObjectId) {
          return item.toString();
        }
        if (typeof item === 'object' && item !== null) {
          return cleanNestedObject(item as GenericObject);
        }
        return item;
      });
    } else if (value !== null && typeof value === 'object') {
      result[key] = cleanNestedObject(value as GenericObject);
    } else {
      result[key] = value;
    }
  });
  
  return result;
}

/**
 * 分页参数接口
 */
export interface PaginationOptions {
  page: number;
  limit: number;
  skip: number;
}

/**
 * 创建通用的分页选项
 * 
 * @param page 页码
 * @param limit 每页数量
 * @param maxLimit 最大每页数量限制
 * @returns 规范化的分页选项
 */
export function normalizePagination(
  page?: number | string, 
  limit?: number | string, 
  maxLimit: number = 100
): PaginationOptions {
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
export function parseFilters(query: GenericObject, allowedFields: string[]): GenericObject {
  const filters: GenericObject = {};
  
  Object.keys(query).forEach(key => {
    if (allowedFields.includes(key)) {
      filters[key] = query[key];
    }
  });
  
  // 处理搜索
  if (query.search && typeof query.search === 'string') {
    // 默认搜索字段
    let fieldsToSearch: string[] = ['name', 'description'];
    
    // 如果提供了searchFields，则使用它
    if (query.searchFields) {
      if (Array.isArray(query.searchFields)) {
        fieldsToSearch = query.searchFields as string[];
      } else if (typeof query.searchFields === 'string') {
        fieldsToSearch = (query.searchFields as string).split(',');
      }
    }
    
    // 过滤出允许的搜索字段
    const validSearchFields: string[] = fieldsToSearch.filter(field => 
      allowedFields.includes(field)
    );
    
    // 创建搜索条件
    if (validSearchFields.length > 0) {
      filters.$or = validSearchFields.map(field => ({
        [field]: { $regex: query.search, $options: 'i' }
      }));
    }
  }
  
  // 处理日期范围
  if (query.startDate && allowedFields.includes('createdAt')) {
    filters.createdAt = { ...(filters.createdAt as GenericObject || {}), $gte: new Date(query.startDate as string) };
  }
  
  if (query.endDate && allowedFields.includes('createdAt')) {
    filters.createdAt = { ...(filters.createdAt as GenericObject || {}), $lte: new Date(query.endDate as string) };
  }
  
  return filters;
}

/**
 * 排序选项接口
 */
export interface SortOptions {
  [key: string]: 1 | -1;
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
export function getSortOptions(
  sortBy?: string,
  sortOrder?: string,
  allowedFields: string[] = [],
  defaultField: string = 'createdAt'
): SortOptions {
  const defaultOrder = -1; // desc
  
  if (!sortBy || !allowedFields.includes(sortBy)) {
    sortBy = defaultField;
  }
  
  const order = sortOrder?.toLowerCase() === 'asc' ? 1 : defaultOrder;
  
  return { [sortBy]: order };
} 