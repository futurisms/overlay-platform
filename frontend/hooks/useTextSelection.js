"use client";
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useTextSelection = useTextSelection;
const react_1 = require("react");
function useTextSelection() {
    const getSelectedText = (0, react_1.useCallback)(() => {
        const selection = window.getSelection();
        return selection?.toString().trim() || "";
    }, []);
    const clearSelection = (0, react_1.useCallback)(() => {
        window.getSelection()?.removeAllRanges();
    }, []);
    return {
        getSelectedText,
        clearSelection,
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXNlVGV4dFNlbGVjdGlvbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInVzZVRleHRTZWxlY3Rpb24udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsWUFBWSxDQUFDOzs7QUFJYiw0Q0FjQztBQWhCRCxpQ0FBb0M7QUFFcEMsU0FBZ0IsZ0JBQWdCO0lBQzlCLE1BQU0sZUFBZSxHQUFHLElBQUEsbUJBQVcsRUFBQyxHQUFHLEVBQUU7UUFDdkMsTUFBTSxTQUFTLEdBQUcsTUFBTSxDQUFDLFlBQVksRUFBRSxDQUFDO1FBQ3hDLE9BQU8sU0FBUyxFQUFFLFFBQVEsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsQ0FBQztJQUM1QyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUM7SUFFUCxNQUFNLGNBQWMsR0FBRyxJQUFBLG1CQUFXLEVBQUMsR0FBRyxFQUFFO1FBQ3RDLE1BQU0sQ0FBQyxZQUFZLEVBQUUsRUFBRSxlQUFlLEVBQUUsQ0FBQztJQUMzQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUM7SUFFUCxPQUFPO1FBQ0wsZUFBZTtRQUNmLGNBQWM7S0FDZixDQUFDO0FBQ0osQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIlwidXNlIGNsaWVudFwiO1xuXG5pbXBvcnQgeyB1c2VDYWxsYmFjayB9IGZyb20gXCJyZWFjdFwiO1xuXG5leHBvcnQgZnVuY3Rpb24gdXNlVGV4dFNlbGVjdGlvbigpIHtcbiAgY29uc3QgZ2V0U2VsZWN0ZWRUZXh0ID0gdXNlQ2FsbGJhY2soKCkgPT4ge1xuICAgIGNvbnN0IHNlbGVjdGlvbiA9IHdpbmRvdy5nZXRTZWxlY3Rpb24oKTtcbiAgICByZXR1cm4gc2VsZWN0aW9uPy50b1N0cmluZygpLnRyaW0oKSB8fCBcIlwiO1xuICB9LCBbXSk7XG5cbiAgY29uc3QgY2xlYXJTZWxlY3Rpb24gPSB1c2VDYWxsYmFjaygoKSA9PiB7XG4gICAgd2luZG93LmdldFNlbGVjdGlvbigpPy5yZW1vdmVBbGxSYW5nZXMoKTtcbiAgfSwgW10pO1xuXG4gIHJldHVybiB7XG4gICAgZ2V0U2VsZWN0ZWRUZXh0LFxuICAgIGNsZWFyU2VsZWN0aW9uLFxuICB9O1xufVxuIl19