已设计的项目管理API端点

项目管理:

POST /api/projects - 创建新项目
GET /api/projects - 获取项目列表
GET /api/projects/:projectId - 获取单个项目详情
PUT /api/projects/:projectId - 更新项目信息
DELETE /api/projects/:projectId - 删除项目
GET /api/projects/:projectId/stats - 获取项目统计信息
POST /api/projects/:projectId/progress - 更新项目进度


文件管理:

POST /api/projects/:projectId/files - 上传文件
GET /api/projects/:projectId/files - 获取项目文件列表
POST /api/files/:fileId/process - 处理文件分段
GET /api/files/:fileId/segments - 获取文件段落列表
POST /api/files/:fileId/progress - 更新文件进度