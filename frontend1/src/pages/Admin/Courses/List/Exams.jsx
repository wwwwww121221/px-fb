import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { createExam, autoGenerateExam, bindExamQuestions, getQuestionList, getExamList, updateExam, deleteExam, getExamQuestions, aiGenerateExam, getExamStudentResults } from '../../../../api/course';

export default function Exams() {
  const { courseId } = useParams();
  const navigate = useNavigate();

  const [examList, setExamList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ current: 1, size: 10, total: 0 });

  const [configModal, setConfigModal] = useState({ isOpen: false, isEditing: false, examId: null });
  const [examForm, setExamForm] = useState({
    title: '', duration: 120, passTotalScore: 60
  });

  const [autoModal, setAutoModal] = useState({ isOpen: false, examId: null, isSubmitting: false });
  const [autoConfig, setAutoConfig] = useState({
    single: { enabled: true, name: '单选题', count: 5, score: 2 },
    multiple: { enabled: false, name: '多选题', count: 2, score: 5 },
    judge: { enabled: false, name: '判断题', count: 5, score: 2 },
    short: { enabled: false, name: '简答题', count: 1, score: 10 }
  });

  const [bindModal, setBindModal] = useState({ isOpen: false, examId: null, isSubmitting: false });
  const [bankQuestions, setBankQuestions] = useState([]);
  const [selectedQIds, setSelectedQIds] = useState([]);
  const [loadingQs, setLoadingQs] = useState(false);

  const [previewModal, setPreviewModal] = useState({ isOpen: false, examTitle: '' });
  const [examQuestions, setExamQuestions] = useState([]);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // 🌟 考试学员成绩弹窗状态
  const [scoreModal, setScoreModal] = useState({ isOpen: false, examId: null, examTitle: '' });
  const [examResults, setExamResults] = useState([]);
  const [loadingResults, setLoadingResults] = useState(false);

  // 🌟 AI 一键出卷状态
  const [aiModal, setAiModal] = useState({ isOpen: false, isGenerating: false });
  const [aiForm, setAiForm] = useState({ title: '', jobRoleTags: [], file: null });
  const [aiConfig, setAiConfig] = useState({
    single: { enabled: true, name: '单选', count: 5, score: 2 },
    multiple: { enabled: false, name: '多选', count: 2, score: 5 },
    judge: { enabled: false, name: '判断', count: 5, score: 2 },
    short: { enabled: false, name: '简答', count: 1, score: 10 }
  });

  // 岗位选项列表
  const jobRoleOptions = ['管理人员', '一线操作人员', '技术人员'];

  // 处理岗位多选
  const handleJobRoleChange = (role) => {
    setAiForm(prev => {
      const currentTags = prev.jobRoleTags || [];
      if (currentTags.includes(role)) {
        return { ...prev, jobRoleTags: currentTags.filter(t => t !== role) };
      } else {
        return { ...prev, jobRoleTags: [...currentTags, role] };
      }
    });
  };

  useEffect(() => {
    fetchExams();
  }, [courseId, pagination.current, pagination.size]);

  const fetchExams = async () => {
    setLoading(true);
    try {
      const res = await getExamList({ 
        courseId: parseInt(courseId, 10), 
        current: pagination.current, 
        size: pagination.size 
      });
      const records = res?.records || res?.data?.records || [];
      const total = res?.total || res?.data?.total || 0;
      setExamList(records);
      setPagination(prev => ({ ...prev, total }));
    } catch (error) {
      console.error('获取考试列表失败', error);
      setExamList([]);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setExamForm({ title: '', duration: 120, passTotalScore: 60 });
    setConfigModal({ isOpen: true, isEditing: false, examId: null });
  };

  const handleOpenEdit = (exam) => {
    setExamForm({
      title: exam.title || '', duration: exam.duration || 120,
      passTotalScore: exam.passTotalScore || 60
    });
    setConfigModal({ isOpen: true, isEditing: true, examId: exam.id });
  };

  const handleConfigSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        courseId: parseInt(courseId, 10), title: examForm.title, duration: parseInt(examForm.duration),
        passTotalScore: parseInt(examForm.passTotalScore)
      };
      
      if (configModal.isEditing) {
        await updateExam(configModal.examId, payload);
        alert('✅ 考试配置修改成功！');
      } else {
        await createExam(payload);
        alert('✅ 考试创建成功！请在列表中为其组卷。');
      }
      
      setConfigModal({ isOpen: false, isEditing: false, examId: null });
      fetchExams();
    } catch (error) {
      alert(`${configModal.isEditing ? '修改' : '创建'}失败，请检查网络`);
    }
  };

  const handleDeleteExam = async (exam) => {
    if (window.confirm(`⚠️ 危险操作：\n您确定要彻底删除考试【${exam.title}】吗？\n删除后不可恢复！`)) {
      try {
        await deleteExam(exam.id);
        alert('✅ 考试已删除！');
        if (examList.length === 1 && pagination.current > 1) {
          setPagination(prev => ({ ...prev, current: prev.current - 1 }));
        } else {
          fetchExams();
        }
      } catch (error) {
        alert('删除失败，可能该考试已有学生答卷等关联数据。');
      }
    }
  };

  // ================= 🌟 终极修复：中英混杂的底层 Key 映射 =================
  const handleAutoGenerateSubmit = async (e) => {
    e.preventDefault();
    const configPayload = {};
    
    // ⚠️ 严格采用后端的奇葩命名法：single_choice, 多选, judge, short_answer
    if (autoConfig.single.enabled) configPayload['single_choice'] = { count: Number(autoConfig.single.count), score: Number(autoConfig.single.score) };
    if (autoConfig.multiple.enabled) configPayload['多选'] = { count: Number(autoConfig.multiple.count), score: Number(autoConfig.multiple.score) };
    if (autoConfig.judge.enabled) configPayload['judge'] = { count: Number(autoConfig.judge.count), score: Number(autoConfig.judge.score) };
    if (autoConfig.short.enabled) configPayload['short_answer'] = { count: Number(autoConfig.short.count), score: Number(autoConfig.short.score) };

    if (Object.keys(configPayload).length === 0) return alert('请至少配置一种题型！');

    setAutoModal(p => ({ ...p, isSubmitting: true }));
    try {
      await autoGenerateExam(autoModal.examId, configPayload); 
      alert('🎉 自动抽题组卷成功！点击【预览试卷】即可查看生成的题目！');
      setAutoModal({ isOpen: false, examId: null, isSubmitting: false });
    } catch (error) {
      // 捕获并展示后端返回的具体错误信息
      const backendMsg = error.response?.data?.msg || error.message || '符合条件的题目数量不足';
      alert(`组卷失败：${backendMsg}\n\n请确认该课程的题库中，对应题型的题目数量是否足够。`);
      setAutoModal(p => ({ ...p, isSubmitting: false }));
    }
  };

  const openBindModal = async (id) => {
    setBindModal({ isOpen: true, examId: id, isSubmitting: false });
    setSelectedQIds([]);
    setLoadingQs(true);
    try {
      const res = await getQuestionList({ current: 1, size: 100 });
      setBankQuestions(res?.records || res?.data?.records || []);
    } catch (e) { console.error(e); } finally { setLoadingQs(false); }
  };

  const handleBindSubmit = async () => {
    if (selectedQIds.length === 0) return alert('请至少勾选一道题目！');
    setBindModal(p => ({ ...p, isSubmitting: true }));
    try {
      await bindExamQuestions(bindModal.examId, selectedQIds); 
      alert('✅ 手动绑定题目成功！');
      setBindModal({ isOpen: false, examId: null, isSubmitting: false });
    } catch (error) {
      alert('绑定失败，请重试。');
      setBindModal(p => ({ ...p, isSubmitting: false }));
    }
  };

  const toggleQuestionSelection = (id) => {
    if (selectedQIds.includes(id)) {
      setSelectedQIds(selectedQIds.filter(qId => qId !== id));
    } else {
      setSelectedQIds([...selectedQIds, id]);
    }
  };

  const handlePreviewExam = async (exam) => {
    setPreviewModal({ isOpen: true, examTitle: exam.title });
    setLoadingPreview(true);
    try {
      const res = await getExamQuestions(exam.id);
      const questions = res?.data || res || [];
      setExamQuestions(Array.isArray(questions) ? questions : []);
    } catch (error) {
      console.error('获取试卷题目失败', error);
      alert('获取试卷题目失败，请检查网络');
      setExamQuestions([]);
    } finally {
      setLoadingPreview(false);
    }
  };

  // 🌟 打开考试学员成绩弹窗
  const openScoreModal = async (exam) => {
    setScoreModal({ isOpen: true, examId: exam.id, examTitle: exam.title });
    setExamResults([]);
    setLoadingResults(true);
    try {
      const data = await getExamStudentResults(exam.id);
      setExamResults(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('获取考试学员成绩失败', error);
      alert('获取考试成绩失败，请检查网络');
      setExamResults([]);
    } finally {
      setLoadingResults(false);
    }
  };

  // 🌟 AI 一键出卷：处理文件选择
  const handleAIFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setAiForm({ ...aiForm, file: e.target.files[0] });
    }
  };

  // 🌟 AI 一键出卷：提交生成请求
  const handleAIGenerate = async (e) => {
    e.preventDefault();
    if (!aiForm.title.trim()) return alert('请输入试卷标题');
    if (!aiForm.jobRoleTags || aiForm.jobRoleTags.length === 0) return alert('请至少选择一个岗位标签');
    if (!aiForm.file) return alert('请上传用于 AI 提取知识的参考文件 (PDF/Word/TXT等)');

    const configObj = {};
    if (aiConfig.single.enabled) configObj['单选'] = { count: Number(aiConfig.single.count), score: Number(aiConfig.single.score) };
    if (aiConfig.multiple.enabled) configObj['多选'] = { count: Number(aiConfig.multiple.count), score: Number(aiConfig.multiple.score) };
    if (aiConfig.judge.enabled) configObj['判断'] = { count: Number(aiConfig.judge.count), score: Number(aiConfig.judge.score) };
    if (aiConfig.short.enabled) configObj['简答'] = { count: Number(aiConfig.short.count), score: Number(aiConfig.short.score) };

    if (Object.keys(configObj).length === 0) return alert('请至少勾选一种题型让 AI 生成！');

    const questionConfigStr = JSON.stringify(configObj);
    const jobRoleTagStr = aiForm.jobRoleTags.join(','); // 将数组转为逗号分隔的字符串

    setAiModal(prev => ({ ...prev, isGenerating: true }));
    try {
      console.log('🤖 AI 出卷参数:', {
        courseId,
        title: aiForm.title,
        jobRoleTag: jobRoleTagStr,
        questionConfig: questionConfigStr,
        file: aiForm.file?.name
      });
      await aiGenerateExam(courseId, aiForm.title, jobRoleTagStr, questionConfigStr, aiForm.file);
      alert('🎉 AI 魔法出卷成功！题目已生成并存入题库。');
      setAiModal({ isOpen: false, isGenerating: false });
      setAiForm({ title: '', jobRoleTags: [], file: null });
      fetchExams();
    } catch (error) {
      console.error('❌ AI 出卷失败:', error);
      alert('生成失败：' + (error.message || '请重试'));
      setAiModal(prev => ({ ...prev, isGenerating: false }));
    }
  };

  const renderQuestionTypeBadge = (type) => {
    switch (type) {
      case 'single_choice': case 'SINGLE': case '单选题': case '单选': return <span className="px-2 py-0.5 inline-flex text-[10px] font-bold rounded bg-blue-100 text-blue-700">单选题</span>;
      case 'multiple_choice': case 'MULTIPLE': case '多选': case '多选题': return <span className="px-2 py-0.5 inline-flex text-[10px] font-bold rounded bg-indigo-100 text-indigo-700">多选题</span>;
      case 'judge': case 'JUDGE': case '判断题': case '判断': return <span className="px-2 py-0.5 inline-flex text-[10px] font-bold rounded bg-amber-100 text-amber-700">判断题</span>;
      case 'short_answer': case '简答题': case '简答': return <span className="px-2 py-0.5 inline-flex text-[10px] font-bold rounded bg-rose-100 text-rose-700">简答题</span>;
      default: return <span className="px-2 py-0.5 inline-flex text-[10px] font-bold rounded bg-slate-100 text-slate-700">{type || '未知'}</span>;
    }
  };

  const formatOptions = (optionsStr) => {
    if (!optionsStr) return null;
    try {
      const arr = JSON.parse(optionsStr);
      if (!Array.isArray(arr) || arr.length === 0) return null;
      const labels = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
      return (
        <div className="flex flex-col gap-1.5 mt-2">
          {arr.map((item, idx) => (
            <div key={idx} className="text-sm text-slate-600 flex items-start gap-2">
              <span className={`font-bold mt-0.5 ${item.is_correct ? 'text-emerald-500' : 'text-slate-400'}`}>{labels[idx] || '•'}.</span>
              <span className={item.is_correct ? 'text-emerald-700 font-bold bg-emerald-50 px-1 rounded' : ''}>{item.option}</span>
            </div>
          ))}
        </div>
      );
    } catch (e) { return null; }
  };

  const maxPage = Math.max(1, Math.ceil(pagination.total / pagination.size));

  return (
    <div className="space-y-6 animate-in fade-in duration-300 relative pb-10">
      
      {/* 头部区域 */}
      <div className="bg-gradient-to-r from-rose-600 via-pink-600 to-fuchsia-700 p-8 rounded-2xl shadow-md text-white flex items-center justify-between relative overflow-hidden">
        <div className="absolute top-0 right-0 w-72 h-72 bg-white opacity-[0.06] rounded-full blur-3xl -translate-y-1/2 translate-x-1/4"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white opacity-[0.04] rounded-full blur-2xl translate-y-1/2 -translate-x-1/4"></div>
        <div className="flex items-center gap-5 relative z-10">
          <button onClick={() => navigate('/admin/courses')} className="p-2.5 hover:bg-white/15 rounded-xl text-white/80 hover:text-white transition-all border border-white/20">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div className="w-14 h-14 bg-white/15 backdrop-blur-sm rounded-xl flex items-center justify-center shrink-0 border border-white/25 shadow-inner">
            <span className="material-symbols-outlined text-3xl">quiz</span>
          </div>
          <div>
            <h2 className="text-2xl font-extrabold tracking-wide">课程考试管理</h2>
            <p className="text-rose-100 mt-0.5 text-sm font-medium">创建考试 · 组卷出题 · 成绩管理</p>
          </div>
        </div>
        <div className="flex gap-3 relative z-10">
          <button onClick={() => setAiModal({ isOpen: true, isGenerating: false })} className="bg-white/12 hover:bg-white/22 backdrop-blur-sm text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all active:scale-95 border border-white/20 shadow-lg">
            <span className="material-symbols-outlined text-[18px]">auto_awesome</span> AI 出卷
          </button>
          <button onClick={handleOpenCreate} className="bg-white hover:bg-rose-50 text-rose-600 px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg transition-all active:scale-95">
            <span className="material-symbols-outlined text-[18px]">add_circle</span> 创建新考试
          </button>
        </div>
      </div>

      {/* 考试列表展示区 */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col overflow-hidden min-h-[500px]">
        <div className="flex-1 overflow-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50 sticky top-0 z-10 shadow-inner">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">考试信息</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">及格线要求</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">创建时间</th>
                <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">试卷管理 (组卷)</th>
                <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan="5" className="px-6 py-16 text-center text-slate-500"><span className="material-symbols-outlined animate-spin text-3xl mb-2 text-rose-200">sync</span><p>加载考试列表中...</p></td></tr>
              ) : examList.length === 0 ? (
                <tr><td colSpan="5" className="px-6 py-16 text-center text-slate-500"><span className="material-symbols-outlined text-5xl opacity-30 mb-2">edit_document</span><p className="font-medium text-lg">当前课程尚未配置考试</p><p className="text-sm mt-1">请点击右上角「创建新考试」初始化考试空壳</p></td></tr>
              ) : examList.map((exam) => (
                <tr key={exam.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-6 py-4">
                    <div onClick={() => handlePreviewExam(exam)} className="text-sm font-bold text-rose-600 hover:text-rose-700 cursor-pointer mb-1 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[16px]">visibility</span>
                      {exam.title}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-bold">ID: {exam.id}</span>
                      <span>时长: {exam.duration} 分钟</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="inline-flex flex-col gap-1">
                       <span className="text-sm font-bold text-slate-700">总分及格线: <span className="text-rose-600">{exam.passTotalScore}</span> 分</span>
                       <span className="text-xs text-slate-400">权重: 平时{exam.weightProcess}% | 期末{exam.weightEnd}% | 实操{exam.weightPractical}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                    {new Date(exam.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end gap-2">
                       <button onClick={() => handlePreviewExam(exam)} className="px-3 py-1.5 bg-rose-50 border border-rose-100 hover:bg-rose-100 text-rose-700 rounded-md text-xs font-bold shadow-sm transition-colors flex items-center gap-1">
                          <span className="material-symbols-outlined text-[16px]">plagiarism</span> 预览试卷
                       </button>
                       <button onClick={() => openBindModal(exam.id)} className="px-3 py-1.5 bg-white border border-slate-200 hover:border-blue-400 text-blue-600 rounded-md text-xs font-bold shadow-sm transition-colors flex items-center gap-1">
                          <span className="material-symbols-outlined text-[16px]">checklist</span> 选卷
                       </button>
                       <button onClick={() => setAutoModal({ isOpen: true, examId: exam.id, isSubmitting: false })} className="px-3 py-1.5 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 text-indigo-700 rounded-md text-xs font-bold shadow-sm transition-colors flex items-center gap-1">
                          <span className="material-symbols-outlined text-[16px]">casino</span> 抽题
                       </button>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button onClick={() => openScoreModal(exam)} className="text-white bg-emerald-500 hover:bg-emerald-600 px-3 py-1 rounded text-xs font-bold shadow-sm transition-colors mr-2">
                      成绩
                    </button>
                    <button onClick={() => handleOpenEdit(exam)} className="text-slate-400 hover:text-blue-600 mr-3 transition-colors p-1" title="修改配置">
                      <span className="material-symbols-outlined text-[18px]">edit</span>
                    </button>
                    <button onClick={() => handleDeleteExam(exam)} className="text-slate-400 hover:text-red-600 transition-colors p-1" title="删除考试">
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 底部精美分页 */}
        {!loading && pagination.total > 0 && (
          <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex justify-between items-center shrunk-0">
             <span className="text-sm text-slate-500 font-medium">共 {pagination.total} 场考试，第 {pagination.current} 页</span>
             <div className="flex gap-2.5">
               <button onClick={() => setPagination(p => ({...p, current: Math.max(1, p.current - 1)}))} disabled={pagination.current === 1} className="px-3.5 py-1.5 bg-white border border-slate-300 rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-slate-50 transition-colors shadow-sm">上一页</button>
               <span className="px-4 py-1.5 text-sm text-slate-800 font-black flex items-center bg-white border border-slate-200 rounded-lg shadow-inner">{pagination.current} / {maxPage}</span>
               <button onClick={() => setPagination(p => ({...p, current: Math.min(maxPage, p.current + 1)}))} disabled={pagination.current >= maxPage} className="px-3.5 py-1.5 bg-white border border-slate-300 rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-slate-50 transition-colors shadow-sm">下一页</button>
             </div>
          </div>
        )}
      </div>

      {/* ================= 🌟 预览试卷题目的弹窗 ================= */}
      {previewModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm px-4">
          <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh]">
            <div className="px-6 py-4 border-b border-rose-100 bg-rose-50 flex justify-between items-center shrink-0">
              <h3 className="text-lg font-bold text-rose-800 flex items-center gap-2">
                <span className="material-symbols-outlined">plagiarism</span> 
                试卷预览：{previewModal.examTitle}
              </h3>
              <div className="flex items-center gap-4">
                <span className="text-sm font-bold text-rose-600 bg-white px-3 py-1 rounded-full shadow-sm">
                  共 {examQuestions.length} 题
                </span>
                <button onClick={() => setPreviewModal({ isOpen: false, examTitle: '' })} className="text-rose-400 hover:bg-rose-200 p-1.5 rounded-lg transition-colors">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-6 bg-slate-50">
              {loadingPreview ? (
                <div className="flex flex-col items-center justify-center h-full py-10">
                  <span className="material-symbols-outlined animate-spin text-4xl text-rose-300 mb-4">sync</span>
                  <p className="text-slate-500 font-medium">正在获取试卷题目...</p>
                </div>
              ) : examQuestions.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-20 bg-white rounded-xl border border-slate-200 border-dashed">
                  <span className="material-symbols-outlined text-6xl text-slate-200 mb-4">find_in_page</span>
                  <p className="text-slate-500 font-medium text-lg">该试卷尚未绑定任何题目</p>
                  <p className="text-slate-400 text-sm mt-1">请关闭弹窗，点击「选卷」或「抽题」进行组卷</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {examQuestions.map((q, index) => (
                    <div key={q.id || index} className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 hover:border-rose-300 transition-colors">
                      <div className="flex gap-3 items-start">
                        <div className="flex-shrink-0 w-8 h-8 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center font-black text-sm">
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <div className="mb-2">
                            {renderQuestionTypeBadge(q.questionType)}
                          </div>
                          <div className="text-base font-bold text-slate-800 leading-relaxed mb-3">
                            {q.content}
                          </div>
                          
                          <div className="mb-4 bg-slate-50 p-3 rounded-lg border border-slate-100">
                            {formatOptions(q.options)}
                          </div>
                          
                          <div className="flex flex-col gap-2 text-sm bg-emerald-50/50 p-3 rounded-lg border border-emerald-100">
                            <div className="flex items-start gap-2">
                              <span className="font-bold text-emerald-700 whitespace-nowrap">标准答案：</span>
                              <span className="text-emerald-600 font-medium">{q.standardAnswer || '未设置'}</span>
                            </div>
                            {q.analysis && (
                              <div className="flex items-start gap-2 border-t border-emerald-100/50 pt-2 mt-1">
                                <span className="font-bold text-emerald-700 whitespace-nowrap">题目解析：</span>
                                <span className="text-emerald-600">{q.analysis}</span>
                              </div>
                            )}
                          </div>
                          
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-slate-100 bg-white shrink-0 flex justify-end">
               <button onClick={() => setPreviewModal({ isOpen: false, examTitle: '' })} className="px-6 py-2.5 text-sm font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg shadow-sm">
                 关闭预览
               </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= 🌟 配置弹窗 (新建 / 编辑共用) ================= */}
      {configModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm px-4" onClick={e => e.target === e.currentTarget && setConfigModal({ isOpen: false, isEditing: false, examId: null })}>
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-7 py-5 border-b border-rose-100 bg-gradient-to-r from-rose-50 to-pink-50 flex justify-between items-center shrink-0">
              <div>
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2.5">
                  <span className={`w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-md ${configModal.isEditing ? 'bg-blue-500' : 'bg-gradient-to-br from-rose-500 to-pink-500'}`}>
                    <span className="material-symbols-outlined text-[20px]">{configModal.isEditing ? 'edit_note' : 'add_circle'}</span>
                  </span>
                  {configModal.isEditing ? '修改考试配置' : '创建新考试'}
                </h3>
                <p className="text-xs text-slate-400 mt-1 ml-11">{configModal.isEditing ? '调整考试基本信息' : '填写考试基本信息后，可在列表中为其组卷出题'}</p>
              </div>
              <button onClick={() => setConfigModal({ isOpen: false, isEditing: false, examId: null })} className="text-slate-300 hover:bg-slate-100 hover:text-slate-600 p-2 rounded-xl transition-colors"><span className="material-symbols-outlined">close</span></button>
            </div>

            <form onSubmit={handleConfigSubmit} className="p-7 space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-rose-500">title</span> 考试标题
                  <span className="text-red-500 font-black">*</span>
                </label>
                <input required autoFocus type="text" value={examForm.title} onChange={e => setExamForm({...examForm, title: e.target.value})} 
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-rose-400 focus:border-rose-400 transition-all bg-slate-50/50" 
                  placeholder="例如：2026年第一季度安全合规考核"/>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-blue-500">timer</span> 考试时长
                    <span className="text-red-500 font-black">*</span>
                  </label>
                  <input type="number" required min="1" value={examForm.duration} onChange={e => setExamForm({...examForm, duration: e.target.value})} 
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all bg-slate-50/50"/>
                  <p className="text-[11px] text-slate-400 pl-1">单位：分钟</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-emerald-500">verified</span> 及格线
                    <span className="text-red-500 font-black">*</span>
                  </label>
                  <input type="number" required min="0" max="100" value={examForm.passTotalScore} onChange={e => setExamForm({...examForm, passTotalScore: e.target.value})} 
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 transition-all bg-slate-50/50"/>
                  <p className="text-[11px] text-slate-400 pl-1">满分 100 分制</p>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 flex items-center gap-2.5">
                <span className="material-symbols-outlined text-[18px] text-amber-500 shrink-0">warning</span>
                <span className="text-xs font-bold text-amber-700">出题分数总和必须达到 100 分</span>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 mt-2">
                <button type="button" onClick={() => setConfigModal({ isOpen: false, isEditing: false, examId: null })} className="px-6 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors">
                  取消
                </button>
                <button type="submit" className={`px-8 py-2.5 text-sm font-bold text-white rounded-xl shadow-lg transition-all active:scale-[0.97] ${
                  configModal.isEditing 
                    ? 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 shadow-blue-500/30' 
                    : 'bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 shadow-rose-500/30'
                }`}>
                  {configModal.isEditing ? (
                    <><span className="material-symbols-outlined text-[16px] align-middle mr-1">check</span> 保存修改</>
                  ) : (
                    <><span className="material-symbols-outlined text-[16px] align-middle mr-1">add_task</span> 创建考试</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= 2. 自动规则组卷弹窗 ================= */}
      {autoModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm px-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 bg-indigo-50 flex justify-between items-center">
              <h3 className="text-lg font-bold text-indigo-800 flex items-center gap-2"><span className="material-symbols-outlined">casino</span> 传统规则自动抽题</h3>
              <button onClick={() => setAutoModal({ isOpen: false, examId: null, isSubmitting: false })} className="text-indigo-400 hover:bg-indigo-200 p-1.5 rounded-lg"><span className="material-symbols-outlined">close</span></button>
            </div>
            <form onSubmit={handleAutoGenerateSubmit} className="p-6 space-y-4">
              <p className="text-sm text-slate-500 mb-4">系统将根据您在此处配置的规则，去题库中随机抽取题目放入该试卷。</p>
              <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                {Object.keys(autoConfig).map((key) => {
                  const item = autoConfig[key];
                  return (
                    <div key={key} className={`flex items-center justify-between p-3 ${item.enabled ? 'bg-white' : 'bg-slate-50'}`}>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input type="checkbox" checked={item.enabled} onChange={e => setAutoConfig({...autoConfig, [key]: {...item, enabled: e.target.checked}})} className="w-4 h-4 text-indigo-600 rounded"/>
                        <span className={`text-sm font-bold ${item.enabled ? 'text-slate-800' : 'text-slate-400'}`}>{item.name}</span>
                      </label>
                      <div className={`flex items-center gap-3 ${item.enabled ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
                        <span className="text-xs text-slate-500">数量:</span>
                        <input type="number" min="1" value={item.count} onChange={e => setAutoConfig({...autoConfig, [key]: {...item, count: e.target.value}})} className="w-14 border rounded p-1 text-sm text-center outline-none focus:border-indigo-500"/>
                        <span className="text-xs text-slate-500">分值:</span>
                        <input type="number" min="1" value={item.score} onChange={e => setAutoConfig({...autoConfig, [key]: {...item, score: e.target.value}})} className="w-14 border rounded p-1 text-sm text-center outline-none focus:border-indigo-500"/>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button type="submit" disabled={autoModal.isSubmitting} className="w-full py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-md disabled:opacity-50">
                  {autoModal.isSubmitting ? '抽题中...' : '开始随机抽题'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= 3. 手动选题绑定弹窗 ================= */}
      {bindModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm px-4">
          <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 max-h-[85vh]">
            <div className="px-6 py-4 border-b border-slate-100 bg-blue-50 flex justify-between items-center shrink-0">
              <h3 className="text-lg font-bold text-blue-800 flex items-center gap-2"><span className="material-symbols-outlined">checklist</span> 从题库中手动选题</h3>
              <button onClick={() => setBindModal({ isOpen: false, examId: null, isSubmitting: false })} className="text-blue-400 hover:bg-blue-200 p-1.5 rounded-lg"><span className="material-symbols-outlined">close</span></button>
            </div>
            
            <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center shrink-0">
              <span className="text-sm font-bold text-slate-600">已选中 <strong className="text-blue-600 text-lg">{selectedQIds.length}</strong> 道题目</span>
            </div>

            <div className="flex-1 overflow-auto p-2">
              {loadingQs ? <p className="text-center text-slate-400 py-10">加载题库中...</p> : (
                <div className="space-y-2">
                  {bankQuestions.map(q => (
                    <label key={q.id} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${selectedQIds.includes(q.id) ? 'bg-blue-50 border-blue-300' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                      <input type="checkbox" checked={selectedQIds.includes(q.id)} onChange={() => toggleQuestionSelection(q.id)} className="mt-1 w-4 h-4 text-blue-600 rounded"/>
                      <div className="flex-1">
                        <div className="text-sm font-bold text-slate-800 line-clamp-2">{q.content}</div>
                        <div className="text-xs text-slate-400 mt-1">题型: {q.questionType} | 标签: {q.jobRoleTag || '无'}</div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-100 bg-white shrink-0 flex justify-end">
               <button onClick={handleBindSubmit} disabled={bindModal.isSubmitting || selectedQIds.length === 0} className="px-8 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-md disabled:opacity-50">
                 {bindModal.isSubmitting ? '保存绑定中...' : '确认绑定所选题目'}
               </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= 4. AI 一键出卷弹窗 ================= */}
      {aiModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm px-4">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh]">
            <div className="px-6 py-4 border-b border-violet-100 bg-gradient-to-r from-violet-50 to-fuchsia-50 flex justify-between items-center shrink-0">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <span className="material-symbols-outlined text-violet-500 text-[22px]">auto_awesome</span> AI 智能解析与生成试卷
              </h3>
              <button onClick={() => !aiModal.isGenerating && setAiModal({ isOpen: false, isGenerating: false })} className="text-slate-400 hover:bg-slate-200 p-1.5 rounded-lg transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleAIGenerate} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-6 overflow-y-auto space-y-6 bg-white">
                
                <div className="bg-violet-50 border border-violet-100 rounded-xl p-4 text-sm text-violet-800 flex items-start gap-3">
                  <span className="material-symbols-outlined text-violet-600 mt-0.5">info</span>
                  <div>
                    <strong className="block mb-1">工作原理：</strong>
                    上传您的课件、规章制度或知识文档，AI 将深度阅读并严格按照您配置的【题型分布】和【岗位需求】，自动提炼并生成一套完整的试卷。
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-slate-700">试卷标题 <span className="text-red-500">*</span></label>
                    <input required type="text" value={aiForm.title} onChange={e => setAiForm({...aiForm, title: e.target.value})} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-500" placeholder="例如: 2026 第一季度安全合规考试"/>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-slate-700">针对岗位标签（可多选）<span className="text-red-500">*</span></label>
                    <div className="flex flex-wrap gap-3 p-3 border border-slate-200 rounded-lg bg-white">
                      {jobRoleOptions.map(role => (
                        <label key={role} className="flex items-center gap-2 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={aiForm.jobRoleTags?.includes(role) || false}
                            onChange={() => handleJobRoleChange(role)}
                            className="w-4 h-4 text-violet-600 rounded border-slate-300 focus:ring-violet-500"
                          />
                          <span className={`text-sm ${aiForm.jobRoleTags?.includes(role) ? 'text-violet-700 font-medium' : 'text-slate-600 group-hover:text-slate-800'}`}>
                            {role}
                          </span>
                        </label>
                      ))}
                    </div>
                    {aiForm.jobRoleTags && aiForm.jobRoleTags.length > 0 && (
                      <p className="text-xs text-violet-600 mt-1">已选择：{aiForm.jobRoleTags.join('、')}</p>
                    )}
                  </div>
                </div>

                {/* 🌟 知识库文件上传区 */}
                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-slate-700">知识库文件 (PDF/Doc/TXT) <span className="text-red-500">*</span></label>
                  <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-300 border-dashed rounded-xl hover:border-violet-500 transition-colors bg-slate-50 group relative">
                    <div className="space-y-2 text-center">
                      <span className={`material-symbols-outlined text-4xl ${aiForm.file ? 'text-violet-500' : 'text-slate-400 group-hover:text-violet-500'}`}>
                        {aiForm.file ? 'draft' : 'upload_file'}
                      </span>
                      <div className="text-sm text-slate-600">
                        <label className="relative cursor-pointer bg-white rounded-md font-bold text-violet-600 hover:text-violet-500 focus-within:outline-none px-1">
                          <span>点击选择文件</span>
                          <input required type="file" onChange={handleAIFileChange} className="sr-only" accept=".pdf,.doc,.docx,.txt" />
                        </label>
                        <span className="pl-1">或将其拖拽到此处</span>
                      </div>
                      <p className="text-xs text-slate-500">
                        {aiForm.file ? <strong className="text-slate-700">已选择: {aiForm.file.name}</strong> : '支持最大 10MB 的文本性质文件'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 🌟 题型结构配置器 */}
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">期望的试卷结构</label>
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 flex items-center gap-2.5 mb-1">
                    <span className="material-symbols-outlined text-[18px] text-amber-500 shrink-0">warning</span>
                    <span className="text-xs font-bold text-amber-700">出题分数总和必须达到 100 分（当前: {Object.values(aiConfig).reduce((sum, q) => sum + (q.enabled ? (parseInt(q.count) || 0) * (parseInt(q.score) || 0) : 0), 0)} 分）</span>
                  </div>
                  <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                    {Object.keys(aiConfig).map((key) => {
                      const item = aiConfig[key];
                      return (
                        <div key={key} className={`flex items-center justify-between p-3 transition-colors ${item.enabled ? 'bg-white' : 'bg-slate-50'}`}>
                          <label className="flex items-center gap-3 cursor-pointer select-none min-w-[100px]">
                            <input type="checkbox" checked={item.enabled} onChange={e => setAiConfig({...aiConfig, [key]: {...item, enabled: e.target.checked}})} className="w-4 h-4 text-violet-600 rounded border-slate-300 focus:ring-violet-500"/>
                            <span className={`text-sm font-bold ${item.enabled ? 'text-slate-800' : 'text-slate-400'}`}>{item.name}题</span>
                          </label>
                          
                          <div className={`flex items-center gap-4 transition-opacity ${item.enabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-slate-500">生成</span>
                              <input type="number" min="1" max="50" value={item.count} onChange={e => setAiConfig({...aiConfig, [key]: {...item, count: e.target.value}})} className="w-16 border border-slate-300 rounded-md px-2 py-1 text-sm text-center outline-none focus:ring-2 focus:ring-violet-500"/>
                              <span className="text-xs text-slate-500">题</span>
                            </div>
                            <span className="text-slate-200">|</span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-slate-500">每题</span>
                              <input type="number" min="1" max="100" value={item.score} onChange={e => setAiConfig({...aiConfig, [key]: {...item, score: e.target.value}})} className="w-16 border border-slate-300 rounded-md px-2 py-1 text-sm text-center outline-none focus:ring-2 focus:ring-violet-500"/>
                              <span className="text-xs text-slate-500">分</span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

              </div>
              
              <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 shrink-0 flex justify-end gap-3">
                <button type="button" disabled={aiModal.isGenerating} onClick={() => setAiModal({ isOpen: false, isGenerating: false })} className="px-5 py-2.5 text-sm font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors shadow-sm disabled:opacity-50">
                  取消
                </button>
                <button type="submit" disabled={aiModal.isGenerating} className="px-6 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 rounded-lg disabled:opacity-80 transition-all shadow-md shadow-violet-500/40 flex items-center gap-2 w-40 justify-center">
                  {aiModal.isGenerating ? (
                    <><span className="material-symbols-outlined animate-spin text-[18px]">sync</span> 生成中...</>
                  ) : (
                    <><span className="material-symbols-outlined text-[18px]">magic_button</span> 开始生成</>
                  )}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* 🌟 考试学员成绩弹窗 */}
      {scoreModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm px-4" onClick={(e) => e.target === e.currentTarget && setScoreModal({ isOpen: false, examId: null, examTitle: '' })}>
          <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 max-h-[85vh]">
            <div className="px-6 py-4 border-b border-slate-100 bg-emerald-50 flex justify-between items-center shrink-0">
              <div>
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <span className="material-symbols-outlined text-emerald-500">leaderboard</span>
                  {scoreModal.examTitle} — 学员成绩
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">共 {examResults.length} 条成绩记录</p>
              </div>
              <button onClick={() => setScoreModal({ isOpen: false, examId: null, examTitle: '' })} className="text-slate-400 hover:bg-slate-200 p-1.5 rounded-lg transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="flex-1 overflow-auto">
              {loadingResults ? (
                <div className="py-20 text-center text-slate-400">
                  <span className="material-symbols-outlined text-4xl mb-2 block animate-spin">progress_activity</span>
                  加载成绩数据中...
                </div>
              ) : examResults.length === 0 ? (
                <div className="py-20 text-center text-slate-400">
                  <span className="material-symbols-outlined text-4xl mb-2 block">empty_dashboard</span>
                  暂无学员答卷记录
                </div>
              ) : (
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr>
                      <th className="px-5 py-3 text-left text-xs font-bold text-slate-500 uppercase">学员</th>
                      <th className="px-5 py-3 text-center text-xs font-bold text-slate-500 uppercase">客观分</th>
                      <th className="px-5 py-3 text-center text-xs font-bold text-slate-500 uppercase">主观分</th>
                      <th className="px-5 py-3 text-center text-xs font-bold text-slate-500 uppercase">最终得分</th>
                      <th className="px-5 py-3 text-center text-xs font-bold text-slate-500 uppercase">状态</th>
                      <th className="px-5 py-3 text-left text-xs font-bold text-slate-500 uppercase">提交时间</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-100">
                    {examResults.map((record, idx) => {
                      const isSubmitted = record.status === 2;
                      const isGrading = record.status === 1;
                      const statusMap = {
                        0: { label: '未开始', cls: 'bg-slate-100 text-slate-600' },
                        1: { label: '待批改', cls: 'bg-amber-100 text-amber-700', sub: 'AI阅卷中' },
                        2: { label: '已交卷', cls: 'bg-emerald-100 text-emerald-700' }
                      };
                      const st = statusMap[record.status] || { label: '未知', cls: 'bg-slate-100 text-slate-600' };

                      return (
                        <tr key={record.userExamId || idx} className="hover:bg-slate-50 transition-colors">
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                                {(record.userName || '?').charAt(0)}
                              </div>
                              <div>
                                <span className="font-medium text-sm text-slate-800">{record.userName}</span>
                                <span className="block text-[10px] text-slate-400">{record.idCard}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3 text-center text-sm font-medium text-slate-700">{isGrading ? '--' : (record.objectiveScore ?? 0)} 分</td>
                          <td className="px-5 py-3 text-center text-sm font-medium text-slate-700">{isGrading ? '--' : (record.subjectiveScore ?? 0)} 分</td>
                          <td className="px-5 py-3 text-center">
                            <span className={`inline-block text-base font-bold ${!isSubmitted ? 'text-slate-300' : (record.finalScore >= (scoreModal.passTotalScore || 60) ? 'text-emerald-600' : 'text-red-500')}`}>
                              {isGrading ? '--' : (isSubmitted ? (record.finalScore ?? 0) : '-')}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-center">
                            <div className="flex flex-col items-center gap-0.5">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${st.cls}`}>
                                {st.label}
                              </span>
                              {isGrading && <span className="text-[10px] text-amber-500 font-medium">{st.sub}</span>}
                            </div>
                          </td>
                          <td className="px-5 py-3 text-sm text-slate-500 whitespace-nowrap">
                            {record.submitTime ? new Date(record.submitTime).toLocaleString() : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 shrink-0 flex justify-between items-center text-xs text-slate-500">
              <span>客观分 + 主观分 = 最终得分</span>
              <button onClick={() => { setExamResults([]); setLoadingResults(true); getExamStudentResults(scoreModal.examId).then(data => { setExamResults(Array.isArray(data) ? data : []); }).catch(() => alert('刷新失败')).finally(() => setLoadingResults(false)); }} disabled={loadingResults} className="text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1 disabled:opacity-50">
                <span className={`material-symbols-outlined text-[14px] ${loadingResults ? 'animate-spin' : ''}`}>refresh</span>
                刷新
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}