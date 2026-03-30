import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // In-memory storage for demo purposes (resets on server restart)
  let quizConfig = {
    subject: 'NHẬP MÔN CÔNG NGHỆ THÔNG TIN',
    questions: [
      { id: 1, text: "Ngôn ngữ lập trình nào được sử dụng phổ biến nhất cho phát triển Web Frontend?", options: ["Java", "Python", "JavaScript", "C++"], correctAnswer: 2 },
      { id: 2, text: "HTML là viết tắt của từ nào?", options: ["Hyper Text Markup Language", "High Tech Modern Language", "Hyper Transfer Markup Language", "Home Tool Markup Language"], correctAnswer: 0 },
      { id: 3, text: "CSS dùng để làm gì?", options: ["Xử lý logic", "Định dạng giao diện", "Quản lý cơ sở dữ liệu", "Lập trình hệ thống"], correctAnswer: 1 },
      { id: 4, text: "React là một thư viện của ngôn ngữ nào?", options: ["PHP", "Ruby", "JavaScript", "Python"], correctAnswer: 2 },
      { id: 5, text: "Thẻ nào dùng để tạo liên kết trong HTML?", options: ["<link>", "<a>", "<href>", "<url>"], correctAnswer: 1 },
      { id: 6, text: "Trong JavaScript, 'const' dùng để khai báo gì?", options: ["Biến có thể thay đổi", "Hằng số", "Hàm", "Mảng"], correctAnswer: 1 },
      { id: 7, text: "Giao thức mặc định của Web là gì?", options: ["FTP", "SMTP", "HTTP", "SSH"], correctAnswer: 2 },
      { id: 8, text: "Đâu là một Framework của JavaScript?", options: ["Django", "Laravel", "Vue.js", "Spring"], correctAnswer: 2 },
      { id: 9, text: "SQL dùng để làm gì?", options: ["Thiết kế đồ họa", "Truy vấn cơ sở dữ liệu", "Tạo hiệu ứng hoạt hình", "Lập trình game"], correctAnswer: 1 },
      { id: 10, text: "Git là hệ thống gì?", options: ["Quản lý phiên bản", "Hệ điều hành", "Trình duyệt web", "Trình biên dịch"], correctAnswer: 0 },
    ]
  };
  let resultsList: any[] = [];

  // API Routes
  app.get("/api/quiz-config", (req, res) => {
    res.json(quizConfig);
  });

  app.post("/api/quiz-config", (req, res) => {
    const { subject, questions, password } = req.body;
    if (password !== 'admin') return res.status(403).json({ error: 'Unauthorized' });
    quizConfig = { subject, questions };
    res.json({ success: true });
  });

  app.get("/api/results", (req, res) => {
    const { password } = req.query;
    if (password !== 'admin') return res.status(403).json({ error: 'Unauthorized' });
    res.json(resultsList);
  });

  app.post("/api/results", (req, res) => {
    const result = req.body;
    resultsList.push(result);
    res.json({ success: true });
  });

  app.delete("/api/results", (req, res) => {
    const { password } = req.query;
    if (password !== 'admin') return res.status(403).json({ error: 'Unauthorized' });
    resultsList = [];
    res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
