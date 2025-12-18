const express = require('express');
const cors = require('cors');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json());

// Handle potential ESM/CommonJS mismatch if pdfParse is an object
const pdfFn = (typeof pdfParse === 'function') ? pdfParse : (pdfParse.default || pdfParse);

// Career Database / Rules
const JOB_ROLES = {
    'Full Stack Developer': {
        keywords: ['react', 'node', 'express', 'mongodb', 'full stack', 'javascript', 'typescript', 'aws'],
        demand: 'Very High',
        salary: '$120k - $160k'
    },
    'Frontend Developer': {
        keywords: ['react', 'vue', 'angular', 'css', 'html', 'javascript', 'redux', 'tailwind'],
        demand: 'High',
        salary: '$90k - $130k'
    },
    'Backend Developer': {
        keywords: ['node', 'python', 'java', 'spring', 'django', 'sql', 'database', 'api'],
        demand: 'High',
        salary: '$100k - $145k'
    },
    'Data Scientist': {
        keywords: ['python', 'pandas', 'numpy', 'machine learning', 'ai', 'pytorch', 'tensorflow', 'sql'],
        demand: 'Very High',
        salary: '$130k - $170k'
    },
    'DevOps Engineer': {
        keywords: ['docker', 'kubernetes', 'aws', 'ci/cd', 'jenkins', 'linux', 'cloud'],
        demand: 'High',
        salary: '$115k - $155k'
    },
    'Software Engineer': {
        keywords: ['c++', 'java', 'python', 'algorithm', 'data structures', 'system design'],
        demand: 'Moderate',
        salary: '$110k - $150k'
    }
};

const COMMON_SKILLS = [
    'javascript', 'python', 'java', 'c++', 'react', 'node.js', 'express', 'mongodb', 'sql',
    'html', 'css', 'git', 'docker', 'kubernetes', 'aws', 'azure', 'typescript', 'go', 'rust',
    'machine learning', 'communication', 'leadership', 'teamwork'
];

// Helper to calculate ATS Score
const calculateATSScore = (text, skillsFound) => {
    let score = 50; // Base score

    // 1. Content Checks (+20 max)
    if (text.match(/experience|employment/i)) score += 10;
    if (text.match(/education|academic/i)) score += 10;

    // 2. Contact Info (+10 max)
    if (text.match(/@/)) score += 5; // Email
    if (text.match(/\d{10}|\d{3}[-.]\d{3}[-.]\d{4}/)) score += 5; // Phoneish

    // 3. Skill Density (+20 max)
    score += Math.min(skillsFound.length * 2, 20);

    // 4. Formatting/Length (+10 max)
    if (text.length > 500 && text.length < 5000) score += 10;

    // Ensure it's not perfect 100 easily, and rarely below 40 if content exists
    return Math.min(Math.max(Math.floor(score), 40), 98);
};

// Helper to determine role
const determineRole = (text) => {
    const textLower = text.toLowerCase();
    let bestRole = 'Software Engineer'; // Default
    let maxCount = 0;

    for (const [role, data] of Object.entries(JOB_ROLES)) {
        let count = 0;
        data.keywords.forEach(kw => {
            if (textLower.includes(kw.toLowerCase())) count++;
        });

        // Normalize by keyword list length to avoid bias toward long lists
        const score = count;

        if (score > maxCount) {
            maxCount = score;
            bestRole = role;
        }
    }
    return bestRole;
};

// Extract skills
const extractSkills = (text) => {
    const textLower = text.toLowerCase();
    const found = new Set();
    COMMON_SKILLS.forEach(skill => {
        if (textLower.includes(skill.toLowerCase())) {
            // Capitalize for display
            const display = skill.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
            found.add(display === 'Node.js' ? 'Node.js' : display); // Formatting fix
        }
    });
    return Array.from(found).slice(0, 8); // Top 8
};

// Helper to validate if text looks like a resume
const validateResumeContent = (text) => {
    // 1. Check for valid length (too short = likely test file or empty)
    if (text.length < 100) return false;

    // 2. Check for Resume-specific keywords
    const requiredKeywords = [
        'experience', 'employment', 'work',
        'education', 'university', 'college', 'school',
        'skills', 'projects', 'summary', 'profile', 'objective',
        'resume', 'cv',
        '@', 'phone', 'mail'
    ];

    const textLower = text.toLowerCase();
    let matchCount = 0;
    requiredKeywords.forEach(keyword => {
        if (textLower.includes(keyword)) matchCount++;
    });

    // We require minimal matches to consider it "Proper"
    return matchCount >= 1;
};

app.get('/', (req, res) => {
    res.send('Server is running');
});

app.post('/api/analyze', upload.single('resume'), async (req, res) => {
    console.log("[INFO] Received analysis request");

    try {
        if (!req.file) {
            console.log("[ERROR] No file uploaded");
            return res.status(400).json({ error: 'No file uploaded' });
        }

        console.log(`[INFO] File received: ${req.file.originalname} (${req.file.size} bytes)`);

        let text = '';

        try {
            if (req.file.mimetype === 'application/pdf') {
                const data = await pdfFn(req.file.buffer);
                text = data.text;
                if (!text || text.trim().length === 0) {
                    throw new Error("PDF content is empty or unreadable (scanned images not supported)");
                }
            } else if (
                req.file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            ) {
                // Precise check for DOCX
                const result = await mammoth.extractRawText({ buffer: req.file.buffer });
                text = result.value;
            } else if (req.file.mimetype === 'application/msword') {
                // Explicit error for legacy .doc
                throw new Error("Legacy Word (.doc) files are not supported. Please convert to .docx or PDF.");
            } else if (req.file.mimetype.includes('wordprocessingml')) {
                // Relaxed check for docx variations if exact match failed
                const result = await mammoth.extractRawText({ buffer: req.file.buffer });
                text = result.value;
            } else {
                // Fallback attempt for text/plain
                text = req.file.buffer.toString('utf8');
            }
        } catch (parseError) {
            console.error("[ERROR] Parser specific error:", parseError);
            return res.status(400).json({
                error: parseError.message || "Failed to read file content."
            });
        }

        if (!text || text.trim().length === 0) {
            console.error("[ERROR] Empty text extracted");
            return res.status(400).json({ error: "Please Uplaod the Resume Properly." });
        }

        // Validate Content Quality
        if (!validateResumeContent(text)) {
            console.log("[WARN] Content validation failed. Text length:", text.length);
            return res.status(400).json({ error: "Please Uplaod the Resume Properly." });
        }

        console.log("[INFO] Text extracted successfully. Length:", text.length);

        // Analysis Logic
        const skills = extractSkills(text);
        const role = determineRole(text);
        const roleData = JOB_ROLES[role];
        const atsScore = calculateATSScore(text, skills);

        // Calculate match score (simulated correlation with role keywords)
        const matchScore = Math.min(Math.floor(atsScore * 0.9) + 5, 99);

        const responseData = {
            role: role,
            atsScore: atsScore,
            matchScore: matchScore,
            marketDemand: roleData.demand,
            skills: skills,
            salary_range: roleData.salary
        };

        // Simulate Processing Delay for UX (1.5s)
        setTimeout(() => {
            console.log("[INFO] Sending successful response");
            res.json(responseData);
        }, 1500);

    } catch (error) {
        console.error("[FATAL ERROR] Server Error:", error);
        res.status(500).json({ error: 'Internal Server Error during analysis' });
    }
});

const PORT = 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
