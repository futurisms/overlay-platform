"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.metadata = void 0;
exports.default = RootLayout;
const google_1 = require("next/font/google");
require("./globals.css");
const sonner_1 = require("sonner");
const NotesContext_1 = require("@/contexts/NotesContext");
const Sidebar_1 = require("@/components/sidebar/Sidebar");
const geistSans = (0, google_1.Geist)({
    variable: "--font-geist-sans",
    subsets: ["latin"],
});
const geistMono = (0, google_1.Geist_Mono)({
    variable: "--font-geist-mono",
    subsets: ["latin"],
});
exports.metadata = {
    title: "Overlay Platform",
    description: "AI-powered document review and evaluation platform",
};
function RootLayout({ children, }) {
    return (<html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <NotesContext_1.NotesProvider>
          <div className="flex">
            <main className="flex-1 mr-0">{children}</main>
            <Sidebar_1.Sidebar />
          </div>
          <sonner_1.Toaster position="top-right" richColors/>
        </NotesContext_1.NotesProvider>
      </body>
    </html>);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGF5b3V0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsibGF5b3V0LnRzeCJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFzQkEsNkJBb0JDO0FBekNELDZDQUFxRDtBQUNyRCx5QkFBdUI7QUFDdkIsbUNBQWlDO0FBQ2pDLDBEQUF3RDtBQUN4RCwwREFBdUQ7QUFFdkQsTUFBTSxTQUFTLEdBQUcsSUFBQSxjQUFLLEVBQUM7SUFDdEIsUUFBUSxFQUFFLG1CQUFtQjtJQUM3QixPQUFPLEVBQUUsQ0FBQyxPQUFPLENBQUM7Q0FDbkIsQ0FBQyxDQUFDO0FBRUgsTUFBTSxTQUFTLEdBQUcsSUFBQSxtQkFBVSxFQUFDO0lBQzNCLFFBQVEsRUFBRSxtQkFBbUI7SUFDN0IsT0FBTyxFQUFFLENBQUMsT0FBTyxDQUFDO0NBQ25CLENBQUMsQ0FBQztBQUVVLFFBQUEsUUFBUSxHQUFhO0lBQ2hDLEtBQUssRUFBRSxrQkFBa0I7SUFDekIsV0FBVyxFQUFFLG9EQUFvRDtDQUNsRSxDQUFDO0FBRUYsU0FBd0IsVUFBVSxDQUFDLEVBQ2pDLFFBQVEsR0FHUjtJQUNBLE9BQU8sQ0FDTCxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUNiO01BQUEsQ0FBQyxJQUFJLENBQ0gsU0FBUyxDQUFDLENBQUMsR0FBRyxTQUFTLENBQUMsUUFBUSxJQUFJLFNBQVMsQ0FBQyxRQUFRLGNBQWMsQ0FBQyxDQUVyRTtRQUFBLENBQUMsNEJBQWEsQ0FDWjtVQUFBLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQ25CO1lBQUEsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLGFBQWEsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxFQUFFLElBQUksQ0FDOUM7WUFBQSxDQUFDLGlCQUFPLENBQUMsQUFBRCxFQUNWO1VBQUEsRUFBRSxHQUFHLENBQ0w7VUFBQSxDQUFDLGdCQUFPLENBQUMsUUFBUSxDQUFDLFdBQVcsQ0FBQyxVQUFVLEVBQzFDO1FBQUEsRUFBRSw0QkFBYSxDQUNqQjtNQUFBLEVBQUUsSUFBSSxDQUNSO0lBQUEsRUFBRSxJQUFJLENBQUMsQ0FDUixDQUFDO0FBQ0osQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB0eXBlIHsgTWV0YWRhdGEgfSBmcm9tIFwibmV4dFwiO1xuaW1wb3J0IHsgR2Vpc3QsIEdlaXN0X01vbm8gfSBmcm9tIFwibmV4dC9mb250L2dvb2dsZVwiO1xuaW1wb3J0IFwiLi9nbG9iYWxzLmNzc1wiO1xuaW1wb3J0IHsgVG9hc3RlciB9IGZyb20gXCJzb25uZXJcIjtcbmltcG9ydCB7IE5vdGVzUHJvdmlkZXIgfSBmcm9tIFwiQC9jb250ZXh0cy9Ob3Rlc0NvbnRleHRcIjtcbmltcG9ydCB7IFNpZGViYXIgfSBmcm9tIFwiQC9jb21wb25lbnRzL3NpZGViYXIvU2lkZWJhclwiO1xuXG5jb25zdCBnZWlzdFNhbnMgPSBHZWlzdCh7XG4gIHZhcmlhYmxlOiBcIi0tZm9udC1nZWlzdC1zYW5zXCIsXG4gIHN1YnNldHM6IFtcImxhdGluXCJdLFxufSk7XG5cbmNvbnN0IGdlaXN0TW9ubyA9IEdlaXN0X01vbm8oe1xuICB2YXJpYWJsZTogXCItLWZvbnQtZ2Vpc3QtbW9ub1wiLFxuICBzdWJzZXRzOiBbXCJsYXRpblwiXSxcbn0pO1xuXG5leHBvcnQgY29uc3QgbWV0YWRhdGE6IE1ldGFkYXRhID0ge1xuICB0aXRsZTogXCJPdmVybGF5IFBsYXRmb3JtXCIsXG4gIGRlc2NyaXB0aW9uOiBcIkFJLXBvd2VyZWQgZG9jdW1lbnQgcmV2aWV3IGFuZCBldmFsdWF0aW9uIHBsYXRmb3JtXCIsXG59O1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBSb290TGF5b3V0KHtcbiAgY2hpbGRyZW4sXG59OiBSZWFkb25seTx7XG4gIGNoaWxkcmVuOiBSZWFjdC5SZWFjdE5vZGU7XG59Pikge1xuICByZXR1cm4gKFxuICAgIDxodG1sIGxhbmc9XCJlblwiPlxuICAgICAgPGJvZHlcbiAgICAgICAgY2xhc3NOYW1lPXtgJHtnZWlzdFNhbnMudmFyaWFibGV9ICR7Z2Vpc3RNb25vLnZhcmlhYmxlfSBhbnRpYWxpYXNlZGB9XG4gICAgICA+XG4gICAgICAgIDxOb3Rlc1Byb3ZpZGVyPlxuICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleFwiPlxuICAgICAgICAgICAgPG1haW4gY2xhc3NOYW1lPVwiZmxleC0xIG1yLTBcIj57Y2hpbGRyZW59PC9tYWluPlxuICAgICAgICAgICAgPFNpZGViYXIgLz5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICA8VG9hc3RlciBwb3NpdGlvbj1cInRvcC1yaWdodFwiIHJpY2hDb2xvcnMgLz5cbiAgICAgICAgPC9Ob3Rlc1Byb3ZpZGVyPlxuICAgICAgPC9ib2R5PlxuICAgIDwvaHRtbD5cbiAgKTtcbn1cbiJdfQ==