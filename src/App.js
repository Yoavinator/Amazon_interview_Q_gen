import React from 'react';
import RandomQuestionGenerator from './components/RandomQuestionGenerator';
import './App.css';

function App() {
  return (
    <div className="App">
      <RandomQuestionGenerator />
      <footer className="text-center p-4 text-gray-400 text-sm">
        <p>Created by Yoav Marziano™</p>
        <p>For educational purposes only. Not affiliated with Amazon. All trademarks belong to their respective owners.</p>
      </footer>
    </div>
  );
}

export default App;
