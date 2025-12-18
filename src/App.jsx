import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, CheckCircle, Loader2, Sparkles, TrendingUp } from 'lucide-react';
import './App.css';

function App() {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('idle'); // idle, analyzing, result
  const [analysis, setAnalysis] = useState(null);

  const onDrop = useCallback(async (acceptedFiles) => {
    const uploadedFile = acceptedFiles[0];
    if (uploadedFile) {
      setFile(uploadedFile);
      setStatus('analyzing');

      const formData = new FormData();
      formData.append('resume', uploadedFile);

      try {
        const response = await fetch('http://localhost:5000/api/analyze', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          let errMsg = 'Analysis failed';
          try {
            const errData = await response.json();
            errMsg = errData.error || errMsg;
          } catch (e) { /* ignore json parse error */ }
          throw new Error(errMsg);
        }

        const data = await response.json();

        // Ensure minimum duration of 2s for the animation to look good
        setTimeout(() => {
          setAnalysis(data);
          setStatus('result');
        }, 1000);

      } catch (error) {
        console.error("Error analyzing:", error);
        setStatus('idle');
        alert(`Analysis failed: ${error.message}`);
      }
    }
  }, []);

  const resetAnalysis = () => {
    window.location.reload();
  };

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    noClick: true,
    maxFiles: 1,
    disabled: status !== 'idle',
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
    }
  });

  return (
    <div className="app-container">
      <div className="glass-card">
        <h1 className="title">Smart Job Recommendation System</h1>

        {status === 'idle' && (
          <div className="upload-section">
            <div
              {...getRootProps()}
              className={`dropzone ${isDragActive ? 'active' : ''}`}
            >
              <input {...getInputProps()} />

              <div className="dropzone-content">
                <div className="icon-wrapper">
                  <Upload size={48} strokeWidth={1.5} />
                </div>

                <div className="text-content">
                  {isDragActive ? (
                    <p className="highlight-text">Drop your resume here...</p>
                  ) : (
                    <>
                      <p className="main-text">Drag & drop your resume here</p>
                      <p className="sub-text">Supported formats: PDF, DOC, DOCX</p>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="divider">
              <span>OR</span>
            </div>

            <button className="upload-btn" onClick={open}>
              Upload Resume
            </button>
          </div>
        )}

        {status === 'analyzing' && (
          <div className="analyzing-view">
            <div className="spinner-wrapper">
              <Loader2 size={64} className="spinner" />
            </div>
            <h2 className="analyzing-title">Analyzing Profile...</h2>
            <p className="analyzing-text">
              Suggesting the Best Job Role From On Market Demand
              <span className="dot-typing"></span>
            </p>
          </div>
        )}

        {status === 'result' && analysis && (
          <div className="results-view">
            <div className="success-badge">
              <Sparkles size={16} />
              <span>Analysed Report</span>
            </div>

            <h2 className="result-role">{analysis.role}</h2>

            <div className="ats-score-container">
              <span className="ats-label">ATS Score:</span>
              <span className="ats-value">{analysis.atsScore}/100</span>
            </div>

            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon match">
                  <CheckCircle size={20} />
                </div>
                <div className="stat-info">
                  <span className="stat-label">Match Score</span>
                  <span className="stat-value">{analysis.matchScore}%</span>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon trend">
                  <TrendingUp size={20} />
                </div>
                <div className="stat-info">
                  <span className="stat-label">Market Demand</span>
                  <span className="stat-value">{analysis.marketDemand}</span>
                </div>
              </div>
            </div>

            <div className="skills-section">
              <h3>Top Matched Skills</h3>
              <div className="skills-tags">
                {analysis.skills.map((skill) => (
                  <span key={skill} className="skill-tag">{skill}</span>
                ))}
              </div>
            </div>

            <div className="file-summary footer-summary">
              <button onClick={resetAnalysis} className="analyze-new-btn">Analyze New</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
