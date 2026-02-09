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

const cognito = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION });
const USER_POOL_ID = process.env.USER_POOL_ID;

exports.handler = async (event) => {
  console.log('Auth API called:', JSON.stringify(event));

  const { httpMethod, body, headers } = event;
  const data = body ? JSON.parse(body) : {};

  // Get origin from request headers
  const origin = headers?.origin || headers?.Origin || '*';

  try {
    switch (httpMethod) {
      case 'POST':
        const result = await handleAuth(data);
        // Add CORS headers to response
        return {
          ...result,
          headers: {
            'Access-Control-Allow-Origin': origin,
            'Access-Control-Allow-Credentials': 'true',
            'Content-Type': 'application/json',
            ...result.headers,
          },
        };
      default:
        return {
          statusCode: 405,
          headers: {
            'Access-Control-Allow-Origin': origin,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ error: 'Method not allowed' }),
        };
    }
  } catch (error) {
    console.error('Auth error:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': origin,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ error: error.message }),
    };
  }
};

async function handleAuth(data) {
  const { action, email, password, username } = data;

  switch (action) {
    case 'login':
      return await login(email, password);
    case 'register':
      return await register(email, password, username);
    default:
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid action' }),
      };
  }
}

async function login(email, password) {
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
    body: JSON.stringify({
      accessToken: response.AuthenticationResult?.AccessToken,
      idToken: response.AuthenticationResult?.IdToken,
      refreshToken: response.AuthenticationResult?.RefreshToken,
      expiresIn: response.AuthenticationResult?.ExpiresIn,
    }),
  };
}

async function register(email, password, username) {
  // Admin-only user creation (self-signup disabled)
  return {
    statusCode: 403,
    body: JSON.stringify({
      error: 'User registration is admin-only. Please contact your administrator.',
    }),
  };
}
