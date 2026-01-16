
require('dotenv').config();
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');

async function testDownload() {
    console.log('Testing R2 Download...');

    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const bucketName = process.env.R2_BUCKET_NAME;

    console.log('Config:', {
        accountId: accountId ? '***' : 'MISSING',
        accessKeyId: accessKeyId ? '***' : 'MISSING',
        secretAccessKey: secretAccessKey ? '***' : 'MISSING',
        bucketName
    });

    const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;

    const client = new S3Client({
        region: 'auto',
        endpoint: endpoint,
        credentials: {
            accessKeyId,
            secretAccessKey
        }
    });

    // Try to list first object to get a key
    const { ListObjectsV2Command } = require('@aws-sdk/client-s3');
    try {
        const listCmd = new ListObjectsV2Command({ Bucket: bucketName, MaxKeys: 1 });
        const listRes = await client.send(listCmd);
        const file = listRes.Contents[0];

        if (!file) {
            console.log('Bucket is empty');
            return;
        }

        const key = file.Key;
        console.log(`Found file: ${key} (${file.Size} bytes)`);

        console.time('Download');
        const getCmd = new GetObjectCommand({
            Bucket: bucketName,
            Key: key
        });
        const getRes = await client.send(getCmd);

        const streamToBuffer = (stream) =>
            new Promise((resolve, reject) => {
                const chunks = [];
                stream.on('data', (chunk) => chunks.push(chunk));
                stream.on('error', reject);
                stream.on('end', () => resolve(Buffer.concat(chunks)));
            });

        const buffer = await streamToBuffer(getRes.Body);
        console.timeEnd('Download');
        console.log(`Downloaded ${buffer.length} bytes`);

    } catch (error) {
        console.error('Error:', error);
    }
}

testDownload();
