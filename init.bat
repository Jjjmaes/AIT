# 创建项目目录
mkdir translation-platform
cd translation-platform

# 初始化npm项目
npm init -y

# 安装核心依赖
npm install express mongoose jsonwebtoken bcrypt cors helmet morgan dotenv
npm install socket.io bull multer express-validator

# 安装AI服务接口
npm install openai @anthropic-ai/sdk 

# 安装TypeScript相关依赖
npm install --save-dev typescript ts-node @types/express @types/node nodemon
npm install --save-dev @types/mongoose @types/jsonwebtoken @types/bcrypt @types/cors
npm install --save-dev @types/multer @types/bull jest ts-jest @types/jest supertest

# 初始化TypeScript配置
npx tsc --init

# 创建基本目录结构
mkdir -p src/{config,controllers,interfaces,middleware,models,routes,services,utils,queues,socket}
mkdir -p client
mkdir -p tests/{unit,integration}