/**
 * Authentication API Handler
 * Handles login, register, refresh token operations
 */

const {
  CognitoIdentityProviderClient,
  AdminInitiateAuthCommand,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  ForgotPasswordCommand,
  ConfirmForgotPasswordCommand,
} = require('@aws-sdk/client-cognito-identity-provider');

const { getCorsHeaders } = require('/opt/nodejs/cors');

const cognito = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION });
const USER_POOL_ID = process.env.USER_POOL_ID;

exports.handler = async (event) => {
  console.log('Auth API called:', JSON.stringify(event));

  const { httpMethod, body } = event;
  const data = body ? JSON.parse(body) : {};

  try {
    switch (httpMethod) {
      case 'POST':
        return await handleAuth(data, event);
      default:
        return {
          statusCode: 405,
          headers: getCorsHeaders(event),
          body: JSON.stringify({ error: 'Method not allowed' }),
        };
    }
  } catch (error) {
    console.error('Auth error:', error);
    return {
      statusCode: 500,
      headers: getCorsHeaders(event),
      body: JSON.stringify({ error: error.message }),
    };
  }
};

async function handleAuth(data, event) {
  const { action, email, password, username, code, newPassword } = data;

  switch (action) {
    case 'login':
      return await login(email, password, event);
    case 'register':
      return await register(email, password, username, event);
    case 'forgotPassword':
      return await forgotPassword(email, event);
    case 'confirmForgotPassword':
      return await confirmForgotPassword(email, code, newPassword, event);
    default:
      return {
        statusCode: 400,
        headers: getCorsHeaders(event),
        body: JSON.stringify({ error: 'Invalid action' }),
      };
  }
}

async function login(email, password, event) {
  // TODO: Implement login with Cognito
  const command = new AdminInitiateAuthCommand({
    UserPoolId: USER_POOL_ID,
    ClientId: process.env.USER_POOL_CLIENT_ID,
    AuthFlow: 'ADMIN_USER_PASSWORD_AUTH',
    AuthParameters: {
      USERNAME: email,
      PASSWORD: password,
    },
  });

  const response = await cognito.send(command);

  return {
    statusCode: 200,
    headers: getCorsHeaders(event),
    body: JSON.stringify({
      accessToken: response.AuthenticationResult?.AccessToken,
      idToken: response.AuthenticationResult?.IdToken,
      refreshToken: response.AuthenticationResult?.RefreshToken,
      expiresIn: response.AuthenticationResult?.ExpiresIn,
    }),
  };
}

async function register(email, password, username, event) {
  // Admin-only user creation (self-signup disabled)
  return {
    statusCode: 403,
    headers: getCorsHeaders(event),
    body: JSON.stringify({
      error: 'User registration is admin-only. Please contact your administrator.',
    }),
  };
}

async function forgotPassword(email, event) {
  try {
    const command = new ForgotPasswordCommand({
      ClientId: process.env.USER_POOL_CLIENT_ID,
      Username: email,
    });

    await cognito.send(command);

    return {
      statusCode: 200,
      headers: getCorsHeaders(event),
      body: JSON.stringify({
        success: true,
        message: 'Password reset code sent to your email',
      }),
    };
  } catch (error) {
    console.error('Forgot password error:', error);
    return {
      statusCode: 400,
      headers: getCorsHeaders(event),
      body: JSON.stringify({
        error: error.message || 'Failed to send reset code',
      }),
    };
  }
}

async function confirmForgotPassword(email, code, newPassword, event) {
  try {
    const command = new ConfirmForgotPasswordCommand({
      ClientId: process.env.USER_POOL_CLIENT_ID,
      Username: email,
      ConfirmationCode: code,
      Password: newPassword,
    });

    await cognito.send(command);

    return {
      statusCode: 200,
      headers: getCorsHeaders(event),
      body: JSON.stringify({
        success: true,
        message: 'Password reset successfully',
      }),
    };
  } catch (error) {
    console.error('Confirm forgot password error:', error);
    return {
      statusCode: 400,
      headers: getCorsHeaders(event),
      body: JSON.stringify({
        error: error.message || 'Failed to reset password',
      }),
    };
  }
}
