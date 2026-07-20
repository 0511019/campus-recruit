"""
校招瞭望台 - 高校招聘活动爬虫
每天自动抓取各高校就业网招聘会信息，输出 data.json
"""
import requests, json, re, time, hashlib
from datetime import datetime, timedelta
from bs4 import BeautifulSoup

# ========== 配置 ==========
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'
}
REQUEST_DELAY = 2  # 请求间隔（秒）

# ========== 高校数据源定义 ==========
SOURCES = [
    # 暨南大学
    {
        'name': '暨南大学',
        'region': ['广东'],
        'list_url': 'https://scdc.jnu.edu.cn/jobfair',
        'base_url': 'https://scdc.jnu.edu.cn',
        'item_selector': 'ul.jobfair-list li, .jobfair-item, .list-item, table.list-table tbody tr',
        'title_selector': 'a, .title a, h4 a, td a',
        'date_pattern': r'(\d{4}-\d{2}-\d{2})',
        'detail_url_pattern': r'/jobfair/view/id/(\d+)',
    },
    # 中山大学
    {
        'name': '中山大学',
        'region': ['广东'],
        'list_url': 'https://career.sysu.edu.cn/largefairs',
        'base_url': 'https://career.sysu.edu.cn',
        'item_selector': '.largefair-list li, .fair-item, .content-item, table tr',
        'title_selector': 'a, .title a, h4 a, td a',
        'date_pattern': r'(\d{4}-\d{2}-\d{2})',
        'detail_url_pattern': r'/largefairs/view/id/(\d+)',
    },
    # 华南理工大学
    {
        'name': '华南理工大学',
        'region': ['广东'],
        'list_url': 'https://career.scut.edu.cn/jobfair',
        'base_url': 'https://career.scut.edu.cn',
        'item_selector': '.jobfair-list li, .list-item, table tr',
        'title_selector': 'a, .title a, td a',
        'date_pattern': r'(\d{4}-\d{2}-\d{2})',
        'detail_url_pattern': r'/jobfair.*?(\d+)',
    },
    # 华南师范大学
    {
        'name': '华南师范大学',
        'region': ['广东'],
        'list_url': 'https://career.scnu.edu.cn/jobfair',
        'base_url': 'https://career.scnu.edu.cn',
        'item_selector': '.jobfair-list li, .list-item, table tr',
        'title_selector': 'a, .title a, td a',
        'date_pattern': r'(\d{4}-\d{2}-\d{2})',
        'detail_url_pattern': r'/jobfair.*?(\d+)',
    },
    # 广东工业大学
    {
        'name': '广东工业大学',
        'region': ['广东'],
        'list_url': 'https://career.gdut.edu.cn/jobfair',
        'base_url': 'https://career.gdut.edu.cn',
        'item_selector': '.jobfair-list li, .list-item, table tr',
        'title_selector': 'a, .title a, td a',
        'date_pattern': r'(\d{4}-\d{2}-\d{2})',
        'detail_url_pattern': r'/jobfair.*?(\d+)',
    },
    # 深圳大学
    {
        'name': '深圳大学',
        'region': ['广东'],
        'list_url': 'https://career.szu.edu.cn/largefairs',
        'base_url': 'https://career.szu.edu.cn',
        'item_selector': '.largefair-list li, .fair-item, .list-item, table tr',
        'title_selector': 'a, .title a, td a',
        'date_pattern': r'(\d{4}-\d{2}-\d{2})',
        'detail_url_pattern': r'/largefairs.*?(\d+)',
    },
]

# ========== 活动类型关键词映射 ==========
TYPE_KEYWORDS = {
    '空中双选会': ['空中双选', '线上双选', '网络双选', '空中招聘', '线上招聘'],
    '线下双选会': ['双选会', '招聘会', '供需见面'],
    '宣讲会': ['宣讲会', '宣讲', '专场招聘'],
    '网络招聘会': ['网络招聘', '线上招聘会'],
    '实习专招会': ['实习专招', '实习招聘', '实习生'],
    '供需见面会': ['供需见面'],
}

def map_activity_type(title):
    for atype, kws in TYPE_KEYWORDS.items():
        for kw in kws:
            if kw in title:
                return atype
    return '线下双选会'

def map_format(title, location_text):
    if '线上' in title or '空中' in title or '网络' in title:
        return 'online'
    if '线上' in (location_text or ''):
        return 'hybrid'
    return 'offline'

def map_status(start_date, end_date):
    today = datetime.now().strftime('%Y-%m-%d')
    if end_date and end_date < today:
        return 'ended', 'closed'
    if start_date and start_date <= today:
        return 'ongoing', 'open'
    return 'preview', 'open'

def extract_dates(text):
    """从文本提取所有日期"""
    dates = re.findall(r'(\d{4}-\d{2}-\d{2})', text)
    return dates

def fetch_page(url, max_retries=2):
    """获取页面内容"""
    for attempt in range(max_retries):
        try:
            resp = requests.get(url, headers=HEADERS, timeout=15)
            resp.encoding = resp.apparent_encoding or 'utf-8'
            return resp.text
        except Exception as e:
            print(f'  ⚠️ 请求失败 (尝试 {attempt+1}/{max_retries}): {e}')
            time.sleep(3)
    return None

def scrape_source(source):
    """爬取单个高校数据源"""
    activities = []
    print(f'\n📡 爬取 {source["name"]}...')

    html = fetch_page(source['list_url'])
    if not html:
        print(f'  ❌ 无法访问 {source["list_url"]}')
        return activities

    soup = BeautifulSoup(html, 'lxml')

    # 尝试多种选择器找到列表容器
    items = []
    for selector in source['item_selector'].split(', '):
        items = soup.select(selector)
        if items:
            break

    # fallback: 找所有包含链接的行
    if not items:
        items = soup.find_all(['tr', 'li', 'div'], class_=lambda c: c and any(
            kw in str(c).lower() for kw in ['fair', 'item', 'list', 'job'])
        )
    if not items:
        items = soup.select('a[href*="view/id"], a[href*="jobfair"]')

    print(f'  找到 {len(items)} 个条目')

    for item in items[:30]:  # 最多30条
        try:
            # 找标题链接
            link = None
            for sel in source['title_selector'].split(', '):
                link = item.select_one(sel.strip()) if not item.name == 'a' else item
                if link and link.name == 'a':
                    break

            if not link or link.name != 'a':
                link = item.find('a')

            if not link:
                continue

            title = link.get_text(strip=True)
            href = link.get('href', '')
            if not title or len(title) < 5:
                continue

            # 构建完整URL
            if href.startswith('http'):
                detail_url = href
            elif href.startswith('/'):
                detail_url = source['base_url'] + href
            else:
                detail_url = source['base_url'] + '/' + href

            # 招聘会标题通常包含"招聘"、"双选"、"宣讲"等关键词
            if not any(kw in title for kw in ['招聘', '双选', '宣讲', '供需', '实习']):
                continue

            # 提取日期
            item_text = item.get_text(' ', strip=True)
            dates = extract_dates(title + ' ' + item_text)

            # 获取详情页
            detail_html = fetch_page(detail_url) if detail_url else None
            detail_text = ''
            if detail_html:
                detail_soup = BeautifulSoup(detail_html, 'lxml')
                detail_text = detail_soup.get_text(' ', strip=True)

            all_text = title + ' ' + item_text + ' ' + detail_text

            # 提取完整日期
            all_dates = extract_dates(all_text)
            all_dates.sort()

            start_date = all_dates[0] if all_dates else ''
            end_date = all_dates[-1] if len(all_dates) > 1 else all_dates[0] if all_dates else ''

            # 提取报名截止日期
            deadline_dates = re.findall(r'(?:截止|报名截止|报名时间).*?(\d{4}-\d{2}-\d{2})', all_text)
            deadline = deadline_dates[0] if deadline_dates else (end_date or start_date)

            # 提取报名链接
            reg_url = ''
            if detail_html:
                reg_links = BeautifulSoup(detail_html, 'lxml').select(
                    'a[href*="zhaopin"], a[href*="cct"], a[href*="register"], a[href*="报名"]'
                )
                for rl in reg_links:
                    rl_href = rl.get('href', '')
                    if rl_href and 'http' in rl_href:
                        reg_url = rl_href
                        break
            if not reg_url:
                reg_url = detail_url

            # 提取地点/平台
            location = ''
            platform = ''
            loc_match = re.search(r'(?:地点|地址|举办地点)[：:]\s*(.+?)(?:\s|$)', all_text)
            if loc_match:
                location = loc_match.group(1).strip()[:100]
            plat_match = re.search(r'(?:平台|线上平台)[：:]\s*(.+?)(?:\s|$)', all_text)
            if plat_match:
                platform = plat_match.group(1).strip()[:50]

            # 类型和状态
            atype = map_activity_type(title)
            fmt = map_format(title, location)
            status, reg_status = map_status(start_date, end_date or deadline)

            # 提取覆盖高校
            uni_matches = re.findall(r'(中山大学|华南理工大学|暨南大学|华南师范大学|广东工业大学|深圳大学|华南农业大学|广东外语外贸大学|广州大学|南方科技大学|汕头大学|广东财经大学|广东海洋大学|南方医科大学|广州中医药大学)', all_text)
            universities = list(set(uni_matches)) if uni_matches else [source['name']]

            # 提取届数
            years = []
            year_matches = re.findall(r'(\d{4})届', all_text)
            for y in year_matches:
                years.append(f'{y}届')
            if not years:
                current = datetime.now().year
                years = [f'{current}届']

            # 生成唯一ID
            uid = hashlib.md5((source['name'] + title).encode()).hexdigest()[:12]

            activity = {
                'id': f'scraped-{uid}',
                'title': title[:200],
                'targetAudience': 'regional' if len(universities) > 3 else 'university',
                'region': source['region'],
                'universities': list(set(universities)),
                'graduateYears': years,
                'activityType': atype,
                'format': fmt,
                'platform': platform if fmt in ('online', 'hybrid') else None,
                'location': location if fmt in ('offline', 'hybrid') else None,
                'status': status,
                'registrationStatus': reg_status,
                'activityStartDate': start_date,
                'activityEndDate': end_date or start_date,
                'registrationDeadline': deadline,
                'enterpriseRegUrl': reg_url,
                'enterpriseRegMethod': '线上报名',
                'sourceLinks': [
                    {'title': f'{source["name"]}就业网-详情', 'url': detail_url},
                ],
                'isVerified': True,
                'createdAt': datetime.now().strftime('%Y-%m-%d'),
            }
            activities.append(activity)
            print(f'  ✅ {title[:60]}...')

        except Exception as e:
            print(f'  ⚠️ 解析失败: {e}')
            continue

    return activities


def main():
    print('=' * 60)
    print(f'🔍 校招瞭望台 - 爬虫启动 {datetime.now().strftime("%Y-%m-%d %H:%M")}')
    print('=' * 60)

    all_activities = []

    for source in SOURCES:
        try:
            acts = scrape_source(source)
            all_activities.extend(acts)
            time.sleep(REQUEST_DELAY)
        except Exception as e:
            print(f'  ❌ {source["name"]} 爬取失败: {e}')

    # 去重（按标题相似度）
    seen_titles = set()
    unique = []
    for a in all_activities:
        key = a['title'][:30]
        if key not in seen_titles:
            seen_titles.add(key)
            unique.append(a)

    # 按日期排序
    unique.sort(key=lambda a: a.get('activityStartDate', ''))

    print(f'\n📊 共爬取 {len(unique)} 条有效活动 (原始 {len(all_activities)} 条)')

    # 如果爬取数据太少，保留原有数据
    if len(unique) < 5:
        print('⚠️ 爬取数据不足，保留现有数据')
        return

    # 输出到 data.json
    output_path = 'data.json'
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(unique, f, ensure_ascii=False, indent=2)

    print(f'💾 已保存到 {output_path}')
    print(f'🏁 爬虫完成！')


if __name__ == '__main__':
    main()
