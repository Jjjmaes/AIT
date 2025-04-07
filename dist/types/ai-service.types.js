"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIProvider = void 0;
// AI 服务提供商
var AIProvider;
(function (AIProvider) {
    AIProvider["OPENAI"] = "openai";
    AIProvider["GOOGLE"] = "google";
    AIProvider["AZURE"] = "azure";
    AIProvider["AWS"] = "aws";
    AIProvider["GROK"] = "grok";
    AIProvider["DEEPSEEK"] = "deepseek";
    AIProvider["BAIDU"] = "baidu";
    AIProvider["ALIYUN"] = "aliyun";
})(AIProvider || (exports.AIProvider = AIProvider = {}));
