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
exports.buttonVariants = void 0;
exports.Button = Button;
const React = __importStar(require("react"));
const react_slot_1 = require("@radix-ui/react-slot");
const class_variance_authority_1 = require("class-variance-authority");
const utils_1 = require("@/lib/utils");
const buttonVariants = (0, class_variance_authority_1.cva)("inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive", {
    variants: {
        variant: {
            default: "bg-primary text-primary-foreground hover:bg-primary/90",
            destructive: "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
            outline: "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
            secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
            ghost: "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
            link: "text-primary underline-offset-4 hover:underline",
        },
        size: {
            default: "h-9 px-4 py-2 has-[>svg]:px-3",
            sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
            lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
            icon: "size-9",
            "icon-sm": "size-8",
            "icon-lg": "size-10",
        },
    },
    defaultVariants: {
        variant: "default",
        size: "default",
    },
});
exports.buttonVariants = buttonVariants;
function Button({ className, variant = "default", size = "default", asChild = false, ...props }) {
    const Comp = asChild ? react_slot_1.Slot : "button";
    return (<Comp data-slot="button" data-variant={variant} data-size={size} className={(0, utils_1.cn)(buttonVariants({ variant, size, className }))} {...props}/>);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnV0dG9uLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYnV0dG9uLnRzeCJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUE2RFMsd0JBQU07QUE3RGYsNkNBQThCO0FBQzlCLHFEQUEyQztBQUMzQyx1RUFBaUU7QUFFakUsdUNBQWdDO0FBRWhDLE1BQU0sY0FBYyxHQUFHLElBQUEsOEJBQUcsRUFDeEIsNmJBQTZiLEVBQzdiO0lBQ0UsUUFBUSxFQUFFO1FBQ1IsT0FBTyxFQUFFO1lBQ1AsT0FBTyxFQUFFLHdEQUF3RDtZQUNqRSxXQUFXLEVBQ1QsbUpBQW1KO1lBQ3JKLE9BQU8sRUFDTCx1SUFBdUk7WUFDekksU0FBUyxFQUNQLDhEQUE4RDtZQUNoRSxLQUFLLEVBQ0gsc0VBQXNFO1lBQ3hFLElBQUksRUFBRSxpREFBaUQ7U0FDeEQ7UUFDRCxJQUFJLEVBQUU7WUFDSixPQUFPLEVBQUUsK0JBQStCO1lBQ3hDLEVBQUUsRUFBRSwrQ0FBK0M7WUFDbkQsRUFBRSxFQUFFLHNDQUFzQztZQUMxQyxJQUFJLEVBQUUsUUFBUTtZQUNkLFNBQVMsRUFBRSxRQUFRO1lBQ25CLFNBQVMsRUFBRSxTQUFTO1NBQ3JCO0tBQ0Y7SUFDRCxlQUFlLEVBQUU7UUFDZixPQUFPLEVBQUUsU0FBUztRQUNsQixJQUFJLEVBQUUsU0FBUztLQUNoQjtDQUNGLENBQ0YsQ0FBQTtBQXlCZ0Isd0NBQWM7QUF2Qi9CLFNBQVMsTUFBTSxDQUFDLEVBQ2QsU0FBUyxFQUNULE9BQU8sR0FBRyxTQUFTLEVBQ25CLElBQUksR0FBRyxTQUFTLEVBQ2hCLE9BQU8sR0FBRyxLQUFLLEVBQ2YsR0FBRyxLQUFLLEVBSVA7SUFDRCxNQUFNLElBQUksR0FBRyxPQUFPLENBQUMsQ0FBQyxDQUFDLGlCQUFJLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQTtJQUV0QyxPQUFPLENBQ0wsQ0FBQyxJQUFJLENBQ0gsU0FBUyxDQUFDLFFBQVEsQ0FDbEIsWUFBWSxDQUFDLENBQUMsT0FBTyxDQUFDLENBQ3RCLFNBQVMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUNoQixTQUFTLENBQUMsQ0FBQyxJQUFBLFVBQUUsRUFBQyxjQUFjLENBQUMsRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLFNBQVMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUM1RCxJQUFJLEtBQUssQ0FBQyxFQUNWLENBQ0gsQ0FBQTtBQUNILENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBSZWFjdCBmcm9tIFwicmVhY3RcIlxuaW1wb3J0IHsgU2xvdCB9IGZyb20gXCJAcmFkaXgtdWkvcmVhY3Qtc2xvdFwiXG5pbXBvcnQgeyBjdmEsIHR5cGUgVmFyaWFudFByb3BzIH0gZnJvbSBcImNsYXNzLXZhcmlhbmNlLWF1dGhvcml0eVwiXG5cbmltcG9ydCB7IGNuIH0gZnJvbSBcIkAvbGliL3V0aWxzXCJcblxuY29uc3QgYnV0dG9uVmFyaWFudHMgPSBjdmEoXG4gIFwiaW5saW5lLWZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIGdhcC0yIHdoaXRlc3BhY2Utbm93cmFwIHJvdW5kZWQtbWQgdGV4dC1zbSBmb250LW1lZGl1bSB0cmFuc2l0aW9uLWFsbCBkaXNhYmxlZDpwb2ludGVyLWV2ZW50cy1ub25lIGRpc2FibGVkOm9wYWNpdHktNTAgWyZfc3ZnXTpwb2ludGVyLWV2ZW50cy1ub25lIFsmX3N2Zzpub3QoW2NsYXNzKj0nc2l6ZS0nXSldOnNpemUtNCBzaHJpbmstMCBbJl9zdmddOnNocmluay0wIG91dGxpbmUtbm9uZSBmb2N1cy12aXNpYmxlOmJvcmRlci1yaW5nIGZvY3VzLXZpc2libGU6cmluZy1yaW5nLzUwIGZvY3VzLXZpc2libGU6cmluZy1bM3B4XSBhcmlhLWludmFsaWQ6cmluZy1kZXN0cnVjdGl2ZS8yMCBkYXJrOmFyaWEtaW52YWxpZDpyaW5nLWRlc3RydWN0aXZlLzQwIGFyaWEtaW52YWxpZDpib3JkZXItZGVzdHJ1Y3RpdmVcIixcbiAge1xuICAgIHZhcmlhbnRzOiB7XG4gICAgICB2YXJpYW50OiB7XG4gICAgICAgIGRlZmF1bHQ6IFwiYmctcHJpbWFyeSB0ZXh0LXByaW1hcnktZm9yZWdyb3VuZCBob3ZlcjpiZy1wcmltYXJ5LzkwXCIsXG4gICAgICAgIGRlc3RydWN0aXZlOlxuICAgICAgICAgIFwiYmctZGVzdHJ1Y3RpdmUgdGV4dC13aGl0ZSBob3ZlcjpiZy1kZXN0cnVjdGl2ZS85MCBmb2N1cy12aXNpYmxlOnJpbmctZGVzdHJ1Y3RpdmUvMjAgZGFyazpmb2N1cy12aXNpYmxlOnJpbmctZGVzdHJ1Y3RpdmUvNDAgZGFyazpiZy1kZXN0cnVjdGl2ZS82MFwiLFxuICAgICAgICBvdXRsaW5lOlxuICAgICAgICAgIFwiYm9yZGVyIGJnLWJhY2tncm91bmQgc2hhZG93LXhzIGhvdmVyOmJnLWFjY2VudCBob3Zlcjp0ZXh0LWFjY2VudC1mb3JlZ3JvdW5kIGRhcms6YmctaW5wdXQvMzAgZGFyazpib3JkZXItaW5wdXQgZGFyazpob3ZlcjpiZy1pbnB1dC81MFwiLFxuICAgICAgICBzZWNvbmRhcnk6XG4gICAgICAgICAgXCJiZy1zZWNvbmRhcnkgdGV4dC1zZWNvbmRhcnktZm9yZWdyb3VuZCBob3ZlcjpiZy1zZWNvbmRhcnkvODBcIixcbiAgICAgICAgZ2hvc3Q6XG4gICAgICAgICAgXCJob3ZlcjpiZy1hY2NlbnQgaG92ZXI6dGV4dC1hY2NlbnQtZm9yZWdyb3VuZCBkYXJrOmhvdmVyOmJnLWFjY2VudC81MFwiLFxuICAgICAgICBsaW5rOiBcInRleHQtcHJpbWFyeSB1bmRlcmxpbmUtb2Zmc2V0LTQgaG92ZXI6dW5kZXJsaW5lXCIsXG4gICAgICB9LFxuICAgICAgc2l6ZToge1xuICAgICAgICBkZWZhdWx0OiBcImgtOSBweC00IHB5LTIgaGFzLVs+c3ZnXTpweC0zXCIsXG4gICAgICAgIHNtOiBcImgtOCByb3VuZGVkLW1kIGdhcC0xLjUgcHgtMyBoYXMtWz5zdmddOnB4LTIuNVwiLFxuICAgICAgICBsZzogXCJoLTEwIHJvdW5kZWQtbWQgcHgtNiBoYXMtWz5zdmddOnB4LTRcIixcbiAgICAgICAgaWNvbjogXCJzaXplLTlcIixcbiAgICAgICAgXCJpY29uLXNtXCI6IFwic2l6ZS04XCIsXG4gICAgICAgIFwiaWNvbi1sZ1wiOiBcInNpemUtMTBcIixcbiAgICAgIH0sXG4gICAgfSxcbiAgICBkZWZhdWx0VmFyaWFudHM6IHtcbiAgICAgIHZhcmlhbnQ6IFwiZGVmYXVsdFwiLFxuICAgICAgc2l6ZTogXCJkZWZhdWx0XCIsXG4gICAgfSxcbiAgfVxuKVxuXG5mdW5jdGlvbiBCdXR0b24oe1xuICBjbGFzc05hbWUsXG4gIHZhcmlhbnQgPSBcImRlZmF1bHRcIixcbiAgc2l6ZSA9IFwiZGVmYXVsdFwiLFxuICBhc0NoaWxkID0gZmFsc2UsXG4gIC4uLnByb3BzXG59OiBSZWFjdC5Db21wb25lbnRQcm9wczxcImJ1dHRvblwiPiAmXG4gIFZhcmlhbnRQcm9wczx0eXBlb2YgYnV0dG9uVmFyaWFudHM+ICYge1xuICAgIGFzQ2hpbGQ/OiBib29sZWFuXG4gIH0pIHtcbiAgY29uc3QgQ29tcCA9IGFzQ2hpbGQgPyBTbG90IDogXCJidXR0b25cIlxuXG4gIHJldHVybiAoXG4gICAgPENvbXBcbiAgICAgIGRhdGEtc2xvdD1cImJ1dHRvblwiXG4gICAgICBkYXRhLXZhcmlhbnQ9e3ZhcmlhbnR9XG4gICAgICBkYXRhLXNpemU9e3NpemV9XG4gICAgICBjbGFzc05hbWU9e2NuKGJ1dHRvblZhcmlhbnRzKHsgdmFyaWFudCwgc2l6ZSwgY2xhc3NOYW1lIH0pKX1cbiAgICAgIHsuLi5wcm9wc31cbiAgICAvPlxuICApXG59XG5cbmV4cG9ydCB7IEJ1dHRvbiwgYnV0dG9uVmFyaWFudHMgfVxuIl19