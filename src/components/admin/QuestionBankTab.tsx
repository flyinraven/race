import React from 'react';
import { Cpu, FileText, Database, Upload, Loader2, CheckCircle, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import Markdown from 'react-markdown';
import { BankQuestion } from '../../services/examEngine';

interface QuestionBankTabProps {
  // Filters & Sort
  uniqueTopics: string[];
  uniquePapers: string[];
  uniqueYears: string[];
  uniqueTypes: string[];
  filterTopic: string;
  setFilterTopic: (val: string) => void;
  filterPaper: string;
  setFilterPaper: (val: string) => void;
  filterYear: string;
  setFilterYear: (val: string) => void;
  filterType: string;
  setFilterType: (val: string) => void;
  sortBy: string;
  setSortBy: (val: any) => void;
  currentPage: number;
  setCurrentPage: (val: any) => void;
  itemsPerPage: number;
  filteredBank: BankQuestion[];
  paginatedBank: BankQuestion[];
  totalPages: number;
  
  // Selection
  selectedQuestions: string[];
  setSelectedQuestions: (ids: string[]) => void;
  toggleSelectAll: (ids: string[]) => void;
  toggleSelection: (id: string) => void;
  
  // Handlers
  handleBulkDelete: () => void;
  handleDownloadPrintable: () => void;
  setEditingQuestion: (q: BankQuestion | null) => void;
  handleDeleteFromBank: (id: string) => void;
  expandedQuestionId: string | null;
  setExpandedQuestionId: (id: string | null) => void;
  customUrlTransform: (val: string) => string;
  MarkdownComponents: any;
  
  // Custom Generator State
  customGenTopic: string;
  setCustomGenTopic: (val: string) => void;
  customGenVsaqCount: number | '';
  setCustomGenVsaqCount: (val: number | '') => void;
  customGenSeqCount: number | '';
  setCustomGenSeqCount: (val: number | '') => void;
  customGenOsceCount: number | '';
  setCustomGenOsceCount: (val: number | '') => void;
  isGeneratingCustom: boolean;
  isGeneratingBatch: boolean;
  batchProgress: any;
  handleCustomGenerate: () => void;
  
  // Upload State
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  isUploading: boolean;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  uploadStatus: string;
  
  // Batch Simulations State
  selectedBatchType: 'paper1' | 'paper2' | 'paper3' | 'paper4' | 'osce' | 'full_exam';
  setSelectedBatchType: (val: any) => void;
  handleBatchGenerate: (type: any) => void;
  isPaused: boolean;
  togglePause: () => void;
}

export default function QuestionBankTab({
  uniqueTopics,
  uniquePapers,
  uniqueYears,
  uniqueTypes,
  filterTopic,
  setFilterTopic,
  filterPaper,
  setFilterPaper,
  filterYear,
  setFilterYear,
  filterType,
  setFilterType,
  sortBy,
  setSortBy,
  currentPage,
  setCurrentPage,
  itemsPerPage,
  filteredBank,
  paginatedBank,
  totalPages,
  selectedQuestions,
  setSelectedQuestions,
  toggleSelectAll,
  toggleSelection,
  handleBulkDelete,
  handleDownloadPrintable,
  setEditingQuestion,
  handleDeleteFromBank,
  expandedQuestionId,
  setExpandedQuestionId,
  customUrlTransform,
  MarkdownComponents,
  customGenTopic,
  setCustomGenTopic,
  customGenVsaqCount,
  setCustomGenVsaqCount,
  customGenSeqCount,
  setCustomGenSeqCount,
  customGenOsceCount,
  setCustomGenOsceCount,
  isGeneratingCustom,
  isGeneratingBatch,
  batchProgress,
  handleCustomGenerate,
  fileInputRef,
  isUploading,
  handleFileUpload,
  uploadStatus,
  selectedBatchType,
  setSelectedBatchType,
  handleBatchGenerate,
  isPaused,
  togglePause,
}: QuestionBankTabProps) {
  return (
    <div className="space-y-8">
      {/* Custom Question Generator */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
          <Cpu className="w-6 h-6 text-indigo-600" />
          <h3 className="text-lg font-bold text-slate-900">Custom Question Generator</h3>
        </div>
        <div className="p-6">
          <p className="text-slate-600 mb-6 text-sm">
            Generate specific questions by topic and type to fill gaps in your question bank.
          </p>
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-grow">
              <label className="block text-sm font-medium text-slate-700 mb-1">Topic</label>
              <select 
                value={customGenTopic}
                onChange={(e) => setCustomGenTopic(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="All">All Topics (Mixed)</option>
                <option value="Cataract">Cataract</option>
                <option value="Cornea and External Eye">Cornea and External Eye</option>
                <option value="Glaucoma">Glaucoma</option>
                <option value="Neuro-ophthalmology">Neuro-ophthalmology</option>
                <option value="Ocular Inflammation">Ocular Inflammation</option>
                <option value="Ocular Motility">Ocular Motility</option>
                <option value="Oculoplastics and Orbit">Oculoplastics and Orbit</option>
                <option value="Paediatrics">Paediatrics</option>
                <option value="Vitreoretinal">Vitreoretinal</option>
              </select>
            </div>
            <div className="flex-[2] flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-slate-700 mb-1">VSAQ Count</label>
                <input 
                  type="number" 
                  min="0" 
                  max="50" 
                  value={customGenVsaqCount}
                  onChange={(e) => setCustomGenVsaqCount(e.target.value === '' ? '' : (parseInt(e.target.value) || 0))}
                  className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="0"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-slate-700 mb-1">SEQ Count</label>
                <input 
                  type="number" 
                  min="0" 
                  max="50" 
                  value={customGenSeqCount}
                  onChange={(e) => setCustomGenSeqCount(e.target.value === '' ? '' : (parseInt(e.target.value) || 0))}
                  className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="0"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-slate-700 mb-1">OSCE Count</label>
                <input 
                  type="number" 
                  min="0" 
                  max="50" 
                  value={customGenOsceCount}
                  onChange={(e) => setCustomGenOsceCount(e.target.value === '' ? '' : (parseInt(e.target.value) || 0))}
                  className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="0"
                />
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-4">
            <button 
              onClick={handleCustomGenerate}
              disabled={isGeneratingCustom || isGeneratingBatch}
              className="w-full bg-indigo-600 text-white px-4 py-3 rounded-lg font-medium hover:bg-indigo-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Cpu className="w-5 h-5" /> Generate Questions
            </button>
          </div>
          {isGeneratingCustom && (
            <div className="mt-6 p-4 bg-indigo-50 border border-indigo-100 rounded-lg">
              <div className="flex items-center gap-3 mb-2">
                <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
                <span className="font-medium text-indigo-900">
                  {batchProgress.waiting 
                    ? `Rate limit reached. ${batchProgress.waitMessage ? `(${batchProgress.waitMessage}) ` : ''}Waiting ${batchProgress.waitTime}s before retrying...` 
                    : `Generating custom questions (${batchProgress.current} / ${batchProgress.total})...`
                  }
                </span>
              </div>
              <div className="w-full bg-indigo-200 rounded-full h-2">
                <div className="bg-indigo-600 h-2 rounded-full transition-all duration-300" style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}></div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Upload to local Bank */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
          <Database className="w-6 h-6 text-purple-600" />
          <h3 className="text-lg font-bold text-slate-900">Upload to local Bank</h3>
        </div>
        <div className="p-6">
          <p className="text-slate-600 mb-6 text-sm leading-relaxed">
             Upload documents (past exam papers or custom question lists) from elsewhere. The AI engine will automatically scan the document, parse its questions, sub-questions, and model answers, determine the exam year/semester automatically, and sort them into the appropriate curriculum topics.
             <br /><br />
             Supported formats: <strong className="text-slate-800">PDF (.pdf), Word (.docx), Plain Text (.txt), or JSON (.json)</strong>.
          </p>
          <div className="relative max-w-md">
            <input 
              type="file" 
              accept=".json,.pdf,.docx,.txt"
              onChange={handleFileUpload}
              ref={fileInputRef}
              disabled={isUploading}
              className={`absolute inset-0 w-full h-full opacity-0 ${isUploading ? 'cursor-not-allowed' : 'cursor-pointer'}`}
            />
            <div className={`bg-purple-50 border border-purple-200 text-purple-700 w-full py-3 rounded-lg font-semibold transition flex items-center justify-center gap-2 pointer-events-none ${isUploading ? 'opacity-70' : 'hover:bg-purple-100'}`}>
              {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
              {isUploading ? 'Processing...' : 'Select Document (PDF, Word, TXT, JSON)'}
            </div>
          </div>
          {uploadStatus && (
            <div className={`mt-4 p-3 rounded text-sm max-w-md ${uploadStatus.includes('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
              {uploadStatus}
            </div>
          )}
        </div>
      </div>



      {/* Manage Question Bank list */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-indigo-600" />
            <h3 className="text-lg font-bold text-slate-900">Manage Question Bank</h3>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 mt-4 sm:mt-0">
            <div className="flex flex-wrap items-center gap-2 bg-slate-100 p-1 rounded-md">
              <select 
                value={filterTopic} 
                onChange={e => setFilterTopic(e.target.value)}
                className="border-none rounded px-3 py-1.5 text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm"
              >
                <option disabled value="">Topic</option>
                {uniqueTopics.map(t => <option key={t} value={t}>{t === 'All' ? 'All Topics' : t}</option>)}
              </select>
              <select 
                value={filterPaper} 
                onChange={e => setFilterPaper(e.target.value)}
                className="border-none rounded px-3 py-1.5 text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm"
              >
                <option disabled value="">Paper</option>
                {uniquePapers.map(p => <option key={p} value={p}>{p === 'All' ? 'All Papers' : p}</option>)}
              </select>
              <select 
                value={filterYear} 
                onChange={e => setFilterYear(e.target.value)}
                className="border-none rounded px-3 py-1.5 text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm"
              >
                <option disabled value="">Year</option>
                {uniqueYears.map(y => <option key={y} value={y}>{y === 'All' ? 'All Years' : y}</option>)}
              </select>
              <select 
                value={filterType} 
                onChange={e => setFilterType(e.target.value)}
                className="border-none rounded px-3 py-1.5 text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm"
              >
                <option disabled value="">Type</option>
                {uniqueTypes.map(t => <option key={t} value={t}>{t === 'All' ? 'All Types' : t}</option>)}
              </select>
            </div>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="border border-slate-300 rounded px-3 py-1.5 text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              <option value="yearDesc">Sort By: Reverse Chronological (Newest First)</option>
              <option value="yearAsc">Sort By: Chronological (Oldest First)</option>
              <option value="topicAsc">Sort By: Topic (A-Z)</option>
              <option value="topicDesc">Sort By: Topic (Z-A)</option>
              <option value="typeAsc">Sort By: Type (A-Z)</option>
              <option value="typeDesc">Sort By: Type (Z-A)</option>
            </select>
            { (filterTopic !== 'All' || filterYear !== 'All' || filterPaper !== 'All' || filterType !== 'All' || sortBy !== 'yearAsc') && (
              <button 
                onClick={() => {
                  setFilterTopic('All');
                  setFilterYear('All');
                  setFilterPaper('All');
                  setFilterType('All');
                  setSortBy('yearAsc');
                }}
                className="text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded font-medium transition text-xs"
              >
                Clear Filters
              </button>
            )}
            <span className="bg-indigo-100 text-indigo-800 text-xs font-bold px-3 py-1.5 rounded uppercase tracking-wide">
              {filteredBank.length} Qs
            </span>
          </div>
        </div>

        <div className="p-0">
          {filteredBank.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              <p>No questions match your filters or the bank is empty.</p>
            </div>
          ) : (
            <>
              <div className="bg-slate-50 border-b border-slate-100 p-3 flex items-center justify-between text-sm">
                <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    checked={selectedQuestions.length === filteredBank.length && filteredBank.length > 0}
                    onChange={() => toggleSelectAll(filteredBank.map(q => q.id))}
                  />
                  Select All
                </label>
                
                {selectedQuestions.length > 0 && (
                  <div className="flex items-center">
                    <button 
                      onClick={handleBulkDelete}
                      className="text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded font-medium transition flex items-center gap-1 text-xs"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete {selectedQuestions.length} Selected
                    </button>
                    <button 
                      onClick={handleDownloadPrintable}
                      className="text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded font-medium transition flex items-center gap-1 text-xs ml-2"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      Download {selectedQuestions.length} Selected (Text)
                    </button>
                  </div>
                )}
              </div>
              <ul className="divide-y divide-slate-100">
                {paginatedBank.map((q) => {
                  const isExpanded = expandedQuestionId === q.id;
                  const isSelected = selectedQuestions.includes(q.id);
                  return (
                    <li key={q.id} className="p-4 flex flex-col hover:bg-slate-50 transition">
                      <div className="flex items-center gap-3">
                        <input 
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelection(q.id)}
                          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer mt-0.5 self-start"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div className="flex-1 flex flex-col sm:flex-row sm:items-center justify-between cursor-pointer" onClick={() => setExpandedQuestionId(isExpanded ? null : q.id)}>
                          <div className="flex items-center gap-3 flex-wrap">
                            {q.questionLabel && <span className="font-bold text-slate-900 text-sm">{q.questionLabel}</span>}
                            <span className={`px-2 py-0.5 text-xs font-bold rounded ${
                              q.type === 'OSCE' ? 'bg-indigo-100 text-indigo-800' :
                              q.type === 'SEQ' ? 'bg-orange-100 text-orange-800' :
                              'bg-blue-100 text-blue-800'
                            }`}>{q.type}</span>
                            <span className="text-sm font-medium text-slate-800">{q.topic}</span>
                            {q.year && q.year !== 'Unknown' && q.year !== 'AI' && <span className="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded">{q.year}</span>}
                            {q.created_at && (
                              <span className="text-xs text-slate-400 font-medium">
                                (Added: {new Date(q.created_at).toLocaleDateString()})
                              </span>
                            )}
                            {q.paper && q.paper !== 'Unknown' && q.paper !== 'AI Generated' && q.paper !== q.type && !q.paper.startsWith('OSCE Bank') && (
                              <span className="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded">{q.paper}</span>
                            )}
                            {q.used && <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded flex items-center gap-1"><CheckCircle className="w-3 h-3"/> Used</span>}
                          </div>
                          <div className="flex items-center gap-2 mt-2 sm:mt-0">
                            <button 
                              onClick={(e) => { e.stopPropagation(); setEditingQuestion(q); }}
                              className="text-slate-400 hover:text-indigo-600 p-2 rounded-full hover:bg-indigo-50 transition text-sm font-medium"
                              title="Edit Question"
                            >
                              Edit
                            </button>
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleDeleteFromBank(q.id); }}
                              className="text-slate-400 hover:text-red-600 p-2 rounded-full hover:bg-red-50 transition"
                              title="Delete Question"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                            {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                          </div>
                        </div>
                      </div>
                    
                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t border-slate-100 pl-2 cursor-default" onClick={e => e.stopPropagation()}>
                        <div className="bg-slate-50 p-4 rounded-lg mb-4 text-sm prose prose-slate max-w-none prose-sm">
                          <strong className="text-slate-700 block mb-2">Scenario:</strong>
                          <div><Markdown urlTransform={customUrlTransform} components={MarkdownComponents}>{q.data.scenario}</Markdown></div>
                        </div>
                        
                        <div className="space-y-4 text-sm">
                          <strong className="text-slate-700 block mb-2">Questions & Model Answers:</strong>
                          {q.data.subQuestions?.map((sq: any, i: number) => (
                            <div key={sq.id || i} className="bg-white border text-sm border-slate-200 p-3 rounded shadow-sm">
                              <p className="font-medium text-slate-800 mb-3">Q: {sq.text}</p>
                              <div className="bg-green-50/50 border border-green-100 text-green-900 p-3 rounded h-full">
                                <span className="font-semibold text-green-800 text-xs uppercase tracking-wider block mb-2">Model Answer:</span>
                                <div>{sq.modelAnswer ? <Markdown urlTransform={customUrlTransform} components={MarkdownComponents}>{sq.modelAnswer}</Markdown> : <span className="italic text-slate-500 opacity-80">Not provided by AI extraction. It will be generated on the fly by the AI assessor during exam.</span>}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </li>
                  );
                })}
              </ul>
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 bg-white border-t border-slate-200 sm:px-6">
                  <div className="flex justify-between flex-1 sm:hidden">
                    <button
                      onClick={() => setCurrentPage((p: number) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setCurrentPage((p: number) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="relative ml-3 inline-flex items-center px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                  <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm text-slate-700">
                        Showing <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-medium">{Math.min(currentPage * itemsPerPage, filteredBank.length)}</span> of <span className="font-medium">{filteredBank.length}</span> results
                      </p>
                    </div>
                    <div>
                      <nav className="inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                        <button
                          onClick={() => setCurrentPage((p: number) => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                          className="relative inline-flex items-center rounded-l-md px-2 py-2 text-slate-400 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
                        >
                          <span className="sr-only">Previous</span>
                          &larr;
                        </button>
                        {Array.from({ length: totalPages }).map((_, i) => (
                          <button
                            key={i}
                            onClick={() => setCurrentPage(i + 1)}
                            className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold focus:z-20 focus:outline-offset-0 ${
                              currentPage === i + 1 
                                ? 'z-10 bg-indigo-600 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600'
                                : 'text-slate-900 ring-1 ring-inset ring-slate-300 hover:bg-slate-50'
                            }`}
                          >
                            {i + 1}
                          </button>
                        ))}
                        <button
                          onClick={() => setCurrentPage((p: number) => Math.min(totalPages, p + 1))}
                          disabled={currentPage === totalPages}
                          className="relative inline-flex items-center rounded-r-md px-2 py-2 text-slate-400 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
                        >
                          <span className="sr-only">Next</span>
                          &rarr;
                        </button>
                      </nav>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
