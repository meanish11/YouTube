const express = require('express');
const cors = require('cors');
const axios = require('axios');
const Sentiment = require('sentiment');
const path = require('path');
require('dotenv').config();

const app = express();
const sentiment = new Sentiment();
const PORT = process.env.PORT || 3000;

// IMPORTANT: Middleware order matters
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

console.log('API Key loaded:', YOUTUBE_API_KEY ? 'Yes ✓' : 'No ✗');

// ============================================================================
//                         HELPER FUNCTIONS
// ============================================================================

function extractVideoId(url) {
    const patterns = [
        /(?:youtube\.com\/watch\?v=)([\w-]+)/,
        /(?:youtu\.be\/)([\w-]+)/,
        /(?:youtube\.com\/embed\/)([\w-]+)/,
        /(?:youtube\.com\/shorts\/)([\w-]+)/
    ];
    
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }
    return url;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchVideoMetadata(videoId) {
    try {
        console.log('Fetching metadata for:', videoId);
        
        const response = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
            params: {
                part: 'snippet,statistics,contentDetails',
                id: videoId,
                key: YOUTUBE_API_KEY
            }
        });
        
        if (!response.data.items || response.data.items.length === 0) {
            throw new Error('Video not found');
        }
        
        const video = response.data.items[0];
        
        return {
            videoId: videoId,
            title: video.snippet.title,
            channel: video.snippet.channelTitle,
            channelId: video.snippet.channelId,
            description: video.snippet.description || '',
            uploadDate: video.snippet.publishedAt,
            viewCount: parseInt(video.statistics.viewCount) || 0,
            likeCount: parseInt(video.statistics.likeCount) || 0,
            commentCount: parseInt(video.statistics.commentCount) || 0,
            duration: video.contentDetails.duration,
            thumbnail: video.snippet.thumbnails.high?.url || '',
            tags: video.snippet.tags || []
        };
    } catch (error) {
        console.error('Metadata error:', error.message);
        throw new Error('Failed to fetch video metadata: ' + error.message);
    }
}

async function fetchComments(videoId, maxComments = null) {
    console.log('Fetching comments for:', videoId);
    
    const allComments = [];
    const seenIds = new Set();
    
    // Fetch by relevance
    let nextPageToken = null;
    let pageCount = 0;
    
    try {
        do {
            pageCount++;
            console.log(`Fetching page ${pageCount}...`);
            
            const response = await axios.get('https://www.googleapis.com/youtube/v3/commentThreads', {
                params: {
                    part: 'snippet',
                    videoId: videoId,
                    maxResults: 100,
                    order: 'relevance',
                    pageToken: nextPageToken,
                    key: YOUTUBE_API_KEY
                }
            });
            
            if (response.data.items) {
                response.data.items.forEach(item => {
                    const comment = item.snippet.topLevelComment.snippet;
                    const commentId = item.snippet.topLevelComment.id;
                    
                    if (!seenIds.has(commentId)) {
                        seenIds.add(commentId);
                        allComments.push({
                            id: commentId,
                            author: comment.authorDisplayName,
                            text: comment.textDisplay.replace(/<[^>]*>/g, ''),
                            likes: comment.likeCount || 0,
                            publishedAt: comment.publishedAt,
                            replyCount: item.snippet.totalReplyCount || 0,
                            isReply: false
                        });
                    }
                });
                
                console.log(`Got ${response.data.items.length} comments. Total: ${allComments.length}`);
            }
            
            nextPageToken = response.data.nextPageToken;
            
            if (maxComments && allComments.length >= maxComments) {
                break;
            }
            
            await sleep(500);
            
        } while (nextPageToken && pageCount < 20);
        
        console.log(`Total extracted: ${allComments.length} comments`);
        return allComments;
        
    } catch (error) {
        console.error('Comments fetch error:', error.message);
        if (error.response?.status === 403) {
            throw new Error('Comments are disabled or API quota exceeded');
        }
        throw new Error('Failed to fetch comments: ' + error.message);
    }
}

function analyzeSentiment(text) {
    const result = sentiment.analyze(text);
    const comparative = result.comparative;
    const polarity = Math.max(-1, Math.min(1, comparative * 5));
    const subjectivity = Math.min(1, Math.abs(result.score) / (text.split(' ').length + 1));
    
    let sentimentLabel;
    if (polarity > 0.3) sentimentLabel = 'Very Positive';
    else if (polarity > 0.1) sentimentLabel = 'Positive';
    else if (polarity < -0.3) sentimentLabel = 'Very Negative';
    else if (polarity < -0.1) sentimentLabel = 'Negative';
    else sentimentLabel = 'Neutral';
    
    return {
        sentiment: sentimentLabel,
        polarity: parseFloat(polarity.toFixed(4)),
        subjectivity: parseFloat(subjectivity.toFixed(4)),
        confidence: parseFloat(Math.abs(polarity).toFixed(4))
    };
}

function processComments(comments) {
    return comments.map((comment, index) => {
        const sentimentResult = analyzeSentiment(comment.text);
        
        return {
            row: index + 1,
            author: comment.author,
            text: comment.text,
            sentiment: sentimentResult.sentiment,
            polarity: sentimentResult.polarity,
            subjectivity: sentimentResult.subjectivity,
            confidence: sentimentResult.confidence,
            likes: comment.likes || 0,
            replyCount: comment.replyCount || 0,
            postedTime: comment.publishedAt,
            timestamp: comment.publishedAt,
            isReply: false
        };
    });
}

function calculateStatistics(comments) {
    const total = comments.length;
    const sentimentCounts = {
        'Very Positive': 0, 'Positive': 0, 'Neutral': 0,
        'Negative': 0, 'Very Negative': 0
    };
    
    let totalPolarity = 0, totalSubjectivity = 0, totalConfidence = 0, totalLikes = 0;
    
    comments.forEach(c => {
        sentimentCounts[c.sentiment]++;
        totalPolarity += c.polarity;
        totalSubjectivity += c.subjectivity;
        totalConfidence += c.confidence;
        totalLikes += c.likes;
    });
    
    const positiveCount = sentimentCounts['Very Positive'] + sentimentCounts['Positive'];
    const negativeCount = sentimentCounts['Very Negative'] + sentimentCounts['Negative'];
    
    return {
        totalComments: total,
        positiveCount, negativeCount,
        neutralCount: sentimentCounts['Neutral'],
        positivePercent: (positiveCount / total * 100).toFixed(2),
        negativePercent: (negativeCount / total * 100).toFixed(2),
        neutralPercent: (sentimentCounts['Neutral'] / total * 100).toFixed(2),
        veryPositivePercent: (sentimentCounts['Very Positive'] / total * 100).toFixed(2),
        veryNegativePercent: (sentimentCounts['Very Negative'] / total * 100).toFixed(2),
        avgPolarity: (totalPolarity / total).toFixed(4),
        avgSubjectivity: (totalSubjectivity / total).toFixed(4),
        avgConfidence: (totalConfidence / total).toFixed(4),
        totalLikes, avgLikes: (totalLikes / total).toFixed(2),
        maxPolarity: Math.max(...comments.map(c => c.polarity)).toFixed(4),
        minPolarity: Math.min(...comments.map(c => c.polarity)).toFixed(4)
    };
}

function generateInsights(comments, stats) {
    const insights = [];
    const posPercent = parseFloat(stats.positivePercent);
    const negPercent = parseFloat(stats.negativePercent);
    
    insights.push({
        category: 'Overall Sentiment',
        insight: `${posPercent}% positive, ${negPercent}% negative`,
        action: posPercent > 60 ? 'Strong positive reception' : 'Mixed reception'
    });
    
    return insights;
}

// ============================================================================
//                         ROUTES
// ============================================================================

// Health check
app.get('/api/health', (req, res) => {
    console.log('Health check requested');
    res.json({ 
        status: 'OK',
        timestamp: new Date().toISOString(),
        apiKey: YOUTUBE_API_KEY ? 'Configured' : 'Missing'
    });
});

// Main analysis endpoint
app.post('/api/analyze', async (req, res) => {
    console.log('\n========================================');
    console.log('Analysis request received');
    console.log('Body:', req.body);
    
    try {
        const { videoUrl, maxComments } = req.body;
        
        if (!videoUrl) {
            console.log('Error: No URL provided');
            return res.status(400).json({ error: 'Video URL is required' });
        }
        
        if (!YOUTUBE_API_KEY) {
            console.log('Error: No API key');
            return res.status(500).json({ error: 'YouTube API key not configured' });
        }
        
        const videoId = extractVideoId(videoUrl);
        console.log('Video ID:', videoId);
        
        // Fetch metadata
        const metadata = await fetchVideoMetadata(videoId);
        console.log('Metadata fetched:', metadata.title);
        
        // Fetch comments
        const rawComments = await fetchComments(videoId, maxComments);
        console.log('Comments fetched:', rawComments.length);
        
        if (rawComments.length === 0) {
            return res.status(404).json({ error: 'No comments found' });
        }
        
        // Process
        const processedComments = processComments(rawComments);
        const statistics = calculateStatistics(processedComments);
        const insights = generateInsights(processedComments, statistics);
        
        console.log('Analysis complete!');
        console.log('========================================\n');
        
        res.json({
            success: true,
            metadata: {
                ...metadata,
                videoUrl,
                analysisDate: new Date().toISOString(),
                extractedComments: processedComments.length,
                youtubeCommentCount: metadata.commentCount,
                coveragePercent: ((processedComments.length/metadata.commentCount)*100).toFixed(2)
            },
            statistics,
            insights,
            comments: processedComments
        });
        
    } catch (error) {
        console.error('Analysis error:', error);
        res.status(500).json({ 
            error: error.message || 'Analysis failed'
        });
    }
});

// Serve frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Catch all other routes
app.use((req, res) => {
    console.log('404 for:', req.method, req.url);
    res.status(404).json({ error: 'Route not found' });
});

// ============================================================================
//                         START SERVER
// ============================================================================

app.listen(PORT, () => {
    console.log('='.repeat(70));
    console.log('🎥 YOUTUBE SENTIMENT ANALYZER');
    console.log('='.repeat(70));
    console.log(`📡 Server: http://localhost:${PORT}`);
    console.log(`🔑 API Key: ${YOUTUBE_API_KEY ? '✓ Configured' : '✗ MISSING'}`);
    console.log('='.repeat(70));
    
    if (!YOUTUBE_API_KEY) {
        console.log('\n⚠️  WARNING: Add YOUTUBE_API_KEY to .env file!\n');
    }
});
