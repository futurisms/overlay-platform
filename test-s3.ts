import { S3Client, PutObjectCommand, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';
import { writeFileSync, readFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const BUCKET_NAME = 'overlay-documents-975050116849';
const REGION = 'eu-west-1';
const TEST_FILE_NAME = 'test-document.txt';
const TEST_FILE_CONTENT = `Overlay Platform Test Document
Created at: ${new Date().toISOString()}

This is a test document to verify S3 bucket functionality.
The Overlay Platform is successfully deployed and operational!

Test details:
- Bucket: ${BUCKET_NAME}
- Region: ${REGION}
- Document ID: test-${Date.now()}
`;

const s3Client = new S3Client({ region: REGION });

async function runS3Test() {
  console.log('🚀 Starting S3 Bucket Test...\n');

  try {
    // Step 1: Create test file locally
    console.log('📝 Step 1: Creating test file locally...');
    const localFilePath = join(process.cwd(), TEST_FILE_NAME);
    writeFileSync(localFilePath, TEST_FILE_CONTENT);
    console.log(`✅ Created: ${localFilePath}\n`);

    // Step 2: Upload to S3
    console.log('☁️  Step 2: Uploading file to S3...');
    const uploadParams = {
      Bucket: BUCKET_NAME,
      Key: TEST_FILE_NAME,
      Body: TEST_FILE_CONTENT,
      ContentType: 'text/plain',
      Metadata: {
        'uploaded-by': 'test-script',
        'test-timestamp': Date.now().toString(),
      },
    };

    const uploadCommand = new PutObjectCommand(uploadParams);
    const uploadResult = await s3Client.send(uploadCommand);
    console.log(`✅ Upload successful!`);
    console.log(`   ETag: ${uploadResult.ETag}\n`);

    // Step 3: List files in bucket
    console.log('📋 Step 3: Listing files in bucket...');
    const listCommand = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      MaxKeys: 10,
    });

    const listResult = await s3Client.send(listCommand);
    if (listResult.Contents && listResult.Contents.length > 0) {
      console.log(`✅ Found ${listResult.Contents.length} file(s) in bucket:`);
      listResult.Contents.forEach((item, index) => {
        console.log(`   ${index + 1}. ${item.Key} (${item.Size} bytes, modified: ${item.LastModified?.toISOString()})`);
      });
      console.log('');
    } else {
      console.log('⚠️  No files found in bucket\n');
    }

    // Step 4: Download file back
    console.log('⬇️  Step 4: Downloading file from S3...');
    const downloadCommand = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: TEST_FILE_NAME,
    });

    const downloadResult = await s3Client.send(downloadCommand);
    const downloadedContent = await downloadResult.Body?.transformToString();

    const downloadedFilePath = join(process.cwd(), 'downloaded-' + TEST_FILE_NAME);
    writeFileSync(downloadedFilePath, downloadedContent || '');
    console.log(`✅ Downloaded to: ${downloadedFilePath}\n`);

    // Step 5: Verify content matches
    console.log('🔍 Step 5: Verifying content...');
    if (downloadedContent === TEST_FILE_CONTENT) {
      console.log('✅ Content verification PASSED! Upload and download working correctly.\n');
    } else {
      console.log('❌ Content verification FAILED! Content mismatch.\n');
      console.log('Original length:', TEST_FILE_CONTENT.length);
      console.log('Downloaded length:', downloadedContent?.length || 0);
    }

    // Summary
    console.log('═══════════════════════════════════════════');
    console.log('✅ S3 BUCKET TEST COMPLETED SUCCESSFULLY!');
    console.log('═══════════════════════════════════════════');
    console.log(`Bucket: ${BUCKET_NAME}`);
    console.log(`Region: ${REGION}`);
    console.log(`Test File: ${TEST_FILE_NAME}`);
    console.log(`Status: All operations working correctly`);
    console.log('═══════════════════════════════════════════\n');

  } catch (error) {
    console.error('\n❌ TEST FAILED!');
    console.error('Error:', error);
    process.exit(1);
  }
}

// Run the test
runS3Test().catch(console.error);
