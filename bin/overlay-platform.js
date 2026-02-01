#!/usr/bin/env node
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
require("dotenv/config");
const cdk = __importStar(require("aws-cdk-lib/core"));
const storage_stack_1 = require("../lib/storage-stack");
const auth_stack_1 = require("../lib/auth-stack");
const compute_stack_1 = require("../lib/compute-stack");
const orchestration_stack_1 = require("../lib/orchestration-stack");
const app = new cdk.App();
const env = {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: 'eu-west-1',
};
const environmentName = 'production';
// ============================================================================
// PHASE 1: STORAGE STACK
// ============================================================================
// VPC, Aurora PostgreSQL, DynamoDB, S3, Secrets Manager
const storageStack = new storage_stack_1.StorageStack(app, 'OverlayStorageStack', {
    env,
    environmentName,
    description: 'Overlay Platform - Storage infrastructure (VPC, Aurora, DynamoDB, S3)',
    tags: {
        Project: 'Overlay',
        Environment: environmentName,
        Stack: 'Storage',
    },
});
// ============================================================================
// PHASE 2: AUTH STACK
// ============================================================================
// Cognito User Pool, User Groups, Lambda Triggers
const authStack = new auth_stack_1.AuthStack(app, 'OverlayAuthStack', {
    env,
    environmentName,
    description: 'Overlay Platform - Authentication infrastructure (Cognito)',
    tags: {
        Project: 'Overlay',
        Environment: environmentName,
        Stack: 'Auth',
    },
});
// ============================================================================
// PHASE 3: COMPUTE STACK
// ============================================================================
// Lambda Functions (AI Agents + API), API Gateway, IAM Permissions
const computeStack = new compute_stack_1.ComputeStack(app, 'OverlayComputeStack', {
    env,
    environmentName,
    vpc: storageStack.vpc,
    auroraCluster: storageStack.auroraCluster,
    auroraSecret: storageStack.auroraCluster.secret,
    documentBucket: storageStack.documentBucket,
    documentTable: storageStack.documentTable,
    llmConfigTable: storageStack.llmConfigTable,
    claudeApiKeySecret: storageStack.claudeApiKeySecret,
    userPool: authStack.userPool,
    userPoolClient: authStack.userPoolClient,
    description: 'Overlay Platform - Compute infrastructure (Lambda, API Gateway)',
    tags: {
        Project: 'Overlay',
        Environment: environmentName,
        Stack: 'Compute',
    },
});
computeStack.addDependency(storageStack);
computeStack.addDependency(authStack);
// ============================================================================
// PHASE 4: ORCHESTRATION STACK
// ============================================================================
// Step Functions, EventBridge, SQS Queues
const orchestrationStack = new orchestration_stack_1.OrchestrationStack(app, 'OverlayOrchestrationStack', {
    env,
    environmentName,
    documentBucket: storageStack.documentBucket,
    structureValidatorFunction: computeStack.structureValidatorFunction,
    contentAnalyzerFunction: computeStack.contentAnalyzerFunction,
    grammarCheckerFunction: computeStack.grammarCheckerFunction,
    orchestratorFunction: computeStack.orchestratorFunction,
    clarificationFunction: computeStack.clarificationFunction,
    scoringFunction: computeStack.scoringFunction,
    description: 'Overlay Platform - Orchestration infrastructure (Step Functions, EventBridge)',
    tags: {
        Project: 'Overlay',
        Environment: environmentName,
        Stack: 'Orchestration',
    },
});
orchestrationStack.addDependency(computeStack);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3ZlcmxheS1wbGF0Zm9ybS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIm92ZXJsYXktcGxhdGZvcm0udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQ0EseUJBQXVCO0FBQ3ZCLHNEQUF3QztBQUN4Qyx3REFBb0Q7QUFDcEQsa0RBQThDO0FBQzlDLHdEQUFvRDtBQUNwRCxvRUFBZ0U7QUFFaEUsTUFBTSxHQUFHLEdBQUcsSUFBSSxHQUFHLENBQUMsR0FBRyxFQUFFLENBQUM7QUFFMUIsTUFBTSxHQUFHLEdBQUc7SUFDVixPQUFPLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxtQkFBbUI7SUFDeEMsTUFBTSxFQUFFLFdBQVc7Q0FDcEIsQ0FBQztBQUVGLE1BQU0sZUFBZSxHQUFHLFlBQVksQ0FBQztBQUVyQywrRUFBK0U7QUFDL0UseUJBQXlCO0FBQ3pCLCtFQUErRTtBQUMvRSx3REFBd0Q7QUFDeEQsTUFBTSxZQUFZLEdBQUcsSUFBSSw0QkFBWSxDQUFDLEdBQUcsRUFBRSxxQkFBcUIsRUFBRTtJQUNoRSxHQUFHO0lBQ0gsZUFBZTtJQUNmLFdBQVcsRUFBRSx1RUFBdUU7SUFDcEYsSUFBSSxFQUFFO1FBQ0osT0FBTyxFQUFFLFNBQVM7UUFDbEIsV0FBVyxFQUFFLGVBQWU7UUFDNUIsS0FBSyxFQUFFLFNBQVM7S0FDakI7Q0FDRixDQUFDLENBQUM7QUFFSCwrRUFBK0U7QUFDL0Usc0JBQXNCO0FBQ3RCLCtFQUErRTtBQUMvRSxrREFBa0Q7QUFDbEQsTUFBTSxTQUFTLEdBQUcsSUFBSSxzQkFBUyxDQUFDLEdBQUcsRUFBRSxrQkFBa0IsRUFBRTtJQUN2RCxHQUFHO0lBQ0gsZUFBZTtJQUNmLFdBQVcsRUFBRSw0REFBNEQ7SUFDekUsSUFBSSxFQUFFO1FBQ0osT0FBTyxFQUFFLFNBQVM7UUFDbEIsV0FBVyxFQUFFLGVBQWU7UUFDNUIsS0FBSyxFQUFFLE1BQU07S0FDZDtDQUNGLENBQUMsQ0FBQztBQUVILCtFQUErRTtBQUMvRSx5QkFBeUI7QUFDekIsK0VBQStFO0FBQy9FLG1FQUFtRTtBQUNuRSxNQUFNLFlBQVksR0FBRyxJQUFJLDRCQUFZLENBQUMsR0FBRyxFQUFFLHFCQUFxQixFQUFFO0lBQ2hFLEdBQUc7SUFDSCxlQUFlO0lBQ2YsR0FBRyxFQUFFLFlBQVksQ0FBQyxHQUFHO0lBQ3JCLGFBQWEsRUFBRSxZQUFZLENBQUMsYUFBYTtJQUN6QyxZQUFZLEVBQUUsWUFBWSxDQUFDLGFBQWEsQ0FBQyxNQUFPO0lBQ2hELGNBQWMsRUFBRSxZQUFZLENBQUMsY0FBYztJQUMzQyxhQUFhLEVBQUUsWUFBWSxDQUFDLGFBQWE7SUFDekMsY0FBYyxFQUFFLFlBQVksQ0FBQyxjQUFjO0lBQzNDLGtCQUFrQixFQUFFLFlBQVksQ0FBQyxrQkFBa0I7SUFDbkQsUUFBUSxFQUFFLFNBQVMsQ0FBQyxRQUFRO0lBQzVCLGNBQWMsRUFBRSxTQUFTLENBQUMsY0FBYztJQUN4QyxXQUFXLEVBQUUsaUVBQWlFO0lBQzlFLElBQUksRUFBRTtRQUNKLE9BQU8sRUFBRSxTQUFTO1FBQ2xCLFdBQVcsRUFBRSxlQUFlO1FBQzVCLEtBQUssRUFBRSxTQUFTO0tBQ2pCO0NBQ0YsQ0FBQyxDQUFDO0FBQ0gsWUFBWSxDQUFDLGFBQWEsQ0FBQyxZQUFZLENBQUMsQ0FBQztBQUN6QyxZQUFZLENBQUMsYUFBYSxDQUFDLFNBQVMsQ0FBQyxDQUFDO0FBRXRDLCtFQUErRTtBQUMvRSwrQkFBK0I7QUFDL0IsK0VBQStFO0FBQy9FLDBDQUEwQztBQUMxQyxNQUFNLGtCQUFrQixHQUFHLElBQUksd0NBQWtCLENBQUMsR0FBRyxFQUFFLDJCQUEyQixFQUFFO0lBQ2xGLEdBQUc7SUFDSCxlQUFlO0lBQ2YsY0FBYyxFQUFFLFlBQVksQ0FBQyxjQUFjO0lBQzNDLDBCQUEwQixFQUFFLFlBQVksQ0FBQywwQkFBMEI7SUFDbkUsdUJBQXVCLEVBQUUsWUFBWSxDQUFDLHVCQUF1QjtJQUM3RCxzQkFBc0IsRUFBRSxZQUFZLENBQUMsc0JBQXNCO0lBQzNELG9CQUFvQixFQUFFLFlBQVksQ0FBQyxvQkFBb0I7SUFDdkQscUJBQXFCLEVBQUUsWUFBWSxDQUFDLHFCQUFxQjtJQUN6RCxlQUFlLEVBQUUsWUFBWSxDQUFDLGVBQWU7SUFDN0MsV0FBVyxFQUFFLCtFQUErRTtJQUM1RixJQUFJLEVBQUU7UUFDSixPQUFPLEVBQUUsU0FBUztRQUNsQixXQUFXLEVBQUUsZUFBZTtRQUM1QixLQUFLLEVBQUUsZUFBZTtLQUN2QjtDQUNGLENBQUMsQ0FBQztBQUNILGtCQUFrQixDQUFDLGFBQWEsQ0FBQyxZQUFZLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIiMhL3Vzci9iaW4vZW52IG5vZGVcclxuaW1wb3J0ICdkb3RlbnYvY29uZmlnJztcclxuaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliL2NvcmUnO1xyXG5pbXBvcnQgeyBTdG9yYWdlU3RhY2sgfSBmcm9tICcuLi9saWIvc3RvcmFnZS1zdGFjayc7XHJcbmltcG9ydCB7IEF1dGhTdGFjayB9IGZyb20gJy4uL2xpYi9hdXRoLXN0YWNrJztcclxuaW1wb3J0IHsgQ29tcHV0ZVN0YWNrIH0gZnJvbSAnLi4vbGliL2NvbXB1dGUtc3RhY2snO1xyXG5pbXBvcnQgeyBPcmNoZXN0cmF0aW9uU3RhY2sgfSBmcm9tICcuLi9saWIvb3JjaGVzdHJhdGlvbi1zdGFjayc7XHJcblxyXG5jb25zdCBhcHAgPSBuZXcgY2RrLkFwcCgpO1xyXG5cclxuY29uc3QgZW52ID0ge1xyXG4gIGFjY291bnQ6IHByb2Nlc3MuZW52LkNES19ERUZBVUxUX0FDQ09VTlQsXHJcbiAgcmVnaW9uOiAnZXUtd2VzdC0xJyxcclxufTtcclxuXHJcbmNvbnN0IGVudmlyb25tZW50TmFtZSA9ICdwcm9kdWN0aW9uJztcclxuXHJcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuLy8gUEhBU0UgMTogU1RPUkFHRSBTVEFDS1xyXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbi8vIFZQQywgQXVyb3JhIFBvc3RncmVTUUwsIER5bmFtb0RCLCBTMywgU2VjcmV0cyBNYW5hZ2VyXHJcbmNvbnN0IHN0b3JhZ2VTdGFjayA9IG5ldyBTdG9yYWdlU3RhY2soYXBwLCAnT3ZlcmxheVN0b3JhZ2VTdGFjaycsIHtcclxuICBlbnYsXHJcbiAgZW52aXJvbm1lbnROYW1lLFxyXG4gIGRlc2NyaXB0aW9uOiAnT3ZlcmxheSBQbGF0Zm9ybSAtIFN0b3JhZ2UgaW5mcmFzdHJ1Y3R1cmUgKFZQQywgQXVyb3JhLCBEeW5hbW9EQiwgUzMpJyxcclxuICB0YWdzOiB7XHJcbiAgICBQcm9qZWN0OiAnT3ZlcmxheScsXHJcbiAgICBFbnZpcm9ubWVudDogZW52aXJvbm1lbnROYW1lLFxyXG4gICAgU3RhY2s6ICdTdG9yYWdlJyxcclxuICB9LFxyXG59KTtcclxuXHJcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuLy8gUEhBU0UgMjogQVVUSCBTVEFDS1xyXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbi8vIENvZ25pdG8gVXNlciBQb29sLCBVc2VyIEdyb3VwcywgTGFtYmRhIFRyaWdnZXJzXHJcbmNvbnN0IGF1dGhTdGFjayA9IG5ldyBBdXRoU3RhY2soYXBwLCAnT3ZlcmxheUF1dGhTdGFjaycsIHtcclxuICBlbnYsXHJcbiAgZW52aXJvbm1lbnROYW1lLFxyXG4gIGRlc2NyaXB0aW9uOiAnT3ZlcmxheSBQbGF0Zm9ybSAtIEF1dGhlbnRpY2F0aW9uIGluZnJhc3RydWN0dXJlIChDb2duaXRvKScsXHJcbiAgdGFnczoge1xyXG4gICAgUHJvamVjdDogJ092ZXJsYXknLFxyXG4gICAgRW52aXJvbm1lbnQ6IGVudmlyb25tZW50TmFtZSxcclxuICAgIFN0YWNrOiAnQXV0aCcsXHJcbiAgfSxcclxufSk7XHJcblxyXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbi8vIFBIQVNFIDM6IENPTVBVVEUgU1RBQ0tcclxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4vLyBMYW1iZGEgRnVuY3Rpb25zIChBSSBBZ2VudHMgKyBBUEkpLCBBUEkgR2F0ZXdheSwgSUFNIFBlcm1pc3Npb25zXHJcbmNvbnN0IGNvbXB1dGVTdGFjayA9IG5ldyBDb21wdXRlU3RhY2soYXBwLCAnT3ZlcmxheUNvbXB1dGVTdGFjaycsIHtcclxuICBlbnYsXHJcbiAgZW52aXJvbm1lbnROYW1lLFxyXG4gIHZwYzogc3RvcmFnZVN0YWNrLnZwYyxcclxuICBhdXJvcmFDbHVzdGVyOiBzdG9yYWdlU3RhY2suYXVyb3JhQ2x1c3RlcixcclxuICBhdXJvcmFTZWNyZXQ6IHN0b3JhZ2VTdGFjay5hdXJvcmFDbHVzdGVyLnNlY3JldCEsXHJcbiAgZG9jdW1lbnRCdWNrZXQ6IHN0b3JhZ2VTdGFjay5kb2N1bWVudEJ1Y2tldCxcclxuICBkb2N1bWVudFRhYmxlOiBzdG9yYWdlU3RhY2suZG9jdW1lbnRUYWJsZSxcclxuICBsbG1Db25maWdUYWJsZTogc3RvcmFnZVN0YWNrLmxsbUNvbmZpZ1RhYmxlLFxyXG4gIGNsYXVkZUFwaUtleVNlY3JldDogc3RvcmFnZVN0YWNrLmNsYXVkZUFwaUtleVNlY3JldCxcclxuICB1c2VyUG9vbDogYXV0aFN0YWNrLnVzZXJQb29sLFxyXG4gIHVzZXJQb29sQ2xpZW50OiBhdXRoU3RhY2sudXNlclBvb2xDbGllbnQsXHJcbiAgZGVzY3JpcHRpb246ICdPdmVybGF5IFBsYXRmb3JtIC0gQ29tcHV0ZSBpbmZyYXN0cnVjdHVyZSAoTGFtYmRhLCBBUEkgR2F0ZXdheSknLFxyXG4gIHRhZ3M6IHtcclxuICAgIFByb2plY3Q6ICdPdmVybGF5JyxcclxuICAgIEVudmlyb25tZW50OiBlbnZpcm9ubWVudE5hbWUsXHJcbiAgICBTdGFjazogJ0NvbXB1dGUnLFxyXG4gIH0sXHJcbn0pO1xyXG5jb21wdXRlU3RhY2suYWRkRGVwZW5kZW5jeShzdG9yYWdlU3RhY2spO1xyXG5jb21wdXRlU3RhY2suYWRkRGVwZW5kZW5jeShhdXRoU3RhY2spO1xyXG5cclxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4vLyBQSEFTRSA0OiBPUkNIRVNUUkFUSU9OIFNUQUNLXHJcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuLy8gU3RlcCBGdW5jdGlvbnMsIEV2ZW50QnJpZGdlLCBTUVMgUXVldWVzXHJcbmNvbnN0IG9yY2hlc3RyYXRpb25TdGFjayA9IG5ldyBPcmNoZXN0cmF0aW9uU3RhY2soYXBwLCAnT3ZlcmxheU9yY2hlc3RyYXRpb25TdGFjaycsIHtcclxuICBlbnYsXHJcbiAgZW52aXJvbm1lbnROYW1lLFxyXG4gIGRvY3VtZW50QnVja2V0OiBzdG9yYWdlU3RhY2suZG9jdW1lbnRCdWNrZXQsXHJcbiAgc3RydWN0dXJlVmFsaWRhdG9yRnVuY3Rpb246IGNvbXB1dGVTdGFjay5zdHJ1Y3R1cmVWYWxpZGF0b3JGdW5jdGlvbixcclxuICBjb250ZW50QW5hbHl6ZXJGdW5jdGlvbjogY29tcHV0ZVN0YWNrLmNvbnRlbnRBbmFseXplckZ1bmN0aW9uLFxyXG4gIGdyYW1tYXJDaGVja2VyRnVuY3Rpb246IGNvbXB1dGVTdGFjay5ncmFtbWFyQ2hlY2tlckZ1bmN0aW9uLFxyXG4gIG9yY2hlc3RyYXRvckZ1bmN0aW9uOiBjb21wdXRlU3RhY2sub3JjaGVzdHJhdG9yRnVuY3Rpb24sXHJcbiAgY2xhcmlmaWNhdGlvbkZ1bmN0aW9uOiBjb21wdXRlU3RhY2suY2xhcmlmaWNhdGlvbkZ1bmN0aW9uLFxyXG4gIHNjb3JpbmdGdW5jdGlvbjogY29tcHV0ZVN0YWNrLnNjb3JpbmdGdW5jdGlvbixcclxuICBkZXNjcmlwdGlvbjogJ092ZXJsYXkgUGxhdGZvcm0gLSBPcmNoZXN0cmF0aW9uIGluZnJhc3RydWN0dXJlIChTdGVwIEZ1bmN0aW9ucywgRXZlbnRCcmlkZ2UpJyxcclxuICB0YWdzOiB7XHJcbiAgICBQcm9qZWN0OiAnT3ZlcmxheScsXHJcbiAgICBFbnZpcm9ubWVudDogZW52aXJvbm1lbnROYW1lLFxyXG4gICAgU3RhY2s6ICdPcmNoZXN0cmF0aW9uJyxcclxuICB9LFxyXG59KTtcclxub3JjaGVzdHJhdGlvblN0YWNrLmFkZERlcGVuZGVuY3koY29tcHV0ZVN0YWNrKTtcclxuIl19