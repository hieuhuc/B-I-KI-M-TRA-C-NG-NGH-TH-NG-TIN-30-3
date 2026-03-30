import React, { useState, useEffect, useMemo } from 'react';
import { Download, Upload, LogIn, CheckCircle2, AlertCircle, FileText, RefreshCw, QrCode, Share2 } from 'lucide-react';
import mammoth from 'mammoth';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { QRCodeSVG } from 'qrcode.react';
import axios from 'axios';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Question {
  id: number;
  text: string;
  options: string[];
  correctAnswer: number; 
}

interface StudentInfo {
  fullName: string;
  studentId: string;
}

interface QuizResult {
  student: StudentInfo;
  score: number;
  correctCount: number;
  totalQuestions: number;
  timestamp: string;
}

const TEACHER_PASSWORD = 'admin';

export default function App() {
  const [step, setStep] = useState<'login' | 'quiz' | 'result' | 'teacher' | 'teacher-login'>('login');
  const [student, setStudent] = useState<StudentInfo>({ fullName: '', studentId: '' });
  const [teacherCredentials, setTeacherCredentials] = useState({ username: '', password: '' });
  const [questions, setQuestions] = useState<Question[]>([]);
  const [userAnswers, setUserAnswers] = useState<Record<number, number>>({});
  const [subject, setSubject] = useState('ĐANG TẢI...');
  const [resultsList, setResultsList] = useState<QuizResult[]>([]);
  const [showQR, setShowQR] = useState(false);

  // Fetch quiz config from server
  const fetchQuizConfig = async () => {
    try {
      const response = await axios.get('/api/quiz-config');
      setSubject(response.data.subject);
      setQuestions(response.data.questions);
    } catch (error) {
      console.error('Error fetching quiz config:', error);
    }
  };

  // Fetch results from server (Teacher only)
  const fetchResults = async () => {
    try {
      const response = await axios.get(`/api/results?password=${TEACHER_PASSWORD}`);
      setResultsList(response.data);
    } catch (error) {
      console.error('Error fetching results:', error);
    }
  };

  useEffect(() => {
    fetchQuizConfig();
  }, []);

  useEffect(() => {
    if (step === 'teacher') {
      fetchResults();
      const interval = setInterval(fetchResults, 5000); // Poll for new results
      return () => clearInterval(interval);
    }
  }, [step]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (student.fullName.trim() && student.studentId.trim()) {
      setStep('quiz');
    } else {
      alert('Vui lòng nhập đầy đủ Họ tên và Mã số sinh viên!');
    }
  };

  const handleTeacherAccess = () => {
    setStep('teacher-login');
  };

  const handleTeacherLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (teacherCredentials.username === 'admin' && teacherCredentials.password === 'admin') {
      setStep('teacher');
    } else {
      alert('Tài khoản hoặc mật khẩu không chính xác!');
    }
  };

  const handleAnswerChange = (questionId: number, optionIdx: number) => {
    setUserAnswers(prev => ({ ...prev, [questionId]: optionIdx }));
  };

  const calculateScore = (currentQuestions: Question[], currentAnswers: Record<number, number>) => {
    let correct = 0;
    currentQuestions.forEach(q => {
      if (currentAnswers[q.id] === q.correctAnswer) {
        correct++;
      }
    });
    const score = (correct / currentQuestions.length) * 10;
    return { correct, score };
  };

  const handleSubmitQuiz = async () => {
    if (Object.keys(userAnswers).length < questions.length) {
      const confirmSubmit = window.confirm('Bạn chưa hoàn thành tất cả câu hỏi. Bạn có chắc chắn muốn nộp bài không?');
      if (!confirmSubmit) return;
    }
    
    const { correct, score } = calculateScore(questions, userAnswers);
    const newResult: QuizResult = {
      student,
      score,
      correctCount: correct,
      totalQuestions: questions.length,
      timestamp: new Date().toLocaleString('vi-VN'),
    };

    try {
      await axios.post('/api/results', newResult);
      setStep('result');
    } catch (error) {
      console.error('Error submitting quiz:', error);
      alert('Có lỗi xảy ra khi nộp bài. Vui lòng thử lại.');
    }
  };

  const currentScore = useMemo(() => calculateScore(questions, userAnswers), [questions, userAnswers]);

  const exportAllResults = () => {
    if (resultsList.length === 0) {
      alert('Chưa có kết quả nào để xuất!');
      return;
    }
    const blob = new Blob([JSON.stringify(resultsList, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `danh_sach_ket_qua_${new Date().getTime()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const updateQuizOnServer = async (newSubject: string, newQuestions: Question[]) => {
    try {
      await axios.post('/api/quiz-config', {
        subject: newSubject,
        questions: newQuestions,
        password: TEACHER_PASSWORD
      });
      setSubject(newSubject);
      setQuestions(newQuestions);
      alert('Đã cập nhật bài thi lên hệ thống!');
    } catch (error) {
      console.error('Error updating quiz:', error);
      alert('Lỗi cập nhật bài thi.');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      const text = result.value;
      
      const lines = text.split('\n').filter(line => line.trim() !== '');
      const newQuestions: Question[] = [];
      
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].toLowerCase().includes('câu') || lines[i].match(/^\d+\./)) {
          const qText = lines[i];
          const options = lines.slice(i + 1, i + 5);
          if (options.length === 4) {
            newQuestions.push({
              id: Date.now() + i,
              text: qText,
              options: options,
              correctAnswer: 0 
            });
            i += 4;
          }
        }
      }

      if (newQuestions.length > 0) {
        updateQuizOnServer(subject, newQuestions);
      } else {
        alert('Không tìm thấy cấu trúc câu hỏi phù hợp trong file Word.');
      }
    } catch (error) {
      console.error('Error reading Word file:', error);
      alert('Có lỗi xảy ra khi đọc file Word.');
    }
  };

  const clearResults = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa toàn bộ danh sách kết quả?')) return;
    try {
      await axios.delete(`/api/results?password=${TEACHER_PASSWORD}`);
      setResultsList([]);
    } catch (error) {
      console.error('Error clearing results:', error);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#212529] font-sans selection:bg-blue-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <FileText className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold">{subject}</h1>
              <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">
                {step === 'teacher' ? 'Chế độ Quản lý Giảng viên' : 'Hệ thống bài kiểm tra trực tuyến'}
              </p>
            </div>
          </div>
          {(step === 'quiz' || step === 'result') && (
            <div className="text-right hidden sm:block">
              <p className="font-medium text-sm">{student.fullName}</p>
              <p className="text-xs text-gray-500">MSSV: {student.studentId}</p>
            </div>
          )}
          {step === 'login' && (
            <button 
              onClick={handleTeacherAccess}
              className="text-sm font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              <RefreshCw className="w-4 h-4" />
              Quản lý
            </button>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Step: Teacher Login */}
        {step === 'teacher-login' && (
          <div className="max-w-md mx-auto bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
            <div className="bg-blue-600 p-8 text-center">
              <LogIn className="w-12 h-12 text-white mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-white">Đăng nhập Giảng viên</h2>
              <p className="text-blue-100 mt-2">Vui lòng nhập tài khoản và mật khẩu quản lý</p>
            </div>
            <form onSubmit={handleTeacherLogin} className="p-8 space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Tài khoản</label>
                <input
                  type="text"
                  required
                  placeholder="admin"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                  value={teacherCredentials.username}
                  onChange={(e) => setTeacherCredentials({ ...teacherCredentials, username: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Mật khẩu</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                  value={teacherCredentials.password}
                  onChange={(e) => setTeacherCredentials({ ...teacherCredentials, password: e.target.value })}
                />
              </div>
              <div className="pt-4 flex flex-col gap-3">
                <button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-blue-200"
                >
                  Đăng nhập
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStep('login');
                    setTeacherCredentials({ username: '', password: '' });
                  }}
                  className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-4 rounded-xl transition-all"
                >
                  Quay lại
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Step: Teacher Mode */}
        {step === 'teacher' && (
          <div className="space-y-8">
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Thiết lập bài kiểm tra</h2>
                  <p className="text-gray-500">Giảng viên có thể thay đổi môn học, bộ câu hỏi và quản lý kết quả.</p>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setShowQR(!showQR)}
                    className="bg-blue-50 text-blue-600 px-4 py-2 rounded-lg font-semibold flex items-center gap-2 hover:bg-blue-100 transition-colors"
                  >
                    <QrCode className="w-4 h-4" />
                    Mã QR
                  </button>
                  <button 
                    onClick={() => {
                      setStep('login');
                      setTeacherCredentials({ username: '', password: '' });
                    }}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-semibold transition-colors"
                  >
                    Thoát Quản lý
                  </button>
                </div>
              </div>

              {showQR && (
                <div className="mb-8 p-8 bg-blue-50 rounded-3xl border-2 border-blue-100 flex flex-col items-center animate-in fade-in zoom-in duration-300">
                  <h3 className="text-lg font-bold text-blue-900 mb-4 flex items-center gap-2">
                    <Share2 className="w-5 h-5" />
                    Chia sẻ bài thi cho sinh viên
                  </h3>
                  <div className="bg-white p-4 rounded-2xl shadow-lg mb-4">
                    <QRCodeSVG value={window.location.href} size={200} />
                  </div>
                  <p className="text-sm text-blue-700 font-medium break-all text-center max-w-sm">
                    {window.location.href}
                  </p>
                  <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl max-w-md">
                    <p className="text-xs text-amber-800 leading-relaxed">
                      <strong className="block mb-1">⚠️ Lưu ý quan trọng:</strong>
                      Nếu URL hiện tại có chứa <code className="bg-amber-100 px-1 rounded">ais-dev</code>, đây là link riêng tư chỉ bạn mới xem được. 
                      Để sinh viên truy cập được, hãy sử dụng link <code className="bg-amber-100 px-1 rounded">ais-pre</code> (Shared App URL) hoặc nhấn nút <strong>"Share"</strong> trong AI Studio để lấy link công khai.
                    </p>
                  </div>
                  <p className="text-xs text-blue-500 mt-2 italic">Sinh viên quét mã QR này để truy cập vào bài thi</p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <label className="block text-sm font-bold text-gray-700 uppercase tracking-tight">Tên môn học</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="flex-grow px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                    />
                    <button 
                      onClick={() => updateQuizOnServer(subject, questions)}
                      className="bg-blue-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-blue-700 transition-colors"
                    >
                      Lưu
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="block text-sm font-bold text-gray-700 uppercase tracking-tight">Nguồn câu hỏi</label>
                  <div className="flex flex-col gap-3">
                    <label className="flex items-center justify-center gap-3 w-full bg-blue-50 border-2 border-dashed border-blue-200 hover:border-blue-400 hover:bg-blue-100 text-blue-700 font-bold py-6 rounded-2xl transition-all cursor-pointer">
                      <Upload className="w-6 h-6" />
                      Tải lên file Word (.docx)
                      <input type="file" accept=".docx" className="hidden" onChange={handleFileUpload} />
                    </label>
                  </div>
                </div>
              </div>

              {/* Results Management Section */}
              <div className="mt-12 pt-8 border-t border-gray-100">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    <CheckCircle2 className="w-6 h-6 text-green-600" />
                    Quản lý kết quả sinh viên ({resultsList.length})
                  </h3>
                  <div className="flex gap-2">
                    <button
                      onClick={clearResults}
                      className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-600 px-4 py-2 rounded-lg font-bold transition-all"
                    >
                      Xóa hết
                    </button>
                    <button
                      onClick={exportAllResults}
                      className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-bold transition-all shadow-md shadow-green-100"
                    >
                      <Download className="w-4 h-4" />
                      Xuất toàn bộ kết quả (JSON)
                    </button>
                  </div>
                </div>
                
                <div className="overflow-x-auto border border-gray-100 rounded-xl">
                  <table className="w-full text-left">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Họ tên</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">MSSV</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Điểm</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Thời gian</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {resultsList.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-6 py-12 text-center text-gray-400 italic">Chưa có sinh viên nào nộp bài.</td>
                        </tr>
                      ) : (
                        resultsList.map((res, idx) => (
                          <tr key={idx} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 font-semibold text-gray-900">{res.student.fullName}</td>
                            <td className="px-6 py-4 text-gray-600">{res.student.studentId}</td>
                            <td className="px-6 py-4 text-center">
                              <span className={cn(
                                "px-3 py-1 rounded-full font-bold text-sm",
                                res.score >= 5 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                              )}>
                                {res.score.toFixed(1)}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right text-xs text-gray-400">{res.timestamp}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mt-12 pt-8 border-t border-gray-100">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-gray-700">
                  <FileText className="w-5 h-5 text-blue-600" />
                  Xem trước bộ câu hỏi ({questions.length})
                </h3>
                <div className="max-h-[300px] overflow-y-auto border border-gray-100 rounded-xl divide-y divide-gray-100">
                  {questions.map((q, idx) => (
                    <div key={q.id} className="p-4 hover:bg-gray-50 transition-colors">
                      <p className="font-semibold text-gray-900">{idx + 1}. {q.text}</p>
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        {q.options.map((opt, oIdx) => (
                          <p key={oIdx} className={cn(
                            "text-sm p-2 rounded border",
                            oIdx === q.correctAnswer ? "bg-green-50 border-green-200 text-green-700 font-medium" : "bg-white border-gray-100 text-gray-500"
                          )}>
                            {String.fromCharCode(65 + oIdx)}. {opt}
                          </p>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-8 pt-8 border-t border-gray-100 flex justify-end">
                <button 
                  onClick={() => setStep('login')}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-12 rounded-2xl transition-all shadow-lg shadow-blue-100"
                >
                  Mở bài thi cho Sinh viên
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 1: Login */}
        {step === 'login' && (
          <div className="max-w-md mx-auto bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
            <div className="bg-blue-600 p-8 text-center">
              <LogIn className="w-12 h-12 text-white mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-white">Đăng nhập sinh viên</h2>
              <p className="text-blue-100 mt-2">Vui lòng nhập thông tin để bắt đầu bài thi</p>
            </div>
            <form onSubmit={handleLogin} className="p-8 space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Họ và Tên</label>
                <input
                  type="text"
                  required
                  placeholder="VD: Nguyễn Văn A"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                  value={student.fullName}
                  onChange={(e) => setStudent({ ...student, fullName: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Mã số sinh viên</label>
                <input
                  type="text"
                  required
                  placeholder="VD: 20240001"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                  value={student.studentId}
                  onChange={(e) => setStudent({ ...student, studentId: e.target.value })}
                />
              </div>
              <div className="pt-4">
                <button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-blue-200"
                >
                  Bắt đầu làm bài
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Step 2: Quiz */}
        {step === 'quiz' && (
          <div className="space-y-8">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="text-amber-600 w-5 h-5 mt-0.5" />
              <p className="text-sm text-amber-800">
                <strong>Lưu ý:</strong> Bạn có {questions.length} câu hỏi trắc nghiệm. Hãy chọn đáp án đúng nhất cho mỗi câu. Bạn có thể nộp bài bất cứ lúc nào.
              </p>
            </div>

            <div className="space-y-6">
              {questions.map((q, qIdx) => (
                <div key={q.id} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:border-blue-200 transition-colors group">
                  <div className="flex gap-4">
                    <span className="flex-shrink-0 w-8 h-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center font-bold text-sm">
                      {qIdx + 1}
                    </span>
                    <div className="flex-grow">
                      <h3 className="text-lg font-semibold mb-4 leading-relaxed">{q.text}</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {q.options.map((option, oIdx) => (
                          <label
                            key={oIdx}
                            className={cn(
                              "relative flex items-center p-4 rounded-xl border cursor-pointer transition-all hover:bg-gray-50",
                              userAnswers[q.id] === oIdx 
                                ? "border-blue-600 bg-blue-50 ring-1 ring-blue-600" 
                                : "border-gray-200"
                            )}
                          >
                            <input
                              type="radio"
                              name={`question-${q.id}`}
                              className="hidden"
                              checked={userAnswers[q.id] === oIdx}
                              onChange={() => handleAnswerChange(q.id, oIdx)}
                            />
                            <span className={cn(
                              "w-6 h-6 rounded-full border-2 mr-3 flex items-center justify-center text-xs font-bold transition-colors",
                              userAnswers[q.id] === oIdx 
                                ? "bg-blue-600 border-blue-600 text-white" 
                                : "border-gray-300 text-gray-400"
                            )}>
                              {String.fromCharCode(65 + oIdx)}
                            </span>
                            <span className={cn(
                              "text-sm font-medium",
                              userAnswers[q.id] === oIdx ? "text-blue-900" : "text-gray-700"
                            )}>
                              {option}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-center pt-8">
              <button
                onClick={handleSubmitQuiz}
                className="bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-12 rounded-2xl transition-all transform hover:scale-105 shadow-xl shadow-green-100 flex items-center gap-2"
              >
                <CheckCircle2 className="w-5 h-5" />
                Nộp bài kiểm tra
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Result */}
        {step === 'result' && (
          <div className="max-w-2xl mx-auto space-y-8">
            <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100">
              <div className={cn(
                "p-12 text-center text-white",
                currentScore.score >= 5 ? "bg-green-600" : "bg-red-600"
              )}>
                <h2 className="text-4xl font-black mb-2">KẾT QUẢ BÀI THI</h2>
                <p className="text-white/80 uppercase tracking-widest text-sm font-bold">Chúc mừng bạn đã hoàn thành!</p>
                
                <div className="mt-8 flex justify-center items-baseline gap-2">
                  <span className="text-8xl font-black">{currentScore.score.toFixed(1)}</span>
                  <span className="text-2xl font-bold opacity-60">/ 10</span>
                </div>
                
                <div className="mt-4 inline-flex items-center gap-2 bg-white/20 px-4 py-2 rounded-full text-sm font-semibold">
                  <CheckCircle2 className="w-4 h-4" />
                  Đúng {currentScore.correct} / {questions.length} câu
                </div>
              </div>

              <div className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-4 rounded-2xl">
                    <p className="text-xs text-gray-500 uppercase font-bold mb-1">Sinh viên</p>
                    <p className="font-bold text-gray-900">{student.fullName}</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-2xl">
                    <p className="text-xs text-gray-500 uppercase font-bold mb-1">Mã số sinh viên</p>
                    <p className="font-bold text-gray-900">{student.studentId}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <button
                    onClick={() => {
                      setStep('login');
                      setUserAnswers({});
                      setStudent({ fullName: '', studentId: '' });
                      fetchQuizConfig(); // Refresh questions for next student
                    }}
                    className="w-full flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-blue-100"
                  >
                    <RefreshCw className="w-5 h-5" />
                    Thoát và quay lại trang chủ
                  </button>
                </div>
              </div>
            </div>

            <div className="text-center text-gray-400 text-sm">
              <p>© 2026 Hệ thống Quiz Trực tuyến - Dành cho Giảng viên Đại học</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
