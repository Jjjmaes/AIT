"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CacheKey = void 0;
var CacheKey;
(function (CacheKey) {
    /** 翻译结果缓存 */
    CacheKey["TRANSLATION_RESULT"] = "translation:result";
    /** 翻译模型信息缓存 */
    CacheKey["MODEL_INFO"] = "translation:model:info";
    /** 翻译模型列表缓存 */
    CacheKey["MODEL_LIST"] = "translation:model:list";
    /** 翻译定价信息缓存 */
    CacheKey["PRICING_INFO"] = "translation:pricing:info";
    /** 翻译质量评估结果缓存 */
    CacheKey["QUALITY_ASSESSMENT"] = "translation:quality:assessment";
    /** 翻译术语库缓存 */
    CacheKey["TERMINOLOGY"] = "translation:terminology";
    /** 翻译配置缓存 */
    CacheKey["CONFIG"] = "translation:config";
    /** 翻译统计信息缓存 */
    CacheKey["STATS"] = "translation:stats";
    /** 翻译任务状态缓存 */
    CacheKey["TASK_STATUS"] = "translation:task:status";
    /** 翻译进度缓存 */
    CacheKey["PROGRESS"] = "translation:progress";
    /** 翻译语言对支持缓存 */
    CacheKey["LANGUAGE_PAIRS"] = "translation:language:pairs";
    /** 翻译字符数统计缓存 */
    CacheKey["CHARACTER_COUNT"] = "translation:character:count";
    /** 翻译成本估算缓存 */
    CacheKey["COST_ESTIMATE"] = "translation:cost:estimate";
    /** 翻译质量分数缓存 */
    CacheKey["QUALITY_SCORE"] = "translation:quality:score";
    /** 翻译错误统计缓存 */
    CacheKey["ERROR_STATS"] = "translation:error:stats";
    /** 翻译性能指标缓存 */
    CacheKey["PERFORMANCE_METRICS"] = "translation:performance:metrics";
    /** 翻译缓存统计信息 */
    CacheKey["CACHE_STATS"] = "translation:cache:stats";
    /** 翻译队列统计信息 */
    CacheKey["QUEUE_STATS"] = "translation:queue:stats";
})(CacheKey || (exports.CacheKey = CacheKey = {}));
