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
exports.Dialog = Dialog;
exports.DialogClose = DialogClose;
exports.DialogContent = DialogContent;
exports.DialogDescription = DialogDescription;
exports.DialogFooter = DialogFooter;
exports.DialogHeader = DialogHeader;
exports.DialogOverlay = DialogOverlay;
exports.DialogPortal = DialogPortal;
exports.DialogTitle = DialogTitle;
exports.DialogTrigger = DialogTrigger;
const React = __importStar(require("react"));
const DialogPrimitive = __importStar(require("@radix-ui/react-dialog"));
const lucide_react_1 = require("lucide-react");
const utils_1 = require("@/lib/utils");
const button_1 = require("@/components/ui/button");
function Dialog({ ...props }) {
    return <DialogPrimitive.Root data-slot="dialog" {...props}/>;
}
function DialogTrigger({ ...props }) {
    return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props}/>;
}
function DialogPortal({ ...props }) {
    return <DialogPrimitive.Portal data-slot="dialog-portal" {...props}/>;
}
function DialogClose({ ...props }) {
    return <DialogPrimitive.Close data-slot="dialog-close" {...props}/>;
}
function DialogOverlay({ className, ...props }) {
    return (<DialogPrimitive.Overlay data-slot="dialog-overlay" className={(0, utils_1.cn)("data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50", className)} {...props}/>);
}
function DialogContent({ className, children, showCloseButton = true, ...props }) {
    return (<DialogPortal data-slot="dialog-portal">
      <DialogOverlay />
      <DialogPrimitive.Content data-slot="dialog-content" className={(0, utils_1.cn)("bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border p-6 shadow-lg duration-200 outline-none sm:max-w-lg", className)} {...props}>
        {children}
        {showCloseButton && (<DialogPrimitive.Close data-slot="dialog-close" className="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4">
            <lucide_react_1.XIcon />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>)}
      </DialogPrimitive.Content>
    </DialogPortal>);
}
function DialogHeader({ className, ...props }) {
    return (<div data-slot="dialog-header" className={(0, utils_1.cn)("flex flex-col gap-2 text-center sm:text-left", className)} {...props}/>);
}
function DialogFooter({ className, showCloseButton = false, children, ...props }) {
    return (<div data-slot="dialog-footer" className={(0, utils_1.cn)("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)} {...props}>
      {children}
      {showCloseButton && (<DialogPrimitive.Close asChild>
          <button_1.Button variant="outline">Close</button_1.Button>
        </DialogPrimitive.Close>)}
    </div>);
}
function DialogTitle({ className, ...props }) {
    return (<DialogPrimitive.Title data-slot="dialog-title" className={(0, utils_1.cn)("text-lg leading-none font-semibold", className)} {...props}/>);
}
function DialogDescription({ className, ...props }) {
    return (<DialogPrimitive.Description data-slot="dialog-description" className={(0, utils_1.cn)("text-muted-foreground text-sm", className)} {...props}/>);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGlhbG9nLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiZGlhbG9nLnRzeCJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxZQUFZLENBQUE7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQW1KVix3QkFBTTtBQUNOLGtDQUFXO0FBQ1gsc0NBQWE7QUFDYiw4Q0FBaUI7QUFDakIsb0NBQVk7QUFDWixvQ0FBWTtBQUNaLHNDQUFhO0FBQ2Isb0NBQVk7QUFDWixrQ0FBVztBQUNYLHNDQUFhO0FBMUpmLDZDQUE4QjtBQUM5Qix3RUFBeUQ7QUFDekQsK0NBQW9DO0FBRXBDLHVDQUFnQztBQUNoQyxtREFBK0M7QUFFL0MsU0FBUyxNQUFNLENBQUMsRUFDZCxHQUFHLEtBQUssRUFDMEM7SUFDbEQsT0FBTyxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxJQUFJLEtBQUssQ0FBQyxFQUFHLENBQUE7QUFDL0QsQ0FBQztBQUVELFNBQVMsYUFBYSxDQUFDLEVBQ3JCLEdBQUcsS0FBSyxFQUM2QztJQUNyRCxPQUFPLENBQUMsZUFBZSxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxLQUFLLENBQUMsRUFBRyxDQUFBO0FBQzFFLENBQUM7QUFFRCxTQUFTLFlBQVksQ0FBQyxFQUNwQixHQUFHLEtBQUssRUFDNEM7SUFDcEQsT0FBTyxDQUFDLGVBQWUsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLGVBQWUsQ0FBQyxJQUFJLEtBQUssQ0FBQyxFQUFHLENBQUE7QUFDeEUsQ0FBQztBQUVELFNBQVMsV0FBVyxDQUFDLEVBQ25CLEdBQUcsS0FBSyxFQUMyQztJQUNuRCxPQUFPLENBQUMsZUFBZSxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsY0FBYyxDQUFDLElBQUksS0FBSyxDQUFDLEVBQUcsQ0FBQTtBQUN0RSxDQUFDO0FBRUQsU0FBUyxhQUFhLENBQUMsRUFDckIsU0FBUyxFQUNULEdB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LElBQUEsVUFBRSxFQUFDLCtCQUErQixFQUFFLFNBQVMsQ0FBQyxDQUFDLENBQzFELElBQUksS0FBSyxDQUFDLEVBQ1YsQ0FDSCxDQUFBO0FBQ0gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIlwidXNlIGNsaWVudFwiXG5cbmltcG9ydCAqIGFzIFJlYWN0IGZyb20gXCJyZWFjdFwiXG5pbXBvcnQgKiBhcyBEaWFsb2dQcmltaXRpdmUgZnJvbSBcIkByYWRpeC11aS9yZWFjdC1kaWFsb2dcIlxuaW1wb3J0IHsgWEljb24gfSBmcm9tIFwibHVjaWRlLXJlYWN0XCJcblxuaW1wb3J0IHsgY24gfSBmcm9tIFwiQC9saWIvdXRpbHNcIlxuaW1wb3J0IHsgQnV0dG9uIH0gZnJvbSBcIkAvY29tcG9uZW50cy91aS9idXR0b25cIlxuXG5mdW5jdGlvbiBEaWFsb2coe1xuICAuLi5wcm9wc1xufTogUmVhY3QuQ29tcG9uZW50UHJvcHM8dHlwZW9mIERpYWxvZ1ByaW1pdGl2ZS5Sb290Pikge1xuICByZXR1cm4gPERpYWxvZ1ByaW1pdGl2ZS5Sb290IGRhdGEtc2xvdD1cImRpYWxvZ1wiIHsuLi5wcm9wc30gLz5cbn1cblxuZnVuY3Rpb24gRGlhbG9nVHJpZ2dlcih7XG4gIC4uLnByb3BzXG59OiBSZWFjdC5Db21wb25lbnRQcm9wczx0eXBlb2YgRGlhbG9nUHJpbWl0aXZlLlRyaWdnZXI+KSB7XG4gIHJldHVybiA8RGlhbG9nUHJpbWl0aXZlLlRyaWdnZXIgZGF0YS1zbG90PVwiZGlhbG9nLXRyaWdnZXJcIiB7Li4ucHJvcHN9IC8+XG59XG5cbmZ1bmN0aW9uIERpYWxvZ1BvcnRhbCh7XG4gIC4uLnByb3BzXG59OiBSZWFjdC5Db21wb25lbnRQcm9wczx0eXBlb2YgRGlhbG9nUHJpbWl0aXZlLlBvcnRhbD4pIHtcbiAgcmV0dXJuIDxEaWFsb2dQcmltaXRpdmUuUG9ydGFsIGRhdGEtc2xvdD1cImRpYWxvZy1wb3J0YWxcIiB7Li4ucHJvcHN9IC8+XG59XG5cbmZ1bmN0aW9uIERpYWxvZ0Nsb3NlKHtcbiAgLi4ucHJvcHNcbn06IFJlYWN0LkNvbXBvbmVudFByb3BzPHR5cGVvZiBEaWFsb2dQcmltaXRpdmUuQ2xvc2U+KSB7XG4gIHJldHVybiA8RGlhbG9nUHJpbWl0aXZlLkNsb3NlIGRhdGEtc2xvdD1cImRpYWxvZy1jbG9zZVwiIHsuLi5wcm9wc30gLz5cbn1cblxuZnVuY3Rpb24gRGlhbG9nT3ZlcmxheSh7XG4gIGNsYXNzTmFtZSxcbiAgLi4ucHJvcHNcbn06IFJlYWN0LkNvbXBvbmVudFByb3BzPHR5cGVvZiBEaWFsb2dQcmltaXRpdmUuT3ZlcmxheT4pIHtcbiAgcmV0dXJuIChcbiAgICA8RGlhbG9nUHJpbWl0aXZlLk92ZXJsYXlcbiAgICAgIGRhdGEtc2xvdD1cImRpYWxvZy1vdmVybGF5XCJcbiAgICAgIGNsYXNzTmFtZT17Y24oXG4gICAgICAgIFwiZGF0YS1bc3RhdGU9b3Blbl06YW5pbWF0ZS1pbiBkYXRhLVtzdGF0ZT1jbG9zZWRdOmFuaW1hdGUtb3V0IGRhdGEtW3N0YXRlPWNsb3NlZF06ZmFkZS1vdXQtMCBkYXRhLVtzdGF0ZT1vcGVuXTpmYWRlLWluLTAgZml4ZWQgaW5zZXQtMCB6LTUwIGJnLWJsYWNrLzUwXCIsXG4gICAgICAgIGNsYXNzTmFtZVxuICAgICAgKX1cbiAgICAgIHsuLi5wcm9wc31cbiAgICAvPlxuICApXG59XG5cbmZ1bmN0aW9uIERpYWxvZ0NvbnRlbnQoe1xuICBjbGFzc05hbWUsXG4gIGNoaWxkcmVuLFxuICBzaG93Q2xvc2VCdXR0b24gPSB0cnVlLFxuICAuLi5wcm9wc1xufTogUmVhY3QuQ29tcG9uZW50UHJvcHM8dHlwZW9mIERpYWxvZ1ByaW1pdGl2ZS5Db250ZW50PiAmIHtcbiAgc2hvd0Nsb3NlQnV0dG9uPzogYm9vbGVhblxufSkge1xuICByZXR1cm4gKFxuICAgIDxEaWFsb2dQb3J0YWwgZGF0YS1zbG90PVwiZGlhbG9nLXBvcnRhbFwiPlxuICAgICAgPERpYWxvZ092ZXJsYXkgLz5cbiAgICAgIDxEaWFsb2dQcmltaXRpdmUuQ29udGVudFxuICAgICAgICBkYXRhLXNsb3Q9XCJkaWFsb2ctY29udGVudFwiXG4gICAgICAgIGNsYXNzTmFtZT17Y24oXG4gICAgICAgICAgXCJiZy1iYWNrZ3JvdW5kIGRhdGEtW3N0YXRlPW9wZW5dOmFuaW1hdGUtaW4gZGF0YS1bc3RhdGU9Y2xvc2VkXTphbmltYXRlLW91dCBkYXRhLVtzdGF0ZT1jbG9zZWRdOmZhZGUtb3V0LTAgZGF0YS1bc3RhdGU9b3Blbl06ZmFkZS1pbi0wIGRhdGEtW3N0YXRlPWNsb3NlZF06em9vbS1vdXQtOTUgZGF0YS1bc3RhdGU9b3Blbl06em9vbS1pbi05NSBmaXhlZCB0b3AtWzUwJV0gbGVmdC1bNTAlXSB6LTUwIGdyaWQgdy1mdWxsIG1heC13LVtjYWxjKDEwMCUtMnJlbSldIHRyYW5zbGF0ZS14LVstNTAlXSB0cmFuc2xhdGUteS1bLTUwJV0gZ2FwLTQgcm91bmRlZC1sZyBib3JkZXIgcC02IHNoYWRvdy1sZyBkdXJhdGlvbi0yMDAgb3V0bGluZS1ub25lIHNtOm1heC13LWxnXCIsXG4gICAgICAgICAgY2xhc3NOYW1lXG4gICAgICAgICl9XG4gICAgICAgIHsuLi5wcm9wc31cbiAgICAgID5cbiAgICAgICAge2NoaWxkcmVufVxuICAgICAgICB7c2hvd0Nsb3NlQnV0dG9uICYmIChcbiAgICAgICAgICA8RGlhbG9nUHJpbWl0aXZlLkNsb3NlXG4gICAgICAgICAgICBkYXRhLXNsb3Q9XCJkaWFsb2ctY2xvc2VcIlxuICAgICAgICAgICAgY2xhc3NOYW1lPVwicmluZy1vZmZzZXQtYmFja2dyb3VuZCBmb2N1czpyaW5nLXJpbmcgZGF0YS1bc3RhdGU9b3Blbl06YmctYWNjZW50IGRhdGEtW3N0YXRlPW9wZW5dOnRleHQtbXV0ZWQtZm9yZWdyb3VuZCBhYnNvbHV0ZSB0b3AtNCByaWdodC00IHJvdW5kZWQteHMgb3BhY2l0eS03MCB0cmFuc2l0aW9uLW9wYWNpdHkgaG92ZXI6b3BhY2l0eS0xMDAgZm9jdXM6cmluZy0yIGZvY3VzOnJpbmctb2Zmc2V0LTIgZm9jdXM6b3V0bGluZS1oaWRkZW4gZGlzYWJsZWQ6cG9pbnRlci1ldmVudHMtbm9uZSBbJl9zdmddOnBvaW50ZXItZXZlbnRzLW5vbmUgWyZfc3ZnXTpzaHJpbmstMCBbJl9zdmc6bm90KFtjbGFzcyo9J3NpemUtJ10pXTpzaXplLTRcIlxuICAgICAgICAgID5cbiAgICAgICAgICAgIDxYSWNvbiAvPlxuICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwic3Itb25seVwiPkNsb3NlPC9zcGFuPlxuICAgICAgICAgIDwvRGlhbG9nUHJpbWl0aXZlLkNsb3NlPlxuICAgICAgICApfVxuICAgICAgPC9EaWFsb2dQcmltaXRpdmUuQ29udGVudD5cbiAgICA8L0RpYWxvZ1BvcnRhbD5cbiAgKVxufVxuXG5mdW5jdGlvbiBEaWFsb2dIZWFkZXIoeyBjbGFzc05hbWUsIC4uLnByb3BzIH06IFJlYWN0LkNvbXBvbmVudFByb3BzPFwiZGl2XCI+KSB7XG4gIHJldHVybiAoXG4gICAgPGRpdlxuICAgICAgZGF0YS1zbG90PVwiZGlhbG9nLWhlYWRlclwiXG4gICAgICBjbGFzc05hbWU9e2NuKFwiZmxleCBmbGV4LWNvbCBnYXAtMiB0ZXh0LWNlbnRlciBzbTp0ZXh0LWxlZnRcIiwgY2xhc3NOYW1lKX1cbiAgICAgIHsuLi5wcm9wc31cbiAgICAvPlxuICApXG59XG5cbmZ1bmN0aW9uIERpYWxvZ0Zvb3Rlcih7XG4gIGNsYXNzTmFtZSxcbiAgc2hvd0Nsb3NlQnV0dG9uID0gZmFsc2UsXG4gIGNoaWxkcmVuLFxuICAuLi5wcm9wc1xufTogUmVhY3QuQ29tcG9uZW50UHJvcHM8XCJkaXZcIj4gJiB7XG4gIHNob3dDbG9zZUJ1dHRvbj86IGJvb2xlYW5cbn0pIHtcbiAgcmV0dXJuIChcbiAgICA8ZGl2XG4gICAgICBkYXRhLXNsb3Q9XCJkaWFsb2ctZm9vdGVyXCJcbiAgICAgIGNsYXNzTmFtZT17Y24oXG4gICAgICAgIFwiZmxleCBmbGV4LWNvbC1yZXZlcnNlIGdhcC0yIHNtOmZsZXgtcm93IHNtOmp1c3RpZnktZW5kXCIsXG4gICAgICAgIGNsYXNzTmFtZVxuICAgICAgKX1cbiAgICAgIHsuLi5wcm9wc31cbiAgICA+XG4gICAgICB7Y2hpbGRyZW59XG4gICAgICB7c2hvd0Nsb3NlQnV0dG9uICYmIChcbiAgICAgICAgPERpYWxvZ1ByaW1pdGl2ZS5DbG9zZSBhc0NoaWxkPlxuICAgICAgICAgIDxCdXR0b24gdmFyaWFudD1cIm91dGxpbmVcIj5DbG9zZTwvQnV0dG9uPlxuICAgICAgICA8L0RpYWxvZ1ByaW1pdGl2ZS5DbG9zZT5cbiAgICAgICl9XG4gICAgPC9kaXY+XG4gIClcbn1cblxuZnVuY3Rpb24gRGlhbG9nVGl0bGUoe1xuICBjbGFzc05hbWUsXG4gIC4uLnByb3BzXG59OiBSZWFjdC5Db21wb25lbnRQcm9wczx0eXBlb2YgRGlhbG9nUHJpbWl0aXZlLlRpdGxlPikge1xuICByZXR1cm4gKFxuICAgIDxEaWFsb2dQcmltaXRpdmUuVGl0bGVcbiAgICAgIGRhdGEtc2xvdD1cImRpYWxvZy10aXRsZVwiXG4gICAgICBjbGFzc05hbWU9e2NuKFwidGV4dC1sZyBsZWFkaW5nLW5vbmUgZm9udC1zZW1pYm9sZFwiLCBjbGFzc05hbWUpfVxuICAgICAgey4uLnByb3BzfVxuICAgIC8+XG4gIClcbn1cblxuZnVuY3Rpb24gRGlhbG9nRGVzY3JpcHRpb24oe1xuICBjbGFzc05hbWUsXG4gIC4uLnByb3BzXG59OiBSZWFjdC5Db21wb25lbnRQcm9wczx0eXBlb2YgRGlhbG9nUHJpbWl0aXZlLkRlc2NyaXB0aW9uPikge1xuICByZXR1cm4gKFxuICAgIDxEaWFsb2dQcmltaXRpdmUuRGVzY3JpcHRpb25cbiAgICAgIGRhdGEtc2xvdD1cImRpYWxvZy1kZXNjcmlwdGlvblwiXG4gICAgICBjbGFzc05hbWU9e2NuKFwidGV4dC1tdXRlZC1mb3JlZ3JvdW5kIHRleHQtc21cIiwgY2xhc3NOYW1lKX1cbiAgICAgIHsuLi5wcm9wc31cbiAgICAvPlxuICApXG59XG5cbmV4cG9ydCB7XG4gIERpYWxvZyxcbiAgRGlhbG9nQ2xvc2UsXG4gIERpYWxvZ0NvbnRlbnQsXG4gIERpYWxvZ0Rlc2NyaXB0aW9uLFxuICBEaWFsb2dGb290ZXIsXG4gIERpYWxvZ0hlYWRlcixcbiAgRGlhbG9nT3ZlcmxheSxcbiAgRGlhbG9nUG9ydGFsLFxuICBEaWFsb2dUaXRsZSxcbiAgRGlhbG9nVHJpZ2dlcixcbn1cbiJdfQ==