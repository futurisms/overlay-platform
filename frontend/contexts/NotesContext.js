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
exports.NotesProvider = NotesProvider;
exports.useNotesContext = useNotesContext;
const react_1 = __importStar(require("react"));
const NotesContext = (0, react_1.createContext)(undefined);
const STORAGE_KEY = "overlay-notes-content";
function NotesProvider({ children }) {
    const [content, setContentState] = (0, react_1.useState)("");
    const [isHydrated, setIsHydrated] = (0, react_1.useState)(false);
    // Load from localStorage on mount
    (0, react_1.useEffect)(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            setContentState(saved);
        }
        setIsHydrated(true);
    }, []);
    // Save to localStorage whenever content changes
    const setContent = (newContent) => {
        setContentState(newContent);
        if (isHydrated) {
            localStorage.setItem(STORAGE_KEY, newContent);
        }
    };
    // Append selected text to notes
    const addToNotes = (text) => {
        const trimmedText = text.trim();
        if (!trimmedText)
            return;
        const newContent = content
            ? `${content}\n\n• ${trimmedText}`
            : `• ${trimmedText}`;
        setContent(newContent);
    };
    const characterCount = content.length;
    return (<NotesContext.Provider value={{ content, setContent, addToNotes, characterCount }}>
      {children}
    </NotesContext.Provider>);
}
function useNotesContext() {
    const context = (0, react_1.useContext)(NotesContext);
    if (context === undefined) {
        throw new Error("useNotesContext must be used within a NotesProvider");
    }
    return context;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiTm90ZXNDb250ZXh0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiTm90ZXNDb250ZXh0LnRzeCJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxZQUFZLENBQUM7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQWViLHNDQXdDQztBQUVELDBDQU1DO0FBN0RELCtDQUF5RjtBQVN6RixNQUFNLFlBQVksR0FBRyxJQUFBLHFCQUFhLEVBQStCLFNBQVMsQ0FBQyxDQUFDO0FBRTVFLE1BQU0sV0FBVyxHQUFHLHVCQUF1QixDQUFDO0FBRTVDLFNBQWdCLGFBQWEsQ0FBQyxFQUFFLFFBQVEsRUFBMkI7SUFDakUsTUFBTSxDQUFDLE9BQU8sRUFBRSxlQUFlLENBQUMsR0FBRyxJQUFBLGdCQUFRLEVBQVMsRUFBRSxDQUFDLENBQUM7SUFDeEQsTUFBTSxDQUFDLFVBQVUsRUFBRSxhQUFhLENBQUMsR0FBRyxJQUFBLGdCQUFRLEVBQUMsS0FBSyxDQUFDLENBQUM7SUFFcEQsa0NBQWtDO0lBQ2xDLElBQUEsaUJBQVMsRUFBQyxHQUFHLEVBQUU7UUFDYixNQUFNLEtBQUssR0FBRyxZQUFZLENBQUMsT0FBTyxDQUFDLFdBQVcsQ0FBQyxDQUFDO1FBQ2hELElBQUksS0FBSyxFQUFFLENBQUM7WUFDVixlQUFlLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDekIsQ0FBQztRQUNELGFBQWEsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUN0QixDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUM7SUFFUCxnREFBZ0Q7SUFDaEQsTUFBTSxVQUFVLEdBQUcsQ0FBQyxVQUFrQixFQUFFLEVBQUU7UUFDeEMsZUFBZSxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQzVCLElBQUksVUFBVSxFQUFFLENBQUM7WUFDZixZQUFZLENBQUMsT0FBTyxDQUFDLFdBQVcsRUFBRSxVQUFVLENBQUMsQ0FBQztRQUNoRCxDQUFDO0lBQ0gsQ0FBQyxDQUFDO0lBRUYsZ0NBQWdDO0lBQ2hDLE1BQU0sVUFBVSxHQUFHLENBQUMsSUFBWSxFQUFFLEVBQUU7UUFDbEMsTUFBTSxXQUFXLEdBQUcsSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDO1FBQ2hDLElBQUksQ0FBQyxXQUFXO1lBQUUsT0FBTztRQUV6QixNQUFNLFVBQVUsR0FBRyxPQUFPO1lBQ3hCLENBQUMsQ0FBQyxHQUFHLE9BQU8sU0FBUyxXQUFXLEVBQUU7WUFDbEMsQ0FBQyxDQUFDLEtBQUssV0FBVyxFQUFFLENBQUM7UUFFdkIsVUFBVSxDQUFDLFVBQVUsQ0FBQyxDQUFDO0lBQ3pCLENBQUMsQ0FBQztJQUVGLE1BQU0sY0FBYyxHQUFHLE9BQU8sQ0FBQyxNQUFNLENBQUM7SUFFdEMsT0FBTyxDQUNMLENBQUMsWUFBWSxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLE9BQU8sRUFBRSxVQUFVLEVBQUUsVUFBVSxFQUFFLGNBQWMsRUFBRSxDQUFDLENBQ2hGO01BQUEsQ0FBQyxRQUFRLENBQ1g7SUFBQSxFQUFFLFlBQVksQ0FBQyxRQUFRLENBQUMsQ0FDekIsQ0FBQztBQUNKLENBQUM7QUFFRCxTQUFnQixlQUFlO0lBQzdCLE1BQU0sT0FBTyxHQUFHLElBQUEsa0JBQVUsRUFBQyxZQUFZLENBQUMsQ0FBQztJQUN6QyxJQUFJLE9BQU8sS0FBSyxTQUFTLEVBQUUsQ0FBQztRQUMxQixNQUFNLElBQUksS0FBSyxDQUFDLHFEQUFxRCxDQUFDLENBQUM7SUFDekUsQ0FBQztJQUNELE9BQU8sT0FBTyxDQUFDO0FBQ2pCLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJcInVzZSBjbGllbnRcIjtcblxuaW1wb3J0IFJlYWN0LCB7IGNyZWF0ZUNvbnRleHQsIHVzZUNvbnRleHQsIHVzZVN0YXRlLCB1c2VFZmZlY3QsIFJlYWN0Tm9kZSB9IGZyb20gXCJyZWFjdFwiO1xuXG5pbnRlcmZhY2UgTm90ZXNDb250ZXh0VHlwZSB7XG4gIGNvbnRlbnQ6IHN0cmluZztcbiAgc2V0Q29udGVudDogKGNvbnRlbnQ6IHN0cmluZykgPT4gdm9pZDtcbiAgYWRkVG9Ob3RlczogKHRleHQ6IHN0cmluZykgPT4gdm9pZDtcbiAgY2hhcmFjdGVyQ291bnQ6IG51bWJlcjtcbn1cblxuY29uc3QgTm90ZXNDb250ZXh0ID0gY3JlYXRlQ29udGV4dDxOb3Rlc0NvbnRleHRUeXBlIHwgdW5kZWZpbmVkPih1bmRlZmluZWQpO1xuXG5jb25zdCBTVE9SQUdFX0tFWSA9IFwib3ZlcmxheS1ub3Rlcy1jb250ZW50XCI7XG5cbmV4cG9ydCBmdW5jdGlvbiBOb3Rlc1Byb3ZpZGVyKHsgY2hpbGRyZW4gfTogeyBjaGlsZHJlbjogUmVhY3ROb2RlIH0pIHtcbiAgY29uc3QgW2NvbnRlbnQsIHNldENvbnRlbnRTdGF0ZV0gPSB1c2VTdGF0ZTxzdHJpbmc+KFwiXCIpO1xuICBjb25zdCBbaXNIeWRyYXRlZCwgc2V0SXNIeWRyYXRlZF0gPSB1c2VTdGF0ZShmYWxzZSk7XG5cbiAgLy8gTG9hZCBmcm9tIGxvY2FsU3RvcmFnZSBvbiBtb3VudFxuICB1c2VFZmZlY3QoKCkgPT4ge1xuICAgIGNvbnN0IHNhdmVkID0gbG9jYWxTdG9yYWdlLmdldEl0ZW0oU1RPUkFHRV9LRVkpO1xuICAgIGlmIChzYXZlZCkge1xuICAgICAgc2V0Q29udGVudFN0YXRlKHNhdmVkKTtcbiAgICB9XG4gICAgc2V0SXNIeWRyYXRlZCh0cnVlKTtcbiAgfSwgW10pO1xuXG4gIC8vIFNhdmUgdG8gbG9jYWxTdG9yYWdlIHdoZW5ldmVyIGNvbnRlbnQgY2hhbmdlc1xuICBjb25zdCBzZXRDb250ZW50ID0gKG5ld0NvbnRlbnQ6IHN0cmluZykgPT4ge1xuICAgIHNldENvbnRlbnRTdGF0ZShuZXdDb250ZW50KTtcbiAgICBpZiAoaXNIeWRyYXRlZCkge1xuICAgICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oU1RPUkFHRV9LRVksIG5ld0NvbnRlbnQpO1xuICAgIH1cbiAgfTtcblxuICAvLyBBcHBlbmQgc2VsZWN0ZWQgdGV4dCB0byBub3Rlc1xuICBjb25zdCBhZGRUb05vdGVzID0gKHRleHQ6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IHRyaW1tZWRUZXh0ID0gdGV4dC50cmltKCk7XG4gICAgaWYgKCF0cmltbWVkVGV4dCkgcmV0dXJuO1xuXG4gICAgY29uc3QgbmV3Q29udGVudCA9IGNvbnRlbnRcbiAgICAgID8gYCR7Y29udGVudH1cXG5cXG7igKIgJHt0cmltbWVkVGV4dH1gXG4gICAgICA6IGDigKIgJHt0cmltbWVkVGV4dH1gO1xuXG4gICAgc2V0Q29udGVudChuZXdDb250ZW50KTtcbiAgfTtcblxuICBjb25zdCBjaGFyYWN0ZXJDb3VudCA9IGNvbnRlbnQubGVuZ3RoO1xuXG4gIHJldHVybiAoXG4gICAgPE5vdGVzQ29udGV4dC5Qcm92aWRlciB2YWx1ZT17eyBjb250ZW50LCBzZXRDb250ZW50LCBhZGRUb05vdGVzLCBjaGFyYWN0ZXJDb3VudCB9fT5cbiAgICAgIHtjaGlsZHJlbn1cbiAgICA8L05vdGVzQ29udGV4dC5Qcm92aWRlcj5cbiAgKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHVzZU5vdGVzQ29udGV4dCgpIHtcbiAgY29uc3QgY29udGV4dCA9IHVzZUNvbnRleHQoTm90ZXNDb250ZXh0KTtcbiAgaWYgKGNvbnRleHQgPT09IHVuZGVmaW5lZCkge1xuICAgIHRocm93IG5ldyBFcnJvcihcInVzZU5vdGVzQ29udGV4dCBtdXN0IGJlIHVzZWQgd2l0aGluIGEgTm90ZXNQcm92aWRlclwiKTtcbiAgfVxuICByZXR1cm4gY29udGV4dDtcbn1cbiJdfQ==