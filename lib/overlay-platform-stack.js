"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.OverlayPlatformStack = void 0;
const cdk = __importStar(require("aws-cdk-lib/core"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
class OverlayPlatformStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        const { storageStack } = props;
        // Reference storage resources from storage stack
        const documentBucket = storageStack.documentBucket;
        const documentTable = storageStack.documentTable;
        const vpc = storageStack.vpc;
        const auroraCluster = storageStack.auroraCluster;
        // Lambda Layer for common dependencies
        const commonLayer = new lambda.LayerVersion(this, 'CommonLayer', {
            code: lambda.Code.fromAsset('lambda/layers/common'),
            compatibleRuntimes: [lambda.Runtime.NODEJS_20_X],
            description: 'Common dependencies for Overlay platform Lambda functions',
        });
        // Outputs
        new cdk.CfnOutput(this, 'DocumentBucketName', {
            value: documentBucket.bucketName,
            description: 'S3 bucket for document storage',
            exportName: 'OverlayDocumentBucket',
        });
        new cdk.CfnOutput(this, 'DocumentTableName', {
            value: documentTable.tableName,
            description: 'DynamoDB table for document metadata',
            exportName: 'OverlayDocumentTable',
        });
        new cdk.CfnOutput(this, 'CommonLayerArn', {
            value: commonLayer.layerVersionArn,
            description: 'Common Lambda layer ARN',
            exportName: 'OverlayCommonLayer',
        });
    }
}
exports.OverlayPlatformStack = OverlayPlatformStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3ZlcmxheS1wbGF0Zm9ybS1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIm92ZXJsYXktcGxhdGZvcm0tc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsc0RBQXdDO0FBRXhDLCtEQUFpRDtBQU9qRCxNQUFhLG9CQUFxQixTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQ2pELFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBZ0M7UUFDeEUsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsTUFBTSxFQUFFLFlBQVksRUFBRSxHQUFHLEtBQUssQ0FBQztRQUUvQixpREFBaUQ7UUFDakQsTUFBTSxjQUFjLEdBQUcsWUFBWSxDQUFDLGNBQWMsQ0FBQztRQUNuRCxNQUFNLGFBQWEsR0FBRyxZQUFZLENBQUMsYUFBYSxDQUFDO1FBQ2pELE1BQU0sR0FBRyxHQUFHLFlBQVksQ0FBQyxHQUFHLENBQUM7UUFDN0IsTUFBTSxhQUFhLEdBQUcsWUFBWSxDQUFDLGFBQWEsQ0FBQztRQUVqRCx1Q0FBdUM7UUFDdkMsTUFBTSxXQUFXLEdBQUcsSUFBSSxNQUFNLENBQUMsWUFBWSxDQUFDLElBQUksRUFBRSxhQUFhLEVBQUU7WUFDL0QsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLHNCQUFzQixDQUFDO1lBQ25ELGtCQUFrQixFQUFFLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxXQUFXLENBQUM7WUFDaEQsV0FBVyxFQUFFLDJEQUEyRDtTQUN6RSxDQUFDLENBQUM7UUFFSCxVQUFVO1FBQ1YsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxvQkFBb0IsRUFBRTtZQUM1QyxLQUFLLEVBQUUsY0FBYyxDQUFDLFVBQVU7WUFDaEMsV0FBVyxFQUFFLGdDQUFnQztZQUM3QyxVQUFVLEVBQUUsdUJBQXVCO1NBQ3BDLENBQUMsQ0FBQztRQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsbUJBQW1CLEVBQUU7WUFDM0MsS0FBSyxFQUFFLGFBQWEsQ0FBQyxTQUFTO1lBQzlCLFdBQVcsRUFBRSxzQ0FBc0M7WUFDbkQsVUFBVSxFQUFFLHNCQUFzQjtTQUNuQyxDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLGdCQUFnQixFQUFFO1lBQ3hDLEtBQUssRUFBRSxXQUFXLENBQUMsZUFBZTtZQUNsQyxXQUFXLEVBQUUseUJBQXlCO1lBQ3RDLFVBQVUsRUFBRSxvQkFBb0I7U0FDakMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztDQUNGO0FBdENELG9EQXNDQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYi9jb3JlJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEnO1xuaW1wb3J0IHsgU3RvcmFnZVN0YWNrIH0gZnJvbSAnLi9zdG9yYWdlLXN0YWNrJztcblxuZXhwb3J0IGludGVyZmFjZSBPdmVybGF5UGxhdGZvcm1TdGFja1Byb3BzIGV4dGVuZHMgY2RrLlN0YWNrUHJvcHMge1xuICByZWFkb25seSBzdG9yYWdlU3RhY2s6IFN0b3JhZ2VTdGFjaztcbn1cblxuZXhwb3J0IGNsYXNzIE92ZXJsYXlQbGF0Zm9ybVN0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IE92ZXJsYXlQbGF0Zm9ybVN0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIGNvbnN0IHsgc3RvcmFnZVN0YWNrIH0gPSBwcm9wcztcblxuICAgIC8vIFJlZmVyZW5jZSBzdG9yYWdlIHJlc291cmNlcyBmcm9tIHN0b3JhZ2Ugc3RhY2tcbiAgICBjb25zdCBkb2N1bWVudEJ1Y2tldCA9IHN0b3JhZ2VTdGFjay5kb2N1bWVudEJ1Y2tldDtcbiAgICBjb25zdCBkb2N1bWVudFRhYmxlID0gc3RvcmFnZVN0YWNrLmRvY3VtZW50VGFibGU7XG4gICAgY29uc3QgdnBjID0gc3RvcmFnZVN0YWNrLnZwYztcbiAgICBjb25zdCBhdXJvcmFDbHVzdGVyID0gc3RvcmFnZVN0YWNrLmF1cm9yYUNsdXN0ZXI7XG5cbiAgICAvLyBMYW1iZGEgTGF5ZXIgZm9yIGNvbW1vbiBkZXBlbmRlbmNpZXNcbiAgICBjb25zdCBjb21tb25MYXllciA9IG5ldyBsYW1iZGEuTGF5ZXJWZXJzaW9uKHRoaXMsICdDb21tb25MYXllcicsIHtcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnbGFtYmRhL2xheWVycy9jb21tb24nKSxcbiAgICAgIGNvbXBhdGlibGVSdW50aW1lczogW2xhbWJkYS5SdW50aW1lLk5PREVKU18yMF9YXSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQ29tbW9uIGRlcGVuZGVuY2llcyBmb3IgT3ZlcmxheSBwbGF0Zm9ybSBMYW1iZGEgZnVuY3Rpb25zJyxcbiAgICB9KTtcblxuICAgIC8vIE91dHB1dHNcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnRG9jdW1lbnRCdWNrZXROYW1lJywge1xuICAgICAgdmFsdWU6IGRvY3VtZW50QnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ1MzIGJ1Y2tldCBmb3IgZG9jdW1lbnQgc3RvcmFnZScsXG4gICAgICBleHBvcnROYW1lOiAnT3ZlcmxheURvY3VtZW50QnVja2V0JyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdEb2N1bWVudFRhYmxlTmFtZScsIHtcbiAgICAgIHZhbHVlOiBkb2N1bWVudFRhYmxlLnRhYmxlTmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnRHluYW1vREIgdGFibGUgZm9yIGRvY3VtZW50IG1ldGFkYXRhJyxcbiAgICAgIGV4cG9ydE5hbWU6ICdPdmVybGF5RG9jdW1lbnRUYWJsZScsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQ29tbW9uTGF5ZXJBcm4nLCB7XG4gICAgICB2YWx1ZTogY29tbW9uTGF5ZXIubGF5ZXJWZXJzaW9uQXJuLFxuICAgICAgZGVzY3JpcHRpb246ICdDb21tb24gTGFtYmRhIGxheWVyIEFSTicsXG4gICAgICBleHBvcnROYW1lOiAnT3ZlcmxheUNvbW1vbkxheWVyJyxcbiAgICB9KTtcbiAgfVxufVxuIl19