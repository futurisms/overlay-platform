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
exports.Label = Label;
const React = __importStar(require("react"));
const LabelPrimitive = __importStar(require("@radix-ui/react-label"));
const utils_1 = require("@/lib/utils");
function Label({ className, ...props }) {
    return (<LabelPrimitive.Root data-slot="label" className={(0, utils_1.cn)("flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50", className)} {...props}/>);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGFiZWwuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJsYWJlbC50c3giXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsWUFBWSxDQUFBOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUF1Qkgsc0JBQUs7QUFyQmQsNkNBQThCO0FBQzlCLHNFQUF1RDtBQUV2RCx1Q0FBZ0M7QUFFaEMsU0FBUyxLQUFLLENBQUMsRUFDYixTQUFTLEVBQ1QsR0FBRyxLQUFLLEVBQ3lDO0lBQ2pELE9BQU8sQ0FDTCxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQ2xCLFNBQVMsQ0FBQyxPQUFPLENBQ2pCLFNBQVMsQ0FBQyxDQUFDLElBQUEsVUFBRSxFQUNYLHFOQUFxTixFQUNyTixTQUFTLENBQ1YsQ0FBQyxDQUNGLElBQUksS0FBSyxDQUFDLEVBQ1YsQ0FDSCxDQUFBO0FBQ0gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIlwidXNlIGNsaWVudFwiXG5cbmltcG9ydCAqIGFzIFJlYWN0IGZyb20gXCJyZWFjdFwiXG5pbXBvcnQgKiBhcyBMYWJlbFByaW1pdGl2ZSBmcm9tIFwiQHJhZGl4LXVpL3JlYWN0LWxhYmVsXCJcblxuaW1wb3J0IHsgY24gfSBmcm9tIFwiQC9saWIvdXRpbHNcIlxuXG5mdW5jdGlvbiBMYWJlbCh7XG4gIGNsYXNzTmFtZSxcbiAgLi4ucHJvcHNcbn06IFJlYWN0LkNvbXBvbmVudFByb3BzPHR5cGVvZiBMYWJlbFByaW1pdGl2ZS5Sb290Pikge1xuICByZXR1cm4gKFxuICAgIDxMYWJlbFByaW1pdGl2ZS5Sb290XG4gICAgICBkYXRhLXNsb3Q9XCJsYWJlbFwiXG4gICAgICBjbGFzc05hbWU9e2NuKFxuICAgICAgICBcImZsZXggaXRlbXMtY2VudGVyIGdhcC0yIHRleHQtc20gbGVhZGluZy1ub25lIGZvbnQtbWVkaXVtIHNlbGVjdC1ub25lIGdyb3VwLWRhdGEtW2Rpc2FibGVkPXRydWVdOnBvaW50ZXItZXZlbnRzLW5vbmUgZ3JvdXAtZGF0YS1bZGlzYWJsZWQ9dHJ1ZV06b3BhY2l0eS01MCBwZWVyLWRpc2FibGVkOmN1cnNvci1ub3QtYWxsb3dlZCBwZWVyLWRpc2FibGVkOm9wYWNpdHktNTBcIixcbiAgICAgICAgY2xhc3NOYW1lXG4gICAgICApfVxuICAgICAgey4uLnByb3BzfVxuICAgIC8+XG4gIClcbn1cblxuZXhwb3J0IHsgTGFiZWwgfVxuIl19