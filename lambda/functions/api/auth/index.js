/**
 * Authentication API Handler
 * Handles login, register, refresh token operations
 */

const {
  CognitoIdentityProviderClient,
  AdminInitiateAuthCommand,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
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
  const { action, email, password, username } = data;

  switch (action) {
    case 'login':
      return await login(email, password, event);
    case 'register':
      return await register(email, password, username, event);
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
