// 抖音解析 Worker - 完整版（含 CORS）
const pattern = /"video":{"play_addr":{"uri":"([a-z0-9]+)"/;
const cVUrl = "https://www.iesdouyin.com/aweme/v1/play/?video_id=%s&ratio=1080p&line=0";
const statsRegex = /"statistics"\s*:\s*\{([\s\S]*?)\},/;
const regex = /"nickname":\s*"([^"]+)",\s*"signature":\s*"([^"]+)"/;
const ctRegex = /"create_time":\s*(\d+)/;
const descRegex = /"desc":\s*"([^"]+)"/;

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

async function doGet(url) {
  const headers = new Headers();
  headers.set(
    "User-Agent",
    "Mozilla/5.0 (Linux; Android 11; SAMSUNG SM-G973U) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/14.2 Chrome/87.0.4280.141 Mobile Safari/537.36"
  );
  const resp = await fetch(url, { method: "GET", headers, redirect: 'follow' });
  return resp;
}

async function parseImgList(body) {
  const content = body.replace(/\\u002F/g, "/").replace(/\//g, "/");
  const reg = /{"uri":"[^\s"]+","url_list":\["(https:\/\/p\d{1,2}-sign.douyinpic.com\/.*?)"/g;
  const urlRet = /"uri":"([^\s"]+)","url_list":/g;
  let imgMatch;
  const firstUrls = [];
  while ((imgMatch = reg.exec(content)) !== null) {
    firstUrls.push(imgMatch[1]);
  }
  let urlMatch;
  const urlList = [];
  while ((urlMatch = urlRet.exec(content)) !== null) {
    urlList.push(urlMatch[1]);
  }
  const urlSet = new Set(urlList);
  const rList = [];
  for (let urlSetKey of urlSet) {
    let t = firstUrls.find((item) => item.includes(urlSetKey));
    if (t) rList.push(t);
  }
  return rList.filter((u) => !u.includes("/obj/"));
}

async function getVideoInfo(inputUrl) {
  let type = "video";
  let img_list = [];
  let video_url = "";
  const resp = await doGet(inputUrl);
  const body = await resp.text();
  const match = pattern.exec(body);
  if (!match || !match[1]) type = "img";
  if (type == "video") {
    video_url = cVUrl.replace("%s", match[1]);
  } else {
    img_list = await parseImgList(body);
  }
  const auMatch = body.match(regex);
  const ctMatch = body.match(ctRegex);
  const descMatch = body.match(descRegex);
  const statsMatch = body.match(statsRegex);
  if (statsMatch) {
    const innerContent = statsMatch[0];
    const awemeIdMatch = innerContent.match(/"aweme_id"\s*:\s*"([^"]+)"/);
    const commentCountMatch = innerContent.match(/"comment_count"\s*:\s*(\d+)/);
    const diggCountMatch = innerContent.match(/"digg_count"\s*:\s*(\d+)/);
    const playCountMatch = innerContent.match(/"play_count"\s*:\s*(\d+)/);
    const shareCountMatch = innerContent.match(/"share_count"\s*:\s*(\d+)/);
    const collectCountMatch = innerContent.match(/"collect_count"\s*:\s*(\d+)/);
    const info = {
      aweme_id: awemeIdMatch ? awemeIdMatch[1] : null,
      comment_count: commentCountMatch ? parseInt(commentCountMatch[1]) : null,
      digg_count: diggCountMatch ? parseInt(diggCountMatch[1]) : null,
      share_count: shareCountMatch ? parseInt(shareCountMatch[1]) : null,
      collect_count: collectCountMatch ? parseInt(collectCountMatch[1]) : null,
      play_count: playCountMatch ? parseInt(playCountMatch[1]) : null,
      nickname: auMatch ? auMatch[1] : null,
      signature: auMatch ? auMatch[2] : null,
      desc: descMatch ? descMatch[1] : null,
      create_time: ctMatch ? formatDate(new Date(parseInt(ctMatch[1]) * 1e3)) : null,
      video_url,
      type,
      image_url_list: img_list
    };
    return info;
  } else {
    throw new Error("No stats found");
  }
}

async function getVideoId(inputUrl) {
  const resp = await doGet(inputUrl);
  const body = await resp.text();
  const match = pattern.exec(body);
  if (!match || !match[1]) throw new Error("Video ID not found");
  return match[1];
}

async function getVideoUrl(inputUrl) {
  const id = await getVideoId(inputUrl);
  return cVUrl.replace("%s", id);
}

// 代理视频流
async function proxyVideo(request, targetUrl) {
  const range = request.headers.get('range');
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 11; SAMSUNG SM-G973U) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/14.2 Chrome/87.0.4280.141 Mobile Safari/537.36',
    'Referer': 'https://www.douyin.com/',
  };
  if (range) headers['Range'] = range;

  const resp = await fetch(targetUrl, { headers, redirect: 'follow' });

  const newHeaders = new Headers();
  ['content-type', 'content-length', 'content-range', 'accept-ranges', 'etag'].forEach(h => {
    if (resp.headers.get(h)) newHeaders.set(h, resp.headers.get(h));
  });
  newHeaders.set('content-disposition', 'inline; filename="video.mp4"');
  newHeaders.set('access-control-allow-origin', '*');

  return new Response(resp.body, {
    status: resp.status,
    headers: newHeaders
  });
}

// CORS 响应头
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Range'
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // CORS 预检请求
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    // 视频代理路由
    if (pathname === '/proxy') {
      const targetUrl = url.searchParams.get('url');
      if (!targetUrl) {
        return new Response('Missing url param', { 
          status: 400,
          headers: corsHeaders
        });
      }
      return proxyVideo(request, targetUrl);
    }

    // API 路由
    if (pathname === '/' || pathname === '') {
      const inputUrl = url.searchParams.get('url');
      if (!inputUrl) {
        return new Response('请提供url参数', { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8' }
        });
      }

      try {
        if (url.searchParams.has('data')) {
          const videoInfo = await getVideoInfo(inputUrl);
          return new Response(JSON.stringify(videoInfo), { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
          });
        } else {
          const videoUrl = await getVideoUrl(inputUrl);
          return new Response(videoUrl, { 
            headers: { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8' }
          });
        }
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
        });
      }
    }

    return new Response('Not Found', { 
      status: 404,
      headers: corsHeaders
    });
  }
};