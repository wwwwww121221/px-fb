import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getCourseDetail,
  getCourseScoreList,
  updateCourseWeights,
  submitProcessScore,
  submitPracticalScore
} from '../../../../api/course';

const DEFAULT_WEIGHTS = { weightExams: 0.4, weightProcess: 0.3, weightPractical: 0.3 };

export default function CourseScoreCenter() {
  const { courseId } = useParams();
  const navigate = useNavigate();

  const [courseName, setCourseName] = useState('');
  const [loading, setLoading] = useState(true);

  const [weights, setWeights] = useState(DEFAULT_WEIGHTS);
  const [editingWeights, setEditingWeights] = useState(false);
  const [tempWeights, setTempWeights] = useState(DEFAULT_WEIGHTS);
  const [savingWeights, setSavingWeights] = useState(false);

  const [students, setStudents] = useState([]);
  const [scoreLoading, setScoreLoading] = useState(false);

  const [scoringModal, setScoringModal] = useState({
    isOpen: false,
    type: '',
    student: null
  });
  const [scoreItems, setScoreItems] = useState([{ name: '', score: '' }]);
  const [submittingScore, setSubmittingScore] = useState(false);

  useEffect(() => {
    fetchCourseDetail();
    fetchScoreList();
  }, [courseId]);

  const fetchCourseDetail = async () => {
    try {
      const data = await getCourseDetail(courseId);
      setCourseName(data.name || '');
      setWeights({
        weightExams: data.weightExams ?? DEFAULT_WEIGHTS.weightExams,
        weightProcess: data.weightProcess ?? DEFAULT_WEIGHTS.weightProcess,
        weightPractical: data.weightPractical ?? DEFAULT_WEIGHTS.weightPractical
      });
    } catch (e) {
      console.error('获取课程详情失败', e);
    }
  };

  const fetchScoreList = async () => {
    setLoading(true);
    setScoreLoading(true);
    try {
      const data = await getCourseScoreList(courseId);
      setStudents(Array.isArray(data) ? data : (data?.records || data?.list || []));
    } catch (e) {
      console.error('获取成绩列表失败', e);
      setStudents([]);
    } finally {
      setLoading(false);
      setScoreLoading(false);
    }
  };

  const startEditWeights = () => {
    setTempWeights({ ...weights });
    setEditingWeights(true);
  };

  const cancelEditWeights = () => {
    setEditingWeights(false);
    setTempWeights({ ...weights });
  };

  const handleSaveWeights = async () => {
    const sum = Object.values(tempWeights).reduce((a, b) => a + Number(b), 0);
    if (Math.abs(sum - 1.0) > 0.001) {
      alert(`权重总和必须等于 100%，当前为 ${(sum * 100).toFixed(1)}%`);
      return;
    }

    setSavingWeights(true);
    try {
      await updateCourseWeights({
        id: Number(courseId),
        weightExams: Number(tempWeights.weightExams),
        weightProcess: Number(tempWeights.weightProcess),
        weightPractical: Number(tempWeights.weightPractical)
      });
      setWeights({ ...tempWeights });
      setEditingWeights(false);
      alert('权重保存成功！系统将自动重新计算所有学员总分。');
      fetchScoreList();
    } catch (e) {
      alert('保存失败：' + (e?.message || '请重试'));
    } finally {
      setSavingWeights(false);
    }
  };

  const openScoringModal = (student, type) => {
    setScoringModal({ isOpen: true, type, student });
    setScoreItems([{ name: '', score: '' }]);
  };

  const closeScoringModal = () => {
    setScoringModal({ isOpen: false, type: '', student: null });
    setScoreItems([{ name: '', score: '' }]);
  };

  const addScoreItem = () => {
    setScoreItems([...scoreItems, { name: '', score: '' }]);
  };

  const removeScoreItem = (index) => {
    if (scoreItems.length <= 1) return;
    setScoreItems(scoreItems.filter((_, i) => i !== index));
  };

  const updateScoreItem = (index, field, value) => {
    const updated = [...scoreItems];
    updated[index][field] = value;
    setScoreItems(updated);
  };

  const getTotalFromItems = () => {
    return scoreItems.reduce((sum, item) => sum + (Number(item.score) || 0), 0);
  };

  const handleSubmitScore = async () => {
    const hasEmpty = scoreItems.some(item => !item.name.trim() || item.score === '' || item.score === null || item.score === undefined);
    if (hasEmpty) {
      alert('请填写完整的评分维度名称和分数');
      return;
    }

    const total = getTotalFromItems();
    if (total < 0 || total > 100) {
      alert(`明细总分必须介于 0 ~ 100 之间，当前总计：${total.toFixed(1)}分`);
      return;
    }

    if (!scoringModal.student?.userId) {
      alert('无法获取学员ID，请刷新页面重试');
      return;
    }

    setSubmittingScore(true);
    try {
      const payload = {
        userId: scoringModal.student.userId,
        courseId: Number(courseId),
        items: scoreItems.map(item => ({
          name: item.name.trim(),
          score: Number(item.score)
        })),
        totalScore: Math.round(total * 100) / 100
      };

      const submitFn = scoringModal.type === 'process' ? submitProcessScore : submitPracticalScore;
      await submitFn(payload);

      alert('打分成功！');
      closeScoringModal();
      fetchScoreList();
    } catch (e) {
      alert('打分失败：' + (e?.message || '请重试'));
    } finally {
      setSubmittingScore(false);
    }
  };

  const weightSum = editingWeights
    ? Object.values(tempWeights).reduce((a, b) => a + Number(b), 0)
    : Object.values(weights).reduce((a, b) => a + Number(b), 0);

  return (
    <div className="p-6 max-w-7xl mx-auto animate-in fade-in duration-300">
      {/* 页头 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/admin/courses')} className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition-colors">
            <span className="material-symbols-outlined text-[22px]">arrow_back</span>
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-500 text-[24px]">leaderboard</span>
              课程成绩控制中心
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              当前课程：<strong>{courseName || `ID: ${courseId}`}</strong>
            </p>
          </div>
        </div>
        <button onClick={fetchScoreList} disabled={scoreLoading} className="text-sm text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 disabled:opacity-50">
          <span className={`material-symbols-outlined text-[16px] ${scoreLoading ? 'animate-spin' : ''}`}>refresh</span>
          刷新数据
        </button>
      </div>

      {/* ========== 一、顶部：全局权重配置区 ========== */}
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <span className="material-symbols-outlined text-amber-500 text-[20px]">tune</span>
            全局权重配置
          </h2>
          {!editingWeights ? (
            <button onClick={startEditWeights} className="text-sm bg-amber-500 hover:bg-amber-600 text-white px-4 py-1.5 rounded-lg transition-colors flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px]">edit</span> 修改权重
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button onClick={cancelEditWeights} className="text-sm text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-colors">取消</button>
              <button onClick={handleSaveWeights} disabled={savingWeights} className="text-sm bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 rounded-lg transition-colors flex items-center gap-1 disabled:opacity-50">
                {savingWeights ? <span className="material-symbols-outlined animate-spin text-[14px]">sync</span> : null}
                {savingWeights ? '保存中...' : '保存权重'}
              </button>
            </div>
          )}
        </div>

        <div className={`grid grid-cols-3 gap-6 ${editingWeights ? 'bg-amber-50/50 dark:bg-amber-900/10 rounded-lg p-4' : ''}`}>
          {[
            { key: 'weightExams', label: '考试权重', icon: 'quiz', color: 'blue' },
            { key: 'weightProcess', label: '过程权重', icon: 'assignment', color: 'indigo' },
            { key: 'weightPractical', label: '实操权重', icon: 'build', color: 'emerald' }
          ].map(({ key, label, icon, color }) => (
            <div key={key} className="relative">
              <div className="flex items-center gap-2 mb-2">
                <span className={`material-symbols-outlined text-${color}-500 text-[18px]`}>{icon}</span>
                <span className="text-sm font-medium text-slate-600">{label}</span>
              </div>
              {editingWeights ? (
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  value={tempWeights[key]}
                  onChange={(e) => setTempWeights({ ...tempWeights, [key]: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-lg font-bold outline-none focus:ring-2 focus:ring-amber-500 dark:bg-slate-800"
                />
              ) : (
                <div className="text-2xl font-bold text-slate-900">
                  {(Number(weights[key]) * 100).toFixed(0)}<span className="text-sm font-normal text-slate-400 ml-0.5">%</span>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className={`mt-3 text-xs flex items-center gap-1.5 ${Math.abs(weightSum - 1.0) > 0.001 ? 'text-red-500 font-medium' : 'text-slate-400'}`}>
          <span className="material-symbols-outlined text-[14px]">{Math.abs(weightSum - 1.0) > 0.001 ? 'warning' : 'check_circle'}</span>
          权重总和：{(weightSum * 100).toFixed(1)}%
          {Math.abs(weightSum - 1.0) > 0.001 && editingWeights && ' — 总和必须等于 100%'}
        </div>
      </div>

      {/* ========== 二、中间：学员成绩统计看板 ========== */}
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/30">
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-500 text-[20px]">table_chart</span>
            学员成绩看板
            <span className="ml-2 text-xs font-normal text-slate-400">共 {students.length} 名学员</span>
          </h2>
        </div>

        {loading ? (
          <div className="py-20 text-center text-slate-400">
            <span className="material-symbols-outlined text-4xl mb-2 block animate-spin">progress_activity</span>
            加载成绩数据中...
          </div>
        ) : students.length === 0 ? (
          <div className="py-20 text-center text-slate-400">
            <span className="material-symbols-outlined text-4xl mb-2 block">empty_dashboard</span>
            暂无学员成绩数据
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
              <thead className="bg-slate-50 dark:bg-slate-800/50 sticky top-0">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">学员姓名</th>
                  <th className="px-5 py-3 text-center text-xs font-semibold text-slate-500 uppercase">考试均分</th>
                  <th className="px-5 py-3 text-center text-xs font-semibold text-slate-500 uppercase">过程分</th>
                  <th className="px-5 py-3 text-center text-xs font-semibold text-slate-500 uppercase">实操分</th>
                  <th className="px-5 py-3 text-center text-xs font-semibold text-slate-500 uppercase">最终总分</th>
                  <th className="px-5 py-3 text-center text-xs font-semibold text-slate-500 uppercase">通过状态</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 uppercase">操作</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100 dark:bg-slate-900 dark:divide-slate-800">
                {students.map((stu, idx) => {
                  const examAvg = stu.examsAvgScore;
                  const processScore = stu.processScore;
                  const practicalScore = stu.practicalScore;
                  const totalScore = stu.totalScore;
                  const isPass = stu.isPassed;

                  return (
                    <tr key={stu.userId || idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                            {(stu.userName || '?').charAt(0)}
                          </div>
                          <span className="font-medium text-slate-800 text-sm">{stu.userName || '未知学员'}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-center text-sm text-slate-700 font-medium">{examAvg != null ? `${examAvg}分` : '-'}</td>
                      <td className="px-5 py-3.5 text-center">
                        <span className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 cursor-pointer hover:text-indigo-800 hover:underline" onClick={() => openScoringModal(stu, 'process')}>
                          {processScore != null ? `${processScore}分` : '未打分'}
                          <span className="material-symbols-outlined text-[14px]">edit_note</span>
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <span className="inline-flex items-center gap-1 text-sm font-medium text-emerald-600 cursor-pointer hover:text-emerald-800 hover:underline" onClick={() => openScoringModal(stu, 'practical')}>
                          {practicalScore != null ? `${practicalScore}分` : '未打分'}
                          <span className="material-symbols-outlined text-[14px]">edit_note</span>
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <span className={`inline-block text-base font-bold ${totalScore == null ? 'text-slate-300' : isPass ? 'text-emerald-600' : 'text-red-500'}`}>
                          {totalScore ?? '-'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        {isPass == null ? (
                          <span className="text-xs text-slate-400">-</span>
                        ) : isPass ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                            <span className="material-symbols-outlined text-[12px]">check_circle</span> 已及格
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                            <span className="material-symbols-outlined text-[12px]">cancel</span> 未及格
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => openScoringModal(stu, 'process')} className="text-indigo-600 hover:bg-indigo-50 px-3 py-1 rounded-md text-xs font-medium transition-colors">
                            过程评价
                          </button>
                          <button onClick={() => openScoringModal(stu, 'practical')} className="text-emerald-600 hover:bg-emerald-50 px-3 py-1 rounded-md text-xs font-medium transition-colors">
                            实操评价
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ========== 三、弹窗：动态详情打分组件 ========== */}
      {scoringModal.isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4" onClick={(e) => e.target === e.currentTarget && closeScoringModal()}>
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <span className={`material-symbols-outlined ${scoringModal.type === 'process' ? 'text-indigo-500' : 'text-emerald-500'}`}>
                    {scoringModal.type === 'process' ? 'assignment' : 'build'}
                  </span>
                  {scoringModal.type === 'process' ? '过程性打分' : '实操打分'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  学员：{scoringModal.student?.userName || '未知'}
                </p>
              </div>
              <button onClick={closeScoringModal} className="text-slate-400 hover:text-slate-600 hover:bg-slate-200 p-1.5 rounded-lg transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleSubmitScore(); }} className="p-6 space-y-5">
              {scoreItems.map((item, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div className="flex-1 grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-slate-500 mb-1 block">评分维度名称</label>
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => updateScoreItem(index, 'name', e.target.value)}
                        placeholder="例如：课堂表现、作业完成度..."
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-500 mb-1 block">分数（0~100）</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={item.score}
                        onChange={(e) => updateScoreItem(index, 'score', e.target.value)}
                        placeholder="0 - 100"
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeScoreItem(index)}
                    disabled={scoreItems.length <= 1}
                    className="mt-6 text-slate-400 hover:text-red-500 disabled:opacity-30 p-1 transition-colors"
                    title="删除此维度"
                  >
                    <span className="material-symbols-outlined text-[18px]">delete_outline</span>
                  </button>
                </div>
              ))}

              <button type="button" onClick={addScoreItem} className="w-full border-2 border-dashed border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 rounded-lg py-2.5 text-sm text-slate-500 hover:text-indigo-600 transition-colors flex items-center justify-center gap-1.5">
                <span className="material-symbols-outlined text-[16px]">add_circle_outline</span>
                添加评分维度
              </button>

              <div className={`rounded-lg p-3 flex items-center justify-between ${getTotalFromItems() > 100 || getTotalFromItems() < 0 ? 'bg-red-50 border border-red-200' : 'bg-slate-50 border border-slate-200'}`}>
                <span className="text-sm text-slate-600">明细总分合计</span>
                <span className={`text-lg font-bold ${getTotalFromItems() > 100 || getTotalFromItems() < 0 ? 'text-red-600' : 'text-slate-900'}`}>
                  {getTotalFromItems().toFixed(1)} <span className="text-xs font-normal text-slate-400">/ 100</span>
                </span>
              </div>

              {getTotalFromItems() > 100 && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">warning</span>
                  总分超过 100，提交按钮已置灰。请调整各维度分数。
                </p>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={closeScoringModal} className="px-5 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors">
                  取消
                </button>
                <button
                  type="submit"
                  disabled={submittingScore || getTotalFromItems() > 100 || getTotalFromItems() < 0}
                  className={`px-6 py-2.5 text-sm font-medium text-white rounded-lg shadow-sm transition-colors flex items-center gap-1.5 ${
                    scoringModal.type === 'process'
                      ? 'bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300'
                      : 'bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300'
                  } disabled:opacity-50`}
                >
                  {submittingScore ? <span className="material-symbols-outlined animate-spin text-sm">sync</span> : null}
                  {submittingScore ? '提交中...' : '确认提交'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
