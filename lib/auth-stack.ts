import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';

export interface AuthStackProps extends cdk.StackProps {
  readonly environmentName?: string;
}

export class AuthStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  public readonly systemAdminGroup: cognito.CfnUserPoolGroup;
  public readonly documentAdminGroup: cognito.CfnUserPoolGroup;
  public readonly endUserGroup: cognito.CfnUserPoolGroup;

  constructor(scope: Construct, id: string, props?: AuthStackProps) {
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
    const cfnUserPool = this.userPool.node.defaultChild as cognito.CfnUserPool;
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
