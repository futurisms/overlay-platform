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
exports.Separator = Separator;
const React = __importStar(require("react"));
const SeparatorPrimitive = __importStar(require("@radix-ui/react-separator"));
const utils_1 = require("@/lib/utils");
function Separator({ className, orientation = "horizontal", decorative = true, ...props }) {
    return (<SeparatorPrimitive.Root data-slot="separator" decorative={decorative} orientation={orientation} className={(0, utils_1.cn)("bg-border shrink-0 data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px", className)} {...props}/>);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VwYXJhdG9yLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsic2VwYXJhdG9yLnRzeCJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxZQUFZLENBQUE7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQTJCSCw4QkFBUztBQXpCbEIsNkNBQThCO0FBQzlCLDhFQUErRDtBQUUvRCx1Q0FBZ0M7QUFFaEMsU0FBUyxTQUFTLENBQUMsRUFDakIsU0FBUyxFQUNULFdBQVcsR0FBRyxZQUFZLEVBQzFCLFVBQVUsR0FBRyxJQUFJLEVBQ2pCLEdBQUcsS0FBSyxFQUM2QztJQUNyRCxPQUFPLENBQ0wsQ0FBQyxrQkFBa0IsQ0FBQyxJQUFJLENBQ3RCLFNBQVMsQ0FBQyxXQUFXLENBQ3JCLFVBQVUsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUN2QixXQUFXLENBQUMsQ0FBQyxXQUFXLENBQUMsQ0FDekIsU0FBUyxDQUFDLENBQUMsSUFBQSxVQUFFLEVBQ1gsZ0tBQWdLLEVBQ2hLLFNBQVMsQ0FDVixDQUFDLENBQ0YsSUFBSSxLQUFLLENBQUMsRUFDVixDQUNILENBQUE7QUFDSCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiXCJ1c2UgY2xpZW50XCJcblxuaW1wb3J0ICogYXMgUmVhY3QgZnJvbSBcInJlYWN0XCJcbmltcG9ydCAqIGFzIFNlcGFyYXRvclByaW1pdGl2ZSBmcm9tIFwiQHJhZGl4LXVpL3JlYWN0LXNlcGFyYXRvclwiXG5cbmltcG9ydCB7IGNuIH0gZnJvbSBcIkAvbGliL3V0aWxzXCJcblxuZnVuY3Rpb24gU2VwYXJhdG9yKHtcbiAgY2xhc3NOYW1lLFxuICBvcmllbnRhdGlvbiA9IFwiaG9yaXpvbnRhbFwiLFxuICBkZWNvcmF0aXZlID0gdHJ1ZSxcbiAgLi4ucHJvcHNcbn06IFJlYWN0LkNvbXBvbmVudFByb3BzPHR5cGVvZiBTZXBhcmF0b3JQcmltaXRpdmUuUm9vdD4pIHtcbiAgcmV0dXJuIChcbiAgICA8U2VwYXJhdG9yUHJpbWl0aXZlLlJvb3RcbiAgICAgIGRhdGEtc2xvdD1cInNlcGFyYXRvclwiXG4gICAgICBkZWNvcmF0aXZlPXtkZWNvcmF0aXZlfVxuICAgICAgb3JpZW50YXRpb249e29yaWVudGF0aW9ufVxuICAgICAgY2xhc3NOYW1lPXtjbihcbiAgICAgICAgXCJiZy1ib3JkZXIgc2hyaW5rLTAgZGF0YS1bb3JpZW50YXRpb249aG9yaXpvbnRhbF06aC1weCBkYXRhLVtvcmllbnRhdGlvbj1ob3Jpem9udGFsXTp3LWZ1bGwgZGF0YS1bb3JpZW50YXRpb249dmVydGljYWxdOmgtZnVsbCBkYXRhLVtvcmllbnRhdGlvbj12ZXJ0aWNhbF06dy1weFwiLFxuICAgICAgICBjbGFzc05hbWVcbiAgICAgICl9XG4gICAgICB7Li4ucHJvcHN9XG4gICAgLz5cbiAgKVxufVxuXG5leHBvcnQgeyBTZXBhcmF0b3IgfVxuIl19