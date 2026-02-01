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
exports.Input = Input;
const React = __importStar(require("react"));
const utils_1 = require("@/lib/utils");
function Input({ className, type, ...props }) {
    return (<input type={type} data-slot="input" className={(0, utils_1.cn)("file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm", "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]", "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive", className)} {...props}/>);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5wdXQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJpbnB1dC50c3giXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFvQlMsc0JBQUs7QUFwQmQsNkNBQThCO0FBRTlCLHVDQUFnQztBQUVoQyxTQUFTLEtBQUssQ0FBQyxFQUFFLFNBQVMsRUFBRSxJQUFJLEVBQUUsR0FBRyxLQUFLLEVBQWlDO0lBQ3pFLE9BQU8sQ0FDTCxDQUFDLEtBQUssQ0FDSixJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FDWCxTQUFTLENBQUMsT0FBTyxDQUNqQixTQUFTLENBQUMsQ0FBQyxJQUFBLFVBQUUsRUFDWCw0YkFBNGIsRUFDNWIsK0VBQStFLEVBQy9FLHdHQUF3RyxFQUN4RyxTQUFTLENBQ1YsQ0FBQyxDQUNGLElBQUksS0FBSyxDQUFDLEVBQ1YsQ0FDSCxDQUFBO0FBQ0gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIFJlYWN0IGZyb20gXCJyZWFjdFwiXG5cbmltcG9ydCB7IGNuIH0gZnJvbSBcIkAvbGliL3V0aWxzXCJcblxuZnVuY3Rpb24gSW5wdXQoeyBjbGFzc05hbWUsIHR5cGUsIC4uLnByb3BzIH06IFJlYWN0LkNvbXBvbmVudFByb3BzPFwiaW5wdXRcIj4pIHtcbiAgcmV0dXJuIChcbiAgICA8aW5wdXRcbiAgICAgIHR5cGU9e3R5cGV9XG4gICAgICBkYXRhLXNsb3Q9XCJpbnB1dFwiXG4gICAgICBjbGFzc05hbWU9e2NuKFxuICAgICAgICBcImZpbGU6dGV4dC1mb3JlZ3JvdW5kIHBsYWNlaG9sZGVyOnRleHQtbXV0ZWQtZm9yZWdyb3VuZCBzZWxlY3Rpb246YmctcHJpbWFyeSBzZWxlY3Rpb246dGV4dC1wcmltYXJ5LWZvcmVncm91bmQgZGFyazpiZy1pbnB1dC8zMCBib3JkZXItaW5wdXQgaC05IHctZnVsbCBtaW4tdy0wIHJvdW5kZWQtbWQgYm9yZGVyIGJnLXRyYW5zcGFyZW50IHB4LTMgcHktMSB0ZXh0LWJhc2Ugc2hhZG93LXhzIHRyYW5zaXRpb24tW2NvbG9yLGJveC1zaGFkb3ddIG91dGxpbmUtbm9uZSBmaWxlOmlubGluZS1mbGV4IGZpbGU6aC03IGZpbGU6Ym9yZGVyLTAgZmlsZTpiZy10cmFuc3BhcmVudCBmaWxlOnRleHQtc20gZmlsZTpmb250LW1lZGl1bSBkaXNhYmxlZDpwb2ludGVyLWV2ZW50cy1ub25lIGRpc2FibGVkOmN1cnNvci1ub3QtYWxsb3dlZCBkaXNhYmxlZDpvcGFjaXR5LTUwIG1kOnRleHQtc21cIixcbiAgICAgICAgXCJmb2N1cy12aXNpYmxlOmJvcmRlci1yaW5nIGZvY3VzLXZpc2libGU6cmluZy1yaW5nLzUwIGZvY3VzLXZpc2libGU6cmluZy1bM3B4XVwiLFxuICAgICAgICBcImFyaWEtaW52YWxpZDpyaW5nLWRlc3RydWN0aXZlLzIwIGRhcms6YXJpYS1pbnZhbGlkOnJpbmctZGVzdHJ1Y3RpdmUvNDAgYXJpYS1pbnZhbGlkOmJvcmRlci1kZXN0cnVjdGl2ZVwiLFxuICAgICAgICBjbGFzc05hbWVcbiAgICAgICl9XG4gICAgICB7Li4ucHJvcHN9XG4gICAgLz5cbiAgKVxufVxuXG5leHBvcnQgeyBJbnB1dCB9XG4iXX0=