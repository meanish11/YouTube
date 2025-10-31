#!/usr/bin/env python3
"""
YouTube Sentiment Analyzer - Enhanced Scraper with Full Metadata
"""

import sys
import json
import re
from youtube_comment_downloader import YoutubeCommentDownloader, SORT_BY_POPULAR, SORT_BY_RECENT

def extract_video_id(url):
    """Extract video ID from YouTube URL"""
    patterns = [
        r'(?:youtube\.com\/watch\?v=)([\w-]+)',
        r'(?:youtu\.be\/)([\w-]+)',
        r'(?:youtube\.com\/embed\/)([\w-]+)',
        r'(?:youtube\.com\/shorts\/)([\w-]+)',
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None

def scrape_youtube_comments(video_id, max_comments=None):
    """Scrape YouTube comments"""
    print(f"🎬 Scraping YouTube video: {video_id}", file=sys.stderr)
    
    downloader = YoutubeCommentDownloader()
    all_comments = []
    seen_ids = set()
    
    try:
        # Phase 1: Popular comments
        print("📥 Phase 1: Fetching popular comments...", file=sys.stderr)
        popular_count = 0
        
        try:
            for comment in downloader.get_comments_from_url(
                f'https://www.youtube.com/watch?v={video_id}',
                sort_by=SORT_BY_POPULAR
            ):
                if comment['cid'] not in seen_ids:
                    seen_ids.add(comment['cid'])
                    all_comments.append({
                        'id': comment['cid'],
                        'author': comment.get('author', 'Unknown'),
                        'text': comment.get('text', ''),
                        'likes': int(comment.get('votes', 0)),
                        'publishedAt': comment.get('time', ''),
                        'replyCount': 0,
                        'isReply': False
                    })
                    popular_count += 1
                    
                    if popular_count % 500 == 0:
                        print(f"   → {popular_count} popular comments...", file=sys.stderr)
                
                if max_comments and len(all_comments) >= max_comments:
                    break
        except Exception as e:
            print(f"   ⚠️  Popular phase: {str(e)[:100]}", file=sys.stderr)
        
        print(f"   ✓ Got {popular_count} popular comments", file=sys.stderr)
        
        # Phase 2: Recent comments
        if not max_comments or len(all_comments) < max_comments:
            print("📥 Phase 2: Fetching recent comments...", file=sys.stderr)
            recent_count = 0
            
            try:
                for comment in downloader.get_comments_from_url(
                    f'https://www.youtube.com/watch?v={video_id}',
                    sort_by=SORT_BY_RECENT
                ):
                    if comment['cid'] not in seen_ids:
                        seen_ids.add(comment['cid'])
                        all_comments.append({
                            'id': comment['cid'],
                            'author': comment.get('author', 'Unknown'),
                            'text': comment.get('text', ''),
                            'likes': int(comment.get('votes', 0)),
                            'publishedAt': comment.get('time', ''),
                            'replyCount': 0,
                            'isReply': False
                        })
                        recent_count += 1
                        
                        if recent_count % 500 == 0:
                            print(f"   → {recent_count} recent comments...", file=sys.stderr)
                    
                    if max_comments and len(all_comments) >= max_comments:
                        break
            except Exception as e:
                print(f"   ⚠️  Recent phase: {str(e)[:100]}", file=sys.stderr)
            
            print(f"   ✓ Got {recent_count} additional comments", file=sys.stderr)
        
        print(f"✅ TOTAL: {len(all_comments)} YouTube comments", file=sys.stderr)
        return all_comments
        
    except Exception as e:
        print(f"❌ YouTube error: {str(e)}", file=sys.stderr)
        return all_comments

def get_youtube_metadata(video_id):
    """Get YouTube metadata using yt-dlp or direct scraping"""
    print(f"📺 Fetching video metadata for: {video_id}", file=sys.stderr)
    
    try:
        # Try using yt-dlp if available
        import yt_dlp
        
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'extract_flat': False,
        }
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(f'https://www.youtube.com/watch?v={video_id}', download=False)
            
            # Format duration
            duration_seconds = info.get('duration', 0)
            hours = duration_seconds // 3600
            minutes = (duration_seconds % 3600) // 60
            seconds = duration_seconds % 60
            
            if hours > 0:
                duration = f"{hours}:{minutes:02d}:{seconds:02d}"
            else:
                duration = f"{minutes}:{seconds:02d}"
            
            # Format upload date
            upload_date = info.get('upload_date', '')
            if upload_date and len(upload_date) == 8:
                upload_date = f"{upload_date[:4]}-{upload_date[4:6]}-{upload_date[6:]}"
            
            metadata = {
                'title': info.get('title', 'YouTube Video'),
                'channel': info.get('uploader', 'Unknown Channel'),
                'channelId': info.get('channel_id', ''),
                'description': info.get('description', '')[:500],  # First 500 chars
                'thumbnail': info.get('thumbnail', f'https://img.youtube.com/vi/{video_id}/maxresdefault.jpg'),
                'viewCount': info.get('view_count', 0),
                'likeCount': info.get('like_count', 0),
                'commentCount': info.get('comment_count', 0),
                'duration': duration,
                'uploadDate': upload_date,
                'tags': info.get('tags', [])[:10]  # First 10 tags
            }
            
            print(f"   ✓ Fetched: {metadata['title']}", file=sys.stderr)
            print(f"   ✓ Channel: {metadata['channel']}", file=sys.stderr)
            print(f"   ✓ Views: {metadata['viewCount']:,}", file=sys.stderr)
            
            return metadata
            
    except ImportError:
        print("   ⚠️  yt-dlp not installed. Using fallback metadata.", file=sys.stderr)
        print("   💡 Install: pip install yt-dlp", file=sys.stderr)
    except Exception as e:
        print(f"   ⚠️  Metadata fetch error: {str(e)[:100]}", file=sys.stderr)
    
    # Fallback metadata
    return {
        'title': 'YouTube Video',
        'channel': 'Unknown Channel',
        'channelId': '',
        'description': '',
        'thumbnail': f'https://img.youtube.com/vi/{video_id}/maxresdefault.jpg',
        'viewCount': 0,
        'likeCount': 0,
        'commentCount': 0,
        'duration': 'N/A',
        'uploadDate': '',
        'tags': []
    }

def scrape_comments(url, max_comments=None):
    """Main function to scrape YouTube comments with metadata"""
    
    video_id = extract_video_id(url)
    if not video_id:
        return {
            "error": "Could not extract video ID from YouTube URL",
            "success": False
        }
    
    print(f"🎯 Video ID: {video_id}", file=sys.stderr)
    
    # Get metadata first
    metadata = get_youtube_metadata(video_id)
    
    # Then get comments
    comments = scrape_youtube_comments(video_id, max_comments)
    
    return {
        "success": True,
        "platform": "youtube",
        "video_id": video_id,
        "total": len(comments),
        "comments": comments,
        "metadata": metadata
    }

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({
            "error": "Video URL required",
            "success": False
        }))
        sys.exit(1)
    
    url = sys.argv[1]
    max_comments = int(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[2] != 'null' else None
    
    result = scrape_comments(url, max_comments)
    print(json.dumps(result))
