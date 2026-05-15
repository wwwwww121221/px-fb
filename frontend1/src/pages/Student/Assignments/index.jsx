import React, { useState, useEffect } from 'react';
import { getStudentMyCourses, getCourseAssignments, submitAssignment } from '../../../api/student';

export default function Assignments() {
  const [courses, setCourses] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState(null);
  
  const [assignments, setAssignments] = useState([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [loadingAssign, setLoadingAssign] = useState(false);

  // 提交作业弹窗状态
  const [submitModalOpen, setSubmitModalOpen] = useState(false);
  const [submitForm, setSubmitForm] = useState({ assignmentId: 0, content: '', attachmentUrl: '' });
  const [submitting, setSubmitting] = useState(false);

  // 🌟 核心新增：本地草稿箱字典，记录每个作业的未提交草稿 { assignmentId: { content, attachmentUrl } }
  const [drafts, setDrafts] = useState({});

  useEffect(() => {
    const fetchCourses = async () => {
      setLoadingCourses(true);
      try {
        const res = await getStudentMyCourses();
        const list = res?.data || res?.records || res || [];
        setCourses(list);
        
        if (list.length > 0) {
          const firstCourseId = list[0].courseId || list[0].id;
          setSelectedCourseId(firstCourseId);
        }
      } catch (error) {
        console.error('获取我的课程失败', error);
      } finally {
        setLoadingCourses(false);
      }
    };
    fetchCourses();
  }, []);

  const fetchAssignments = async (courseId) => {
    if (!courseId) return;
    setLoadingAssign(true);
    try {
      const res = await getCourseAssignments(courseId);
      setAssignments(res?.data || res || []);
    } catch (error) {
      console.error('获取作业列表失败', error);
      setAssignments([]);
    } finally {
      setLoadingAssign(false);
    }
  };

  useEffect(() => {
    if (selectedCourseId) {
      fetchAssignments(selectedCourseId);
    }
  }, [selectedCourseId]);

  const handleSubmitAssignment = async (e) => {
    e.preventDefault();
    if (!submitForm.content.trim()) return alert('请填写作业内容！');

    setSubmitting(true);
    try {
      const payload = {
        assignmentId: parseInt(submitForm.assignmentId, 10),
        content: submitForm.content,
        attachmentUrl: submitForm.attachmentUrl || ''
      };

      await submitAssignment(payload);
      
      alert('🎉 作业提交成功！老师批改后将在此处显示得分。');
      
      // 🌟 提交成功后，清除该作业的本地草稿
      setDrafts(prev => {
        const newDrafts = { ...prev };
        delete newDrafts[submitForm.assignmentId];
        return newDrafts;
      });

      setSubmitModalOpen(false);
      setSubmitForm({ assignmentId: 0, content: '', attachmentUrl: '' });
      fetchAssignments(selectedCourseId);
      
    } catch (error) {
      alert('作业提交失败：' + (error.message || '系统繁忙，请稍后再试'));
    } finally {
      setSubmitting(false);
    }
  };

  // 🌟 核心新增：处理暂存逻辑
  const handleSaveDraft = () => {
    setDrafts(prev => ({
      ...prev,
      [submitForm.assignmentId]: {
        content: submitForm.content,
        attachmentUrl: submitForm.attachmentUrl
      }
    }));
    setSubmitModalOpen(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 relative">
      
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <span className="material-symbols-outlined text-blue-600 text-3xl">assignment</span>
          作业中心
        </h2>
        <p className="text-slate-500 text-sm mt-1">请在左侧选择课程，查看并完成老师布置的课后作业。</p>
      </div>

      <div className="flex flex-col md:flex-row gap-6 h-[calc(100vh-14rem)] min-h-[500px]">
        
        {/* 左侧：我的课程列表 */}
        <div className="w-full md:w-80 bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col overflow-hidden shrink-0">
          <div className="p-4 bg-slate-50 border-b border-slate-100 font-bold text-slate-700 flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px]">menu_book</span> 所选课程
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {loadingCourses ? (
              <div className="text-center py-10 text-slate-400 text-sm">加载课程中...</div>
            ) : courses.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-sm">暂无学习中的课程</div>
            ) : (
              courses.map(course => {
                const currentId = course.courseId || course.id; 
                return (
                  <button
                    key={currentId}
                    onClick={() => setSelectedCourseId(currentId)}
                    className={`w-full text-left p-4 rounded-xl transition-all border ${
                      selectedCourseId === currentId 
                        ? 'bg-blue-50 border-blue-200 shadow-sm' 
                        : 'bg-white border-transparent hover:bg-slate-50 hover:border-slate-200'
                    }`}
                  >
                    <div className={`font-bold text-sm line-clamp-2 ${selectedCourseId === currentId ? 'text-blue-700' : 'text-slate-700'}`}>
                      {course.title || course.name}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* 右侧：对应课程的作业列表 */}
        <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col overflow-hidden relative">
          
          <div className="p-4 border-b border-slate-100 bg-white sticky top-0 z-10 flex justify-between items-center shadow-sm">
            <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
              任务列表
            </h3>
            <span className="text-sm font-medium text-blue-600 bg-blue-50 px-3 py-1 rounded-lg">共 {assignments.length} 份作业</span>
          </div>

          <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
            {loadingAssign ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400">
                <span className="material-symbols-outlined text-4xl animate-spin text-blue-500 mb-2">sync</span>
                <p>拉取作业数据中...</p>
              </div>
            ) : assignments.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400">
                <span className="material-symbols-outlined text-6xl mb-4 opacity-50">assignment_turned_in</span>
                <p className="text-lg font-medium text-slate-600">当前课程暂无作业任务</p>
                <p className="text-sm mt-1">老师还没有发布作业，去看看视频吧</p>
              </div>
            ) : (
              <div className="space-y-4 max-w-4xl mx-auto">
                {assignments.map(assignment => (
                  <div key={assignment.assignmentId} className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 hover:border-blue-300 hover:shadow-md transition-all group">
                    
                    <div className="flex justify-between items-start mb-3">
                      <h4 className="font-bold text-slate-800 text-xl group-hover:text-blue-600 transition-colors flex items-center gap-2">
                        {assignment.title}
                        {/* 🌟 提示：如果有草稿，在标题旁给个小标签 */}
                        {!assignment.submitted && drafts[assignment.assignmentId] && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold border bg-slate-100 text-slate-500 border-slate-200 ml-2">
                            有未提交草稿
                          </span>
                        )}
                      </h4>
                      
                      {assignment.submitted ? (
                        assignment.score !== null ? (
                          <span className="px-3 py-1 rounded text-xs font-bold border bg-emerald-50 text-emerald-600 border-emerald-200">
                            已批改
                          </span>
                        ) : (
                          <span className="px-3 py-1 rounded text-xs font-bold border bg-blue-50 text-blue-600 border-blue-200">
                            待批改
                          </span>
                        )
                      ) : (
                        <span className="px-3 py-1 rounded text-xs font-bold border bg-amber-50 text-amber-600 border-amber-200">
                          未完成
                        </span>
                      )}
                    </div>
                    
                    <p className={`mb-5 whitespace-pre-wrap leading-relaxed ${assignment.content ? 'text-slate-600' : 'text-slate-400 italic'}`}>
                      {assignment.content || '（老师未填写详细作业说明）'}
                    </p>
                    
                    <div className="flex flex-wrap gap-4 text-sm text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100 mb-5">
                      <div className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[18px] text-slate-400">event</span> 
                        截止时间: <span className="font-medium text-slate-700">{assignment.deadline ? assignment.deadline.replace('T', ' ') : '无限制'}</span>
                      </div>
                      
                      {assignment.attachmentUrl && (
                         <a href={assignment.attachmentUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline font-medium">
                           <span className="material-symbols-outlined text-[18px]">attach_file</span> 下载资料附件
                         </a>
                      )}

                      {assignment.submitted && assignment.score !== null && (
                        <div className="flex items-center gap-1.5 ml-auto">
                          <span className="material-symbols-outlined text-[18px] text-emerald-500">workspace_premium</span> 
                          最终得分: <span className="font-black text-emerald-600 text-lg">{assignment.score} 分</span>
                        </div>
                      )}
                    </div>
                    
                    {assignment.comment && (
                      <div className="mb-5 p-4 bg-blue-50/80 text-blue-900 text-sm rounded-lg border border-blue-100 flex gap-3 shadow-sm">
                         <span className="material-symbols-outlined text-[20px] text-blue-600 shrink-0">reviews</span>
                         <div><span className="font-bold text-blue-700">导师批注：</span>{assignment.comment}</div>
                      </div>
                    )}

                    <div className="pt-5 border-t border-slate-100 flex justify-end gap-3">
                      {assignment.submitted ? (
                        <button 
                          onClick={() => alert(`【您的提交记录】\n\n提交内容：\n${assignment.submittedContent || '无文本内容'}\n\n附件链接：\n${assignment.submittedAttachmentUrl || '无'}`)} 
                          className="px-6 py-2.5 bg-white border border-slate-300 text-slate-700 text-sm font-bold rounded-lg hover:bg-slate-50 transition-colors shadow-sm"
                        >
                          查看已交记录
                        </button>
                      ) : (
                        <button 
                          onClick={() => {
                            // 🌟 核心修改：打开弹窗前，先查字典里有没有这个作业的草稿！
                            const savedDraft = drafts[assignment.assignmentId] || { content: '', attachmentUrl: '' };
                            setSubmitForm({ 
                              assignmentId: assignment.assignmentId, 
                              content: savedDraft.content, 
                              attachmentUrl: savedDraft.attachmentUrl 
                            });
                            setSubmitModalOpen(true);
                          }} 
                          className="px-8 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 transition-all active:scale-95 shadow-sm shadow-blue-600/20 flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-[18px]">publish</span> 去完成作业
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 提交作业填报弹窗 */}
      {submitModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-bold flex items-center gap-2 text-slate-800">
                <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">edit_document</span>
                </div>
                提交作业内容
              </h3>
              {/* 🌟 右上角的关闭（X）同样绑定保存草稿逻辑 */}
              <button onClick={handleSaveDraft} className="text-slate-400 hover:text-slate-700 hover:bg-slate-200 p-1.5 rounded-lg transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSubmitAssignment} className="p-6 space-y-5">
              
              <div className="space-y-1.5">
                <label className="text-sm font-bold text-slate-700 flex items-center gap-1">
                  作业文字内容 <span className="text-red-500">*</span>
                </label>
                <textarea 
                  required autoFocus rows="6" 
                  placeholder="请在此输入您的作业解答、思考或报告内容..."
                  value={submitForm.content} 
                  onChange={e => setSubmitForm({...submitForm, content: e.target.value})}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-colors resize-none bg-slate-50 focus:bg-white leading-relaxed"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-bold text-slate-700 flex items-center gap-1">
                  附件资源链接 (选填)
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">link</span>
                  <input 
                    type="url" 
                    placeholder="如需上传文件，请填写您的云盘分享链接或开源仓库地址 (http://...)"
                    value={submitForm.attachmentUrl} 
                    onChange={e => setSubmitForm({...submitForm, attachmentUrl: e.target.value})}
                    className="w-full border border-slate-200 rounded-xl pl-9 pr-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-colors bg-slate-50 focus:bg-white"
                  />
                </div>
                <p className="text-xs text-slate-400 pl-1 mt-1">支持百度网盘、阿里云盘、GitHub、各类在线文档等公开访问链接。</p>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                {/* 🌟 将暂存按钮绑定到我们新写的保存方法上 */}
                <button 
                  type="button" 
                  onClick={handleSaveDraft} 
                  className="px-6 py-2.5 text-sm font-bold text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl transition-colors"
                >
                  暂存并关闭
                </button>
                <button 
                  type="submit" 
                  disabled={submitting} 
                  className="px-8 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl disabled:opacity-50 transition-all active:scale-[0.98] flex items-center gap-2 shadow-md shadow-blue-600/20"
                >
                  {submitting ? <><span className="material-symbols-outlined text-[18px] animate-spin">sync</span> 提交中</> : '确认提交'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}