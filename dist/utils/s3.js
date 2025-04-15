"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadToS3 = uploadToS3;
exports.getFileContent = getFileContent;
exports.deleteFromS3 = deleteFromS3;
exports.getSignedUrl = getSignedUrl;
const client_s3_1 = require("@aws-sdk/client-s3");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
const logger_1 = __importDefault(require("./logger"));
const s3Client = new client_s3_1.S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
    }
});
const BUCKET_NAME = process.env.AWS_S3_BUCKET || 'translation-platform';
/**
 * 上传文件到 S3
 */
async function uploadToS3(filePath, key, contentType) {
    try {
        const command = new client_s3_1.PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
            Body: filePath,
            ContentType: contentType
        });
        await s3Client.send(command);
        logger_1.default.info(`File uploaded successfully to S3: ${key}`);
        return `https://${BUCKET_NAME}.s3.amazonaws.com/${key}`;
    }
    catch (error) {
        logger_1.default.error(`Error uploading file to S3: ${error instanceof Error ? error.message : 'Unknown error'}`);
        throw error;
    }
}
/**
 * 从 S3 获取文件内容
 */
async function getFileContent(key) {
    try {
        const command = new client_s3_1.GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key
        });
        const response = await s3Client.send(command);
        const chunks = [];
        for await (const chunk of response.Body) {
            chunks.push(chunk);
        }
        return Buffer.concat(chunks).toString('utf-8');
    }
    catch (error) {
        logger_1.default.error(`Error getting file content from S3: ${error instanceof Error ? error.message : 'Unknown error'}`);
        throw error;
    }
}
/**
 * 从 S3 删除文件
 */
async function deleteFromS3(key) {
    try {
        const command = new client_s3_1.DeleteObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key
        });
        await s3Client.send(command);
        logger_1.default.info(`File deleted successfully from S3: ${key}`);
    }
    catch (error) {
        logger_1.default.error(`Error deleting file from S3: ${error instanceof Error ? error.message : 'Unknown error'}`);
        throw error;
    }
}
/**
 * 获取文件的预签名 URL
 */
async function getSignedUrl(key, expiresIn = 3600) {
    try {
        const command = new client_s3_1.GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key
        });
        return await (0, s3_request_presigner_1.getSignedUrl)(s3Client, command, { expiresIn });
    }
    catch (error) {
        logger_1.default.error(`Error generating signed URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
        throw error;
    }
}
