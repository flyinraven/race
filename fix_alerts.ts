import fs from 'fs';
const file = 'src/pages/AdminDashboard.tsx';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(/alert\(/g, 'customAlert(');
let uiToast = `
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 bg-slate-900 border border-slate-700 text-white px-4 py-3 rounded shadow-lg max-w-sm">
          {toastMessage}
        </div>
      )}
`;
if (!content.includes('top-4 right-4 z-50 bg-slate-900')) {
  content = content.replace('<div className="min-h-screen bg-slate-50 flex flex-col">', '<div className="min-h-screen bg-slate-50 flex flex-col">' + uiToast);
}
fs.writeFileSync(file, content);
