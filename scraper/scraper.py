"""
校招瞭望台 - 爬虫 v2
从 urls.txt 读取高校就业网详情页链接 → 自动提取信息 → 输出 data.json
用法：python scraper/scraper.py  或 双击 run.bat
"""
import requests, json, re, time, hashlib, sys, io, os
from datetime import datetime
from bs4 import BeautifulSoup

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'
}

# 高校域名 → 中文名称
UNI_NAMES = {
    'scdc.jnu.edu.cn': '暨南大学', 'career.sysu.edu.cn': '中山大学',
    'career.scut.edu.cn': '华南理工大学', 'career.scnu.edu.cn': '华南师范大学',
    'career.gdut.edu.cn': '广东工业大学', 'career.szu.edu.cn': '深圳大学',
    'jyzx.scau.edu.cn': '华南农业大学', 'career.gdufs.edu.cn': '广东外语外贸大学',
}

# 中国高校全称列表（用于从页面文本匹配覆盖高校）
ALL_UNIS = [
    '中山大学','华南理工大学','暨南大学','华南师范大学','广东工业大学',
    '深圳大学','华南农业大学','广东外语外贸大学','广州大学','南方科技大学',
    '汕头大学','广东财经大学','广东海洋大学','南方医科大学','广州中医药大学',
    '广州美术学院','广东医科大学','东莞理工学院','佛山科学技术学院',
    '深圳技术大学','北京理工大学珠海学院','清华大学','北京大学','浙江大学',
    '复旦大学','上海交通大学','武汉大学','华中科技大学','广西大学',
    '中南大学','湖南大学','四川大学','重庆大学','电子科技大学','西南交通大学',
]

def fetch(url):
    for i in range(3):
        try:
            r = requests.get(url, headers=HEADERS, timeout=15)
            r.encoding = r.apparent_encoding or 'utf-8'
            return r.text
        except Exception as e:
            if i == 2: print(f'  [失败] {e}')
            else: time.sleep(2)

def extract(html, source_url):
    """从详情页HTML中提取招聘活动信息"""
    soup = BeautifulSoup(html, 'lxml')
    text = soup.get_text(' ', strip=True)
    text_oneline = text.replace('\n', ' ')

    # 1. 标题
    title = ''
    for tag in soup.select('h1, h2, h3, .title, .bt, .view-title, .news-title'):
        t = tag.get_text(strip=True)
        if len(t) > len(title) and len(t) > 5:
            title = t
    if not title:
        m = re.search(r'<title>([^<\-\|]+)', html)
        if m: title = m.group(1).strip()

    # 2. 日期
    dates = re.findall(r'(\d{4}[-/]\d{2}[-/]\d{2})', text)
    dates = sorted(set(d.replace('/', '-') for d in dates))
    start_date = dates[0] if dates else ''
    end_date = dates[-1] if len(dates) > 1 else (dates[0] if dates else '')

    # 3. 报名截止
    deadline = ''
    dl_m = re.search(r'(?:报名截止|截止时间|截止日期|报名时间|报名日期)[：:]*\s*(\d{4}[-/]\d{2}[-/]\d{2})', text)
    if dl_m:
        deadline = dl_m.group(1).replace('/', '-')
    else:
        # 取最后一个合理日期
        future_dates = [d for d in dates if d >= datetime.now().strftime('%Y-%m-%d')]
        deadline = future_dates[-1] if future_dates else (end_date or start_date)

    # 4. 地点/平台
    location = ''
    platform = ''
    loc_m = re.search(r'(?:地点|地址|举办地点|场地|地点)[：:]\s*(.+?)(?:\s{2,}|[；;]|$)', text)
    if loc_m: location = loc_m.group(1).strip()[:100]
    plat_m = re.search(r'(?:平台|线上平台|承办平台)[：:]\s*(.+?)(?:\s{2,}|[；;]|$)', text)
    if plat_m: platform = plat_m.group(1).strip()[:50]
    if not platform and ('空中' in title or '线上' in title or '网络' in title):
        if '智联' in text: platform = '智联招聘'

    # 5. 活动类型
    # 优先用标题判断
    title_text = title + ' ' + text_oneline[:300]
    atype = '线下双选会'
    if any(kw in title_text for kw in ['空中双选','线上双选','网络双选','空中招聘']): atype = '空中双选会'
    elif any(kw in title_text for kw in ['供需见面']): atype = '供需见面会'
    elif any(kw in title_text for kw in ['网络招聘','线上招聘会']): atype = '网络招聘会'
    elif any(kw in title_text for kw in ['实习专招','实习招聘','实习生']): atype = '实习专招会'
    elif any(kw in title_text for kw in ['宣讲会','宣讲']): atype = '宣讲会'
    elif any(kw in title_text for kw in ['双选会','招聘会']): atype = '线下双选会'

    # 6. 形式
    fmt = 'offline'
    has_online = bool(re.search(r'线上|空中|网络|在线', title+text_oneline[:500]))
    has_offline = bool(re.search(r'线下|现场|地点：|地址：|体育馆|教室|架空层|报告厅', text_oneline[:500]))
    if has_online and has_offline: fmt = 'hybrid'
    elif has_online: fmt = 'online'

    # 7. 覆盖高校
    unis = []
    for uni in ALL_UNIS:
        if uni in text_oneline:
            unis.append(uni)
    # 从URL判断主办高校
    source_uni = None
    for domain, name in UNI_NAMES.items():
        if domain in source_url: source_uni = name; break
    if source_uni and source_uni not in unis:
        unis.insert(0, source_uni)

    # 8. 届数
    years = []
    for m in re.finditer(r'(\d{4})届', text_oneline):
        y = m.group(0)
        if y not in years: years.append(y)
    if not years:
        y = datetime.now().year
        years.append(f'{y}届')

    # 9. 报名链接（页面中的外部链接）
    reg_url = ''
    for a in soup.select('a[href]'):
        href = a.get('href', '')
        if any(kw in href for kw in ['zhaopin.com', 'cct.', 'register', '报名', 'biyejob', 'cnxincai']):
            if href.startswith('http'):
                reg_url = href; break
    if not reg_url:
        for a in soup.select('a[href]'):
            href = a.get('href', '')
            if href.startswith('http') and 'career.' not in href and 'edu.cn' not in href:
                txt = a.get_text(strip=True)
                if any(kw in txt for kw in ['报名', '链接', '入口', '点击']):
                    reg_url = href; break
    if not reg_url:
        reg_url = source_url

    # 10. 生成ID
    uid = hashlib.md5((source_url + title).encode()).hexdigest()[:12]

    # 11. 状态判断
    today = datetime.now().strftime('%Y-%m-%d')
    status = 'preview'
    reg_status = 'open'
    if end_date and end_date < today:
        status, reg_status = 'ended', 'closed'
    elif start_date and start_date <= today:
        status = 'ongoing'

    return {
        'id': f'auto-{uid}',
        'title': title[:200],
        'targetAudience': 'regional' if len(unis) > 3 else 'university',
        'region': ['广东'],
        'universities': list(set(unis)),
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
        'sourceLinks': [{'title': f'{source_uni or "高校"}就业网-详情', 'url': source_url}],
        'isVerified': True,
        'createdAt': datetime.now().strftime('%Y-%m-%d'),
    }


def load_urls(path):
    urls = []
    if not os.path.exists(path):
        print(f'[警告] {path} 不存在，请创建该文件并添加URL')
        return urls
    with open(path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and line.startswith('http'):
                urls.append(line)
    return urls


def main():
    print('=' * 60)
    print(f'[校招瞭望台] 爬虫 v2 启动 {datetime.now().strftime("%Y-%m-%d %H:%M")}')
    print('=' * 60)

    # 读取URL列表
    urls = load_urls('urls.txt')
    print(f'\n共 {len(urls)} 个待抓取链接\n')

    if not urls:
        return

    activities = []
    for i, url in enumerate(urls, 1):
        uni_name = '未知'
        for domain, name in UNI_NAMES.items():
            if domain in url: uni_name = name; break
        print(f'[{i}/{len(urls)}] {uni_name}')

        html = fetch(url)
        if not html: continue

        try:
            act = extract(html, url)
            # 过滤无效页面（需登录、空白页等）
            if len(act['title']) < 8 or '请选择' in act['title'] or '登录' in act['title']:
                print(f'  [跳过] 页面可能需要登录或无效: {act["title"][:50]}')
                continue
            activities.append(act)
            print(f'  [OK] {act["title"][:70]}')
            print(f'       日期:{act["activityStartDate"]}~{act["activityEndDate"]} 类型:{act["activityType"]} 截止:{act["registrationDeadline"]}')
        except Exception as e:
            print(f'  [错误] {e}')

        time.sleep(1.5)  # 礼貌延迟

    # 去重
    seen = set()
    unique = []
    for a in activities:
        key = a['title'][:40]
        if key not in seen:
            seen.add(key)
            unique.append(a)

    print(f'\n[统计] 成功 {len(unique)} 条 (原始 {len(activities)} 条)')

    # 如果抓取成功，保存
    if unique:
        with open('data.json', 'w', encoding='utf-8') as f:
            json.dump(unique, f, ensure_ascii=False, indent=2)
        print(f'[保存] data.json ({len(unique)} 条活动)')
    else:
        print('[警告] 未抓取到有效数据')

    print('[完成]')


if __name__ == '__main__':
    main()
