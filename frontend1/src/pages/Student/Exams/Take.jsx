import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { startUserExam, getUserExamQuestions, submitUserExam } from "../../../api/student";

export default function TakeExam() {
  const { examId } = useParams();
  const navigate = useNavigate();

  // 状态管理
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [userExamId, setUserExamId] = useState(null); 
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [blockedStatus, setBlockedStatus] = useState(null);

  useEffect(() => {
    if (!examId) return;
    initExamSession();
  }, [examId]);

  const initExamSession = async () => {
    setLoading(true);
    try {
      const startRes = await startUserExam({ examId: parseInt(examId, 10) });
      const currentUid = startRes?.data?.userExamId || startRes?.userExamId;
      const existingStatus = startRes?.data?.status || startRes?.status;

      if (existingStatus === 2) {
        setBlockedStatus(2);
        setLoading(false);
        return;
      }

      if (existingStatus === 1) {
        setBlockedStatus(1);
        setLoading(false);
        return;
      }

      if (!currentUid) throw new Error("无法获取答卷流水号");
      
      setUserExamId(currentUid);

      const qRes = await getUserExamQuestions(currentUid);
      const qList = qRes?.data || qRes || [];
      console.log('📝 考试题目原始数据:', qList);
      qList.sort((a, b) => (a.sort || 0) - (b.sort || 0));
      setQuestions(qList);
      
    } catch (error) {
      console.error('初始化考试失败', error);
      alert('无法开启考试，请确认该考试是否有效或网络是否正常。');
      navigate('/student/exams'); 
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerChange = (questionId, value, type) => {
    setAnswers(prev => {
      const newAnswers = { ...prev };
      
      // 多选题逻辑
      if (type === 'multiple_choice' || type === '多选题' || type === '多选') {
        const currentArr = Array.isArray(newAnswers[questionId]) ? newAnswers[questionId] : [];
        if (currentArr.includes(value)) {
          newAnswers[questionId] = currentArr.filter(v => v !== value);
        } else {
          newAnswers[questionId] = [...currentArr, value];
        }
      } else {
        // 单选、判断逻辑
        newAnswers[questionId] = value;
      }
      
      return newAnswers;
    });
  };

  const handleSubmitExam = async () => {
    if (!window.confirm('确定要提交试卷吗？交卷后将无法修改答案！')) return;

    setSubmitting(true);
    try {
      const formattedAnswers = questions.map(q => {
        let uAns = answers[q.questionId];
        // 多选题答案如果是数组，转换为 'A、B' 格式
        if (Array.isArray(uAns)) {
          uAns = uAns.sort().join('、'); 
        }
        return {
          questionId: q.questionId,
          userAnswer: uAns || '' 
        };
      });

      const res = await submitUserExam(userExamId, { answers: formattedAnswers });
      setResult(res?.data || res);
      window.scrollTo(0, 0); 
    } catch (error) {
      alert('交卷失败，请检查网络');
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  const parseOptions = (optionsStr) => {
    // 如果是字符串（JSON 格式），解析并转为选项数组
    if (typeof optionsStr === 'string') {
      try {
        const obj = JSON.parse(optionsStr);
        // 转换为 [{ label: 'A', text: '选项内容' }, ...] 格式
        const result = [];
        for (const [key, value] of Object.entries(obj)) {
          result.push({ label: key, text: value });
        }
        return result;
      } catch { return []; }
    }
    // 如果已经是数组，直接返回
    if (Array.isArray(optionsStr)) return optionsStr;
    return [];
  };

  // 🌟 优化的 Badge 组件
  const renderBadge = (type) => {
    const baseClass = "px-2.5 py-1 inline-flex text-xs font-bold rounded-md border";
    switch (type) {
      case 'single_choice': case '单选': case '单选题': return <span className={`${baseClass} bg-sky-50 text-sky-700 border-sky-100`}>单选题</span>;
      case 'multiple_choice': case '多选': case '多选题': return <span className={`${baseClass} bg-indigo-50 text-indigo-700 border-indigo-100`}>多选题</span>;
      case 'judge': case '判断': case '判断题': case 'true_false': return <span className={`${baseClass} bg-amber-50 text-amber-700 border-amber-100`}>判断题</span>;
      case 'short_answer': case '简答': case '简答题': return <span className={`${baseClass} bg-rose-50 text-rose-700 border-rose-100`}>简答题</span>;
      default: return <span className={`${baseClass} bg-slate-50 text-slate-700 border-slate-100`}>{type}</span>;
    }
  };

  // ==================== 1. 加载中状态 (全屏沉浸) ====================
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center animate-in fade-in duration-500">
        <span className="material-symbols-outlined animate-spin text-5xl text-blue-500 mb-5">sync</span>
        <h2 className="text-xl font-black text-slate-800 tracking-tight">正在为您生成专属答卷...</h2>
        <p className="text-slate-500 mt-2 text-sm font-medium">请稍候，答题即将开始</p>
      </div>
    );
  }

  // ==================== 1.5 拦截状态：已考完 / 考试进行中（禁止重复进入） ====================
  if (blockedStatus !== null) {
    return (
      <div className="min-h-screen bg-slate-50 py-12 px-4 flex justify-center animate-in fade-in duration-500">
        <div className="bg-white max-w-lg w-full rounded-3xl shadow-xl overflow-hidden border border-slate-100">
          <div className={`p-12 text-center text-white relative overflow-hidden ${blockedStatus === 2 ? 'bg-gradient-to-b from-emerald-600 to-teal-700' : 'bg-gradient-to-b from-amber-500 to-orange-600'}`}>
            <span className="material-symbols-outlined text-[150px] opacity-10 absolute -right-6 -bottom-6">{blockedStatus === 2 ? 'task_alt' : 'hourglass_top'}</span>
            <span className="material-symbols-outlined text-7xl mb-4 relative z-10">{blockedStatus === 2 ? 'verified' : 'pending'}</span>
            <h2 className="text-3xl font-black mb-2 relative z-10 tracking-tight">
              {blockedStatus === 2 ? '您已完成此考试' : '考试正在进行中'}
            </h2>
            <p className={ `text-sm font-medium relative z-10 ${blockedStatus === 2 ? 'text-emerald-100' : 'text-amber-100'}` }>
              {blockedStatus === 2
                ? '您的答卷已提交，无法重复参加同一考试。请等待成绩发布后申请证书。'
                : '您已有未完成的考试记录，请返回继续作答或联系管理员。'
              }
            </p>
          </div>

          <div className="p-8 space-y-4">
            {blockedStatus === 1 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                <span className="material-symbols-outlined text-amber-500 mt-0.5">info</span>
                <div className="text-sm text-amber-800">
                  <p className="font-bold">提示</p>
                  <p>如果您在答题过程中遇到异常退出，可尝试重新点击进入考场恢复答题。</p>
                </div>
              </div>
            )}

            <button onClick={() => navigate('/student/exams')} className={`w-full py-4 rounded-xl font-black text-base shadow-lg transition-all active:scale-95 ${
              blockedStatus === 2
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-emerald-500/20'
                : 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-amber-500/20'
            }`}>
              返回考试大厅
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==================== 2. 交卷结果页 (简洁美观) ====================
  if (result) {
    return (
      <div className="min-h-screen bg-slate-50 py-12 px-4 flex justify-center animate-in fade-in duration-700">
        <div className="bg-white max-w-xl w-full rounded-3xl shadow-xl overflow-hidden border border-slate-100">
          <div className="bg-gradient-to-b from-blue-600 to-indigo-700 p-12 text-center text-white relative overflow-hidden">
            {/* 装饰性大图标 */}
            <span className="material-symbols-outlined text-[150px] opacity-10 absolute -right-6 -bottom-6">task_alt</span>
            <span className="material-symbols-outlined text-7xl mb-4 relative z-10">verified</span>
            <h2 className="text-3xl font-black mb-2 relative z-10 tracking-tight">交卷成功！</h2>
            <p className="text-blue-100 text-sm font-medium relative z-10">您的答卷已安全上传至系统云端，请等待成绩发布。</p>
          </div>
          
          <div className="p-10 space-y-8">
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-white border border-slate-100 rounded-2xl p-6 text-center shadow-inner">
                <p className="text-xs font-bold text-slate-500 mb-2 tracking-wide uppercase">客观题得分</p>
                <div className="text-5xl font-black text-blue-700">{result.objectiveScore || 0} <span className="text-lg text-blue-400 font-bold">分</span></div>
                <p className="text-xs text-slate-400 mt-2">系统已自动完成判分</p>
              </div>
              <div className="bg-white border border-slate-100 rounded-2xl p-6 text-center shadow-inner">
                <p className="text-xs font-bold text-slate-500 mb-2 tracking-wide uppercase">待批主观题</p>
                <div className="text-5xl font-black text-amber-700">{result.subjectiveCount || 0} <span className="text-lg text-amber-400 font-bold">道</span></div>
                <p className="text-xs text-slate-400 mt-2">需导师人工阅卷</p>
              </div>
            </div>

            <button onClick={() => navigate('/student/exams')} className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-black text-base shadow-lg shadow-blue-500/20 transition-all active:scale-95">
              返回考试大厅
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 进度条逻辑
  const answeredCount = Object.keys(answers).filter(k => {
    const val = answers[k];
    return Array.isArray(val) ? val.length > 0 : !!val;
  }).length;
  const progress = Math.round((answeredCount / questions.length) * 100) || 0;

  // ==================== 3. 答题主页面 (简介优美) ====================
  return (
    <div className="min-h-screen bg-slate-50 pb-36 animate-in fade-in duration-300">
      
      {/* 🌟 简洁美观的顶部状态栏 */}
      <div className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-slate-100 shadow-sm px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-xl flex items-center justify-center font-black shadow-md shadow-blue-500/10">
            <span className="material-symbols-outlined">edit_document</span>
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-800 tracking-tight">考试进行中</h1>
            <p className="text-xs font-medium text-slate-400">请保持专注，诚信作答</p>
          </div>
        </div>
        
        {/* 精美的进度条 */}
        <div className="flex items-center gap-6 w-1/3 max-w-md">
          <div className="flex-1">
            <div className="flex justify-between text-xs font-bold text-slate-500 mb-1.5">
              <span>答题进度</span>
              <span className={progress === 100 ? 'text-emerald-600' : 'text-slate-700'}>{answeredCount} / {questions.length}</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-500 rounded-full ${progress === 100 ? 'bg-emerald-500' : 'bg-gradient-to-r from-blue-500 to-indigo-600'}`} 
                style={{ width: `${progress}%` }}>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 🌟 核心答题区域 */}
      <div className="max-w-4xl mx-auto mt-10 space-y-6 px-4">
        {questions.map((q, index) => {
          const opts = parseOptions(q.options);
          const qType = q.questionType;
          const isMultiple = qType === 'multiple_choice' || qType === '多选题' || qType === '多选';
          const isShort = qType === 'short_answer' || qType === '简答题' || qType === '简答';
          const labels = ['A', 'B', 'C', 'D', 'E', 'F'];

          return (
            // 🌟 精致的题目卡片
            <div key={q.questionId} className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 transition-shadow hover:shadow-md">
              <div className="flex gap-5 items-start mb-8">
                {/* 题号 */}
                <div className="flex-shrink-0 w-10 h-10 bg-slate-100 text-slate-700 font-black rounded-xl flex items-center justify-center text-sm border border-slate-200">
                  {String(index + 1).padStart(2, '0')}
                </div>
                {/* 题干信息 */}
                <div className="flex-1 overflow-hidden">
                  <div className="flex items-center gap-3 mb-3">
                    {renderBadge(q.questionType)}
                    <span className="text-sm font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-100">{q.score} 分</span>
                  </div>
                  <div className="text-xl font-black text-slate-800 leading-relaxed select-none tracking-tight">
                    {q.content}
                  </div>
                </div>
              </div>

              {/* 🌟 选项/回答区域 */}
              <div className="pl-13 ml-3">
                {isShort ? (
                  // 🌟 主观题输入框
                  <textarea 
                    value={answers[q.questionId] || ''}
                    onChange={(e) => handleAnswerChange(q.questionId, e.target.value, qType)}
                    placeholder="在此处输入您的完整解答内容..."
                    className="w-full min-h-[180px] p-5 border-2 border-slate-200 rounded-xl outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100 transition-all text-base text-slate-700 resize-y"
                  />
                ) : (
                  // 🌟 客观题选项 (精美大卡片)
                  <div className="space-y-3.5">
                    {opts.map((opt, oIdx) => {
                      const label = opt.label || labels[oIdx] || '•';
                      let isChecked = false;
                      if (isMultiple) {
                        isChecked = Array.isArray(answers[q.questionId]) && answers[q.questionId].includes(label);
                      } else {
                        isChecked = answers[q.questionId] === label;
                      }

                      return (
                        <label 
                          key={oIdx} 
                          className={`flex items-center gap-5 p-5 rounded-2xl border-2 cursor-pointer transition-all select-none
                            ${isChecked 
                                ? 'border-blue-500 bg-blue-50/50 shadow-inner' 
                                : 'border-slate-100 hover:border-slate-300 hover:bg-slate-50'
                            }`}
                        >
                          {/*优雅的选中指示器 */}
                          <div className={`w-6 h-6 rounded flex items-center justify-center border-2 flex-shrink-0 transition-colors
                            ${isChecked 
                                ? 'bg-blue-600 border-blue-600 text-white' 
                                : 'border-slate-300 bg-white text-transparent'
                            }`}>
                            <span className="text-xs font-black">{label}</span>
                          </div>
                          <input 
                            type={isMultiple ? "checkbox" : "radio"}
                            name={`question_${q.questionId}`}
                            className="hidden"
                            checked={isChecked}
                            onChange={() => handleAnswerChange(q.questionId, label, qType)}
                          />
                          <span className={`text-base font-black ${isChecked ? 'text-blue-700' : 'text-slate-500'}`}>{label}.</span>
                          <span className={`text-base ${isChecked ? 'text-blue-900 font-medium' : 'text-slate-700 font-medium'}`}>{opt.text || opt.option || ''}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 🌟 精致的底部交卷悬浮栏 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-slate-100 p-5 shadow-[0_-10px_50px_-10px_rgba(0,0,0,0.06)] z-50 animate-in slide-in-from-bottom duration-500 delay-150">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="text-slate-500 text-sm font-medium flex items-center gap-2">
            <span className="material-symbols-outlined text-amber-500 text-[20px]">lightbulb</span>
            全部题目作答完毕后，请点击右侧交卷上传。交卷后不可修改。
          </div>
          <button 
            onClick={handleSubmitExam}
            disabled={submitting}
            className="px-10 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl font-black text-base shadow-lg shadow-blue-500/20 transition-all active:scale-95 disabled:opacity-60 flex items-center gap-2"
          >
            {submitting ? (
              <><span className="material-symbols-outlined animate-spin">sync</span> 交卷中...</>
            ) : (
              <><span className="material-symbols-outlined">send</span> 确认提交试卷</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}