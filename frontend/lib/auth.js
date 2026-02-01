"use strict";
/**
 * Cognito Authentication Utility
 * Handles login with AWS Cognito User Pool
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.login = login;
exports.logout = logout;
exports.getCurrentUser = getCurrentUser;
exports.saveUserInfo = saveUserInfo;
const COGNITO_REGION = 'eu-west-1';
const USER_POOL_ID = 'eu-west-1_lC25xZ8s6';
const CLIENT_ID = '4e45pdiobcm8qo3ehvi1bcmo2s';
async function login(email, password) {
    try {
        // Use proxy server for Cognito to avoid CORS issues
        const url = 'http://localhost:3001/cognito';
        const payload = {
            AuthFlow: 'USER_PASSWORD_AUTH',
            ClientId: CLIENT_ID,
            AuthParameters: {
                USERNAME: email,
                PASSWORD: password,
            },
        };
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-amz-json-1.1',
                'X-Amz-Target': 'AWSCognitoIdentityProviderService.InitiateAuth',
            },
            body: JSON.stringify(payload),
        });
        if (!response.ok) {
            const error = await response.json();
            return {
                success: false,
                error: error.message || error.__type || 'Authentication failed',
            };
        }
        const data = await response.json();
        if (!data.AuthenticationResult?.IdToken) {
            return {
                success: false,
                error: 'No token received from authentication',
            };
        }
        const idToken = data.AuthenticationResult.IdToken;
        // Decode JWT to get user info (simple base64 decode, no verification needed for display)
        const payload_parts = idToken.split('.')[1];
        const decoded = JSON.parse(atob(payload_parts));
        return {
            success: true,
            token: idToken,
            userInfo: {
                email: decoded.email || email,
                sub: decoded.sub,
                groups: decoded['cognito:groups'] || [],
            },
        };
    }
    catch (error) {
        console.error('Login error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Network error during login',
        };
    }
}
function logout() {
    if (typeof window !== 'undefined') {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_info');
        // Clear auth token cookie
        document.cookie = 'auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    }
}
function getCurrentUser() {
    if (typeof window === 'undefined')
        return null;
    const token = localStorage.getItem('auth_token');
    const userInfo = localStorage.getItem('user_info');
    if (!token || !userInfo)
        return null;
    try {
        return JSON.parse(userInfo);
    }
    catch {
        return null;
    }
}
function saveUserInfo(userInfo) {
    if (typeof window !== 'undefined') {
        localStorage.setItem('user_info', JSON.stringify(userInfo));
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXV0aC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImF1dGgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7R0FHRzs7QUFpQkgsc0JBOERDO0FBRUQsd0JBT0M7QUFFRCx3Q0FhQztBQUVELG9DQUlDO0FBM0dELE1BQU0sY0FBYyxHQUFHLFdBQVcsQ0FBQztBQUNuQyxNQUFNLFlBQVksR0FBRyxxQkFBcUIsQ0FBQztBQUMzQyxNQUFNLFNBQVMsR0FBRyw0QkFBNEIsQ0FBQztBQWF4QyxLQUFLLFVBQVUsS0FBSyxDQUFDLEtBQWEsRUFBRSxRQUFnQjtJQUN6RCxJQUFJLENBQUM7UUFDSCxvREFBb0Q7UUFDcEQsTUFBTSxHQUFHLEdBQUcsK0JBQStCLENBQUM7UUFFNUMsTUFBTSxPQUFPLEdBQUc7WUFDZCxRQUFRLEVBQUUsb0JBQW9CO1lBQzlCLFFBQVEsRUFBRSxTQUFTO1lBQ25CLGNBQWMsRUFBRTtnQkFDZCxRQUFRLEVBQUUsS0FBSztnQkFDZixRQUFRLEVBQUUsUUFBUTthQUNuQjtTQUNGLENBQUM7UUFFRixNQUFNLFFBQVEsR0FBRyxNQUFNLEtBQUssQ0FBQyxHQUFHLEVBQUU7WUFDaEMsTUFBTSxFQUFFLE1BQU07WUFDZCxPQUFPLEVBQUU7Z0JBQ1AsY0FBYyxFQUFFLDRCQUE0QjtnQkFDNUMsY0FBYyxFQUFFLGdEQUFnRDthQUNqRTtZQUNELElBQUksRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQztTQUM5QixDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsUUFBUSxDQUFDLEVBQUUsRUFBRSxDQUFDO1lBQ2pCLE1BQU0sS0FBSyxHQUFHLE1BQU0sUUFBUSxDQUFDLElBQUksRUFBRSxDQUFDO1lBQ3BDLE9BQU87Z0JBQ0wsT0FBTyxFQUFFLEtBQUs7Z0JBQ2QsS0FBSyxFQUFFLEtBQUssQ0FBQyxPQUFPLElBQUksS0FBSyxDQUFDLE1BQU0sSUFBSSx1QkFBdUI7YUFDaEUsQ0FBQztRQUNKLENBQUM7UUFFRCxNQUFNLElBQUksR0FBRyxNQUFNLFFBQVEsQ0FBQyxJQUFJLEVBQUUsQ0FBQztRQUVuQyxJQUFJLENBQUMsSUFBSSxDQUFDLG9CQUFvQixFQUFFLE9BQU8sRUFBRSxDQUFDO1lBQ3hDLE9BQU87Z0JBQ0wsT0FBTyxFQUFFLEtBQUs7Z0JBQ2QsS0FBSyxFQUFFLHVDQUF1QzthQUMvQyxDQUFDO1FBQ0osQ0FBQztRQUVELE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxPQUFPLENBQUM7UUFFbEQseUZBQXlGO1FBQ3pGLE1BQU0sYUFBYSxHQUFHLE9BQU8sQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDNUMsTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQztRQUVoRCxPQUFPO1lBQ0wsT0FBTyxFQUFFLElBQUk7WUFDYixLQUFLLEVBQUUsT0FBTztZQUNkLFFBQVEsRUFBRTtnQkFDUixLQUFLLEVBQUUsT0FBTyxDQUFDLEtBQUssSUFBSSxLQUFLO2dCQUM3QixHQUFHLEVBQUUsT0FBTyxDQUFDLEdBQUc7Z0JBQ2hCLE1BQU0sRUFBRSxPQUFPLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxFQUFFO2FBQ3hDO1NBQ0YsQ0FBQztJQUNKLENBQUM7SUFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO1FBQ2YsT0FBTyxDQUFDLEtBQUssQ0FBQyxjQUFjLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDckMsT0FBTztZQUNMLE9BQU8sRUFBRSxLQUFLO1lBQ2QsS0FBSyxFQUFFLEtBQUssWUFBWSxLQUFLLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLDRCQUE0QjtTQUM3RSxDQUFDO0lBQ0osQ0FBQztBQUNILENBQUM7QUFFRCxTQUFnQixNQUFNO0lBQ3BCLElBQUksT0FBTyxNQUFNLEtBQUssV0FBVyxFQUFFLENBQUM7UUFDbEMsWUFBWSxDQUFDLFVBQVUsQ0FBQyxZQUFZLENBQUMsQ0FBQztRQUN0QyxZQUFZLENBQUMsVUFBVSxDQUFDLFdBQVcsQ0FBQyxDQUFDO1FBQ3JDLDBCQUEwQjtRQUMxQixRQUFRLENBQUMsTUFBTSxHQUFHLDREQUE0RCxDQUFDO0lBQ2pGLENBQUM7QUFDSCxDQUFDO0FBRUQsU0FBZ0IsY0FBYztJQUM1QixJQUFJLE9BQU8sTUFBTSxLQUFLLFdBQVc7UUFBRSxPQUFPLElBQUksQ0FBQztJQUUvQyxNQUFNLEtBQUssR0FBRyxZQUFZLENBQUMsT0FBTyxDQUFDLFlBQVksQ0FBQyxDQUFDO0lBQ2pELE1BQU0sUUFBUSxHQUFHLFlBQVksQ0FBQyxPQUFPLENBQUMsV0FBVyxDQUFDLENBQUM7SUFFbkQsSUFBSSxDQUFDLEtBQUssSUFBSSxDQUFDLFFBQVE7UUFBRSxPQUFPLElBQUksQ0FBQztJQUVyQyxJQUFJLENBQUM7UUFDSCxPQUFPLElBQUksQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLENBQUM7SUFDOUIsQ0FBQztJQUFDLE1BQU0sQ0FBQztRQUNQLE9BQU8sSUFBSSxDQUFDO0lBQ2QsQ0FBQztBQUNILENBQUM7QUFFRCxTQUFnQixZQUFZLENBQUMsUUFBYTtJQUN4QyxJQUFJLE9BQU8sTUFBTSxLQUFLLFdBQVcsRUFBRSxDQUFDO1FBQ2xDLFlBQVksQ0FBQyxPQUFPLENBQUMsV0FBVyxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQztJQUM5RCxDQUFDO0FBQ0gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQ29nbml0byBBdXRoZW50aWNhdGlvbiBVdGlsaXR5XG4gKiBIYW5kbGVzIGxvZ2luIHdpdGggQVdTIENvZ25pdG8gVXNlciBQb29sXG4gKi9cblxuY29uc3QgQ09HTklUT19SRUdJT04gPSAnZXUtd2VzdC0xJztcbmNvbnN0IFVTRVJfUE9PTF9JRCA9ICdldS13ZXN0LTFfbEMyNXhaOHM2JztcbmNvbnN0IENMSUVOVF9JRCA9ICc0ZTQ1cGRpb2JjbThxbzNlaHZpMWJjbW8ycyc7XG5cbmludGVyZmFjZSBMb2dpblJlc3VsdCB7XG4gIHN1Y2Nlc3M6IGJvb2xlYW47XG4gIHRva2VuPzogc3RyaW5nO1xuICBlcnJvcj86IHN0cmluZztcbiAgdXNlckluZm8/OiB7XG4gICAgZW1haWw6IHN0cmluZztcbiAgICBzdWI6IHN0cmluZztcbiAgICBncm91cHM/OiBzdHJpbmdbXTtcbiAgfTtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGxvZ2luKGVtYWlsOiBzdHJpbmcsIHBhc3N3b3JkOiBzdHJpbmcpOiBQcm9taXNlPExvZ2luUmVzdWx0PiB7XG4gIHRyeSB7XG4gICAgLy8gVXNlIHByb3h5IHNlcnZlciBmb3IgQ29nbml0byB0byBhdm9pZCBDT1JTIGlzc3Vlc1xuICAgIGNvbnN0IHVybCA9ICdodHRwOi8vbG9jYWxob3N0OjMwMDEvY29nbml0byc7XG5cbiAgICBjb25zdCBwYXlsb2FkID0ge1xuICAgICAgQXV0aEZsb3c6ICdVU0VSX1BBU1NXT1JEX0FVVEgnLFxuICAgICAgQ2xpZW50SWQ6IENMSUVOVF9JRCxcbiAgICAgIEF1dGhQYXJhbWV0ZXJzOiB7XG4gICAgICAgIFVTRVJOQU1FOiBlbWFpbCxcbiAgICAgICAgUEFTU1dPUkQ6IHBhc3N3b3JkLFxuICAgICAgfSxcbiAgICB9O1xuXG4gICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaCh1cmwsIHtcbiAgICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgICAgaGVhZGVyczoge1xuICAgICAgICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL3gtYW16LWpzb24tMS4xJyxcbiAgICAgICAgJ1gtQW16LVRhcmdldCc6ICdBV1NDb2duaXRvSWRlbnRpdHlQcm92aWRlclNlcnZpY2UuSW5pdGlhdGVBdXRoJyxcbiAgICAgIH0sXG4gICAgICBib2R5OiBKU09OLnN0cmluZ2lmeShwYXlsb2FkKSxcbiAgICB9KTtcblxuICAgIGlmICghcmVzcG9uc2Uub2spIHtcbiAgICAgIGNvbnN0IGVycm9yID0gYXdhaXQgcmVzcG9uc2UuanNvbigpO1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgIGVycm9yOiBlcnJvci5tZXNzYWdlIHx8IGVycm9yLl9fdHlwZSB8fCAnQXV0aGVudGljYXRpb24gZmFpbGVkJyxcbiAgICAgIH07XG4gICAgfVxuXG4gICAgY29uc3QgZGF0YSA9IGF3YWl0IHJlc3BvbnNlLmpzb24oKTtcblxuICAgIGlmICghZGF0YS5BdXRoZW50aWNhdGlvblJlc3VsdD8uSWRUb2tlbikge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgIGVycm9yOiAnTm8gdG9rZW4gcmVjZWl2ZWQgZnJvbSBhdXRoZW50aWNhdGlvbicsXG4gICAgICB9O1xuICAgIH1cblxuICAgIGNvbnN0IGlkVG9rZW4gPSBkYXRhLkF1dGhlbnRpY2F0aW9uUmVzdWx0LklkVG9rZW47XG5cbiAgICAvLyBEZWNvZGUgSldUIHRvIGdldCB1c2VyIGluZm8gKHNpbXBsZSBiYXNlNjQgZGVjb2RlLCBubyB2ZXJpZmljYXRpb24gbmVlZGVkIGZvciBkaXNwbGF5KVxuICAgIGNvbnN0IHBheWxvYWRfcGFydHMgPSBpZFRva2VuLnNwbGl0KCcuJylbMV07XG4gICAgY29uc3QgZGVjb2RlZCA9IEpTT04ucGFyc2UoYXRvYihwYXlsb2FkX3BhcnRzKSk7XG5cbiAgICByZXR1cm4ge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHRva2VuOiBpZFRva2VuLFxuICAgICAgdXNlckluZm86IHtcbiAgICAgICAgZW1haWw6IGRlY29kZWQuZW1haWwgfHwgZW1haWwsXG4gICAgICAgIHN1YjogZGVjb2RlZC5zdWIsXG4gICAgICAgIGdyb3VwczogZGVjb2RlZFsnY29nbml0bzpncm91cHMnXSB8fCBbXSxcbiAgICAgIH0sXG4gICAgfTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLmVycm9yKCdMb2dpbiBlcnJvcjonLCBlcnJvcik7XG4gICAgcmV0dXJuIHtcbiAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgZXJyb3I6IGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogJ05ldHdvcmsgZXJyb3IgZHVyaW5nIGxvZ2luJyxcbiAgICB9O1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBsb2dvdXQoKSB7XG4gIGlmICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJykge1xuICAgIGxvY2FsU3RvcmFnZS5yZW1vdmVJdGVtKCdhdXRoX3Rva2VuJyk7XG4gICAgbG9jYWxTdG9yYWdlLnJlbW92ZUl0ZW0oJ3VzZXJfaW5mbycpO1xuICAgIC8vIENsZWFyIGF1dGggdG9rZW4gY29va2llXG4gICAgZG9jdW1lbnQuY29va2llID0gJ2F1dGhfdG9rZW49OyBwYXRoPS87IGV4cGlyZXM9VGh1LCAwMSBKYW4gMTk3MCAwMDowMDowMCBHTVQnO1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRDdXJyZW50VXNlcigpIHtcbiAgaWYgKHR5cGVvZiB3aW5kb3cgPT09ICd1bmRlZmluZWQnKSByZXR1cm4gbnVsbDtcblxuICBjb25zdCB0b2tlbiA9IGxvY2FsU3RvcmFnZS5nZXRJdGVtKCdhdXRoX3Rva2VuJyk7XG4gIGNvbnN0IHVzZXJJbmZvID0gbG9jYWxTdG9yYWdlLmdldEl0ZW0oJ3VzZXJfaW5mbycpO1xuXG4gIGlmICghdG9rZW4gfHwgIXVzZXJJbmZvKSByZXR1cm4gbnVsbDtcblxuICB0cnkge1xuICAgIHJldHVybiBKU09OLnBhcnNlKHVzZXJJbmZvKTtcbiAgfSBjYXRjaCB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNhdmVVc2VySW5mbyh1c2VySW5mbzogYW55KSB7XG4gIGlmICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJykge1xuICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCd1c2VyX2luZm8nLCBKU09OLnN0cmluZ2lmeSh1c2VySW5mbykpO1xuICB9XG59XG4iXX0=