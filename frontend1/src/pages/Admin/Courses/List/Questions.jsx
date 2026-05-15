import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
// 🌟 引入了 getCourseList，用于拉取课程列表给下拉框用
import { getQuestionList, updateQuestion, deleteQuestion, createQuestion, getCourseList } from '../../../../api/course'; 

export default function Questions() {
  const { courseId } = useParams(); 
  const navigate = useNavigate();

  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);

  // 🌟 新增：存放所有课程的列表，用于下拉框选择
  const [courseOptions, setCourseOptions] = useState([]);

  // 视图模式状态 ('course' = 本课题库, 'unassigned' = 未分配题库)
  const [viewMode, setViewMode] = useState('course');

  const [searchForm, setSearchForm] = useState({ content: '', questionType: '', industryTag: '', jobRoleTag: '' });
  const [queryParams, setQueryParams] = useState({ ...searchForm });
  
  const [pagination, setPagination] = useState({ current: 1, size: 10, total: 0 });
  const maxPage = Math.max(1, Math.ceil(pagination.total / pagination.size));

  const [editModal, setEditModal] = useState({ isOpen: false, isSubmitting: false });
  const [editForm, setEditForm] = useState({
    id: null, courseId: '', questionType: 'single_choice', content: '', standardAnswer: '', analysis: '', industryTag: '', jobRoleTag: '',
    parsedOptions: [] 
  });

  // 🌟 组件加载时，拉取一次课程列表，作为下拉菜单的数据源
  useEffect(() => {
    const fetchCourses = async () => {
      try {
        // 给个比较大的 size，确保能拉到大部分课程供选择
        const res = await getCourseList({ current: 1, size: 500 });
        setCourseOptions(res?.records || res?.data?.records || []);
      } catch (error) {
        console.error("获取课程列表用于下拉框失败", error);
      }
    };
    fetchCourses();
  }, []);

  useEffect(() => { 
    if (courseId) {
      fetchQuestions(pagination.current, pagination.size, queryParams, viewMode); 
    }
  }, [pagination.current, pagination.size, queryParams, courseId, viewMode]);

  const fetchQuestions = async (current, size, paramsObj, currentViewMode) => {
    setLoading(true);
    try {
      const apiParams = { current, size };
      
      apiParams.courseId = currentViewMode === 'course' ? parseInt(courseId, 10) : 0; 
      
      if (paramsObj.content && paramsObj.content.trim() !== '') apiParams.content = paramsObj.content.trim();
      if (paramsObj.questionType && paramsObj.questionType !== '') apiParams.questionType = paramsObj.questionType;
      if (paramsObj.industryTag && paramsObj.industryTag.trim() !== '') apiParams.industryTag = paramsObj.industryTag.trim();
      if (paramsObj.jobRoleTag && paramsObj.jobRoleTag.trim() !== '') apiParams.jobRoleTag = paramsObj.jobRoleTag.trim();

      const res = await getQuestionList(apiParams);
      const records = res?.records || res?.data?.records || [];
      const total = res?.total || res?.data?.total || 0;
      
      setQuestions(records);
      setPagination(prev => ({ ...prev, total, current }));
    } catch (error) { 
      setQuestions([]); 
    } finally { 
      setLoading(false); 
    }
  };

  const handleViewModeChange = (mode) => {
    setViewMode(mode);
    setPagination(prev => ({ ...prev, current: 1 }));
  };

  const handleSearch = () => { setQueryParams({ ...searchForm }); setPagination(prev => ({ ...prev, current: 1 })); };
  
  const handleReset = () => {
    const emptyForm = { content: '', questionType: '', industryTag: '', jobRoleTag: '' };
    setSearchForm(emptyForm); setQueryParams(emptyForm); setPagination(prev => ({ ...prev, current: 1 }));
  };

  // ================= 🌟 新建 / 编辑逻辑 =================
  
  const handleOpenCreate = () => {
    setEditForm({
      id: null,
      courseId: courseId, // 新建时默认绑定当前课程
      questionType: 'single_choice',
      content: '',
      standardAnswer: '',
      analysis: '',
      industryTag: '',
      jobRoleTag: '',
      parsedOptions: [
        { option: '', is_correct: false }, { option: '', is_correct: false },
        { option: '', is_correct: false }, { option: '', is_correct: false }
      ]
    });
    setEditModal({ isOpen: true, isSubmitting: false });
  };

  const handleOpenEdit = (record) => {
    let parsedOpts = [];
    if (record.options) {
      try { parsedOpts = JSON.parse(record.options); } catch (e) { console.error('解析选项失败', e); }
    }
    setEditForm({
      id: record.id,
      courseId: record.courseId !== undefined ? record.courseId : courseId, 
      questionType: record.questionType || 'single_choice',
      content: record.content || '',
      standardAnswer: record.standardAnswer || '',
      analysis: record.analysis || '',
      industryTag: record.industryTag || '',
      jobRoleTag: record.jobRoleTag || '',
      parsedOptions: parsedOpts
    });
    setEditModal({ isOpen: true, isSubmitting: false });
  };

  const handleQuestionTypeChange = (e) => {
    const type = e.target.value;
    let newOpts = [];
    if (type === 'single_choice' || type === 'multiple_choice' || type === '单选' || type === '多选') {
      newOpts = [{ option: '', is_correct: false }, { option: '', is_correct: false }, { option: '', is_correct: false }, { option: '', is_correct: false }];
    } else if (type === 'judge' || type === '判断题') {
      newOpts = [{ option: '正确', is_correct: true }, { option: '错误', is_correct: false }];
    }
    setEditForm({ ...editForm, questionType: type, parsedOptions: newOpts, standardAnswer: '' });
  };

  const updateOption = (index, field, value) => {
    const newOpts = [...editForm.parsedOptions];
    if (field === 'is_correct' && value === true && (editForm.questionType === 'single_choice' || editForm.questionType === 'judge' || editForm.questionType === '单选' || editForm.questionType === '单选题' || editForm.questionType === '判断题')) {
      newOpts.forEach(opt => opt.is_correct = false);
    }
    newOpts[index][field] = value;
    
    if (field === 'is_correct' || field === 'option') {
       const correctOpts = newOpts.filter(opt => opt.is_correct).map(opt => opt.option);
       setEditForm({ ...editForm, parsedOptions: newOpts, standardAnswer: correctOpts.join('、') });
    } else {
       setEditForm({ ...editForm, parsedOptions: newOpts });
    }
  };

  const handleAddOption = () => {
    setEditForm({ ...editForm, parsedOptions: [...editForm.parsedOptions, { option: '', is_correct: false }] });
  };

  const handleRemoveOption = (index) => {
    const newOpts = editForm.parsedOptions.filter((_, i) => i !== index);
    setEditForm({ ...editForm, parsedOptions: newOpts });
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editForm.content.trim()) return alert('题目内容不能为空！');
    
    setEditModal(prev => ({ ...prev, isSubmitting: true }));
    try {
      const payload = {
        courseId: parseInt(editForm.courseId, 10) || 0, // 底层依然严谨地转换为数字 ID 发给后端
        questionType: editForm.questionType,
        content: editForm.content,
        options: editForm.parsedOptions && editForm.parsedOptions.length > 0 
                  ? JSON.stringify(editForm.parsedOptions) 
                  : null,
        standardAnswer: editForm.standardAnswer,
        analysis: editForm.analysis,
        industryTag: editForm.industryTag,
        jobRoleTag: editForm.jobRoleTag,
        createdAt: new Date().toISOString()
      };

      if (editForm.id) {
        await updateQuestion(editForm.id, payload);
        alert(viewMode === 'unassigned' && payload.courseId !== 0 ? '✅ 题目已成功分配到指定课程！' : '✅ 题目信息更新成功！');
      } else {
        await createQuestion(payload);
        alert('✅ 新题目录入成功！');
      }

      setEditModal({ isOpen: false, isSubmitting: false });
      
      if (viewMode === 'unassigned' && payload.courseId !== 0) {
        setViewMode('course');
      } else {
        fetchQuestions(pagination.current, pagination.size, queryParams, viewMode);
      }
    } catch (error) {
      alert(`${editForm.id ? '修改' : '录入'}失败，请检查网络或参数`);
      setEditModal(prev => ({ ...prev, isSubmitting: false }));
    }
  };

  // ================= 🌟 删除逻辑 =================
  const handleDelete = async (id, content) => {
    const shortContent = content.length > 15 ? content.substring(0, 15) + '...' : content;
    if (window.confirm(`⚠️ 危险操作：\n您确定要彻底删除题目【${shortContent}】吗？\n此操作不可恢复！`)) {
      try {
        await deleteQuestion(id);
        alert('✅ 题目删除成功！');
        if (questions.length === 1 && pagination.current > 1) {
          setPagination(prev => ({ ...prev, current: prev.current - 1 }));
        } else {
          fetchQuestions(pagination.current, pagination.size, queryParams, viewMode);
        }
      } catch (error) {
        alert('删除失败，请检查网络或确认该题目是否已被试卷引用。');
      }
    }
  };

  const renderQuestionTypeBadge = (type) => {
    switch (type) {
      case 'single_choice': case 'SINGLE': case '单选题': case '单选': return <span className="px-2.5 py-1 inline-flex text-xs font-bold rounded-full bg-blue-100 text-blue-700 border border-blue-200">单选题</span>;
      case 'multiple_choice': case 'MULTIPLE': case '多选': case '多选题': return <span className="px-2.5 py-1 inline-flex text-xs font-bold rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200">多选题</span>;
      case 'judge': case 'JUDGE': case '判断题': case '判断': return <span className="px-2.5 py-1 inline-flex text-xs font-bold rounded-full bg-amber-100 text-amber-700 border border-amber-200">判断题</span>;
      case 'short_answer': case '简答题': case '简答': return <span className="px-2.5 py-1 inline-flex text-xs font-bold rounded-full bg-rose-100 text-rose-700 border border-rose-200">简答题</span>;
      default: return <span className="px-2.5 py-1 inline-flex text-xs font-bold rounded-full bg-slate-100 text-slate-700 border border-slate-200">{type || '未知'}</span>;
    }
  };

  const formatOptions = (optionsStr) => {
    if (!optionsStr) return null;
    try {
      const arr = JSON.parse(optionsStr);
      if (!Array.isArray(arr) || arr.length === 0) return null;
      const labels = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
      return (
        <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-2">
          {arr.map((item, idx) => (
            <div key={idx} className="text-xs text-slate-600 bg-slate-50 px-2 py-0.5 rounded border border-slate-100 flex items-center gap-1">
              <span className={`font-bold ${item.is_correct ? 'text-emerald-500' : 'text-slate-400'}`}>{labels[idx] || '•'}.</span>
              <span className={item.is_correct ? 'text-emerald-700 font-bold' : ''}>{item.option}</span>
            </div>
          ))}
        </div>
      );
    } catch (e) { return null; }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 relative pb-10">
      
      {/* 头部区域 */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/admin/courses')} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center border border-blue-100">
              <span className="material-symbols-outlined text-2xl">dataset</span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-3">
                课程题库管理
                <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
                  <button 
                    onClick={() => handleViewModeChange('course')} 
                    className={`px-3 py-1 text-xs font-bold rounded-md transition-colors flex items-center gap-1 ${viewMode === 'course' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    <span className="material-symbols-outlined text-[14px]">local_library</span> 本课专属题库
                  </button>
                  <button 
                    onClick={() => handleViewModeChange('unassigned')} 
                    className={`px-3 py-1 text-xs font-bold rounded-md transition-colors flex items-center gap-1 ${viewMode === 'unassigned' ? 'bg-white text-amber-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    <span className="material-symbols-outlined text-[14px]">inbox</span> 暂未分配的题库
                  </button>
                </div>
              </h2>
              <p className="text-slate-500 text-xs mt-1">
                当前操作课程 ID: <strong className="text-blue-600">{courseId}</strong>
                {viewMode === 'unassigned' && <span className="ml-2 text-amber-600">💡 提示：在未分配题库中修改归属课程可进行认领</span>}
              </p>
            </div>
          </div>
        </div>
        <button onClick={handleOpenCreate} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-1.5 shadow-sm transition-all active:scale-95 shadow-blue-500/20">
          <span className="material-symbols-outlined text-[18px]">add</span> 录入本课新题
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col overflow-hidden min-h-[500px]">
        {/* 检索面板 */}
        <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
              <input type="text" value={searchForm.content} onChange={(e) => setSearchForm({...searchForm, content: e.target.value})} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} placeholder="搜索题目内容..." className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-shadow bg-white"/>
            </div>
            <select value={searchForm.questionType} onChange={e => setSearchForm({...searchForm, questionType: e.target.value})} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white text-slate-700">
              <option value="">全部题型</option>
              <option value="single_choice">单选题</option>
              <option value="多选">多选题</option>
              <option value="judge">判断题</option>
              <option value="short_answer">简答题</option>
            </select>
            <input type="text" value={searchForm.industryTag} onChange={(e) => setSearchForm({...searchForm, industryTag: e.target.value})} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} placeholder="行业标签..." className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-shadow bg-white"/>
            <input type="text" value={searchForm.jobRoleTag} onChange={(e) => setSearchForm({...searchForm, jobRoleTag: e.target.value})} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} placeholder="岗位标签..." className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-shadow bg-white"/>
          </div>
          <div className="flex justify-end gap-3 pt-1 border-t border-slate-100/50 mt-1">
            <button onClick={handleReset} className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-5 py-2 rounded-lg text-sm font-bold transition-colors shadow-sm">重置条件</button>
            <button onClick={handleSearch} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg text-sm font-bold transition-colors shadow-sm shadow-blue-500/20">精确查询</button>
          </div>
        </div>

        {/* 数据表格 */}
        <div className="flex-1 overflow-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50 sticky top-0 z-10 shadow-inner">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider w-5/12">题目与选项</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">题型</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">标准答案</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">业务标签</th>
                <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan="5" className="px-6 py-16 text-center text-slate-500"><span className="material-symbols-outlined animate-spin text-3xl mb-2 text-blue-200">sync</span><p>加载题库数据中...</p></td></tr>
              ) : questions.length === 0 ? (
                <tr><td colSpan="5" className="px-6 py-16 text-center text-slate-500">
                  <span className="material-symbols-outlined text-5xl opacity-30 mb-2">find_in_page</span>
                  <p>{viewMode === 'course' ? '该课程暂无专属题目数据' : '当前没有未分配课程的孤儿题目'}</p>
                </td></tr>
              ) : questions.map((q) => (
                <tr key={q.id} className={`transition-colors group ${viewMode === 'unassigned' ? 'hover:bg-amber-50' : 'hover:bg-slate-50'}`}>
                  <td className="px-6 py-4">
                    <div className="text-sm font-bold text-slate-800 leading-relaxed mb-1" title={q.content}>{q.content || '空题目'}</div>
                    {formatOptions(q.options)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">{renderQuestionTypeBadge(q.questionType)}</td>
                  <td className="px-6 py-4">
                    <div className="inline-flex items-center gap-1.5 text-sm font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100 max-w-[200px]" title={q.standardAnswer}>
                      <span className="material-symbols-outlined text-[16px] flex-shrink-0 leading-none">check_circle</span>
                      <span className="truncate">{q.standardAnswer || '未设置'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {q.industryTag && <span className="px-2.5 py-1 text-[11px] font-bold rounded bg-slate-100 text-slate-600 border border-slate-200 line-clamp-1" title={q.industryTag}>行: {q.industryTag}</span>}
                      {q.jobRoleTag && <span className="px-2.5 py-1 text-[11px] font-bold rounded bg-slate-100 text-slate-600 border border-slate-200 line-clamp-1" title={q.jobRoleTag}>岗: {q.jobRoleTag}</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {viewMode === 'unassigned' ? (
                      <button onClick={() => handleOpenEdit(q)} className="text-amber-600 hover:text-amber-700 mr-3 transition-colors bg-amber-50 border border-amber-200 hover:border-amber-300 px-3 py-1.5 rounded-md shadow-sm">分配/编辑</button>
                    ) : (
                      <button onClick={() => handleOpenEdit(q)} className="text-slate-500 hover:text-blue-600 mr-3 transition-colors bg-white border border-slate-200 px-3 py-1.5 rounded-md shadow-sm">编辑</button>
                    )}
                    <button onClick={() => handleDelete(q.id, q.content)} className="text-slate-500 hover:text-red-600 transition-colors px-2 py-1.5">删除</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* 底部精美分页 */}
        {!loading && pagination.total > 0 && (
          <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex justify-between items-center shrunk-0">
             <span className="text-sm text-slate-500 font-medium">共 {pagination.total} 道题目，第 {pagination.current} 页</span>
             <div className="flex gap-2.5">
               <button onClick={() => setPagination(p => ({...p, current: Math.max(1, p.current - 1)}))} disabled={pagination.current === 1} className="px-3.5 py-1.5 bg-white border border-slate-300 rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-slate-50 transition-colors shadow-sm">上一页</button>
               <span className="px-4 py-1.5 text-sm text-slate-800 font-black flex items-center bg-white border border-slate-200 rounded-lg shadow-inner">{pagination.current} / {maxPage}</span>
               <button onClick={() => setPagination(p => ({...p, current: Math.min(maxPage, p.current + 1)}))} disabled={pagination.current >= maxPage} className="px-3.5 py-1.5 bg-white border border-slate-300 rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-slate-50 transition-colors shadow-sm">下一页</button>
             </div>
          </div>
        )}
      </div>

      {/* ================= 🌟 题目表单弹窗 ================= */}
      {editModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm px-4">
          <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh]">
            
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center shrink-0">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-500 text-[22px]">
                  {editForm.id ? 'edit_note' : 'add_circle'}
                </span> 
                {editForm.id 
                  ? '编辑题目信息' 
                  : '录入新题'}
              </h3>
              <button onClick={() => setEditModal({ isOpen: false, isSubmitting: false })} className="text-slate-400 hover:bg-slate-200 p-1.5 rounded-lg transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-6 overflow-y-auto space-y-5 bg-white">
                
                <div className="grid grid-cols-2 gap-5">
                  {/* 🌟 核心UI替换：下拉列表选择课程 */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-slate-700">归属课程配置 <span className="text-xs font-normal text-slate-400 ml-1">(选未分配即移出)</span></label>
                    <select 
                      required 
                      value={editForm.courseId} 
                      onChange={e => setEditForm({...editForm, courseId: e.target.value})} 
                      className={`w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 ${viewMode === 'unassigned' ? 'bg-amber-50 focus:ring-amber-500' : 'bg-slate-50'}`}
                    >
                      <option value="0">【公共库】暂未分配课程</option>
                      {/* 渲染所有拉取到的课程选项 */}
                      {courseOptions.map(c => (
                        <option key={c.id} value={c.id}>{c.title || c.name || `课程 (ID: ${c.id})`}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-slate-700">题型</label>
                    <select value={editForm.questionType} onChange={handleQuestionTypeChange} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50">
                      <option value="single_choice">单选题</option>
                      <option value="多选">多选题</option>
                      <option value="judge">判断题</option>
                      <option value="short_answer">简答题</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-slate-700">题目内容主体 <span className="text-red-500">*</span></label>
                  <textarea required rows="3" value={editForm.content} onChange={e => setEditForm({...editForm, content: e.target.value})} className="w-full border border-slate-200 rounded-lg px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none shadow-inner" placeholder="请输入题目题干内容..." />
                </div>

                {editForm.parsedOptions && editForm.questionType !== 'short_answer' && (
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3">
                    <div className="text-sm font-bold text-slate-700 flex items-center justify-between">
                      <div>选项配置区 <span className="text-xs font-normal text-slate-500 ml-2">修改文字，或勾选以标记正确答案</span></div>
                      {(editForm.questionType === 'single_choice' || editForm.questionType === 'multiple_choice' || editForm.questionType === '单选' || editForm.questionType === '多选' || editForm.questionType === '单选题' || editForm.questionType === '多选题') && (
                         <button type="button" onClick={handleAddOption} className="text-xs text-blue-600 hover:text-blue-700 font-bold flex items-center gap-1">
                           <span className="material-symbols-outlined text-[16px]">add</span>添加选项
                         </button>
                      )}
                    </div>
                    <div className="space-y-2.5">
                      {editForm.parsedOptions.map((opt, idx) => (
                        <div key={idx} className="flex items-center gap-3 bg-white p-2 rounded border border-slate-200 shadow-sm focus-within:border-blue-400 transition-colors">
                           <div className="flex items-center justify-center w-8 text-slate-400 font-bold">{['A','B','C','D','E','F','G'][idx] || '•'}</div>
                           <input type="text" value={opt.option} onChange={e => updateOption(idx, 'option', e.target.value)} className="flex-1 border-none outline-none text-sm text-slate-700 bg-transparent" placeholder="输入选项内容"/>
                           <label className="flex items-center gap-1 cursor-pointer pr-2 border-r border-slate-200">
                             <input type="checkbox" checked={opt.is_correct} onChange={e => updateOption(idx, 'is_correct', e.target.checked)} className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"/>
                             <span className="text-xs font-bold text-slate-500 select-none">设为正确</span>
                           </label>
                           <button type="button" onClick={() => handleRemoveOption(idx)} className="text-slate-300 hover:text-red-500 px-1" title="删除该选项">
                             <span className="material-symbols-outlined text-[18px]">close</span>
                           </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-slate-700">标准答案文本</label>
                    <input type="text" value={editForm.standardAnswer} onChange={e => setEditForm({...editForm, standardAnswer: e.target.value})} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-emerald-50/30 text-emerald-700 font-bold" placeholder="手动输入，或勾选选项自动生成"/>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-slate-700">行业标签</label>
                    <input type="text" value={editForm.industryTag} onChange={e => setEditForm({...editForm, industryTag: e.target.value})} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="例如: 互联网"/>
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-sm font-bold text-slate-700">岗位标签</label>
                    <input type="text" value={editForm.jobRoleTag} onChange={e => setEditForm({...editForm, jobRoleTag: e.target.value})} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="例如: 前端开发"/>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-slate-700">题目解析 (选填)</label>
                  <textarea rows="2" value={editForm.analysis} onChange={e => setEditForm({...editForm, analysis: e.target.value})} className="w-full border border-slate-200 rounded-lg px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none" placeholder="输入这道题的答案解析..." />
                </div>

              </div>
              
              <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 shrink-0 flex justify-end gap-3">
                <button type="button" onClick={() => setEditModal({ isOpen: false, isSubmitting: false })} className="px-5 py-2.5 text-sm font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors shadow-sm">
                  取消
                </button>
                <button type="submit" disabled={editModal.isSubmitting} className={`px-6 py-2.5 text-sm font-bold text-white rounded-lg disabled:opacity-50 transition-colors shadow-sm flex items-center gap-2 ${viewMode === 'unassigned' ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/30' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/30'}`}>
                  {editModal.isSubmitting ? <span className="material-symbols-outlined animate-spin text-[18px]">sync</span> : <span className="material-symbols-outlined text-[18px]">save</span>}
                  {editModal.isSubmitting ? '保存中...' : '确认保存'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
}