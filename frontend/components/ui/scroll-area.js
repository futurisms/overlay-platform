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
exports.ScrollArea = ScrollArea;
exports.ScrollBar = ScrollBar;
const React = __importStar(require("react"));
const ScrollAreaPrimitive = __importStar(require("@radix-ui/react-scroll-area"));
const utils_1 = require("@/lib/utils");
function ScrollArea({ className, children, ...props }) {
    return (<ScrollAreaPrimitive.Root data-slot="scroll-area" className={(0, utils_1.cn)("relative", className)} {...props}>
      <ScrollAreaPrimitive.Viewport data-slot="scroll-area-viewport" className="focus-visible:ring-ring/50 size-full rounded-[inherit] transition-[color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:outline-1">
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollBar />
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>);
}
function ScrollBar({ className, orientation = "vertical", ...props }) {
    return (<ScrollAreaPrimitive.ScrollAreaScrollbar data-slot="scroll-area-scrollbar" orientation={orientation} className={(0, utils_1.cn)("flex touch-none p-px transition-colors select-none", orientation === "vertical" &&
            "h-full w-2.5 border-l border-l-transparent", orientation === "horizontal" &&
            "h-2.5 flex-col border-t border-t-transparent", className)} {...props}>
      <ScrollAreaPrimitive.ScrollAreaThumb data-slot="scroll-area-thumb" className="bg-border relative flex-1 rounded-full"/>
    </ScrollAreaPrimitive.ScrollAreaScrollbar>);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2Nyb2xsLWFyZWEuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJzY3JvbGwtYXJlYS50c3giXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsWUFBWSxDQUFBOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUF5REgsZ0NBQVU7QUFBRSw4QkFBUztBQXZEOUIsNkNBQThCO0FBQzlCLGlGQUFrRTtBQUVsRSx1Q0FBZ0M7QUFFaEMsU0FBUyxVQUFVLENBQUMsRUFDbEIsU0FBUyxFQUNULFFBQVEsRUFDUixHQUFHLEtBQUssRUFDOEM7SUFDdEQsT0FBTyxDQUNMLENBQUMsbUJBQW1CLENBQUMsSUFBSSxDQUN2QixTQUFTLENBQUMsYUFBYSxDQUN2QixTQUFTLENBQUMsQ0FBQyxJQUFBLFVBQUUsRUFBQyxVQUFVLEVBQUUsU0FBUyxDQUFDLENBQUMsQ0FDckMsSUFBSSxLQUFLLENBQUMsQ0FFVjtNQUFBLENBQUMsbUJBQW1CLENBQUMsUUFBUSxDQUMzQixTQUFTLENBQUMsc0JBQXNCLENBQ2hDLFNBQVMsQ0FBQyxvSkFBb0osQ0FFOUo7UUFBQSxDQUFDLFFBQVEsQ0FDWDtNQUFBLEVBQUUsbUJBQW1CLENBQUMsUUFBUSxDQUM5QjtNQUFBLENBQUMsU0FBUyxDQUFDLEFBQUQsRUFDVjtNQUFBLENBQUMsbUJBQW1CLENBQUMsTUFBTSxDQUFDLEFBQUQsRUFDN0I7SUFBQSxFQUFFLG1CQUFtQixDQUFDLElBQUksQ0FBQyxDQUM1QixDQUFBO0FBQ0gsQ0FBQztBQUVELFNBQVMsU0FBUyxDQUFDLEVBQ2pCLFNBQVMsRUFDVCxXQUFXLEdBQUcsVUFBVSxFQUN4QixHQUFHLEtBQUssRUFDNkQ7SUFDckUsT0FBTyxDQUNMLENBQUMsbUJBQW1CLENBQUMsbUJBQW1CLENBQ3RDLFNBQVMsQ0FBQyx1QkFBdUIsQ0FDakMsV0FBVyxDQUFDLENBQUMsV0FBVyxDQUFDLENBQ3pCLFNBQVMsQ0FBQyxDQUFDLElBQUEsVUFBRSxFQUNYLG9EQUFvRCxFQUNwRCxXQUFXLEtBQUssVUFBVTtZQUN4Qiw0Q0FBNEMsRUFDOUMsV0FBVyxLQUFLLFlBQVk7WUFDMUIsOENBQThDLEVBQ2hELFNBQVMsQ0FDVixDQUFDLENBQ0YsSUFBSSxLQUFLLENBQUMsQ0FFVjtNQUFBLENBQUMsbUJBQW1CLENBQUMsZUFBZSxDQUNsQyxTQUFTLENBQUMsbUJBQW1CLENBQzdCLFNBQVMsQ0FBQyx3Q0FBd0MsRUFFdEQ7SUFBQSxFQUFFLG1CQUFtQixDQUFDLG1CQUFtQixDQUFDLENBQzNDLENBQUE7QUFDSCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiXCJ1c2UgY2xpZW50XCJcblxuaW1wb3J0ICogYXMgUmVhY3QgZnJvbSBcInJlYWN0XCJcbmltcG9ydCAqIGFzIFNjcm9sbEFyZWFQcmltaXRpdmUgZnJvbSBcIkByYWRpeC11aS9yZWFjdC1zY3JvbGwtYXJlYVwiXG5cbmltcG9ydCB7IGNuIH0gZnJvbSBcIkAvbGliL3V0aWxzXCJcblxuZnVuY3Rpb24gU2Nyb2xsQXJlYSh7XG4gIGNsYXNzTmFtZSxcbiAgY2hpbGRyZW4sXG4gIC4uLnByb3BzXG59OiBSZWFjdC5Db21wb25lbnRQcm9wczx0eXBlb2YgU2Nyb2xsQXJlYVByaW1pdGl2ZS5Sb290Pikge1xuICByZXR1cm4gKFxuICAgIDxTY3JvbGxBcmVhUHJpbWl0aXZlLlJvb3RcbiAgICAgIGRhdGEtc2xvdD1cInNjcm9sbC1hcmVhXCJcbiAgICAgIGNsYXNzTmFtZT17Y24oXCJyZWxhdGl2ZVwiLCBjbGFzc05hbWUpfVxuICAgICAgey4uLnByb3BzfVxuICAgID5cbiAgICAgIDxTY3JvbGxBcmVhUHJpbWl0aXZlLlZpZXdwb3J0XG4gICAgICAgIGRhdGEtc2xvdD1cInNjcm9sbC1hcmVhLXZpZXdwb3J0XCJcbiAgICAgICAgY2xhc3NOYW1lPVwiZm9jdXMtdmlzaWJsZTpyaW5nLXJpbmcvNTAgc2l6ZS1mdWxsIHJvdW5kZWQtW2luaGVyaXRdIHRyYW5zaXRpb24tW2NvbG9yLGJveC1zaGFkb3ddIG91dGxpbmUtbm9uZSBmb2N1cy12aXNpYmxlOnJpbmctWzNweF0gZm9jdXMtdmlzaWJsZTpvdXRsaW5lLTFcIlxuICAgICAgPlxuICAgICAgICB7Y2hpbGRyZW59XG4gICAgICA8L1Njcm9sbEFyZWFQcmltaXRpdmUuVmlld3BvcnQ+XG4gICAgICA8U2Nyb2xsQmFyIC8+XG4gICAgICA8U2Nyb2xsQXJlYVByaW1pdGl2ZS5Db3JuZXIgLz5cbiAgICA8L1Njcm9sbEFyZWFQcmltaXRpdmUuUm9vdD5cbiAgKVxufVxuXG5mdW5jdGlvbiBTY3JvbGxCYXIoe1xuICBjbGFzc05hbWUsXG4gIG9yaWVudGF0aW9uID0gXCJ2ZXJ0aWNhbFwiLFxuICAuLi5wcm9wc1xufTogUmVhY3QuQ29tcG9uZW50UHJvcHM8dHlwZW9mIFNjcm9sbEFyZWFQcmltaXRpdmUuU2Nyb2xsQXJlYVNjcm9sbGJhcj4pIHtcbiAgcmV0dXJuIChcbiAgICA8U2Nyb2xsQXJlYVByaW1pdGl2ZS5TY3JvbGxBcmVhU2Nyb2xsYmFyXG4gICAgICBkYXRhLXNsb3Q9XCJzY3JvbGwtYXJlYS1zY3JvbGxiYXJcIlxuICAgICAgb3JpZW50YXRpb249e29yaWVudGF0aW9ufVxuICAgICAgY2xhc3NOYW1lPXtjbihcbiAgICAgICAgXCJmbGV4IHRvdWNoLW5vbmUgcC1weCB0cmFuc2l0aW9uLWNvbG9ycyBzZWxlY3Qtbm9uZVwiLFxuICAgICAgICBvcmllbnRhdGlvbiA9PT0gXCJ2ZXJ0aWNhbFwiICYmXG4gICAgICAgICAgXCJoLWZ1bGwgdy0yLjUgYm9yZGVyLWwgYm9yZGVyLWwtdHJhbnNwYXJlbnRcIixcbiAgICAgICAgb3JpZW50YXRpb24gPT09IFwiaG9yaXpvbnRhbFwiICYmXG4gICAgICAgICAgXCJoLTIuNSBmbGV4LWNvbCBib3JkZXItdCBib3JkZXItdC10cmFuc3BhcmVudFwiLFxuICAgICAgICBjbGFzc05hbWVcbiAgICAgICl9XG4gICAgICB7Li4ucHJvcHN9XG4gICAgPlxuICAgICAgPFNjcm9sbEFyZWFQcmltaXRpdmUuU2Nyb2xsQXJlYVRodW1iXG4gICAgICAgIGRhdGEtc2xvdD1cInNjcm9sbC1hcmVhLXRodW1iXCJcbiAgICAgICAgY2xhc3NOYW1lPVwiYmctYm9yZGVyIHJlbGF0aXZlIGZsZXgtMSByb3VuZGVkLWZ1bGxcIlxuICAgICAgLz5cbiAgICA8L1Njcm9sbEFyZWFQcmltaXRpdmUuU2Nyb2xsQXJlYVNjcm9sbGJhcj5cbiAgKVxufVxuXG5leHBvcnQgeyBTY3JvbGxBcmVhLCBTY3JvbGxCYXIgfVxuIl19