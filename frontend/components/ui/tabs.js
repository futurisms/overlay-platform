"use client";
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
exports.Tabs = Tabs;
exports.TabsList = TabsList;
exports.TabsTrigger = TabsTrigger;
exports.TabsContent = TabsContent;
const React = __importStar(require("react"));
const TabsPrimitive = __importStar(require("@radix-ui/react-tabs"));
const utils_1 = require("@/lib/utils");
function Tabs({ className, ...props }) {
    return (<TabsPrimitive.Root data-slot="tabs" className={(0, utils_1.cn)("flex flex-col gap-2", className)} {...props}/>);
}
function TabsList({ className, ...props }) {
    return (<TabsPrimitive.List data-slot="tabs-list" className={(0, utils_1.cn)("bg-muted text-muted-foreground inline-flex h-9 w-fit items-center justify-center rounded-lg p-[3px]", className)} {...props}/>);
}
function TabsTrigger({ className, ...props }) {
    return (<TabsPrimitive.Trigger data-slot="tabs-trigger" className={(0, utils_1.cn)("data-[state=active]:bg-background dark:data-[state=active]:text-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:outline-ring dark:data-[state=active]:border-input dark:data-[state=active]:bg-input/30 text-foreground dark:text-muted-foreground inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-sm font-medium whitespace-nowrap transition-[color,box-shadow] focus-visible:ring-[3px] focus-visible:outline-1 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:shadow-sm [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4", className)} {...props}/>);
}
function TabsContent({ className, ...props }) {
    return (<TabsPrimitive.Content data-slot="tabs-content" className={(0, utils_1.cn)("flex-1 outline-none", className)} {...props}/>);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGFicy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInRhYnMudHN4Il0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLFlBQVksQ0FBQTs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBaUVILG9CQUFJO0FBQUUsNEJBQVE7QUFBRSxrQ0FBVztBQUFFLGtDQUFXO0FBL0RqRCw2Q0FBOEI7QUFDOUIsb0VBQXFEO0FBRXJELHVDQUFnQztBQUVoQyxTQUFTLElBQUksQ0FBQyxFQUNaLFNBQVMsRUFDVCxHQUFHLEtBQUssRUFDd0M7SUFDaEQsT0FBTyxDQUNMLENBQUMsYUFBYSxDQUFDLElBQUksQ0FDakIsU0FBUyxDQUFDLE1BQU0sQ0FDaEIsU0FBUyxDQUFDLENBQUMsSUFBQSxVQUFFLEVBQUMscUJBQXFCLEVBQUUsU0FBUyxDQUFDLENBQUMsQ0FDaEQsSUFBSSxLQUFLLENBQUMsRUFDVixDQUNILENBQUE7QUFDSCxDQUFDO0FBRUQsU0FBUyxRQUFRLENBQUMsRUFDaEIsU0FBUyxFQUNULEdBQUcsS0FBSyxFQUN3QztJQUNoRCxPQUFPLENBQ0wsQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUNqQixTQUFTLENBQUMsV0FBVyxDQUNyQixTQUFTLENBQUMsQ0FBQyxJQUFBLFVBQUUsRUFDWCxxR0FBcUcsRUFDckcsU0FBUyxDQUNWLENBQUMsQ0FDRixJQUFJLEtBQUssQ0FBQyxFQUNWLENBQ0gsQ0FBQTtBQUNILENBQUM7QUFFRCxTQUFTLFdBQVcsQ0FBQyxFQUNuQixTQUFTLEVBQ1QsR0FBRyxLQUFLLEVBQzJDO0lBQ25ELE9BQU8sQ0FDTCxDQUFDLGFBQWEsQ0FBQyxPQUFPLENBQ3BCLFNBQVMsQ0FBQyxjQUFjLENBQ3hCLFNBQVMsQ0FBQyxDQUFDLElBQUEsVUFBRSxFQUNYLGlxQkFBaXFCLEVBQ2pxQixTQUFTLENBQ1YsQ0FBQyxDQUNGLElBQUksS0FBSyxDQUFDLEVBQ1YsQ0FDSCxDQUFBO0FBQ0gsQ0FBQztBQUVELFNBQVMsV0FBVyxDQUFDLEVBQ25CLFNBQVMsRUFDVCxHQUFHLEtBQUssRUFDMkM7SUFDbkQsT0FBTyxDQUNMLENBQUMsYUFBYSxDQUFDLE9BQU8sQ0FDcEIsU0FBUyxDQUFDLGNBQWMsQ0FDeEIsU0FBUyxDQUFDLENBQUMsSUFBQSxVQUFFLEVBQUMscUJBQXFCLEVBQUUsU0FBUyxDQUFDLENBQUMsQ0FDaEQsSUFBSSxLQUFLLENBQUMsRUFDVixDQUNILENBQUE7QUFDSCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiXCJ1c2UgY2xpZW50XCJcblxuaW1wb3J0ICogYXMgUmVhY3QgZnJvbSBcInJlYWN0XCJcbmltcG9ydCAqIGFzIFRhYnNQcmltaXRpdmUgZnJvbSBcIkByYWRpeC11aS9yZWFjdC10YWJzXCJcblxuaW1wb3J0IHsgY24gfSBmcm9tIFwiQC9saWIvdXRpbHNcIlxuXG5mdW5jdGlvbiBUYWJzKHtcbiAgY2xhc3NOYW1lLFxuICAuLi5wcm9wc1xufTogUmVhY3QuQ29tcG9uZW50UHJvcHM8dHlwZW9mIFRhYnNQcmltaXRpdmUuUm9vdD4pIHtcbiAgcmV0dXJuIChcbiAgICA8VGFic1ByaW1pdGl2ZS5Sb290XG4gICAgICBkYXRhLXNsb3Q9XCJ0YWJzXCJcbiAgICAgIGNsYXNzTmFtZT17Y24oXCJmbGV4IGZsZXgtY29sIGdhcC0yXCIsIGNsYXNzTmFtZSl9XG4gICAgICB7Li4ucHJvcHN9XG4gICAgLz5cbiAgKVxufVxuXG5mdW5jdGlvbiBUYWJzTGlzdCh7XG4gIGNsYXNzTmFtZSxcbiAgLi4ucHJvcHNcbn06IFJlYWN0LkNvbXBvbmVudFByb3BzPHR5cGVvZiBUYWJzUHJpbWl0aXZlLkxpc3Q+KSB7XG4gIHJldHVybiAoXG4gICAgPFRhYnNQcmltaXRpdmUuTGlzdFxuICAgICAgZGF0YS1zbG90PVwidGFicy1saXN0XCJcbiAgICAgIGNsYXNzTmFtZT17Y24oXG4gICAgICAgIFwiYmctbXV0ZWQgdGV4dC1tdXRlZC1mb3JlZ3JvdW5kIGlubGluZS1mbGV4IGgtOSB3LWZpdCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgcm91bmRlZC1sZyBwLVszcHhdXCIsXG4gICAgICAgIGNsYXNzTmFtZVxuICAgICAgKX1cbiAgICAgIHsuLi5wcm9wc31cbiAgICAvPlxuICApXG59XG5cbmZ1bmN0aW9uIFRhYnNUcmlnZ2VyKHtcbiAgY2xhc3NOYW1lLFxuICAuLi5wcm9wc1xufTogUmVhY3QuQ29tcG9uZW50UHJvcHM8dHlwZW9mIFRhYnNQcmltaXRpdmUuVHJpZ2dlcj4pIHtcbiAgcmV0dXJuIChcbiAgICA8VGFic1ByaW1pdGl2ZS5UcmlnZ2VyXG4gICAgICBkYXRhLXNsb3Q9XCJ0YWJzLXRyaWdnZXJcIlxuICAgICAgY2xhc3NOYW1lPXtjbihcbiAgICAgICAgXCJkYXRhLVtzdGF0ZT1hY3RpdmVdOmJnLWJhY2tncm91bmQgZGFyazpkYXRhLVtzdGF0ZT1hY3RpdmVdOnRleHQtZm9yZWdyb3VuZCBmb2N1cy12aXNpYmxlOmJvcmRlci1yaW5nIGZvY3VzLXZpc2libGU6cmluZy1yaW5nLzUwIGZvY3VzLXZpc2libGU6b3V0bGluZS1yaW5nIGRhcms6ZGF0YS1bc3RhdGU9YWN0aXZlXTpib3JkZXItaW5wdXQgZGFyazpkYXRhLVtzdGF0ZT1hY3RpdmVdOmJnLWlucHV0LzMwIHRleHQtZm9yZWdyb3VuZCBkYXJrOnRleHQtbXV0ZWQtZm9yZWdyb3VuZCBpbmxpbmUtZmxleCBoLVtjYWxjKDEwMCUtMXB4KV0gZmxleC0xIGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciBnYXAtMS41IHJvdW5kZWQtbWQgYm9yZGVyIGJvcmRlci10cmFuc3BhcmVudCBweC0yIHB5LTEgdGV4dC1zbSBmb250LW1lZGl1bSB3aGl0ZXNwYWNlLW5vd3JhcCB0cmFuc2l0aW9uLVtjb2xvcixib3gtc2hhZG93XSBmb2N1cy12aXNpYmxlOnJpbmctWzNweF0gZm9jdXMtdmlzaWJsZTpvdXRsaW5lLTEgZGlzYWJsZWQ6cG9pbnRlci1ldmVudHMtbm9uZSBkaXNhYmxlZDpvcGFjaXR5LTUwIGRhdGEtW3N0YXRlPWFjdGl2ZV06c2hhZG93LXNtIFsmX3N2Z106cG9pbnRlci1ldmVudHMtbm9uZSBbJl9zdmddOnNocmluay0wIFsmX3N2Zzpub3QoW2NsYXNzKj0nc2l6ZS0nXSldOnNpemUtNFwiLFxuICAgICAgICBjbGFzc05hbWVcbiAgICAgICl9XG4gICAgICB7Li4ucHJvcHN9XG4gICAgLz5cbiAgKVxufVxuXG5mdW5jdGlvbiBUYWJzQ29udGVudCh7XG4gIGNsYXNzTmFtZSxcbiAgLi4ucHJvcHNcbn06IFJlYWN0LkNvbXBvbmVudFByb3BzPHR5cGVvZiBUYWJzUHJpbWl0aXZlLkNvbnRlbnQ+KSB7XG4gIHJldHVybiAoXG4gICAgPFRhYnNQcmltaXRpdmUuQ29udGVudFxuICAgICAgZGF0YS1zbG90PVwidGFicy1jb250ZW50XCJcbiAgICAgIGNsYXNzTmFtZT17Y24oXCJmbGV4LTEgb3V0bGluZS1ub25lXCIsIGNsYXNzTmFtZSl9XG4gICAgICB7Li4ucHJvcHN9XG4gICAgLz5cbiAgKVxufVxuXG5leHBvcnQgeyBUYWJzLCBUYWJzTGlzdCwgVGFic1RyaWdnZXIsIFRhYnNDb250ZW50IH1cbiJdfQ==