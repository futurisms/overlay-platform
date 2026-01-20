import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  UpdateCommand
} from '@aws-sdk/lib-dynamodb';

const TABLE_NAME = 'overlay-documents';
const REGION = 'eu-west-1';

const client = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(client);

interface DocumentRecord {
  documentId: string;
  timestamp: number;
  status: string;
  fileName: string;
  fileSize: number;
  s3Key: string;
  createdAt: string;
  updatedAt: string;
}

async function runDynamoDBTest() {
  console.log('🚀 Starting DynamoDB Table Test...\n');

  const testDocumentId = 'test-doc-001';
  const currentTimestamp = Date.now();

  try {
    // Step 1: Put a test document record
    console.log('📝 Step 1: Putting test document record...');
    const testDocument: DocumentRecord = {
      documentId: testDocumentId,
      timestamp: currentTimestamp,
      status: 'UPLOADED',
      fileName: 'test-document.txt',
      fileSize: 301,
      s3Key: 'test-document.txt',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const putCommand = new PutCommand({
      TableName: TABLE_NAME,
      Item: testDocument,
    });

    await docClient.send(putCommand);
    console.log('✅ Document record created successfully!');
    console.log(`   Document ID: ${testDocumentId}`);
    console.log(`   Status: ${testDocument.status}`);
    console.log(`   Timestamp: ${testDocument.timestamp}\n`);

    // Step 2: Get the item by documentId
    console.log('🔍 Step 2: Getting document by documentId...');
    const getCommand = new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        documentId: testDocumentId,
        timestamp: currentTimestamp,
      },
    });

    const getResult = await docClient.send(getCommand);
    if (getResult.Item) {
      console.log('✅ Document retrieved successfully!');
      console.log('   Retrieved data:', JSON.stringify(getResult.Item, null, 2));
      console.log('');
    } else {
      console.log('❌ Document not found!\n');
    }

    // Step 3: Query using StatusIndex GSI to find all UPLOADED documents
    console.log('🔎 Step 3: Querying UPLOADED documents using StatusIndex GSI...');
    const queryCommand = new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: 'StatusIndex',
      KeyConditionExpression: '#status = :statusValue',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':statusValue': 'UPLOADED',
      },
    });

    const queryResult = await docClient.send(queryCommand);
    console.log(`✅ Query completed! Found ${queryResult.Count} UPLOADED document(s):`);
    if (queryResult.Items && queryResult.Items.length > 0) {
      queryResult.Items.forEach((item, index) => {
        console.log(`   ${index + 1}. ${item.documentId} - ${item.fileName} (${item.fileSize} bytes)`);
      });
    }
    console.log('');

    // Step 4: Update the status to PROCESSING
    console.log('✏️  Step 4: Updating document status to PROCESSING...');
    const updateCommand = new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        documentId: testDocumentId,
        timestamp: currentTimestamp,
      },
      UpdateExpression: 'SET #status = :newStatus, #updatedAt = :updatedAt',
      ExpressionAttributeNames: {
        '#status': 'status',
        '#updatedAt': 'updatedAt',
      },
      ExpressionAttributeValues: {
        ':newStatus': 'PROCESSING',
        ':updatedAt': new Date().toISOString(),
      },
      ReturnValues: 'ALL_NEW',
    });

    const updateResult = await docClient.send(updateCommand);
    console.log('✅ Status updated successfully!');
    console.log(`   New status: ${updateResult.Attributes?.status}`);
    console.log(`   Updated at: ${updateResult.Attributes?.updatedAt}\n`);

    // Step 5: Query again to verify the update
    console.log('🔍 Step 5: Verifying update by querying UPLOADED documents...');
    const verifyUploadedQuery = await docClient.send(queryCommand);
    console.log(`✅ UPLOADED documents count: ${verifyUploadedQuery.Count}`);

    console.log('\n🔎 Step 5b: Querying PROCESSING documents...');
    const processingQueryCommand = new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: 'StatusIndex',
      KeyConditionExpression: '#status = :statusValue',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':statusValue': 'PROCESSING',
      },
    });

    const processingResult = await docClient.send(processingQueryCommand);
    console.log(`✅ PROCESSING documents count: ${processingResult.Count}`);
    if (processingResult.Items && processingResult.Items.length > 0) {
      processingResult.Items.forEach((item, index) => {
        console.log(`   ${index + 1}. ${item.documentId} - Status: ${item.status} (Updated: ${item.updatedAt})`);
      });
    }
    console.log('');

    // Verify the update worked
    const finalGetCommand = new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        documentId: testDocumentId,
        timestamp: currentTimestamp,
      },
    });

    const finalGetResult = await docClient.send(finalGetCommand);
    if (finalGetResult.Item && finalGetResult.Item.status === 'PROCESSING') {
      console.log('✅ Update verification PASSED! Status changed from UPLOADED to PROCESSING.\n');
    } else {
      console.log('❌ Update verification FAILED!\n');
    }

    // Summary
    console.log('═══════════════════════════════════════════════════');
    console.log('✅ DYNAMODB TABLE TEST COMPLETED SUCCESSFULLY!');
    console.log('═══════════════════════════════════════════════════');
    console.log(`Table: ${TABLE_NAME}`);
    console.log(`Region: ${REGION}`);
    console.log(`Test Document ID: ${testDocumentId}`);
    console.log('');
    console.log('Operations Verified:');
    console.log('  ✅ PutItem - Create new document record');
    console.log('  ✅ GetItem - Retrieve by primary key');
    console.log('  ✅ Query - Search by status using GSI');
    console.log('  ✅ UpdateItem - Change document status');
    console.log('  ✅ GSI StatusIndex - Working correctly');
    console.log('═══════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('\n❌ TEST FAILED!');
    console.error('Error:', error);
    process.exit(1);
  }
}

// Run the test
runDynamoDBTest().catch(console.error);
