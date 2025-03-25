import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '../config';
import { ValidationError } from './errors';
import * as fs from 'fs';

const s3Client = new S3Client({
  region: config.aws.region,
  credentials: {
    accessKeyId: config.aws.accessKeyId,
    secretAccessKey: config.aws.secretAccessKey
  }
});

/**
 * 上传文件到S3
 */
export async function uploadToS3(
  filePath: string,
  key: string,
  contentType: string
): Promise<string> {
  if (!filePath || !key || !contentType) {
    throw new ValidationError('文件路径、键值和内容类型不能为空');
  }

  if (!fs.existsSync(filePath)) {
    throw new ValidationError('文件不存在');
  }

  try {
    const command = new PutObjectCommand({
      Bucket: config.aws.bucketName,
      Key: key,
      ContentType: contentType,
      Body: fs.createReadStream(filePath)
    });

    await s3Client.send(command);
    return `https://${config.aws.bucketName}.s3.${config.aws.region}.amazonaws.com/${key}`;
  } catch (error) {
    throw new ValidationError('文件上传失败');
  }
}

/**
 * 从S3删除文件
 */
export async function deleteFromS3(key: string): Promise<void> {
  if (!key) {
    throw new ValidationError('文件键值不能为空');
  }

  try {
    const command = new DeleteObjectCommand({
      Bucket: config.aws.bucketName,
      Key: key
    });

    await s3Client.send(command);
  } catch (error) {
    throw new ValidationError('文件删除失败');
  }
}

/**
 * 获取S3文件的签名URL
 */
export async function getSignedUrlForUpload(key: string, contentType: string): Promise<string> {
  if (!key || !contentType) {
    throw new ValidationError('文件键值和内容类型不能为空');
  }

  try {
    const command = new PutObjectCommand({
      Bucket: config.aws.bucketName,
      Key: key,
      ContentType: contentType
    });

    return getSignedUrl(s3Client, command, { expiresIn: 3600 });
  } catch (error) {
    throw new ValidationError('获取签名URL失败');
  }
}

/**
 * 获取S3文件内容
 */
export async function getFileContent(key: string): Promise<string> {
  if (!key) {
    throw new ValidationError('文件键值不能为空');
  }

  try {
    const command = new GetObjectCommand({
      Bucket: config.aws.bucketName,
      Key: key
    });

    const response = await s3Client.send(command);
    const chunks: Uint8Array[] = [];

    if (!response.Body) {
      throw new ValidationError('文件内容为空');
    }

    for await (const chunk of response.Body as any) {
      chunks.push(chunk);
    }

    return Buffer.concat(chunks).toString('utf-8');
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new ValidationError('获取文件内容失败');
  }
} 