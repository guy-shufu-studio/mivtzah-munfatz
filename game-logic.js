// game-logic.js

document.addEventListener('DOMContentLoaded', () => {
    // Check if the questions array exists
    if (typeof questions === 'undefined') {
        console.error("The questions data file (operations-data.js) is not loaded.");
        return;
    }

    // --- Supabase Setup ---
    const SUPABASE_URL = 'https://xrhvoxtzikvthfngznkh.supabase.co'; 
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhyaHZveHR6aWt2dGhmbmd6bmtoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA0NDk5NzgsImV4cCI6MjA2NjAyNTk3OH0.MhvECXWVUPDmlIECRmS2odiPOP--kiSdWHfc7OqBPuc';
    
    let supabaseClient;
    let supabaseReady = false;

    // Initialize Supabase client silently
    try {
        if (SUPABASE_URL !== 'YOUR_SUPABASE_URL' && SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY' && typeof supabase !== 'undefined') {
            supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            supabaseReady = true;
            console.log("Supabase client initialized successfully.");
        } else {
            console.warn("Supabase credentials not provided. Leaderboard feature will be disabled.");
        }
    } catch (e) {
        console.error("Could not initialize Supabase client.", e);
    }
    

    // --- DOM References ---
    const gameAreaEl = document.getElementById('game-area');
    const h1El = document.querySelector('h1');
    const subtitleEl = document.querySelector('.subtitle');
    const operationNameEl = document.getElementById('operation-name');
    const realBtn = document.getElementById('real-btn');
    const fakeBtn = document.getElementById('fake-btn');
    const startBtn = document.getElementById('start-btn');
    const nextBtn = document.getElementById('next-btn');
    const feedbackTextEl = document.getElementById('feedback-text');
    const feedbackInfoEl = document.getElementById('feedback-info');
    const scoreEl = document.getElementById('score');
    const timerEl = document.getElementById('timer');
    const socialShareContainer = document.getElementById('social-share-container');
    const nameEntryContainer = document.getElementById('name-entry-container');
    const playerNameInput = document.getElementById('player-name-input');
    const leaderboardContainer = document.getElementById('leaderboard-container');
    const leaderboardTableBody = document.querySelector('#leaderboard-table tbody');

    // --- Game State ---
    let score, shuffledQuestions, currentQuestionIndex, timer, timeLeft, gameIsActive = false;
    let currentPlayerRowId = null;

    // --- Leaderboard Logic (Supabase) ---
    function getTodayDateString() {
        return new Date().toISOString().split('T')[0];
    }
    
    async function fetchLeaderboard() {
        if (!supabaseReady) return;

        const todayStr = getTodayDateString();
        try {
            let { data: scores, error } = await supabaseClient
                .from('leaderboard')
                .select('*')
                .eq('date', todayStr)
                .order('score', { ascending: false })
                .order('created_at', { ascending: true })
                .limit(10);

            if (error) throw error;
            
            displayLeaderboard(scores);

        } catch (error) {
            console.error("Error fetching leaderboard:", error);
            leaderboardContainer.style.display = 'none'; // Hide if there's an error
        }
    }

    async function addPlayerToLeaderboard(name, score) {
        if (!supabaseReady) return;

        try {
            const { data, error } = await supabaseClient
                .from('leaderboard')
                .insert([{ name: name, score: score, date: getTodayDateString() }])
                .select('id') 
                .single();
            
            if (error) throw error;

            if(data) {
                currentPlayerRowId = data.id; 
            }
            fetchLeaderboard(); 

        } catch (error) {
            console.error("Error adding document:", error);
        }
    }

    function displayLeaderboard(scores) {
        leaderboardTableBody.innerHTML = '';
        if (!scores || scores.length === 0) {
            leaderboardContainer.style.display = 'none';
            return;
        }
        
        leaderboardContainer.style.display = 'block';
        scores.forEach((entry, index) => {
            const row = leaderboardTableBody.insertRow();
            if (entry.id === currentPlayerRowId) {
                row.classList.add('current-player');
            }
            row.innerHTML = `<td>${index + 1}</td><td>${entry.name}</td><td>${entry.score}</td>`;
        });
    }

    // --- Game Flow Logic ---
    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    function startGame() {
        gameIsActive = true;
        score = 0;
        timeLeft = 60;
        currentPlayerRowId = null;
        
        scoreEl.textContent = score;
        timerEl.textContent = timeLeft;
        h1El.innerHTML = 'מבצע מונפץ';
        subtitleEl.textContent = 'עד כמה אתם מכירים את היסטורית המבצעים של צה״ל?';
        socialShareContainer.style.display = 'none';
        nameEntryContainer.style.display = 'none';
        leaderboardContainer.style.display = 'none'; // Hide leaderboard at start

        shuffledQuestions = [...questions];
        shuffleArray(shuffledQuestions);
        currentQuestionIndex = 0;

        startBtn.style.display = 'none';
        gameAreaEl.style.display = 'block';

        showNextQuestion();

        clearInterval(timer);
        timer = setInterval(updateTimer, 1000);
    }

    function updateTimer() {
        if (!gameIsActive) return;
        timeLeft--;
        timerEl.textContent = timeLeft;
        if (timeLeft <= 0) endGame();
    }

    function showNextQuestion() {
        if (currentQuestionIndex >= shuffledQuestions.length) {
            endGame();
            return;
        }
        resetStateForNextQuestion();
        operationNameEl.textContent = shuffledQuestions[currentQuestionIndex].name;
    }

    function resetStateForNextQuestion() {
        feedbackTextEl.textContent = '';
        feedbackInfoEl.textContent = '';
        realBtn.disabled = false;
        fakeBtn.disabled = false;
        nextBtn.style.display = 'none';
    }

    function checkAnswer(userChoice) {
        realBtn.disabled = true;
        fakeBtn.disabled = true;
        const currentQuestion = shuffledQuestions[currentQuestionIndex];
        if (userChoice === currentQuestion.isReal) {
            score++;
            scoreEl.textContent = score;
            feedbackTextEl.textContent = 'נכון!';
            feedbackTextEl.className = 'correct';
        } else {
            feedbackTextEl.textContent = 'טעות...';
            feedbackTextEl.className = 'incorrect';
        }
        feedbackInfoEl.textContent = currentQuestion.info;
        nextBtn.style.display = 'block';
    }

    function endGame() {
        gameIsActive = false;
        clearInterval(timer);
        gameAreaEl.style.display = 'none';
        nextBtn.style.display = 'none';
        h1El.textContent = 'הזמן נגמר!';
        subtitleEl.innerHTML = `הציון הסופי שלך:<br><span class="final-score">${score}</span>`;
        
        // Show all end-game elements simultaneously
        startBtn.textContent = 'שחק שוב';
        startBtn.style.display = 'block';
        socialShareContainer.style.display = 'block';
        setupSocialSharing(score);

        if (supabaseReady) {
            nameEntryContainer.style.display = 'block';
            fetchLeaderboard(); // Fetch and display the final leaderboard
        }
    }

    async function handleNameSubmission(event) {
        event.preventDefault();
        const playerName = playerNameInput.value.trim();
        if (playerName) {
            await addPlayerToLeaderboard(playerName, score);
            // Hide the form after submission to prevent multiple entries
            nameEntryContainer.style.display = 'none';
        }
    }

    function setupSocialSharing(finalScore) {
        const url = "mivtzahmunfatz.lol";
        const text = `השגתי ${finalScore} נקודות במשחק "מבצע מונפץ"! בואו נראה אם תצליחו לנצח אותי:`;
        const encodedUrl = encodeURIComponent(url);
        const encodedText = encodeURIComponent(text);
        document.getElementById('share-facebook').href = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
        document.getElementById('share-twitter').href = `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedText}`;
        document.getElementById('share-linkedin').href = `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;
        document.getElementById('share-whatsapp').href = `https://api.whatsapp.com/send?text=${encodedText}%20${encodedUrl}`;
        document.getElementById('share-telegram').href = `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`;
    }

    // --- Initial Setup ---
    if (supabaseReady) {
        // Initial fetch to show leaderboard on page load
        fetchLeaderboard();
        
        // Setup real-time subscription for live updates
        supabaseClient.channel('public:leaderboard')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'leaderboard' }, fetchLeaderboard)
            .subscribe();
    } else {
         leaderboardContainer.style.display = 'none';
    }
    
    startBtn.addEventListener('click', startGame);
    realBtn.addEventListener('click', () => checkAnswer(true));
    fakeBtn.addEventListener('click', () => checkAnswer(false));
    nextBtn.addEventListener('click', () => {
        currentQuestionIndex++;
        showNextQuestion();
    });
    nameEntryContainer.addEventListener('submit', handleNameSubmission);
});
