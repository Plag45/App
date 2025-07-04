import { useEffect, useState, useRef } from "react";

function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [databases, setDatabases] = useState([]);
  const [selectedDb, setSelectedDb] = useState("");
  const [activeImage, setActiveImage] = useState(null);
  const chatEndRef = useRef(null);

  useEffect(() => {
    fetch("http://localhost:5000/databases")
      .then((res) => res.json())
      .then((data) => {
        setDatabases(data);
        if (data.length > 0) setSelectedDb(data[0]);
      });
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  const handleSend = async () => {
    if (!input.trim()) return;
    if (!selectedDb) {
      setMessages([...messages, { sender: "bot", text: "No database selected." }]);
      return;
    }

    const userMessage = { sender: "user", text: input };
    setMessages([...messages, userMessage]);
    setTyping(true);
    setInput("");

    try {
      const response = await fetch("http://localhost:5000/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: input, database: selectedDb }),
      });
      const data = await response.json();
      const botMessage = {
        sender: "bot",
        text: data.answer || "No response.",
        image: data.image || null,
        source: data.source || null,
      };
      setMessages((prev) => [...prev, botMessage]);
    } catch (err) {
      setMessages((prev) => [...prev, { sender: "bot", text: "Network error." }]);
    } finally {
      setTyping(false);
    }
  };

  const handleThemeToggle = () => {
    setDarkMode((prev) => !prev);
  };

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  return (
    <div className={`min-h-screen flex flex-col ${darkMode ? "bg-[#0f1c24] text-white" : "bg-white text-black"}`}>
      <header className={`flex items-center justify-between p-4 ${darkMode ? "bg-[#0f1c24] border-gray-700" : "bg-gray-100 border-gray-300"} border-b`}>
        <img src="/logo.png" alt="Logo" className="h-8 w-auto" />
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold">Dava.X Academy</h1>
          <button onClick={handleThemeToggle} className={`px-3 py-1 rounded-full text-sm font-medium ${darkMode ? "bg-gray-800 text-white" : "bg-gray-300 text-black"}`}>
            {darkMode ? "☀️ Light" : "🌙 Dark"}
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col md:flex-row overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="mb-4">
            <label className="mr-2">Select Database:</label>
            <select
              className="p-2 rounded bg-gray-700 text-white"
              value={selectedDb}
              onChange={(e) => setSelectedDb(e.target.value)}
            >
              {databases.map((db, idx) => (
                <option key={idx} value={db}>{db}</option>
              ))}
            </select>
          </div>

          {messages.map((msg, idx) => (
            <div key={idx} className={msg.sender === "user" ? "text-right" : "text-left"}>
              <div className={`inline-block max-w-[75%] px-4 py-2 rounded-2xl ${msg.sender === "user" ? "bg-[#f05340] text-white" : darkMode ? "bg-gray-800 text-white" : "bg-gray-200 text-black"}`}>
                <p>{msg.text}</p>
                {msg.image && (
                  <button
                    className="mt-2 text-xs underline text-blue-400 hover:text-blue-600"
                    onClick={() => setActiveImage(msg.image)}
                  >
                    Show source
                  </button>
                )}
              </div>
            </div>
          ))}

          {typing && (
            <div className="flex items-center gap-2 text-sm italic text-gray-400">
              <div className="w-4 h-4 border-2 border-t-transparent border-white rounded-full animate-spin"></div>
              Bot is typing...
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {activeImage && (
          <div className="md:w-[40%] p-4 border-l border-gray-300 dark:border-gray-700 overflow-y-auto bg-gray-50 dark:bg-gray-900">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-sm font-medium text-gray-700 dark:text-gray-200">📄 PDF Preview</h2>
              <button
                className="text-sm text-red-500 hover:text-red-700"
                onClick={() => setActiveImage(null)}
              >
                Close
              </button>
            </div>
            <img
  src={`http://localhost:5000/previews/${activeImage}`}
  alt="PDF Source"
  className="w-full rounded shadow"
  onError={(e) => {
    e.target.onerror = null;
    e.target.src = "/fallback-preview.png";  // dacă ai unul
  }}
/>

          </div>
        )}
      </main>

      <footer className={`p-4 flex items-center justify-between gap-2 ${darkMode ? "bg-[#0f1c24] border-gray-700" : "bg-gray-100 border-gray-300"} border-t`}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Ask something about the document..."
          className={`flex-1 p-3 rounded-full outline-none transition-all duration-300 ${darkMode ? "bg-gray-800 text-white" : "bg-white text-black border border-gray-300"}`}
          disabled={typing}
        />
        <button onClick={handleSend} disabled={typing} className={`px-5 py-2 rounded-full font-semibold transition ${typing ? "opacity-50 cursor-not-allowed" : "hover:bg-[#d94432] bg-[#f05340] text-white"}`}>
          Send
        </button>
      </footer>
    </div>
  );
}

export default App;
