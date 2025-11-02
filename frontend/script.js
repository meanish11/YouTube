// ============================================================================
//                    YOUTUBE SENTIMENT ANALYZER - FRONTEND
//                    Optimized for Vercel + Render Setup
// ============================================================================

// ============================================================================
//                    🔴 IMPORTANT: UPDATE THIS API URL
// ============================================================================

// TODO: After deploying backend to Render, replace with your actual Render URL
const RENDER_API_URL = 'https://youtubeanalyzer-1vcp.onrender.com/api';

// Automatically detect environment and use appropriate API URL
const API_BASE_URL = (() => {
    const hostname = window.location.hostname;
    
    // Local development
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        console.log('🔧 Running in LOCAL mode');
        return 'http://localhost:10000/api';
    }
    
    // Production - Vercel deployment calling Render backend
    console.log('🌐 Running in PRODUCTION mode');
    return RENDER_API_URL; // Replace with your actual Render backend URL
})();

console.log('🔗 API Base URL:', API_BASE_URL);

// ============================================================================
//                    GLOBAL VARIABLES
// ============================================================================

let analysisData = null;
let currentChart = null;
let analysisHistory = [];
let loadingTimer = null;
let loadingStartTime = null;

// ============================================================================
//                    INITIALIZATION
// ============================================================================

window.addEventListener('load', () => {
    console.log('✅ Application loaded');
    document.getElementById('videoUrl').focus();
    loadHistory();
    updateHeaderStats();
    
    // Test API connection
    testAPIConnection();
});

document.getElementById('videoUrl').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        analyzeVideo();
    }
});

// ============================================================================
//                    API CONNECTION TEST
// ============================================================================

async function testAPIConnection() {
    try {
        console.log('🔍 Testing API connection...');
        const response = await fetch(`${API_BASE_URL}/health`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log('✅ API Connected:', data);
        } else {
            console.warn('⚠️ API responded with status:', response.status);
        }
    } catch (error) {
        console.error('❌ API Connection Failed:', error.message);
        console.warn('⚠️ Make sure backend is deployed and URL is correct');
    }
}

// ============================================================================
//                    MAIN ANALYSIS FUNCTION
// ============================================================================

async function analyzeVideo() {
    const urlInput = document.getElementById('videoUrl').value.trim();
    const maxCommentsInput = document.getElementById('maxComments').value;
    const maxComments = maxCommentsInput ? parseInt(maxCommentsInput) : null;
    
    if (!urlInput) {
        showError('Please enter a YouTube video URL');
        return;
    }
    
    // Validate YouTube URL
    if (!isValidYouTubeURL(urlInput)) {
        showError('Invalid YouTube URL. Please enter a valid youtube.com, youtu.be, or shorts URL');
        return;
    }
    
    hideError();
    showLoading();
    hideResults();
    disableAnalyzeButton();
    
    loadingStartTime = Date.now();
    startLoadingTimer();
    
    // Start smooth progress animation
    let currentProgress = 0;
    const progressInterval = setInterval(() => {
        if (currentProgress < 90) {
            currentProgress += 0.5;
            updateLoadingStatus(getLoadingMessage(currentProgress), currentProgress, getLoadingStep(currentProgress));
        }
    }, 100);
    
    try {
        console.log('📤 Sending request to:', `${API_BASE_URL}/analyze`);
        console.log('📊 Request data:', { videoUrl: urlInput, maxComments });
        
        const response = await fetch(`${API_BASE_URL}/analyze`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                videoUrl: urlInput,
                maxComments: maxComments
            })
        });
        
        console.log('📥 Response status:', response.status);
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Server error: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('✅ Analysis complete:', data);
        
        if (!data.success) {
            throw new Error(data.error || 'Analysis failed');
        }
        
        if (!data.comments || data.comments.length === 0) {
            throw new Error('No comments found on this video');
        }
        
        clearInterval(progressInterval);
        currentProgress = 90;
        
        for (let i = 90; i <= 100; i += 2) {
            updateLoadingStatus(getLoadingMessage(i), i, getLoadingStep(i));
            await sleep(50);
        }
        
        analysisData = data;
        addToHistory(data);
        
        updateLoadingStatus('Complete!', 100, '6/6');
        stopLoadingTimer();
        
        await sleep(300);
        
        hideLoading();
        displayResults(analysisData);
        showResults();
        enableAnalyzeButton();
        
        document.getElementById('results').scrollIntoView({ behavior: 'smooth', block: 'start' });
        
    } catch (error) {
        clearInterval(progressInterval);
        console.error('❌ Analysis error:', error);
        
        // Provide helpful error messages
        let errorMessage = error.message;
        if (error.message.includes('Failed to fetch')) {
            errorMessage = 'Cannot connect to backend server. Please check if backend is deployed and URL is correct in script.js';
        } else if (error.message.includes('NetworkError')) {
            errorMessage = 'Network error. Please check your internet connection and backend URL';
        } else if (error.message.includes('CORS')) {
            errorMessage = 'CORS error. Please check backend CORS configuration';
        }
        
        showError(errorMessage);
        hideLoading();
        enableAnalyzeButton();
        stopLoadingTimer();
    }
}

function getLoadingMessage(progress) {
    if (progress < 5) return 'Initializing AI Engine...';
    if (progress < 15) return 'Connecting to YouTube...';
    if (progress < 25) return 'Starting web scraper...';
    if (progress < 50) return 'Scraping comments from YouTube...';
    if (progress < 70) return 'Processing comments...';
    if (progress < 85) return 'Analyzing sentiment with AI...';
    if (progress < 95) return 'Generating insights...';
    return 'Preparing results...';
}

function getLoadingStep(progress) {
    if (progress < 15) return '1/6';
    if (progress < 25) return '2/6';
    if (progress < 50) return '3/6';
    if (progress < 70) return '4/6';
    if (progress < 90) return '5/6';
    return '6/6';
}

// ============================================================================
//                    URL VALIDATION
// ============================================================================

function isValidYouTubeURL(url) {
    const patterns = [
        /^(https?:\/\/)?(www\.)?youtube\.com\/watch\?v=[\w-]+/,
        /^(https?:\/\/)?(www\.)?youtu\.be\/[\w-]+/,
        /^(https?:\/\/)?(www\.)?youtube\.com\/shorts\/[\w-]+/,
        /^(https?:\/\/)?(www\.)?youtube\.com\/embed\/[\w-]+/
    ];
    
    return patterns.some(pattern => pattern.test(url));
}

// ============================================================================
//                    DISPLAY FUNCTIONS
// ============================================================================

function displayResults(data) {
    console.log('🎨 Displaying results:', data);
    
    animateValue('totalComments', 0, data.statistics.totalComments, 1000);
    animateValue('positivePercent', 0, parseFloat(data.statistics.positivePercent), 1000, '%', 1);
    animateValue('negativePercent', 0, parseFloat(data.statistics.negativePercent), 1000, '%', 1);
    animateValue('avgPolarity', 0, parseFloat(data.statistics.avgPolarity), 1000, '', 2);
    
    const metadata = data.metadata || {};
    
    const thumbnailImg = document.getElementById('videoThumbnail');
    if (metadata.thumbnail) {
        thumbnailImg.src = metadata.thumbnail;
        thumbnailImg.style.display = 'block';
        thumbnailImg.onerror = function() {
            const videoId = metadata.videoId;
            const alternates = [
                `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
                `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
                `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
                `https://img.youtube.com/vi/${videoId}/default.jpg`
            ];
            
            let index = 0;
            const tryNext = () => {
                if (index < alternates.length) {
                    thumbnailImg.src = alternates[index];
                    index++;
                } else {
                    thumbnailImg.style.display = 'none';
                }
            };
            
            thumbnailImg.onerror = tryNext;
            tryNext();
        };
    } else {
        thumbnailImg.style.display = 'none';
    }
    
    document.getElementById('videoTitle').textContent = metadata.title || 'YouTube Video Analysis';
    document.getElementById('channelName').textContent = metadata.channel || 'Unknown Channel';
    document.getElementById('viewCount').textContent = formatNumberSafe(metadata.viewCount);
    document.getElementById('likeCount').textContent = formatNumberSafe(metadata.likeCount);
    document.getElementById('duration').textContent = metadata.duration || 'N/A';
    document.getElementById('uploadDate').textContent = metadata.uploadDate || 'N/A';
    
    updateDetailedSentimentBars(data.statistics, data.comments);
    createSentimentChart(data.statistics);
    generateWordCloud(data.comments);
    displayEnhancedInsights(data.insights);
    displayEmojiAnalysis(data.comments);
    displayCommentsInTabs(data.comments);
    updateStatsDashboard(data.statistics, data.comments);
    updateTabCounts(data.comments);
    updateHeaderStats();
}

function updateDetailedSentimentBars(stats, comments) {
    const sentimentCounts = {
        'Very Positive': 0,
        'Positive': 0,
        'Neutral': 0,
        'Negative': 0,
        'Very Negative': 0
    };
    
    comments.forEach(comment => {
        sentimentCounts[comment.sentiment]++;
    });
    
    const total = comments.length;
    
    updateVerticalBar('veryPositiveBar', 'veryPositiveCount', sentimentCounts['Very Positive'], total);
    updateVerticalBar('positiveBar', 'positiveCount', sentimentCounts['Positive'], total);
    updateVerticalBar('neutralBar', 'neutralCount', sentimentCounts['Neutral'], total);
    updateVerticalBar('negativeBar', 'negativeCount', sentimentCounts['Negative'], total);
    updateVerticalBar('veryNegativeBar', 'veryNegativeCount', sentimentCounts['Very Negative'], total);
    
    updateListBar('veryPositiveListBar', 'veryPositiveListCount', sentimentCounts['Very Positive'], total);
    updateListBar('positiveListBar', 'positiveListCount', sentimentCounts['Positive'], total);
    updateListBar('neutralListBar', 'neutralListCount', sentimentCounts['Neutral'], total);
    updateListBar('negativeListBar', 'negativeListCount', sentimentCounts['Negative'], total);
    updateListBar('veryNegativeListBar', 'veryNegativeListCount', sentimentCounts['Very Negative'], total);
    
    document.getElementById('chartPositive').textContent = stats.positivePercent + '%';
    document.getElementById('chartNeutral').textContent = stats.neutralPercent + '%';
    document.getElementById('chartNegative').textContent = stats.negativePercent + '%';
}

function updateVerticalBar(barId, countId, count, total) {
    const percentage = ((count / total) * 100).toFixed(1);
    const bar = document.getElementById(barId);
    const countElem = document.getElementById(countId);
    
    if (bar && countElem) {
        countElem.textContent = count;
        
        const percentSpan = bar.querySelector('.bar-percentage');
        
        setTimeout(() => {
            bar.style.height = percentage + '%';
            if (percentSpan && parseFloat(percentage) > 15) {
                percentSpan.textContent = percentage + '%';
            } else if (percentSpan) {
                percentSpan.textContent = '';
            }
        }, 100);
    }
}

function updateListBar(barId, countId, count, total) {
    const percentage = ((count / total) * 100).toFixed(1);
    const bar = document.getElementById(barId);
    const countElem = document.getElementById(countId);
    
    if (bar && countElem) {
        countElem.textContent = `${count} (${percentage}%)`;
        
        setTimeout(() => {
            bar.style.width = percentage + '%';
        }, 100);
    }
}

function toggleBreakdownView(view) {
    const barsView = document.getElementById('barsView');
    const listView = document.getElementById('listView');
    const buttons = document.querySelectorAll('.toggle-btn');
    
    buttons.forEach(btn => btn.classList.remove('active'));
    event.target.closest('.toggle-btn').classList.add('active');
    
    if (view === 'bars') {
        barsView.classList.add('active');
        listView.classList.remove('active');
    } else {
        barsView.classList.remove('active');
        listView.classList.add('active');
    }
}

function createSentimentChart(stats) {
    const ctx = document.getElementById('sentimentChart');
    if (!ctx) return;
    
    if (currentChart) {
        currentChart.destroy();
    }
    
    currentChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Positive', 'Neutral', 'Negative'],
            datasets: [{
                data: [
                    parseFloat(stats.positivePercent),
                    parseFloat(stats.neutralPercent),
                    parseFloat(stats.negativePercent)
                ],
                backgroundColor: [
                    'rgba(16, 185, 129, 0.8)',
                    'rgba(148, 163, 184, 0.8)',
                    'rgba(239, 68, 68, 0.8)'
                ],
                borderColor: [
                    'rgba(16, 185, 129, 1)',
                    'rgba(148, 163, 184, 1)',
                    'rgba(239, 68, 68, 1)'
                ],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 500
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.label + ': ' + context.parsed.toFixed(1) + '%';
                        }
                    }
                }
            }
        }
    });
}

function generateWordCloud(comments) {
    const container = document.getElementById('wordCloud');
    if (!container) return;
    
    container.innerHTML = '';
    
    const wordFreq = {};
    const stopWords = ['the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'but', 'in', 'with', 'to', 'for', 'of', 'as', 'by', 'this', 'that', 'it', 'from', 'be', 'are', 'was', 'were', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'can', 'may', 'might', 'must', 'you', 'your', 'my', 'me', 'we', 'us', 'they', 'them', 'their', 'he', 'she', 'his', 'her'];
    
    comments.forEach(comment => {
        const words = comment.text.toLowerCase().split(/\W+/);
        words.forEach(word => {
            if (word.length > 3 && !stopWords.includes(word)) {
                wordFreq[word] = (wordFreq[word] || 0) + 1;
            }
        });
    });
    
    const sortedWords = Object.entries(wordFreq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 30);
    
    if (sortedWords.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #6b7280;">No significant words found</p>';
        return;
    }
    
    const maxFreq = sortedWords[0]?.[1] || 1;
    
    sortedWords.forEach(([word, freq]) => {
        const size = 14 + (freq / maxFreq) * 24;
        const wordElem = document.createElement('div');
        wordElem.className = 'word-item';
        wordElem.style.fontSize = size + 'px';
        wordElem.textContent = word;
        wordElem.title = `Mentioned ${freq} times`;
        container.appendChild(wordElem);
    });
}

function displayEnhancedInsights(insights) {
    const container = document.getElementById('insightsContainer');
    if (!container) return;
    
    container.innerHTML = '';
    
    const icons = {
        'Overall Sentiment': 'fa-chart-pie',
        'Sentiment Confidence': 'fa-shield-alt',
        'Negative Feedback': 'fa-exclamation-triangle',
        'High Engagement': 'fa-fire',
        'Good Engagement': 'fa-users',
        'Highly Praised': 'fa-star',
        'Critical Issues': 'fa-bug',
        'Many Questions': 'fa-question-circle'
    };
    
    insights.forEach(insight => {
        const card = document.createElement('div');
        card.className = 'insight-card';
        card.innerHTML = `
            <div class="insight-category">
                <i class="fas ${icons[insight.category] || 'fa-lightbulb'}"></i>
                ${insight.category}
            </div>
            <div class="insight-text">${escapeHtml(insight.insight)}</div>
            <div class="insight-action">
                <i class="fas fa-arrow-right"></i>
                ${escapeHtml(insight.action)}
            </div>
        `;
        container.appendChild(card);
    });
}

function displayEmojiAnalysis(comments) {
    const container = document.getElementById('emojiAnalysis');
    if (!container) return;
    
    container.innerHTML = '';
    
    const emojiMap = {
        '😊': 'Happy', '😂': 'Laughing', '❤️': 'Love', '👍': 'Thumbs Up',
        '🔥': 'Fire', '😍': 'Heart Eyes', '👏': 'Clapping', '🙏': 'Praying',
        '😢': 'Crying', '😡': 'Angry', '💯': 'Perfect', '✨': 'Sparkles'
    };
    
    const emojiCounts = {};
    
    comments.forEach(comment => {
        Object.keys(emojiMap).forEach(emoji => {
            const regex = new RegExp(emoji.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
            const matches = comment.text.match(regex);
            if (matches) {
                emojiCounts[emoji] = (emojiCounts[emoji] || 0) + matches.length;
            }
        });
    });
    
    const sortedEmojis = Object.entries(emojiCounts)
        .filter(([, count]) => count > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8);
    
    if (sortedEmojis.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #6b7280; padding: 2rem;">No emojis found in comments</p>';
        return;
    }
    
    sortedEmojis.forEach(([emoji, count]) => {
        const item = document.createElement('div');
        item.className = 'emoji-item';
        item.innerHTML = `
            <div class="emoji">${emoji}</div>
            <div class="count">${count}</div>
            <div class="label">${emojiMap[emoji]}</div>
        `;
        container.appendChild(item);
    });
}

function displayCommentsInTabs(comments) {
    displayCommentsList('allComments', comments.slice(0, 50));
    
    const positiveComments = comments.filter(c => 
        c.sentiment === 'Positive' || c.sentiment === 'Very Positive'
    ).sort((a, b) => b.polarity - a.polarity);
    displayCommentsList('positiveComments', positiveComments.slice(0, 30));
    
    const negativeComments = comments.filter(c => 
        c.sentiment === 'Negative' || c.sentiment === 'Very Negative'
    ).sort((a, b) => a.polarity - b.polarity);
    displayCommentsList('negativeComments', negativeComments.slice(0, 30));
    
    const likedComments = [...comments].sort((a, b) => b.likes - a.likes);
    displayCommentsList('likedComments', likedComments.slice(0, 30));
    
    const insightComments = comments.filter(c => 
        Math.abs(c.polarity) > 0.5 && c.likes > 5
    );
    displayCommentsList('insightComments', insightComments.slice(0, 30));
    
    const questionComments = comments.filter(c => c.text.includes('?'));
    displayCommentsList('questionComments', questionComments.slice(0, 30));
}

function displayCommentsList(containerId, comments) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = '';
    
    if (comments.length === 0) {
        container.innerHTML = '<p style="text-align: center; padding: 3rem; color: #6b7280; font-size: 1.1rem;">No comments found in this category</p>';
        return;
    }
    
    const fragment = document.createDocumentFragment();
    comments.forEach(comment => {
        fragment.appendChild(createEnhancedCommentCard(comment));
    });
    container.appendChild(fragment);
}

function createEnhancedCommentCard(comment) {
    const card = document.createElement('div');
    card.className = 'comment-card';
    
    const sentimentClass = comment.sentiment.includes('Positive') ? 'sentiment-positive' :
                          comment.sentiment.includes('Negative') ? 'sentiment-negative' :
                          'sentiment-neutral';
    
    const timeAgo = formatDate(comment.postedTime);
    
    const sentimentEmoji = comment.sentiment === 'Very Positive' ? '😊' :
                          comment.sentiment === 'Positive' ? '🙂' :
                          comment.sentiment === 'Neutral' ? '😐' :
                          comment.sentiment === 'Negative' ? '😟' :
                          '😢';
    
    card.innerHTML = `
        <div class="comment-header">
            <div class="comment-author">
                <i class="fas fa-user-circle"></i>
                ${escapeHtml(comment.author)}
            </div>
            <div class="comment-sentiment ${sentimentClass}">
                ${sentimentEmoji} ${comment.sentiment} (${comment.polarity.toFixed(2)})
            </div>
        </div>
        <div class="comment-text">${escapeHtml(comment.text)}</div>
        <div class="comment-meta">
            <span><i class="fas fa-thumbs-up"></i> ${comment.likes}</span>
            <span><i class="fas fa-clock"></i> ${timeAgo}</span>
            <span><i class="fas fa-chart-line"></i> Confidence: ${(comment.confidence * 100).toFixed(0)}%</span>
        </div>
    `;
    
    return card;
}

function updateStatsDashboard(stats, comments) {
    const uniqueAuthors = new Set(comments.map(c => c.author)).size;
    const totalLikes = comments.reduce((sum, c) => sum + c.likes, 0);
    const totalReplies = 0;
    const engagementRate = ((totalLikes / comments.length) * 100).toFixed(1);
    
    const uniqueElem = document.getElementById('uniqueAuthors');
    const likesElem = document.getElementById('totalLikes');
    const repliesElem = document.getElementById('totalReplies');
    const engagementElem = document.getElementById('engagement');
    
    if (uniqueElem) uniqueElem.textContent = uniqueAuthors;
    if (likesElem) likesElem.textContent = formatNumber(totalLikes);
    if (repliesElem) repliesElem.textContent = totalReplies;
    if (engagementElem) engagementElem.textContent = engagementRate + '%';
}

function updateTabCounts(comments) {
    const updateCount = (id, value) => {
        const elem = document.getElementById(id);
        if (elem) elem.textContent = value;
    };
    
    updateCount('allCount', comments.length);
    updateCount('positiveTabCount', comments.filter(c => c.sentiment.includes('Positive')).length);
    updateCount('negativeTabCount', comments.filter(c => c.sentiment.includes('Negative')).length);
    updateCount('likedTabCount', comments.filter(c => c.likes > 10).length);
    updateCount('insightsTabCount', comments.filter(c => Math.abs(c.polarity) > 0.5).length);
    updateCount('questionsTabCount', comments.filter(c => c.text.includes('?')).length);
}

// ============================================================================
//                    TAB SWITCHING & CHART CONTROLS
// ============================================================================

function switchTab(tabName) {
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => tab.classList.remove('active'));
    event.target.closest('.tab').classList.add('active');
    
    const contents = document.querySelectorAll('.tab-content');
    contents.forEach(content => content.classList.remove('active'));
    const targetContent = document.getElementById('tab-' + tabName);
    if (targetContent) {
        targetContent.classList.add('active');
    }
}

function showChartType(type) {
    if (!analysisData) return;
    
    const buttons = document.querySelectorAll('.chart-btn');
    buttons.forEach(btn => btn.classList.remove('active'));
    event.target.closest('.chart-btn').classList.add('active');
    
    const ctx = document.getElementById('sentimentChart');
    if (!ctx) return;
    
    if (currentChart) {
        currentChart.destroy();
    }
    
    const stats = analysisData.statistics;
    
    const chartConfigs = {
        bar: {
            type: 'bar',
            data: {
                labels: ['Positive', 'Neutral', 'Negative'],
                datasets: [{
                    label: 'Sentiment %',
                    data: [
                        parseFloat(stats.positivePercent),
                        parseFloat(stats.neutralPercent),
                        parseFloat(stats.negativePercent)
                    ],
                    backgroundColor: [
                        'rgba(16, 185, 129, 0.8)',
                        'rgba(148, 163, 184, 0.8)',
                        'rgba(239, 68, 68, 0.8)'
                    ]
                }]
            }
        },
        pie: {
            type: 'pie',
            data: {
                labels: ['Positive', 'Neutral', 'Negative'],
                datasets: [{
                    data: [
                        parseFloat(stats.positivePercent),
                        parseFloat(stats.neutralPercent),
                        parseFloat(stats.negativePercent)
                    ],
                    backgroundColor: [
                        'rgba(16, 185, 129, 0.8)',
                        'rgba(148, 163, 184, 0.8)',
                        'rgba(239, 68, 68, 0.8)'
                    ]
                }]
            }
        },
        doughnut: {
            type: 'doughnut',
            data: {
                labels: ['Positive', 'Neutral', 'Negative'],
                datasets: [{
                    data: [
                        parseFloat(stats.positivePercent),
                        parseFloat(stats.neutralPercent),
                        parseFloat(stats.negativePercent)
                    ],
                    backgroundColor: [
                        'rgba(16, 185, 129, 0.8)',
                        'rgba(148, 163, 184, 0.8)',
                        'rgba(239, 68, 68, 0.8)'
                    ],
                    borderWidth: 3,
                    borderColor: '#fff'
                }]
            }
        }
    };
    
    currentChart = new Chart(ctx, {
        ...chartConfigs[type],
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 500
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.label + ': ' + context.parsed.toFixed(1) + '%';
                        }
                    }
                }
            }
        }
    });
}

// ============================================================================
//                    EXPORT FUNCTIONS
// ============================================================================

function exportToExcel() {
    if (!analysisData) {
        alert('No data to export. Please analyze a video first.');
        return;
    }
    
    const wb = XLSX.utils.book_new();
    
    const summaryData = [
        ['YOUTUBE SENTIMENT ANALYSIS REPORT'],
        [''],
        ['Video Title', analysisData.metadata.title],
        ['Channel', analysisData.metadata.channel],
        ['Video ID', analysisData.metadata.videoId],
        ['Total Comments', analysisData.statistics.totalComments],
        ['Analysis Date', new Date().toLocaleString()],
        [''],
        ['SENTIMENT BREAKDOWN'],
        ['Positive', analysisData.statistics.positivePercent + '%'],
        ['Neutral', analysisData.statistics.neutralPercent + '%'],
        ['Negative', analysisData.statistics.negativePercent + '%'],
        [''],
        ['STATISTICS'],
        ['Average Polarity', analysisData.statistics.avgPolarity],
        ['Average Subjectivity', analysisData.statistics.avgSubjectivity],
        ['Total Likes', analysisData.statistics.totalLikes],
        ['Average Likes', analysisData.statistics.avgLikes]
    ];
    const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, ws1, 'Summary');
    
    const commentsData = analysisData.comments.map(c => ({
        'Row': c.row,
        'Author': c.author,
        'Comment': c.text,
        'Sentiment': c.sentiment,
        'Polarity': c.polarity,
        'Subjectivity': c.subjectivity,
        'Confidence': c.confidence,
        'Likes': c.likes,
        'Posted': c.postedTime
    }));
    const ws2 = XLSX.utils.json_to_sheet(commentsData);
    XLSX.utils.book_append_sheet(wb, ws2, 'All Comments');
    
    const insightsData = analysisData.insights.map(i => ({
        'Category': i.category,
        'Insight': i.insight,
        'Action': i.action
    }));
    const ws3 = XLSX.utils.json_to_sheet(insightsData);
    XLSX.utils.book_append_sheet(wb, ws3, 'Key Insights');
    
    const topPositive = analysisData.comments
        .filter(c => c.sentiment.includes('Positive'))
        .sort((a, b) => b.polarity - a.polarity)
        .slice(0, 50)
        .map(c => ({
            'Author': c.author,
            'Comment': c.text,
            'Polarity': c.polarity,
            'Likes': c.likes
        }));
    const ws4 = XLSX.utils.json_to_sheet(topPositive);
    XLSX.utils.book_append_sheet(wb, ws4, 'Top Positive');
    
    const topNegative = analysisData.comments
        .filter(c => c.sentiment.includes('Negative'))
        .sort((a, b) => a.polarity - b.polarity)
        .slice(0, 50)
        .map(c => ({
            'Author': c.author,
            'Comment': c.text,
            'Polarity': c.polarity,
            'Likes': c.likes
        }));
    const ws5 = XLSX.utils.json_to_sheet(topNegative);
    XLSX.utils.book_append_sheet(wb, ws5, 'Top Negative');
    
    const filename = `youtube_analysis_${analysisData.metadata.videoId}_${Date.now()}.xlsx`;
    XLSX.writeFile(wb, filename);
}

async function exportToPDF() {
    if (!analysisData) {
        alert('No data to export. Please analyze a video first.');
        return;
    }
    
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        let y = 20;
        
        doc.setFontSize(20);
        doc.setTextColor(99, 102, 241);
        doc.text('YouTube Sentiment Analysis', 20, y);
        y += 15;
        
        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        doc.text(`Title: ${analysisData.metadata.title.substring(0, 60)}`, 20, y);
        y += 10;
        doc.text(`Channel: ${analysisData.metadata.channel}`, 20, y);
        y += 10;
        doc.text(`Total Comments: ${analysisData.statistics.totalComments}`, 20, y);
        y += 10;
        doc.text(`Positive: ${analysisData.statistics.positivePercent}%`, 20, y);
        y += 10;
        doc.text(`Negative: ${analysisData.statistics.negativePercent}%`, 20, y);
        y += 10;
        doc.text(`Neutral: ${analysisData.statistics.neutralPercent}%`, 20, y);
        y += 15;
        
        doc.setFontSize(14);
        doc.setTextColor(99, 102, 241);
        doc.text('Key Insights', 20, y);
        y += 10;
        
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        analysisData.insights.forEach(insight => {
            if (y > 270) {
                doc.addPage();
                y = 20;
            }
            const text = `${insight.category}: ${insight.insight}`;
            const lines = doc.splitTextToSize(text, 170);
            doc.text(lines, 20, y);
            y += lines.length * 7;
        });
        
        doc.save(`youtube_analysis_${Date.now()}.pdf`);
    } catch (error) {
        console.error('PDF export error:', error);
        alert('PDF library not loaded. Downloading Excel instead...');
        exportToExcel();
    }
}

function shareAnalysis() {
    if (!analysisData) {
        alert('No data to share. Please analyze a video first.');
        return;
    }
    
    const shareText = `YouTube Sentiment Analysis Results:\n\n` +
        `Video: ${analysisData.metadata.title}\n` +
        `Total Comments: ${analysisData.statistics.totalComments}\n` +
        `Positive: ${analysisData.statistics.positivePercent}%\n` +
        `Negative: ${analysisData.statistics.negativePercent}%\n` +
        `Neutral: ${analysisData.statistics.neutralPercent}%\n\n` +
        `Analyzed on: ${new Date().toLocaleDateString()}`;
    
    if (navigator.share) {
        navigator.share({
            title: 'YouTube Sentiment Analysis',
            text: shareText
        }).catch(err => console.log('Share cancelled'));
    } else {
        navigator.clipboard.writeText(shareText).then(() => {
            alert('✓ Analysis summary copied to clipboard!');
        });
    }
}

function printReport() {
    window.print();
}

// ============================================================================
//                    HISTORY FUNCTIONS
// ============================================================================

function addToHistory(data) {
    const historyItem = {
        id: Date.now(),
        videoId: data.metadata.videoId,
        title: data.metadata.title,
        date: new Date().toISOString(),
        stats: {
            total: data.statistics.totalComments,
            positive: data.statistics.positivePercent,
            negative: data.statistics.negativePercent
        }
    };
    
    analysisHistory.unshift(historyItem);
    if (analysisHistory.length > 10) {
        analysisHistory = analysisHistory.slice(0, 10);
    }
    
    localStorage.setItem('analysisHistory', JSON.stringify(analysisHistory));
    updateHeaderStats();
}

function loadHistory() {
    const saved = localStorage.getItem('analysisHistory');
    if (saved) {
        try {
            analysisHistory = JSON.parse(saved);
        } catch (e) {
            analysisHistory = [];
        }
    }
}

function saveToHistory() {
    if (analysisData) {
        addToHistory(analysisData);
        alert('✓ Analysis saved to history!');
    }
}

function showHistory() {
    const history = JSON.parse(localStorage.getItem('analysisHistory') || '[]');
    
    if (history.length === 0) {
        alert('No analysis history found.');
        return;
    }
    
    const modal = document.getElementById('historyModal');
    const content = document.getElementById('historyContent');
    
    content.innerHTML = history.map(item => `
        <div style="padding: 1.5rem; margin-bottom: 1rem; background: #f3f4f6; border-radius: 15px; cursor: pointer; transition: all 0.3s;"
             onmouseover="this.style.background='#e5e7eb'" 
             onmouseout="this.style.background='#f3f4f6'">
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                <i class="fab fa-youtube" style="font-size: 1.5rem; color: #ff0000;"></i>
                <div style="font-weight: 700; font-size: 1.1rem;">${escapeHtml(item.title || 'Video ' + item.videoId)}</div>
            </div>
            <div style="color: #6b7280; font-size: 0.9rem; margin-bottom: 0.5rem;">
                ${new Date(item.date).toLocaleString()}
            </div>
            <div style="display: flex; gap: 1rem; font-size: 0.9rem;">
                <span style="color: #10b981;">✓ ${item.stats.total} comments</span>
                <span style="color: #10b981;">↑ ${item.stats.positive}% positive</span>
            </div>
        </div>
    `).join('');
    
    modal.classList.add('active');
}

function updateHeaderStats() {
    const totalAnalyzed = analysisHistory.length;
    const totalComments = analysisHistory.reduce((sum, item) => sum + item.stats.total, 0);
    
    const analyzedElem = document.getElementById('totalAnalyzed');
    const commentsElem = document.getElementById('totalCommentsProcessed');
    
    if (analyzedElem) analyzedElem.textContent = totalAnalyzed;
    if (commentsElem) commentsElem.textContent = formatNumber(totalComments);
}

// ============================================================================
//                    MODAL FUNCTIONS
// ============================================================================

function showContactModal() {
    const modal = document.getElementById('contactModal');
    if (modal) {
        modal.classList.add('active');
    }
}

function showAboutModal() {
    const modal = document.getElementById('aboutModal');
    if (modal) {
        modal.classList.add('active');
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
    }
}

// ============================================================================
//                    MOBILE MENU FUNCTIONS
// ============================================================================

function toggleMobileMenu() {
    const navLinks = document.getElementById('navLinks');
    const menuToggle = document.getElementById('mobileMenuToggle');
    
    if (navLinks && menuToggle) {
        navLinks.classList.toggle('active');
        
        const icon = menuToggle.querySelector('i');
        if (navLinks.classList.contains('active')) {
            icon.classList.remove('fa-bars');
            icon.classList.add('fa-times');
        } else {
            icon.classList.remove('fa-times');
            icon.classList.add('fa-bars');
        }
    }
}

function closeMobileMenu() {
    const navLinks = document.getElementById('navLinks');
    const menuToggle = document.getElementById('mobileMenuToggle');
    
    if (navLinks && menuToggle) {
        navLinks.classList.remove('active');
        
        const icon = menuToggle.querySelector('i');
        icon.classList.remove('fa-times');
        icon.classList.add('fa-bars');
    }
}

// ============================================================================
//                    UTILITY FUNCTIONS
// ============================================================================

function clearInput() {
    document.getElementById('videoUrl').value = '';
    document.getElementById('videoUrl').focus();
}

function analyzeAnother() {
    clearInput();
    hideResults();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function filterComments() {
    const searchTerm = document.getElementById('searchComments').value.toLowerCase();
    
    if (!analysisData) return;
    
    const filtered = analysisData.comments.filter(c => 
        c.text.toLowerCase().includes(searchTerm) ||
        c.author.toLowerCase().includes(searchTerm)
    );
    
    displayCommentsList('allComments', filtered.slice(0, 50));
}

function sortComments() {
    if (!analysisData) return;
    
    const sortBy = document.getElementById('sortComments').value;
    let sorted = [...analysisData.comments];
    
    switch(sortBy) {
        case 'likes':
            sorted.sort((a, b) => b.likes - a.likes);
            break;
        case 'recent':
            sorted.sort((a, b) => new Date(b.postedTime) - new Date(a.postedTime));
            break;
        case 'polarity':
            sorted.sort((a, b) => b.polarity - a.polarity);
            break;
    }
    
    displayCommentsList('allComments', sorted.slice(0, 50));
}

function animateValue(id, start, end, duration, suffix = '', decimals = 0) {
    const element = document.getElementById(id);
    if (!element) return;
    
    const range = end - start;
    const increment = range / (duration / 16);
    let current = start;
    
    const timer = setInterval(() => {
        current += increment;
        if ((increment > 0 && current >= end) || (increment < 0 && current <= end)) {
            current = end;
            clearInterval(timer);
        }
        element.textContent = current.toFixed(decimals) + suffix;
    }, 16);
}

function formatNumberSafe(num) {
    if (num === undefined || num === null || isNaN(num)) {
        return 'N/A';
    }
    return formatNumber(num);
}

function formatNumber(num) {
    if (typeof num !== 'number') {
        num = parseInt(num) || 0;
    }
    
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
}

function formatDate(isoString) {
    if (!isoString) return 'Unknown';
    try {
        const date = new Date(isoString);
        const now = new Date();
        const diff = now - date;
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        
        if (days === 0) return 'Today';
        if (days === 1) return 'Yesterday';
        if (days < 7) return `${days} days ago`;
        if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
        if (days < 365) return `${Math.floor(days / 30)} months ago`;
        return `${Math.floor(days / 365)} years ago`;
    } catch (e) {
        return 'Unknown';
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function updateLoadingStatus(message, progress, step) {
    const statusElem = document.getElementById('loadingStatus');
    const fillElem = document.getElementById('progressFill');
    const percentElem = document.getElementById('progressPercent');
    const stepElem = document.getElementById('progressStep');
    
    if (statusElem) statusElem.textContent = message;
    if (fillElem) fillElem.style.width = progress + '%';
    if (percentElem) percentElem.textContent = Math.round(progress) + '%';
    if (stepElem) stepElem.textContent = step;
}

function startLoadingTimer() {
    loadingTimer = setInterval(() => {
        const elapsed = Math.floor((Date.now() - loadingStartTime) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        const timeElem = document.getElementById('loadingTime');
        if (timeElem) {
            timeElem.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }
    }, 1000);
}

function stopLoadingTimer() {
    if (loadingTimer) {
        clearInterval(loadingTimer);
        loadingTimer = null;
    }
}

function showLoading() {
    const loading = document.getElementById('loading');
    if (loading) loading.classList.add('active');
}

function hideLoading() {
    const loading = document.getElementById('loading');
    if (loading) loading.classList.remove('active');
}

function showResults() {
    const results = document.getElementById('results');
    if (results) results.classList.add('active');
}

function hideResults() {
    const results = document.getElementById('results');
    if (results) results.classList.remove('active');
}

function showError(message) {
    const errorElem = document.getElementById('errorMessage');
    const errorText = document.getElementById('errorText');
    if (errorElem && errorText) {
        errorText.textContent = message;
        errorElem.classList.add('active');
        errorElem.style.display = 'flex';
    }
}

function hideError() {
    const errorElem = document.getElementById('errorMessage');
    if (errorElem) {
        errorElem.classList.remove('active');
        errorElem.style.display = 'none';
    }
}

function disableAnalyzeButton() {
    const btn = document.getElementById('analyzeBtn');
    if (btn) btn.disabled = true;
}

function enableAnalyzeButton() {
    const btn = document.getElementById('analyzeBtn');
    if (btn) btn.disabled = false;
}

// Close modals and mobile menu when clicking outside
window.addEventListener('click', function(event) {
    const navLinks = document.getElementById('navLinks');
    const menuToggle = document.getElementById('mobileMenuToggle');
    
    if (navLinks && menuToggle) {
        if (!event.target.closest('.nav-links') && 
            !event.target.closest('.mobile-menu-toggle') && 
            navLinks.classList.contains('active')) {
            closeMobileMenu();
        }
    }
    
    if (event.target.classList.contains('modal')) {
        event.target.classList.remove('active');
    }
});
