#!/usr/bin/env python3
import sys
import json
from youtube_comment_downloader import YoutubeCommentDownloader, SORT_BY_POPULAR, SORT_BY_RECENT

def extract_video_id(url):
    """Extract video ID from various YouTube URL formats"""
    import re
    patterns = [
        r'(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)',
        r'youtube\.com\/shorts\/([^&\n?#]+)',
    ]
    
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            video_id = match.group(1)
            print(f"✓ Extracted video ID: {video_id}", file=sys.stderr)
            return video_id
    
    print(f"❌ Could not extract video ID from: {url}", file=sys.stderr)
    return None

def get_video_metadata(video_id):
    """Get video metadata using yt-dlp"""
    try:
        import yt_dlp
        
        print(f"📊 Fetching metadata for video: {video_id}", file=sys.stderr)
        
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'extract_flat': False,
            'skip_download': True,
            'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'http_headers': {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-us,en;q=0.5',
            }
        }
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(f'https://www.youtube.com/watch?v={video_id}', download=False)
            
            metadata = {
                'title': info.get('title', 'Unknown'),
                'channel': info.get('uploader', 'Unknown'),
                'viewCount': info.get('view_count', 0),
                'likeCount': info.get('like_count', 0),
                'duration': info.get('duration_string', 'Unknown'),
                'uploadDate': info.get('upload_date', 'Unknown'),
                'thumbnail': info.get('thumbnail', ''),
                'description': info.get('description', '')[:500]
            }
            
            print(f"✓ Metadata retrieved: {metadata['title']}", file=sys.stderr)
            return metadata
            
    except Exception as e:
        print(f"⚠️  Metadata fetch failed: {str(e)}", file=sys.stderr)
        return {
            'title': 'Unknown',
            'channel': 'Unknown',
            'viewCount': 0,
            'likeCount': 0,
            'duration': 'Unknown',
            'uploadDate': 'Unknown',
            'thumbnail': '',
            'description': ''
        }

def scrape_comments(video_url, max_comments=None):
    try:
        print(f"🎬 Starting scraper...", file=sys.stderr)
        print(f"📹 Video URL: {video_url}", file=sys.stderr)
        print(f"📊 Max comments: {max_comments or 'All'}", file=sys.stderr)
        
        video_id = extract_video_id(video_url)
        if not video_id:
            return {
                'success': False,
                'error': 'Invalid YouTube URL. Please provide a valid youtube.com or youtu.be link.',
                'video_id': None,
                'total': 0,
                'comments': [],
                'metadata': {}
            }
        
        print("📥 Initializing comment downloader...", file=sys.stderr)
        downloader = YoutubeCommentDownloader()
        
        print("📡 Fetching comments from YouTube...", file=sys.stderr)
        comments = []
        count = 0
        
        try:
            for comment in downloader.get_comments_from_url(video_url, sort_by=SORT_BY_POPULAR):
                comments.append({
                    'id': comment.get('cid', ''),
                    'author': comment.get('author', 'Unknown'),
                    'text': comment.get('text', ''),
                    'likes': int(comment.get('votes', 0)),
                    'publishedAt': comment.get('time', ''),
                    'replyCount': 0,
                    'isReply': False
                })
                
                count += 1
                
                if count % 100 == 0:
                    print(f"   → Scraped {count} comments...", file=sys.stderr)
                
                if max_comments and count >= int(max_comments):
                    print(f"   → Reached limit of {max_comments} comments", file=sys.stderr)
                    break
                    
        except Exception as scrape_error:
            print(f"⚠️  Scraping error: {str(scrape_error)}", file=sys.stderr)
            if count == 0:
                return {
                    'success': False,
                    'error': f'Failed to scrape comments: {str(scrape_error)}. The video might have comments disabled or restricted access.',
                    'video_id': video_id,
                    'total': 0,
                    'comments': [],
                    'metadata': {}
                }
        
        if count == 0:
            print("⚠️  No comments found!", file=sys.stderr)
            return {
                'success': False,
                'error': 'No comments found. The video might have comments disabled, be age-restricted, or have no comments yet.',
                'video_id': video_id,
                'total': 0,
                'comments': [],
                'metadata': get_video_metadata(video_id)
            }
        
        print(f"✅ Successfully scraped {count} comments", file=sys.stderr)
        
        print("📊 Fetching video metadata...", file=sys.stderr)
        metadata = get_video_metadata(video_id)
        
        result = {
            'success': True,
            'video_id': video_id,
            'total': len(comments),
            'comments': comments,
            'metadata': metadata
        }
        
        print(f"✓ Scraping complete: {len(comments)} comments", file=sys.stderr)
        return result
        
    except Exception as e:
        print(f"❌ Fatal error: {str(e)}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        return {
            'success': False,
            'error': f'Fatal error: {str(e)}',
            'video_id': None,
            'total': 0,
            'comments': [],
            'metadata': {}
        }

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({
            'success': False,
            'error': 'No video URL provided'
        }))
        sys.exit(1)
    
    video_url = sys.argv[1]
    max_comments = int(sys.argv[2]) if len(sys.argv) > 2 else None
    
    result = scrape_comments(video_url, max_comments)
    print(json.dumps(result, ensure_ascii=False))
