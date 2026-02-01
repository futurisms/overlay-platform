"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
exports.middleware = middleware;
const server_1 = require("next/server");
// Public routes that don't require authentication
const publicRoutes = ['/login', '/auth/signin', '/'];
// Check if JWT token is expired
function isTokenExpired(token) {
    try {
        // JWT format: header.payload.signature
        const parts = token.split('.');
        if (parts.length !== 3)
            return true;
        // Decode payload (base64)
        const payload = JSON.parse(atob(parts[1]));
        // Check expiration (exp is in seconds, Date.now() is in milliseconds)
        if (!payload.exp)
            return true;
        const now = Math.floor(Date.now() / 1000);
        return payload.exp < now;
    }
    catch (error) {
        console.error('Token validation error:', error);
        return true; // Treat invalid tokens as expired
    }
}
function middleware(request) {
    const { pathname } = request.nextUrl;
    // Allow public routes
    if (publicRoutes.includes(pathname)) {
        return server_1.NextResponse.next();
    }
    // Check for auth token in cookies (primary) or localStorage (via header)
    const tokenFromCookie = request.cookies.get('auth_token')?.value;
    const tokenFromHeader = request.headers.get('x-auth-token');
    const token = tokenFromCookie || tokenFromHeader;
    // If no token, redirect to login with return URL
    if (!token) {
        const url = request.nextUrl.clone();
        url.pathname = '/login';
        url.searchParams.set('callbackUrl', pathname);
        return server_1.NextResponse.redirect(url);
    }
    // Check if token is expired
    if (isTokenExpired(token)) {
        // Expired token - redirect to login with return URL
        const url = request.nextUrl.clone();
        url.pathname = '/login';
        url.searchParams.set('callbackUrl', pathname);
        // Clear the expired token cookie
        const response = server_1.NextResponse.redirect(url);
        response.cookies.delete('auth_token');
        return response;
    }
    // Token valid, allow request to proceed
    return server_1.NextResponse.next();
}
// Configure which routes use this middleware
exports.config = {
    matcher: [
        /*
         * Match all request paths except:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public folder files
         */
        '/((?!_next/static|_next/image|favicon.ico|public).*)',
    ],
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWlkZGxld2FyZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIm1pZGRsZXdhcmUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBMkJBLGdDQXFDQztBQWhFRCx3Q0FBMkM7QUFHM0Msa0RBQWtEO0FBQ2xELE1BQU0sWUFBWSxHQUFHLENBQUMsUUFBUSxFQUFFLGNBQWMsRUFBRSxHQUFHLENBQUMsQ0FBQztBQUVyRCxnQ0FBZ0M7QUFDaEMsU0FBUyxjQUFjLENBQUMsS0FBYTtJQUNuQyxJQUFJLENBQUM7UUFDSCx1Q0FBdUM7UUFDdkMsTUFBTSxLQUFLLEdBQUcsS0FBSyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUMvQixJQUFJLEtBQUssQ0FBQyxNQUFNLEtBQUssQ0FBQztZQUFFLE9BQU8sSUFBSSxDQUFDO1FBRXBDLDBCQUEwQjtRQUMxQixNQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBRTNDLHNFQUFzRTtRQUN0RSxJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUc7WUFBRSxPQUFPLElBQUksQ0FBQztRQUU5QixNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUUsR0FBRyxJQUFJLENBQUMsQ0FBQztRQUMxQyxPQUFPLE9BQU8sQ0FBQyxHQUFHLEdBQUcsR0FBRyxDQUFDO0lBQzNCLENBQUM7SUFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO1FBQ2YsT0FBTyxDQUFDLEtBQUssQ0FBQyx5QkFBeUIsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUNoRCxPQUFPLElBQUksQ0FBQyxDQUFDLGtDQUFrQztJQUNqRCxDQUFDO0FBQ0gsQ0FBQztBQUVELFNBQWdCLFVBQVUsQ0FBQyxPQUFvQjtJQUM3QyxNQUFNLEVBQUUsUUFBUSxFQUFFLEdBQUcsT0FBTyxDQUFDLE9BQU8sQ0FBQztJQUVyQyxzQkFBc0I7SUFDdEIsSUFBSSxZQUFZLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUM7UUFDcEMsT0FBTyxxQkFBWSxDQUFDLElBQUksRUFBRSxDQUFDO0lBQzdCLENBQUM7SUFFRCx5RUFBeUU7SUFDekUsTUFBTSxlQUFlLEdBQUcsT0FBTyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsWUFBWSxDQUFDLEVBQUUsS0FBSyxDQUFDO0lBQ2pFLE1BQU0sZUFBZSxHQUFHLE9BQU8sQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLGNBQWMsQ0FBQyxDQUFDO0lBQzVELE1BQU0sS0FBSyxHQUFHLGVBQWUsSUFBSSxlQUFlLENBQUM7SUFFakQsaURBQWlEO0lBQ2pELElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQztRQUNYLE1BQU0sR0FBRyxHQUFHLE9BQU8sQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLENBQUM7UUFDcEMsR0FBRyxDQUFDLFFBQVEsR0FBRyxRQUFRLENBQUM7UUFDeEIsR0FBRyxDQUFDLFlBQVksQ0FBQyxHQUFHLENBQUMsYUFBYSxFQUFFLFFBQVEsQ0FBQyxDQUFDO1FBQzlDLE9BQU8scUJBQVksQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDcEMsQ0FBQztJQUVELDRCQUE0QjtJQUM1QixJQUFJLGNBQWMsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDO1FBQzFCLG9EQUFvRDtRQUNwRCxNQUFNLEdBQUcsR0FBRyxPQUFPLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxDQUFDO1FBQ3BDLEdBQUcsQ0FBQyxRQUFRLEdBQUcsUUFBUSxDQUFDO1FBQ3hCLEdBQUcsQ0FBQyxZQUFZLENBQUMsR0FBRyxDQUFDLGFBQWEsRUFBRSxRQUFRLENBQUMsQ0FBQztRQUU5QyxpQ0FBaUM7UUFDakMsTUFBTSxRQUFRLEdBQUcscUJBQVksQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDNUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsWUFBWSxDQUFDLENBQUM7UUFFdEMsT0FBTyxRQUFRLENBQUM7SUFDbEIsQ0FBQztJQUVELHdDQUF3QztJQUN4QyxPQUFPLHFCQUFZLENBQUMsSUFBSSxFQUFFLENBQUM7QUFDN0IsQ0FBQztBQUVELDZDQUE2QztBQUNoQyxRQUFBLE1BQU0sR0FBRztJQUNwQixPQUFPLEVBQUU7UUFDUDs7Ozs7O1dBTUc7UUFDSCxzREFBc0Q7S0FDdkQ7Q0FDRixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgTmV4dFJlc3BvbnNlIH0gZnJvbSAnbmV4dC9zZXJ2ZXInO1xuaW1wb3J0IHR5cGUgeyBOZXh0UmVxdWVzdCB9IGZyb20gJ25leHQvc2VydmVyJztcblxuLy8gUHVibGljIHJvdXRlcyB0aGF0IGRvbid0IHJlcXVpcmUgYXV0aGVudGljYXRpb25cbmNvbnN0IHB1YmxpY1JvdXRlcyA9IFsnL2xvZ2luJywgJy9hdXRoL3NpZ25pbicsICcvJ107XG5cbi8vIENoZWNrIGlmIEpXVCB0b2tlbiBpcyBleHBpcmVkXG5mdW5jdGlvbiBpc1Rva2VuRXhwaXJlZCh0b2tlbjogc3RyaW5nKTogYm9vbGVhbiB7XG4gIHRyeSB7XG4gICAgLy8gSldUIGZvcm1hdDogaGVhZGVyLnBheWxvYWQuc2lnbmF0dXJlXG4gICAgY29uc3QgcGFydHMgPSB0b2tlbi5zcGxpdCgnLicpO1xuICAgIGlmIChwYXJ0cy5sZW5ndGggIT09IDMpIHJldHVybiB0cnVlO1xuXG4gICAgLy8gRGVjb2RlIHBheWxvYWQgKGJhc2U2NClcbiAgICBjb25zdCBwYXlsb2FkID0gSlNPTi5wYXJzZShhdG9iKHBhcnRzWzFdKSk7XG5cbiAgICAvLyBDaGVjayBleHBpcmF0aW9uIChleHAgaXMgaW4gc2Vjb25kcywgRGF0ZS5ub3coKSBpcyBpbiBtaWxsaXNlY29uZHMpXG4gICAgaWYgKCFwYXlsb2FkLmV4cCkgcmV0dXJuIHRydWU7XG5cbiAgICBjb25zdCBub3cgPSBNYXRoLmZsb29yKERhdGUubm93KCkgLyAxMDAwKTtcbiAgICByZXR1cm4gcGF5bG9hZC5leHAgPCBub3c7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcignVG9rZW4gdmFsaWRhdGlvbiBlcnJvcjonLCBlcnJvcik7XG4gICAgcmV0dXJuIHRydWU7IC8vIFRyZWF0IGludmFsaWQgdG9rZW5zIGFzIGV4cGlyZWRcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gbWlkZGxld2FyZShyZXF1ZXN0OiBOZXh0UmVxdWVzdCkge1xuICBjb25zdCB7IHBhdGhuYW1lIH0gPSByZXF1ZXN0Lm5leHRVcmw7XG5cbiAgLy8gQWxsb3cgcHVibGljIHJvdXRlc1xuICBpZiAocHVibGljUm91dGVzLmluY2x1ZGVzKHBhdGhuYW1lKSkge1xuICAgIHJldHVybiBOZXh0UmVzcG9uc2UubmV4dCgpO1xuICB9XG5cbiAgLy8gQ2hlY2sgZm9yIGF1dGggdG9rZW4gaW4gY29va2llcyAocHJpbWFyeSkgb3IgbG9jYWxTdG9yYWdlICh2aWEgaGVhZGVyKVxuICBjb25zdCB0b2tlbkZyb21Db29raWUgPSByZXF1ZXN0LmNvb2tpZXMuZ2V0KCdhdXRoX3Rva2VuJyk/LnZhbHVlO1xuICBjb25zdCB0b2tlbkZyb21IZWFkZXIgPSByZXF1ZXN0LmhlYWRlcnMuZ2V0KCd4LWF1dGgtdG9rZW4nKTtcbiAgY29uc3QgdG9rZW4gPSB0b2tlbkZyb21Db29raWUgfHwgdG9rZW5Gcm9tSGVhZGVyO1xuXG4gIC8vIElmIG5vIHRva2VuLCByZWRpcmVjdCB0byBsb2dpbiB3aXRoIHJldHVybiBVUkxcbiAgaWYgKCF0b2tlbikge1xuICAgIGNvbnN0IHVybCA9IHJlcXVlc3QubmV4dFVybC5jbG9uZSgpO1xuICAgIHVybC5wYXRobmFtZSA9ICcvbG9naW4nO1xuICAgIHVybC5zZWFyY2hQYXJhbXMuc2V0KCdjYWxsYmFja1VybCcsIHBhdGhuYW1lKTtcbiAgICByZXR1cm4gTmV4dFJlc3BvbnNlLnJlZGlyZWN0KHVybCk7XG4gIH1cblxuICAvLyBDaGVjayBpZiB0b2tlbiBpcyBleHBpcmVkXG4gIGlmIChpc1Rva2VuRXhwaXJlZCh0b2tlbikpIHtcbiAgICAvLyBFeHBpcmVkIHRva2VuIC0gcmVkaXJlY3QgdG8gbG9naW4gd2l0aCByZXR1cm4gVVJMXG4gICAgY29uc3QgdXJsID0gcmVxdWVzdC5uZXh0VXJsLmNsb25lKCk7XG4gICAgdXJsLnBhdGhuYW1lID0gJy9sb2dpbic7XG4gICAgdXJsLnNlYXJjaFBhcmFtcy5zZXQoJ2NhbGxiYWNrVXJsJywgcGF0aG5hbWUpO1xuXG4gICAgLy8gQ2xlYXIgdGhlIGV4cGlyZWQgdG9rZW4gY29va2llXG4gICAgY29uc3QgcmVzcG9uc2UgPSBOZXh0UmVzcG9uc2UucmVkaXJlY3QodXJsKTtcbiAgICByZXNwb25zZS5jb29raWVzLmRlbGV0ZSgnYXV0aF90b2tlbicpO1xuXG4gICAgcmV0dXJuIHJlc3BvbnNlO1xuICB9XG5cbiAgLy8gVG9rZW4gdmFsaWQsIGFsbG93IHJlcXVlc3QgdG8gcHJvY2VlZFxuICByZXR1cm4gTmV4dFJlc3BvbnNlLm5leHQoKTtcbn1cblxuLy8gQ29uZmlndXJlIHdoaWNoIHJvdXRlcyB1c2UgdGhpcyBtaWRkbGV3YXJlXG5leHBvcnQgY29uc3QgY29uZmlnID0ge1xuICBtYXRjaGVyOiBbXG4gICAgLypcbiAgICAgKiBNYXRjaCBhbGwgcmVxdWVzdCBwYXRocyBleGNlcHQ6XG4gICAgICogLSBfbmV4dC9zdGF0aWMgKHN0YXRpYyBmaWxlcylcbiAgICAgKiAtIF9uZXh0L2ltYWdlIChpbWFnZSBvcHRpbWl6YXRpb24gZmlsZXMpXG4gICAgICogLSBmYXZpY29uLmljbyAoZmF2aWNvbiBmaWxlKVxuICAgICAqIC0gcHVibGljIGZvbGRlciBmaWxlc1xuICAgICAqL1xuICAgICcvKCg/IV9uZXh0L3N0YXRpY3xfbmV4dC9pbWFnZXxmYXZpY29uLmljb3xwdWJsaWMpLiopJyxcbiAgXSxcbn07XG4iXX0=