"use client";
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Home;
const react_1 = require("react");
const navigation_1 = require("next/navigation");
function Home() {
    const router = (0, navigation_1.useRouter)();
    (0, react_1.useEffect)(() => {
        // Redirect to login page
        router.push("/login");
    }, [router]);
    return (<div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
      <p className="text-slate-600 dark:text-slate-400">Redirecting to login...</p>
    </div>);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFnZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInBhZ2UudHN4Il0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLFlBQVksQ0FBQzs7O0FBS2IsdUJBYUM7QUFoQkQsaUNBQWtDO0FBQ2xDLGdEQUE0QztBQUU1QyxTQUF3QixJQUFJO0lBQzFCLE1BQU0sTUFBTSxHQUFHLElBQUEsc0JBQVMsR0FBRSxDQUFDO0lBRTNCLElBQUEsaUJBQVMsRUFBQyxHQUFHLEVBQUU7UUFDYix5QkFBeUI7UUFDekIsTUFBTSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQztJQUN4QixDQUFDLEVBQUUsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO0lBRWIsT0FBTyxDQUNMLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxpSUFBaUksQ0FDOUk7TUFBQSxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsb0NBQW9DLENBQUMsdUJBQXVCLEVBQUUsQ0FBQyxDQUM5RTtJQUFBLEVBQUUsR0FBRyxDQUFDLENBQ1AsQ0FBQztBQUNKLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJcInVzZSBjbGllbnRcIjtcblxuaW1wb3J0IHsgdXNlRWZmZWN0IH0gZnJvbSBcInJlYWN0XCI7XG5pbXBvcnQgeyB1c2VSb3V0ZXIgfSBmcm9tIFwibmV4dC9uYXZpZ2F0aW9uXCI7XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIEhvbWUoKSB7XG4gIGNvbnN0IHJvdXRlciA9IHVzZVJvdXRlcigpO1xuXG4gIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgLy8gUmVkaXJlY3QgdG8gbG9naW4gcGFnZVxuICAgIHJvdXRlci5wdXNoKFwiL2xvZ2luXCIpO1xuICB9LCBbcm91dGVyXSk7XG5cbiAgcmV0dXJuIChcbiAgICA8ZGl2IGNsYXNzTmFtZT1cIm1pbi1oLXNjcmVlbiBiZy1ncmFkaWVudC10by1iIGZyb20tc2xhdGUtNTAgdG8tc2xhdGUtMTAwIGRhcms6ZnJvbS1zbGF0ZS05MDAgZGFyazp0by1zbGF0ZS04MDAgZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXJcIj5cbiAgICAgIDxwIGNsYXNzTmFtZT1cInRleHQtc2xhdGUtNjAwIGRhcms6dGV4dC1zbGF0ZS00MDBcIj5SZWRpcmVjdGluZyB0byBsb2dpbi4uLjwvcD5cbiAgICA8L2Rpdj5cbiAgKTtcbn1cbiJdfQ==