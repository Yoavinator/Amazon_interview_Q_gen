import React, { useState } from 'react';
import './App.css';
import RandomQuestionGenerator from './components/RandomQuestionGenerator';
import InterviewRecorder from './components/InterviewRecorder';

function App() {
  const [currentQuestion, setCurrentQuestion] = useState('');

  const handleQuestionGenerated = (question) => {
    setCurrentQuestion(question);
  };

  return (
    <div className="App">
      <header className="header">
        <h1>Amazon Interview Practice</h1>
      </header>
      
      <div className="content">
        <RandomQuestionGenerator onQuestionGenerated={handleQuestionGenerated} />
        <InterviewRecorder question={currentQuestion} />
      </div>
      
      <footer className="footer">
        <p>Created by Yoav Marziano™</p>
        <p>For educational purposes only. Not affiliated with Amazon. All trademarks belong to their respective owners.</p>
      </footer>
    </div>
  );
}

export default App;
