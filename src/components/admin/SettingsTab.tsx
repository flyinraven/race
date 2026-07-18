import React from 'react';
import { FileText, CheckCircle } from 'lucide-react';

interface SettingsTabProps {
  curriculumText: string;
  setCurriculumText: (val: string) => void;
  handleSaveCurriculum: () => void;
  curriculumSaved: boolean;
  
  examGuidelines: string;
  setExamGuidelines: (val: string) => void;
  handleSaveGuidelines: () => void;
  guidelinesSaved: boolean;
}

export default function SettingsTab({
  curriculumText,
  setCurriculumText,
  handleSaveCurriculum,
  curriculumSaved,
  examGuidelines,
  setExamGuidelines,
  handleSaveGuidelines,
  guidelinesSaved
}: SettingsTabProps) {
  return (
    <div className="max-w-2xl mx-auto">
      {/* Curriculum Framework */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
          <FileText className="w-6 h-6 text-indigo-600" />
          <h3 className="text-lg font-bold text-slate-900">Curriculum Framework</h3>
        </div>
        <div className="p-6">
          <p className="text-slate-600 mb-4 text-sm">
            Upload or paste the curriculum framework for the exam. The AI engine will utilize this to set examination boundaries, verify syllabus matches when generating questions, and evaluate candidates accurately.
          </p>
          <textarea
            className="w-full border border-slate-300 rounded-lg p-4 text-sm h-64 focus:ring-2 focus:ring-indigo-500 outline-none resize-y font-mono"
            placeholder="Paste syllabus, learning objectives, or curriculum boundaries here..."
            value={curriculumText}
            onChange={e => setCurriculumText(e.target.value)}
          />
          <div className="pt-4 flex items-center gap-4">
            <button 
              onClick={handleSaveCurriculum}
              className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-indigo-700 transition text-sm whitespace-nowrap"
            >
              Save Curriculum Guide
            </button>
            {curriculumSaved && <span className="text-sm text-indigo-600 font-medium flex items-center gap-1"><CheckCircle className="w-4 h-4" /> Saved!</span>}
          </div>
        </div>
      </div>

      {/* Exam Guidelines & Format */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mt-8">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
          <FileText className="w-6 h-6 text-indigo-600" />
          <h3 className="text-lg font-bold text-slate-900">Exam Guidelines & Format</h3>
        </div>
        <div className="p-6">
          <p className="text-slate-600 mb-4 text-sm">
            Define the exact internal format of the exam, including timing rules, papers, durations, mark allocations, scoring standards, and logistical instructions.
          </p>
          <textarea
            className="w-full border border-slate-300 rounded-lg p-4 text-sm h-64 focus:ring-2 focus:ring-indigo-500 outline-none resize-y font-mono"
            placeholder="Paste exam formatting and logistical guidelines..."
            value={examGuidelines}
            onChange={e => setExamGuidelines(e.target.value)}
          />
          <div className="pt-4 flex items-center gap-4">
            <button 
              onClick={handleSaveGuidelines}
              className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-indigo-700 transition text-sm whitespace-nowrap"
            >
              Save Exam Guidelines
            </button>
            {guidelinesSaved && <span className="text-sm text-indigo-600 font-medium flex items-center gap-1"><CheckCircle className="w-4 h-4" /> Saved!</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
