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
exports.AuthStack = void 0;
const cdk = __importStar(require("aws-cdk-lib/core"));
const cognito = __importStar(require("aws-cdk-lib/aws-cognito"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
class AuthStack extends cdk.Stack {
    userPool;
    userPoolClient;
    systemAdminGroup;
    documentAdminGroup;
    endUserGroup;
    constructor(scope, id, props) {
        super(scope, id, props);
        const environmentName = props?.environmentName || 'production';
        console.log('Creating Cognito User Pool...');
        // Cognito User Pool
        this.userPool = new cognito.UserPool(this, 'OverlayUserPool', {
            userPoolName: 'overlay-users',
            selfSignUpEnabled: false, // Admin-controlled user creation
            signInAliases: {
                email: true,
                username: false,
            },
            autoVerify: {
                email: true,
            },
            standardAttributes: {
                email: {
                    required: true,
                    mutable: true,
                },
                givenName: {
                    required: true,
                    mutable: true,
                },
                familyName: {
                    required: true,
                    mutable: true,
                },
            },
            customAttributes: {
                organizationId: new cognito.StringAttribute({ mutable: true }),
                role: new cognito.StringAttribute({ mutable: true }),
            },
            passwordPolicy: {
                minLength: 12,
                requireLowercase: true,
                requireUppercase: true,
                requireDigits: true,
                requireSymbols: true,
                tempPasswordValidity: cdk.Duration.days(7),
            },
            accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
            mfa: cognito.Mfa.OPTIONAL,
            mfaSecondFactor: {
                sms: true,
                otp: true,
            },
            userVerification: {
                emailSubject: 'Verify your Overlay Platform account',
                emailBody: 'Hello {username}, your verification code is {####}',
                emailStyle: cognito.VerificationEmailStyle.CODE,
            },
            userInvitation: {
                emailSubject: 'Welcome to Overlay Platform',
                emailBody: 'Hello {username}, you have been invited to join Overlay Platform. Your temporary password is {####}',
            },
            removalPolicy: cdk.RemovalPolicy.RETAIN,
            advancedSecurityMode: cognito.AdvancedSecurityMode.ENFORCED,
            deviceTracking: {
                challengeRequiredOnNewDevice: true,
                deviceOnlyRememberedOnUserPrompt: true,
            },
        });
        // User Pool Client (for web application)
        this.userPoolClient = this.userPool.addClient('OverlayWebClient', {
            userPoolClientName: 'overlay-web-app',
            authFlows: {
                userPassword: true,
                userSrp: true,
                adminUserPassword: true, // Required for ADMIN_USER_PASSWORD_AUTH flow
                custom: false,
            },
            generateSecret: false, // For web applications
            preventUserExistenceErrors: true,
            refreshTokenValidity: cdk.Duration.days(30),
            accessTokenValidity: cdk.Duration.hours(1),
            idTokenValidity: cdk.Duration.hours(1),
            enableTokenRevocation: true,
        });
        // User Groups
        console.log('Creating Cognito User Groups...');
        // System Admin Group - Full system access
        this.systemAdminGroup = new cognito.CfnUserPoolGroup(this, 'SystemAdminGroup', {
            userPoolId: this.userPool.userPoolId,
            groupName: 'system_admin',
            description: 'System administrators with full access to all features',
            precedence: 1,
        });
        // Document Admin Group - Manage overlays and review documents
        this.documentAdminGroup = new cognito.CfnUserPoolGroup(this, 'DocumentAdminGroup', {
            userPoolId: this.userPool.userPoolId,
            groupName: 'document_admin',
            description: 'Document administrators who can create overlays and review submissions',
            precedence: 10,
        });
        // End User Group - Submit documents for review
        this.endUserGroup = new cognito.CfnUserPoolGroup(this, 'EndUserGroup', {
            userPoolId: this.userPool.userPoolId,
            groupName: 'end_user',
            description: 'End users who can submit documents for review',
            precedence: 100,
        });
        // Pre-signup Lambda trigger (to enforce admin-only user creation)
        const preSignupTrigger = new lambda.Function(this, 'PreSignupTrigger', {
            functionName: 'overlay-cognito-presignup',
            runtime: lambda.Runtime.NODEJS_20_X,
            handler: 'index.handler',
            code: lambda.Code.fromInline(`
        exports.handler = async (event) => {
          // Only allow admin-initiated signups (via AdminCreateUser)
          if (event.request.userAttributes.email) {
            // Auto-confirm admin-created users
            event.response.autoConfirmUser = true;
            event.response.autoVerifyEmail = true;
          }
          return event;
        };
      `),
            description: 'Pre-signup trigger to auto-confirm admin-created users',
        });
        // Grant Cognito permission to invoke Lambda
        preSignupTrigger.addPermission('CognitoInvokePermission', {
            principal: new iam.ServicePrincipal('cognito-idp.amazonaws.com'),
            sourceArn: this.userPool.userPoolArn,
        });
        // Attach trigger to User Pool
        const cfnUserPool = this.userPool.node.defaultChild;
        cfnUserPool.lambdaConfig = {
            preSignUp: preSignupTrigger.functionArn,
        };
        // Post-authentication trigger (for audit logging)
        const postAuthTrigger = new lambda.Function(this, 'PostAuthTrigger', {
            functionName: 'overlay-cognito-postauth',
            runtime: lambda.Runtime.NODEJS_20_X,
            handler: 'index.handler',
            code: lambda.Code.fromInline(`
        exports.handler = async (event) => {
          console.log('User authenticated:', JSON.stringify({
            username: event.userName,
            email: event.request.userAttributes.email,
            timestamp: new Date().toISOString(),
          }));
          // TODO: Write to Aurora audit_logs table
          return event;
        };
      `),
            description: 'Post-authentication trigger for audit logging',
        });
        postAuthTrigger.addPermission('CognitoPostAuthInvokePermission', {
            principal: new iam.ServicePrincipal('cognito-idp.amazonaws.com'),
            sourceArn: this.userPool.userPoolArn,
        });
        // Update Lambda config to include post-auth trigger
        cfnUserPool.lambdaConfig = {
            ...cfnUserPool.lambdaConfig,
            postAuthentication: postAuthTrigger.functionArn,
        };
        // CloudFormation Outputs
        new cdk.CfnOutput(this, 'UserPoolId', {
            value: this.userPool.userPoolId,
            description: 'Cognito User Pool ID',
            exportName: 'OverlayUserPoolId',
        });
        new cdk.CfnOutput(this, 'UserPoolArn', {
            value: this.userPool.userPoolArn,
            description: 'Cognito User Pool ARN',
            exportName: 'OverlayUserPoolArn',
        });
        new cdk.CfnOutput(this, 'UserPoolClientId', {
            value: this.userPoolClient.userPoolClientId,
            description: 'Cognito User Pool Client ID',
            exportName: 'OverlayUserPoolClientId',
        });
        new cdk.CfnOutput(this, 'UserPoolDomain', {
            value: `https://cognito-idp.${this.region}.amazonaws.com/${this.userPool.userPoolId}`,
            description: 'Cognito User Pool endpoint',
            exportName: 'OverlayUserPoolDomain',
        });
        // Tags
        cdk.Tags.of(this).add('Environment', environmentName);
        cdk.Tags.of(this).add('Project', 'Overlay');
        cdk.Tags.of(this).add('Stack', 'Auth');
    }
}
exports.AuthStack = AuthStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXV0aC1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImF1dGgtc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsc0RBQXdDO0FBRXhDLGlFQUFtRDtBQUNuRCwrREFBaUQ7QUFDakQseURBQTJDO0FBTTNDLE1BQWEsU0FBVSxTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQ3RCLFFBQVEsQ0FBbUI7SUFDM0IsY0FBYyxDQUF5QjtJQUN2QyxnQkFBZ0IsQ0FBMkI7SUFDM0Msa0JBQWtCLENBQTJCO0lBQzdDLFlBQVksQ0FBMkI7SUFFdkQsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUFzQjtRQUM5RCxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4QixNQUFNLGVBQWUsR0FBRyxLQUFLLEVBQUUsZUFBZSxJQUFJLFlBQVksQ0FBQztRQUUvRCxPQUFPLENBQUMsR0FBRyxDQUFDLCtCQUErQixDQUFDLENBQUM7UUFFN0Msb0JBQW9CO1FBQ3BCLElBQUksQ0FBQyxRQUFRLEdBQUcsSUFBSSxPQUFPLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxpQkFBaUIsRUFBRTtZQUM1RCxZQUFZLEVBQUUsZUFBZTtZQUM3QixpQkFBaUIsRUFBRSxLQUFLLEVBQUUsaUNBQWlDO1lBQzNELGFBQWEsRUFBRTtnQkFDYixLQUFLLEVBQUUsSUFBSTtnQkFDWCxRQUFRLEVBQUUsS0FBSzthQUNoQjtZQUNELFVBQVUsRUFBRTtnQkFDVixLQUFLLEVBQUUsSUFBSTthQUNaO1lBQ0Qsa0JBQWtCLEVBQUU7Z0JBQ2xCLEtBQUssRUFBRTtvQkFDTCxRQUFRLEVBQUUsSUFBSTtvQkFDZCxPQUFPLEVBQUUsSUFBSTtpQkFDZDtnQkFDRCxTQUFTLEVBQUU7b0JBQ1QsUUFBUSxFQUFFLElBQUk7b0JBQ2QsT0FBTyxFQUFFLElBQUk7aUJBQ2Q7Z0JBQ0QsVUFB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LGdCQUFnQjtZQUMzQyxXQUFXLEVBQUUsNkJBQTZCO1lBQzFDLFVBQVUsRUFBRSx5QkFBeUI7U0FDdEMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxnQkFBZ0IsRUFBRTtZQUN4QyxLQUFLLEVBQUUsdUJBQXVCLElBQUksQ0FBQyxNQUFNLGtCQUFrQixJQUFJLENBQUMsUUFBUSxDQUFDLFVBQVUsRUFBRTtZQUNyRixXQUFXLEVBQUUsNEJBQTRCO1lBQ3pDLFVBQVUsRUFBRSx1QkFBdUI7U0FDcEMsQ0FBQyxDQUFDO1FBRUgsT0FBTztRQUNQLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxhQUFhLEVBQUUsZUFBZSxDQUFDLENBQUM7UUFDdEQsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLFNBQVMsRUFBRSxTQUFTLENBQUMsQ0FBQztRQUM1QyxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsT0FBTyxFQUFFLE1BQU0sQ0FBQyxDQUFDO0lBQ3pDLENBQUM7Q0FDRjtBQWpORCw4QkFpTkMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWIvY29yZSc7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcbmltcG9ydCAqIGFzIGNvZ25pdG8gZnJvbSAnYXdzLWNkay1saWIvYXdzLWNvZ25pdG8nO1xuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEnO1xuaW1wb3J0ICogYXMgaWFtIGZyb20gJ2F3cy1jZGstbGliL2F3cy1pYW0nO1xuXG5leHBvcnQgaW50ZXJmYWNlIEF1dGhTdGFja1Byb3BzIGV4dGVuZHMgY2RrLlN0YWNrUHJvcHMge1xuICByZWFkb25seSBlbnZpcm9ubWVudE5hbWU/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjbGFzcyBBdXRoU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICBwdWJsaWMgcmVhZG9ubHkgdXNlclBvb2w6IGNvZ25pdG8uVXNlclBvb2w7XG4gIHB1YmxpYyByZWFkb25seSB1c2VyUG9vbENsaWVudDogY29nbml0by5Vc2VyUG9vbENsaWVudDtcbiAgcHVibGljIHJlYWRvbmx5IHN5c3RlbUFkbWluR3JvdXA6IGNvZ25pdG8uQ2ZuVXNlclBvb2xHcm91cDtcbiAgcHVibGljIHJlYWRvbmx5IGRvY3VtZW50QWRtaW5Hcm91cDogY29nbml0by5DZm5Vc2VyUG9vbEdyb3VwO1xuICBwdWJsaWMgcmVhZG9ubHkgZW5kVXNlckdyb3VwOiBjb2duaXRvLkNmblVzZXJQb29sR3JvdXA7XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM/OiBBdXRoU3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xuXG4gICAgY29uc3QgZW52aXJvbm1lbnROYW1lID0gcHJvcHM/LmVudmlyb25tZW50TmFtZSB8fCAncHJvZHVjdGlvbic7XG5cbiAgICBjb25zb2xlLmxvZygnQ3JlYXRpbmcgQ29nbml0byBVc2VyIFBvb2wuLi4nKTtcblxuICAgIC8vIENvZ25pdG8gVXNlciBQb29sXG4gICAgdGhpcy51c2VyUG9vbCA9IG5ldyBjb2duaXRvLlVzZXJQb29sKHRoaXMsICdPdmVybGF5VXNlclBvb2wnLCB7XG4gICAgICB1c2VyUG9vbE5hbWU6ICdvdmVybGF5LXVzZXJzJyxcbiAgICAgIHNlbGZTaWduVXBFbmFibGVkOiBmYWxzZSwgLy8gQWRtaW4tY29udHJvbGxlZCB1c2VyIGNyZWF0aW9uXG4gICAgICBzaWduSW5BbGlhc2VzOiB7XG4gICAgICAgIGVtYWlsOiB0cnVlLFxuICAgICAgICB1c2VybmFtZTogZmFsc2UsXG4gICAgICB9LFxuICAgICAgYXV0b1ZlcmlmeToge1xuICAgICAgICBlbWFpbDogdHJ1ZSxcbiAgICAgIH0sXG4gICAgICBzdGFuZGFyZEF0dHJpYnV0ZXM6IHtcbiAgICAgICAgZW1haWw6IHtcbiAgICAgICAgICByZXF1aXJlZDogdHJ1ZSxcbiAgICAgICAgICBtdXRhYmxlOiB0cnVlLFxuICAgICAgICB9LFxuICAgICAgICBnaXZlbk5hbWU6IHtcbiAgICAgICAgICByZXF1aXJlZDogdHJ1ZSxcbiAgICAgICAgICBtdXRhYmxlOiB0cnVlLFxuICAgICAgICB9LFxuICAgICAgICBmYW1pbHlOYW1lOiB7XG4gICAgICAgICAgcmVxdWlyZWQ6IHRydWUsXG4gICAgICAgICAgbXV0YWJsZTogdHJ1ZSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgICBjdXN0b21BdHRyaWJ1dGVzOiB7XG4gICAgICAgIG9yZ2FuaXphdGlvbklkOiBuZXcgY29nbml0by5TdHJpbmdBdHRyaWJ1dGUoeyBtdXRhYmxlOiB0cnVlIH0pLFxuICAgICAgICByb2xlOiBuZXcgY29nbml0by5TdHJpbmdBdHRyaWJ1dGUoeyBtdXRhYmxlOiB0cnVlIH0pLFxuICAgICAgfSxcbiAgICAgIHBhc3N3b3JkUG9saWN5OiB7XG4gICAgICAgIG1pbkxlbmd0aDogMTIsXG4gICAgICAgIHJlcXVpcmVMb3dlcmNhc2U6IHRydWUsXG4gICAgICAgIHJlcXVpcmVVcHBlcmNhc2U6IHRydWUsXG4gICAgICAgIHJlcXVpcmVEaWdpdHM6IHRydWUsXG4gICAgICAgIHJlcXVpcmVTeW1ib2xzOiB0cnVlLFxuICAgICAgICB0ZW1wUGFzc3dvcmRWYWxpZGl0eTogY2RrLkR1cmF0aW9uLmRheXMoNyksXG4gICAgICB9LFxuICAgICAgYWNjb3VudFJlY292ZXJ5OiBjb2duaXRvLkFjY291bnRSZWNvdmVyeS5FTUFJTF9PTkxZLFxuICAgICAgbWZhOiBjb2duaXRvLk1mYS5PUFRJT05BTCxcbiAgICAgIG1mYVNlY29uZEZhY3Rvcjoge1xuICAgICAgICBzbXM6IHRydWUsXG4gICAgICAgIG90cDogdHJ1ZSxcbiAgICAgIH0sXG4gICAgICB1c2VyVmVyaWZpY2F0aW9uOiB7XG4gICAgICAgIGVtYWlsU3ViamVjdDogJ1ZlcmlmeSB5b3VyIE92ZXJsYXkgUGxhdGZvcm0gYWNjb3VudCcsXG4gICAgICAgIGVtYWlsQm9keTogJ0hlbGxvIHt1c2VybmFtZX0sIHlvdXIgdmVyaWZpY2F0aW9uIGNvZGUgaXMgeyMjIyN9JyxcbiAgICAgICAgZW1haWxTdHlsZTogY29nbml0by5WZXJpZmljYXRpb25FbWFpbFN0eWxlLkNPREUsXG4gICAgICB9LFxuICAgICAgdXNlckludml0YXRpb246IHtcbiAgICAgICAgZW1haWxTdWJqZWN0OiAnV2VsY29tZSB0byBPdmVybGF5IFBsYXRmb3JtJyxcbiAgICAgICAgZW1haWxCb2R5OiAnSGVsbG8ge3VzZXJuYW1lfSwgeW91IGhhdmUgYmVlbiBpbnZpdGVkIHRvIGpvaW4gT3ZlcmxheSBQbGF0Zm9ybS4gWW91ciB0ZW1wb3JhcnkgcGFzc3dvcmQgaXMgeyMjIyN9JyxcbiAgICAgIH0sXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5SRVRBSU4sXG4gICAgICBhZHZhbmNlZFNlY3VyaXR5TW9kZTogY29nbml0by5BZHZhbmNlZFNlY3VyaXR5TW9kZS5FTkZPUkNFRCxcbiAgICAgIGRldmljZVRyYWNraW5nOiB7XG4gICAgICAgIGNoYWxsZW5nZVJlcXVpcmVkT25OZXdEZXZpY2U6IHRydWUsXG4gICAgICAgIGRldmljZU9ubHlSZW1lbWJlcmVkT25Vc2VyUHJvbXB0OiB0cnVlLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIFVzZXIgUG9vbCBDbGllbnQgKGZvciB3ZWIgYXBwbGljYXRpb24pXG4gICAgdGhpcy51c2VyUG9vbENsaWVudCA9IHRoaXMudXNlclBvb2wuYWRkQ2xpZW50KCdPdmVybGF5V2ViQ2xpZW50Jywge1xuICAgICAgdXNlclBvb2xDbGllbnROYW1lOiAnb3ZlcmxheS13ZWItYXBwJyxcbiAgICAgIGF1dGhGbG93czoge1xuICAgICAgICB1c2VyUGFzc3dvcmQ6IHRydWUsXG4gICAgICAgIHVzZXJTcnA6IHRydWUsXG4gICAgICAgIGFkbWluVXNlclBhc3N3b3JkOiB0cnVlLCAvLyBSZXF1aXJlZCBmb3IgQURNSU5fVVNFUl9QQVNTV09SRF9BVVRIIGZsb3dcbiAgICAgICAgY3VzdG9tOiBmYWxzZSxcbiAgICAgIH0sXG4gICAgICBnZW5lcmF0ZVNlY3JldDogZmFsc2UsIC8vIEZvciB3ZWIgYXBwbGljYXRpb25zXG4gICAgICBwcmV2ZW50VXNlckV4aXN0ZW5jZUVycm9yczogdHJ1ZSxcbiAgICAgIHJlZnJlc2hUb2tlblZhbGlkaXR5OiBjZGsuRHVyYXRpb24uZGF5cygzMCksXG4gICAgICBhY2Nlc3NUb2tlblZhbGlkaXR5OiBjZGsuRHVyYXRpb24uaG91cnMoMSksXG4gICAgICBpZFRva2VuVmFsaWRpdHk6IGNkay5EdXJhdGlvbi5ob3VycygxKSxcbiAgICAgIGVuYWJsZVRva2VuUmV2b2NhdGlvbjogdHJ1ZSxcbiAgICB9KTtcblxuICAgIC8vIFVzZXIgR3JvdXBzXG4gICAgY29uc29sZS5sb2coJ0NyZWF0aW5nIENvZ25pdG8gVXNlciBHcm91cHMuLi4nKTtcblxuICAgIC8vIFN5c3RlbSBBZG1pbiBHcm91cCAtIEZ1bGwgc3lzdGVtIGFjY2Vzc1xuICAgIHRoaXMuc3lzdGVtQWRtaW5Hcm91cCA9IG5ldyBjb2duaXRvLkNmblVzZXJQb29sR3JvdXAodGhpcywgJ1N5c3RlbUFkbWluR3JvdXAnLCB7XG4gICAgICB1c2VyUG9vbElkOiB0aGlzLnVzZXJQb29sLnVzZXJQb29sSWQsXG4gICAgICBncm91cE5hbWU6ICdzeXN0ZW1fYWRtaW4nLFxuICAgICAgZGVzY3JpcHRpb246ICdTeXN0ZW0gYWRtaW5pc3RyYXRvcnMgd2l0aCBmdWxsIGFjY2VzcyB0byBhbGwgZmVhdHVyZXMnLFxuICAgICAgcHJlY2VkZW5jZTogMSxcbiAgICB9KTtcblxuICAgIC8vIERvY3VtZW50IEFkbWluIEdyb3VwIC0gTWFuYWdlIG92ZXJsYXlzIGFuZCByZXZpZXcgZG9jdW1lbnRzXG4gICAgdGhpcy5kb2N1bWVudEFkbWluR3JvdXAgPSBuZXcgY29nbml0by5DZm5Vc2VyUG9vbEdyb3VwKHRoaXMsICdEb2N1bWVudEFkbWluR3JvdXAnLCB7XG4gICAgICB1c2VyUG9vbElkOiB0aGlzLnVzZXJQb29sLnVzZXJQb29sSWQsXG4gICAgICBncm91cE5hbWU6ICdkb2N1bWVudF9hZG1pbicsXG4gICAgICBkZXNjcmlwdGlvbjogJ0RvY3VtZW50IGFkbWluaXN0cmF0b3JzIHdobyBjYW4gY3JlYXRlIG92ZXJsYXlzIGFuZCByZXZpZXcgc3VibWlzc2lvbnMnLFxuICAgICAgcHJlY2VkZW5jZTogMTAsXG4gICAgfSk7XG5cbiAgICAvLyBFbmQgVXNlciBHcm91cCAtIFN1Ym1pdCBkb2N1bWVudHMgZm9yIHJldmlld1xuICAgIHRoaXMuZW5kVXNlckdyb3VwID0gbmV3IGNvZ25pdG8uQ2ZuVXNlclBvb2xHcm91cCh0aGlzLCAnRW5kVXNlckdyb3VwJywge1xuICAgICAgdXNlclBvb2xJZDogdGhpcy51c2VyUG9vbC51c2VyUG9vbElkLFxuICAgICAgZ3JvdXBOYW1lOiAnZW5kX3VzZXInLFxuICAgICAgZGVzY3JpcHRpb246ICdFbmQgdXNlcnMgd2hvIGNhbiBzdWJtaXQgZG9jdW1lbnRzIGZvciByZXZpZXcnLFxuICAgICAgcHJlY2VkZW5jZTogMTAwLFxuICAgIH0pO1xuXG4gICAgLy8gUHJlLXNpZ251cCBMYW1iZGEgdHJpZ2dlciAodG8gZW5mb3JjZSBhZG1pbi1vbmx5IHVzZXIgY3JlYXRpb24pXG4gICAgY29uc3QgcHJlU2lnbnVwVHJpZ2dlciA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ1ByZVNpZ251cFRyaWdnZXInLCB7XG4gICAgICBmdW5jdGlvbk5hbWU6ICdvdmVybGF5LWNvZ25pdG8tcHJlc2lnbnVwJyxcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18yMF9YLFxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUlubGluZShgXG4gICAgICAgIGV4cG9ydHMuaGFuZGxlciA9IGFzeW5jIChldmVudCkgPT4ge1xuICAgICAgICAgIC8vIE9ubHkgYWxsb3cgYWRtaW4taW5pdGlhdGVkIHNpZ251cHMgKHZpYSBBZG1pbkNyZWF0ZVVzZXIpXG4gICAgICAgICAgaWYgKGV2ZW50LnJlcXVlc3QudXNlckF0dHJpYnV0ZXMuZW1haWwpIHtcbiAgICAgICAgICAgIC8vIEF1dG8tY29uZmlybSBhZG1pbi1jcmVhdGVkIHVzZXJzXG4gICAgICAgICAgICBldmVudC5yZXNwb25zZS5hdXRvQ29uZmlybVVzZXIgPSB0cnVlO1xuICAgICAgICAgICAgZXZlbnQucmVzcG9uc2UuYXV0b1ZlcmlmeUVtYWlsID0gdHJ1ZTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIGV2ZW50O1xuICAgICAgICB9O1xuICAgICAgYCksXG4gICAgICBkZXNjcmlwdGlvbjogJ1ByZS1zaWdudXAgdHJpZ2dlciB0byBhdXRvLWNvbmZpcm0gYWRtaW4tY3JlYXRlZCB1c2VycycsXG4gICAgfSk7XG5cbiAgICAvLyBHcmFudCBDb2duaXRvIHBlcm1pc3Npb24gdG8gaW52b2tlIExhbWJkYVxuICAgIHByZVNpZ251cFRyaWdnZXIuYWRkUGVybWlzc2lvbignQ29nbml0b0ludm9rZVBlcm1pc3Npb24nLCB7XG4gICAgICBwcmluY2lwYWw6IG5ldyBpYW0uU2VydmljZVByaW5jaXBhbCgnY29nbml0by1pZHAuYW1hem9uYXdzLmNvbScpLFxuICAgICAgc291cmNlQXJuOiB0aGlzLnVzZXJQb29sLnVzZXJQb29sQXJuLFxuICAgIH0pO1xuXG4gICAgLy8gQXR0YWNoIHRyaWdnZXIgdG8gVXNlciBQb29sXG4gICAgY29uc3QgY2ZuVXNlclBvb2wgPSB0aGlzLnVzZXJQb29sLm5vZGUuZGVmYXVsdENoaWxkIGFzIGNvZ25pdG8uQ2ZuVXNlclBvb2w7XG4gICAgY2ZuVXNlclBvb2wubGFtYmRhQ29uZmlnID0ge1xuICAgICAgcHJlU2lnblVwOiBwcmVTaWdudXBUcmlnZ2VyLmZ1bmN0aW9uQXJuLFxuICAgIH07XG5cbiAgICAvLyBQb3N0LWF1dGhlbnRpY2F0aW9uIHRyaWdnZXIgKGZvciBhdWRpdCBsb2dnaW5nKVxuICAgIGNvbnN0IHBvc3RBdXRoVHJpZ2dlciA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ1Bvc3RBdXRoVHJpZ2dlcicsIHtcbiAgICAgIGZ1bmN0aW9uTmFtZTogJ292ZXJsYXktY29nbml0by1wb3N0YXV0aCcsXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMjBfWCxcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21JbmxpbmUoYFxuICAgICAgICBleHBvcnRzLmhhbmRsZXIgPSBhc3luYyAoZXZlbnQpID0+IHtcbiAgICAgICAgICBjb25zb2xlLmxvZygnVXNlciBhdXRoZW50aWNhdGVkOicsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgIHVzZXJuYW1lOiBldmVudC51c2VyTmFtZSxcbiAgICAgICAgICAgIGVtYWlsOiBldmVudC5yZXF1ZXN0LnVzZXJBdHRyaWJ1dGVzLmVtYWlsLFxuICAgICAgICAgICAgdGltZXN0YW1wOiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgICAgICAgfSkpO1xuICAgICAgICAgIC8vIFRPRE86IFdyaXRlIHRvIEF1cm9yYSBhdWRpdF9sb2dzIHRhYmxlXG4gICAgICAgICAgcmV0dXJuIGV2ZW50O1xuICAgICAgICB9O1xuICAgICAgYCksXG4gICAgICBkZXNjcmlwdGlvbjogJ1Bvc3QtYXV0aGVudGljYXRpb24gdHJpZ2dlciBmb3IgYXVkaXQgbG9nZ2luZycsXG4gICAgfSk7XG5cbiAgICBwb3N0QXV0aFRyaWdnZXIuYWRkUGVybWlzc2lvbignQ29nbml0b1Bvc3RBdXRoSW52b2tlUGVybWlzc2lvbicsIHtcbiAgICAgIHByaW5jaXBhbDogbmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKCdjb2duaXRvLWlkcC5hbWF6b25hd3MuY29tJyksXG4gICAgICBzb3VyY2VBcm46IHRoaXMudXNlclBvb2wudXNlclBvb2xBcm4sXG4gICAgfSk7XG5cbiAgICAvLyBVcGRhdGUgTGFtYmRhIGNvbmZpZyB0byBpbmNsdWRlIHBvc3QtYXV0aCB0cmlnZ2VyXG4gICAgY2ZuVXNlclBvb2wubGFtYmRhQ29uZmlnID0ge1xuICAgICAgLi4uY2ZuVXNlclBvb2wubGFtYmRhQ29uZmlnLFxuICAgICAgcG9zdEF1dGhlbnRpY2F0aW9uOiBwb3N0QXV0aFRyaWdnZXIuZnVuY3Rpb25Bcm4sXG4gICAgfTtcblxuICAgIC8vIENsb3VkRm9ybWF0aW9uIE91dHB1dHNcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnVXNlclBvb2xJZCcsIHtcbiAgICAgIHZhbHVlOiB0aGlzLnVzZXJQb29sLnVzZXJQb29sSWQsXG4gICAgICBkZXNjcmlwdGlvbjogJ0NvZ25pdG8gVXNlciBQb29sIElEJyxcbiAgICAgIGV4cG9ydE5hbWU6ICdPdmVybGF5VXNlclBvb2xJZCcsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnVXNlclBvb2xBcm4nLCB7XG4gICAgICB2YWx1ZTogdGhpcy51c2VyUG9vbC51c2VyUG9vbEFybixcbiAgICAgIGRlc2NyaXB0aW9uOiAnQ29nbml0byBVc2VyIFBvb2wgQVJOJyxcbiAgICAgIGV4cG9ydE5hbWU6ICdPdmVybGF5VXNlclBvb2xBcm4nLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1VzZXJQb29sQ2xpZW50SWQnLCB7XG4gICAgICB2YWx1ZTogdGhpcy51c2VyUG9vbENsaWVudC51c2VyUG9vbENsaWVudElkLFxuICAgICAgZGVzY3JpcHRpb246ICdDb2duaXRvIFVzZXIgUG9vbCBDbGllbnQgSUQnLFxuICAgICAgZXhwb3J0TmFtZTogJ092ZXJsYXlVc2VyUG9vbENsaWVudElkJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdVc2VyUG9vbERvbWFpbicsIHtcbiAgICAgIHZhbHVlOiBgaHR0cHM6Ly9jb2duaXRvLWlkcC4ke3RoaXMucmVnaW9ufS5hbWF6b25hd3MuY29tLyR7dGhpcy51c2VyUG9vbC51c2VyUG9vbElkfWAsXG4gICAgICBkZXNjcmlwdGlvbjogJ0NvZ25pdG8gVXNlciBQb29sIGVuZHBvaW50JyxcbiAgICAgIGV4cG9ydE5hbWU6ICdPdmVybGF5VXNlclBvb2xEb21haW4nLFxuICAgIH0pO1xuXG4gICAgLy8gVGFnc1xuICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZCgnRW52aXJvbm1lbnQnLCBlbnZpcm9ubWVudE5hbWUpO1xuICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZCgnUHJvamVjdCcsICdPdmVybGF5Jyk7XG4gICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKCdTdGFjaycsICdBdXRoJyk7XG4gIH1cbn1cbiJdfQ==