import React from 'react';

/**
 * 字符串标记类型，用于替换简单标记为React节点
 */
type MarkupHandlers = {
  [tag: string]: (content: string) => React.ReactNode;
};

/**
 * 将包含简单标记的文本转换为React节点
 * 例如: "这是<term>术语</term>标记" → "这是<Tooltip>术语</Tooltip>标记"
 * 
 * @param text 包含标记的文本
 * @param handlers 标记处理函数对象
 * @returns React节点数组
 */
export const markupToReact = (text: string, handlers: MarkupHandlers): React.ReactNode[] => {
  // 如果没有文本或处理器，直接返回原文本
  if (!text || Object.keys(handlers).length === 0) {
    return [text];
  }

  // 创建正则表达式匹配所有已定义处理器的标签
  const tagNames = Object.keys(handlers).join('|');
  const regex = new RegExp(`<(${tagNames})>(.*?)<\\/\\1>`, 'g');
  
  // 结果数组
  const result: React.ReactNode[] = [];
  
  // 上一个匹配结束位置
  let lastIndex = 0;
  // 用于确保每个React节点有唯一key
  let keyCounter = 0;
  
  // 查找所有匹配
  let match;
  while ((match = regex.exec(text)) !== null) {
    // 添加标签前的文本
    if (match.index > lastIndex) {
      result.push(text.substring(lastIndex, match.index));
    }
    
    // 获取标签名和内容
    const [, tagName, content] = match;
    
    // 使用对应处理器处理内容并添加到结果
    if (handlers[tagName]) {
      result.push(
        React.createElement(
          React.Fragment, 
          { key: `markup-${keyCounter++}` },
          handlers[tagName](content)
        )
      );
    } else {
      // 如果没有找到处理器，添加原始标记文本
      result.push(match[0]);
    }
    
    // 更新索引到当前匹配之后
    lastIndex = regex.lastIndex;
  }
  
  // 添加最后一个标签后的剩余文本
  if (lastIndex < text.length) {
    result.push(text.substring(lastIndex));
  }
  
  return result;
}; 