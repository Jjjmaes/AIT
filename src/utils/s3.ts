import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl as getS3SignedUrl } from '@aws-sdk/s3-request-presigner';
import logger from './logger';

const s3Client = new S3Client({
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
export async function uploadToS3(
  filePath: string | Buffer,
  key: string,
  contentType: string
): Promise<string> {
  try {
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: filePath,
      ContentType: contentType
    });

    await s3Client.send(command);
    logger.info(`File uploaded successfully to S3: ${key}`);
    return `https://${BUCKET_NAME}.s3.amazonaws.com/${key}`;
  } catch (error) {
    logger.error(`Error uploading file to S3: ${error instanceof Error ? error.message : 'Unknown error'}`);
    throw error;
  }
}

/**
 * 从 S3 获取文件内容
 */
export async function getFileContent(key: string): Promise<string> {
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key
    });

    const response = await s3Client.send(command);
    const chunks: Uint8Array[] = [];

    for await (const chunk of response.Body as any) {
      chunks.push(chunk);
    }

    return Buffer.concat(chunks).toString('utf-8');
  } catch (error) {
    logger.error(`Error getting file content from S3: ${error instanceof Error ? error.message : 'Unknown error'}`);
    throw error;
  }
}

/**
 * 从 S3 删除文件
 */
export async function deleteFromS3(key: string): Promise<void> {
  try {
    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key
    });

    await s3Client.send(command);
    logger.info(`File deleted successfully from S3: ${key}`);
  } catch (error) {
    logger.error(`Error deleting file from S3: ${error instanceof Error ? error.message : 'Unknown error'}`);
    throw error;
  }
}

/**
 * 获取文件的预签名 URL
 */
export async function getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key
    });

    return await getS3SignedUrl(s3Client, command, { expiresIn });
  } catch (error) {
    logger.error(`Error generating signed URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    throw error;
  }
} 